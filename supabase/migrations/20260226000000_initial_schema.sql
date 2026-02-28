-- ============================================================
-- MarketerAgents – Phase 1 Initial Schema
-- Migration: 20260226000000_initial_schema.sql
--
-- Multi-tenant architecture: every data row is scoped to an
-- agency_id. Row Level Security (RLS) enforces tenant isolation
-- at the database layer so no application bug can leak data.
--
-- Token storage note: access_token columns are stored encrypted
-- via Supabase Vault (pgsodium) in production. For local dev
-- they are plain text — never commit real tokens.
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type plan_tier as enum ('trial', 'starter', 'growth', 'scale');
create type member_role as enum ('owner', 'admin', 'member');
create type account_status as enum ('active', 'expired', 'revoked');
create type tracker_status as enum ('active', 'paused', 'archived');
create type rule_scope as enum ('account', 'campaign', 'adset', 'ad');
create type attribution_window as enum (
  '1d_click', '7d_click', '28d_click',
  '1d_view', '7d_view'
);
create type agent_type as enum ('spy', 'optimizer');

-- The heart of HITL: every agent action flows through these states.
create type action_status as enum (
  'pending_human_approval',  -- agent proposed, waiting for user
  'approved',                -- user clicked Approve; queued for execution
  'denied',                  -- user clicked Deny; no action taken
  'executing',               -- API call in progress
  'executed',                -- successfully applied to Meta
  'failed',                  -- execution error (see error_message)
  'cancelled',               -- approval window expired or manually cancelled
  'auto_approved'            -- below auto-approve threshold; no human needed
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- ------------------------------------------------------------
-- agencies
-- The top-level tenant unit. Every user belongs to one agency.
-- ------------------------------------------------------------
create table agencies (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  slug                  text not null unique,             -- URL-safe workspace identifier
  plan                  plan_tier not null default 'trial',
  -- Plan limits (denormalized for fast reads; enforced in app layer)
  plan_meta_accounts    integer not null default 1,       -- max connected Meta accounts
  plan_spy_trackers     integer not null default 3,       -- max active spy trackers
  plan_spend_limit_usd  numeric(12,2) not null default 1000,  -- max managed spend/mo
  plan_seats            integer not null default 1,       -- max team members
  -- Notifications
  slack_webhook_url     text,                             -- global agency-level Slack webhook
  notification_email    text,                             -- alert destination email
  -- Billing
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  trial_ends_at         timestamptz default (now() + interval '14 days'),
  -- Meta
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ------------------------------------------------------------
-- users  (extends auth.users; created automatically via trigger)
-- ------------------------------------------------------------
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  agency_id    uuid not null references agencies(id) on delete cascade,
  role         member_role not null default 'member',
  full_name    text,
  avatar_url   text,
  -- Onboarding state machine — drives the wizard UI
  onboarding_step        integer not null default 0,  -- 0=not started, 3=complete
  onboarding_completed   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- agency_invitations  (pending team member invites)
-- ------------------------------------------------------------
create table agency_invitations (
  id          uuid primary key default uuid_generate_v4(),
  agency_id   uuid not null references agencies(id) on delete cascade,
  email       text not null,
  role        member_role not null default 'member',
  token       text not null unique default left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 64),
  invited_by  uuid references users(id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now(),
  unique (agency_id, email)
);

-- ============================================================
-- META INTEGRATION
-- ============================================================

-- ------------------------------------------------------------
-- meta_ad_accounts
-- Stores OAuth tokens and Meta ad account metadata per tenant.
-- ⚠️  access_token is sensitive — encrypt via Supabase Vault
--     (pgsodium.create_key + vault.create_secret) in production.
-- ------------------------------------------------------------
create table meta_ad_accounts (
  id                 uuid primary key default uuid_generate_v4(),
  agency_id          uuid not null references agencies(id) on delete cascade,
  connected_by       uuid references users(id) on delete set null,
  -- Meta identifiers
  ad_account_id      text not null,         -- format: act_XXXXXXXXXX
  ad_account_name    text,
  business_id        text,
  business_name      text,
  currency           text default 'USD',
  timezone           text default 'America/New_York',
  -- Auth tokens (encrypt at rest in production)
  access_token       text not null,         -- user or system-user OAuth token
  token_expires_at   timestamptz,           -- null = non-expiring system user token
  refresh_token      text,
  -- Granted OAuth scopes (e.g. ["ads_read","ads_management"])
  granted_scopes     text[] not null default '{}',
  -- Account status
  status             account_status not null default 'active',
  -- Sync metadata
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (agency_id, ad_account_id)
);

-- ============================================================
-- SPY AGENT
-- ============================================================

-- ------------------------------------------------------------
-- spy_trackers
-- One row = one "watch this competitor" job.
-- ------------------------------------------------------------
create table spy_trackers (
  id                      uuid primary key default uuid_generate_v4(),
  agency_id               uuid not null references agencies(id) on delete cascade,
  created_by              uuid references users(id) on delete set null,
  -- Target
  name                    text not null,          -- user-friendly label, e.g. "Nike US"
  competitor_name         text not null,
  competitor_page_url     text,                   -- facebook.com/nike
  competitor_page_id      text,                   -- Meta Page ID (more reliable)
  -- Filter criteria sent to Apify
  country_code            text not null default 'US',
  search_terms            text[] default '{}',    -- optional keyword filters
  ad_types                text[] default array['IMAGE','VIDEO','CAROUSEL'],
  min_longevity_days      integer not null default 7,   -- only show ads active ≥ N days
  max_results             integer not null default 50,
  -- Schedule (cron format, UTC)
  schedule_cron           text not null default '0 6 * * *',  -- daily at 06:00 UTC
  status                  tracker_status not null default 'active',
  -- Link back to the optimizer for the closed learning loop
  meta_ad_account_id      uuid references meta_ad_accounts(id) on delete set null,
  -- Runtime state
  last_run_at             timestamptz,
  next_run_at             timestamptz,
  apify_run_id            text,                   -- last Apify run ID for status polling
  last_report_summary     jsonb,                  -- cached: {top_ads: [...], insights: "..."}
  total_runs              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- OPTIMIZER AGENT
-- ============================================================

-- ------------------------------------------------------------
-- optimizer_rules
-- Guardrails that govern what the optimizer is allowed to do.
-- The AI CANNOT breach max_daily_budget_usd under any circumstance.
-- ------------------------------------------------------------
create table optimizer_rules (
  id                          uuid primary key default uuid_generate_v4(),
  agency_id                   uuid not null references agencies(id) on delete cascade,
  created_by                  uuid references users(id) on delete set null,
  meta_ad_account_id          uuid not null references meta_ad_accounts(id) on delete cascade,
  -- Rule identity
  name                        text not null,      -- e.g. "Client X – Safety Rails"
  description                 text,
  scope                       rule_scope not null default 'account',
  -- Which Meta campaigns/adsets this rule covers (empty = all in account)
  campaign_ids                text[] default '{}',
  adset_ids                   text[] default '{}',
  -- ── Budget guardrails (absolute ceilings) ──────────────────
  max_daily_budget_usd        numeric(10,2),      -- HARD ceiling — AI can never exceed
  min_daily_budget_usd        numeric(10,2),      -- floor — AI can never drop below
  max_budget_increase_pct     numeric(5,2) default 20,   -- max single-step increase (%)
  max_budget_decrease_pct     numeric(5,2) default 30,   -- max single-step decrease (%)
  -- ── ROAS targets ───────────────────────────────────────────
  target_roas                 numeric(6,2),       -- desired ROAS (e.g. 3.0)
  min_roas_threshold          numeric(6,2),       -- pause ad below this (e.g. 1.5)
  -- ── Attribution window ─────────────────────────────────────
  attribution_window          attribution_window not null default '7d_click',
  -- Do not evaluate an ad until it has spent at least this amount.
  -- Prevents premature pausing of delayed-conversion ads.
  min_spend_before_action_usd numeric(10,2) default 50,
  -- ── Creative fatigue thresholds ────────────────────────────
  max_ad_frequency            numeric(5,2),       -- pause creative above this frequency
  max_cpm_increase_pct        numeric(5,2),       -- flag if CPM rises faster than this %
  -- ── Bid cap (standard campaigns) ───────────────────────────
  max_bid_cap_usd             numeric(10,2),
  -- ── Operational schedule ───────────────────────────────────
  check_interval_minutes      integer not null default 60,
  schedule_cron               text default '0 * * * *',   -- hourly
  -- ── Human-in-the-Loop settings ─────────────────────────────
  require_approval            boolean not null default true,   -- HITL default ON
  -- Auto-approve actions whose budget delta is below this threshold.
  -- Set to 0 to require approval for every action.
  auto_approve_below_usd      numeric(10,2) default 0,
  -- ── Status ─────────────────────────────────────────────────
  status                      tracker_status not null default 'active',
  last_run_at                 timestamptz,
  next_run_at                 timestamptz,
  total_actions_taken         integer not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ============================================================
-- AUDIT & HITL
-- ============================================================

-- ------------------------------------------------------------
-- action_logs
-- The single source of truth for everything the agents have
-- done or proposed. This drives the /approvals inbox UI.
-- LangGraph threads are paused here and resumed on approval.
-- ------------------------------------------------------------
create table action_logs (
  id                    uuid primary key default uuid_generate_v4(),
  agency_id             uuid not null references agencies(id) on delete cascade,
  -- Who/what initiated this action
  agent_type            agent_type not null,
  action_type           text not null,       -- e.g. 'INCREASE_BUDGET', 'PAUSE_AD', 'SPY_REPORT'
  -- Related records
  meta_ad_account_id    uuid references meta_ad_accounts(id) on delete set null,
  optimizer_rule_id     uuid references optimizer_rules(id) on delete set null,
  spy_tracker_id        uuid references spy_trackers(id) on delete set null,
  -- Target Meta entity
  target_entity_type    text,               -- 'campaign' | 'adset' | 'ad' | 'report'
  target_entity_id      text,               -- Meta's entity ID
  target_entity_name    text,
  -- State snapshots (before → after)
  current_value         jsonb,              -- e.g. {"daily_budget": 5000}
  proposed_value        jsonb,              -- e.g. {"daily_budget": 6000}
  -- AI reasoning (shown to user in approval UI)
  reasoning             text,               -- plain English: "3-day ROAS fell below 1.5 …"
  confidence_score      numeric(4,3),       -- 0.000 – 1.000
  -- Status lifecycle
  status                action_status not null default 'pending_human_approval',
  requires_approval     boolean not null default true,
  -- HITL approval
  approved_by           uuid references users(id) on delete set null,
  approved_at           timestamptz,
  denied_by             uuid references users(id) on delete set null,
  denied_at             timestamptz,
  denial_reason         text,
  -- Execution
  executing_at          timestamptz,
  executed_at           timestamptz,
  execution_result      jsonb,              -- Meta API response payload
  error_message         text,
  -- LangGraph resumption
  langgraph_thread_id   text,              -- used to resume paused workflow
  langgraph_checkpoint  jsonb,             -- serialised LangGraph state snapshot
  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Approval window: auto-cancel if not acted upon within 24h
  expires_at            timestamptz default (now() + interval '24 hours')
);

-- ============================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on any row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to all relevant tables
create trigger agencies_updated_at
  before update on agencies
  for each row execute procedure set_updated_at();

create trigger users_updated_at
  before update on users
  for each row execute procedure set_updated_at();

create trigger meta_ad_accounts_updated_at
  before update on meta_ad_accounts
  for each row execute procedure set_updated_at();

create trigger spy_trackers_updated_at
  before update on spy_trackers
  for each row execute procedure set_updated_at();

create trigger optimizer_rules_updated_at
  before update on optimizer_rules
  for each row execute procedure set_updated_at();

create trigger action_logs_updated_at
  before update on action_logs
  for each row execute procedure set_updated_at();

-- ─── New User → Auto-create Profile ─────────────────────────────────────────
-- When someone signs up via Supabase Auth, we need a corresponding row in
-- the public.users table. They start without an agency; the onboarding wizard
-- creates/joins one.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_agency_id uuid;
begin
  -- Extract desired agency name from metadata if provided (e.g. from signup form)
  -- If none, we create a placeholder agency named after the user's email domain.
  insert into agencies (name, slug, plan)
  values (
    coalesce(
      new.raw_user_meta_data->>'agency_name',
      split_part(new.email, '@', 2)  -- e.g. "acme.com"
    ),
    -- Slug: lowercase email domain, strip dots, append 6-char random suffix
    lower(replace(split_part(new.email, '@', 2), '.', '-'))
      || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    'trial'
  )
  returning id into new_agency_id;

  insert into users (id, agency_id, role, full_name, avatar_url)
  values (
    new.id,
    new_agency_id,
    'owner',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- INDEXES  (performance for common query patterns)
-- ============================================================

-- Tenant scoping — used on virtually every query
create index idx_users_agency_id               on users(agency_id);
create index idx_meta_ad_accounts_agency_id    on meta_ad_accounts(agency_id);
create index idx_spy_trackers_agency_id        on spy_trackers(agency_id);
create index idx_optimizer_rules_agency_id     on optimizer_rules(agency_id);
create index idx_action_logs_agency_id         on action_logs(agency_id);

-- Action logs — approvals inbox queries
create index idx_action_logs_status            on action_logs(status);
create index idx_action_logs_agent_type        on action_logs(agent_type);
create index idx_action_logs_created_at        on action_logs(created_at desc);
create index idx_action_logs_account           on action_logs(meta_ad_account_id);
create index idx_action_logs_pending           on action_logs(agency_id, status)
  where status = 'pending_human_approval';    -- partial index for inbox performance

-- LangGraph thread lookup
create index idx_action_logs_thread_id         on action_logs(langgraph_thread_id)
  where langgraph_thread_id is not null;

-- Tracker scheduling
create index idx_spy_trackers_next_run         on spy_trackers(next_run_at)
  where status = 'active';
create index idx_optimizer_rules_next_run      on optimizer_rules(next_run_at)
  where status = 'active';

-- Invitation lookup by token (used during invite acceptance)
create index idx_invitations_token             on agency_invitations(token);
create index idx_invitations_email             on agency_invitations(email);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Strategy: every SELECT/INSERT/UPDATE/DELETE checks that the
-- requesting auth.uid() belongs to the same agency as the row.
-- Owners and admins get write access; members get read-only.
-- ============================================================

alter table agencies           enable row level security;
alter table users              enable row level security;
alter table agency_invitations enable row level security;
alter table meta_ad_accounts   enable row level security;
alter table spy_trackers       enable row level security;
alter table optimizer_rules    enable row level security;
alter table action_logs        enable row level security;

-- ─── Helper: is the current user a member of a given agency? ────────────────
create or replace function is_agency_member(p_agency_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users
    where id = auth.uid()
    and agency_id = p_agency_id
  );
$$;

-- ─── Helper: is the current user an owner or admin of a given agency? ────────
create or replace function is_agency_admin(p_agency_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from users
    where id = auth.uid()
    and agency_id = p_agency_id
    and role in ('owner', 'admin')
  );
$$;

-- ─── agencies ────────────────────────────────────────────────────────────────
create policy "Members can view their own agency"
  on agencies for select
  using (is_agency_member(id));

create policy "Owners can update agency settings"
  on agencies for update
  using (is_agency_admin(id));

-- ─── users ───────────────────────────────────────────────────────────────────
create policy "Users can view members of their agency"
  on users for select
  using (is_agency_member(agency_id));

create policy "Users can update their own profile"
  on users for update
  using (auth.uid() = id);

create policy "Admins can update any member in their agency"
  on users for update
  using (is_agency_admin(agency_id));

create policy "Admins can remove members from their agency"
  on users for delete
  using (is_agency_admin(agency_id) and id <> auth.uid()); -- cannot remove self

-- ─── agency_invitations ──────────────────────────────────────────────────────
create policy "Admins can manage invitations"
  on agency_invitations for all
  using (is_agency_admin(agency_id));

create policy "Invited users can read their own invitation by token"
  on agency_invitations for select
  using (email = (select email from auth.users where id = auth.uid()));

-- ─── meta_ad_accounts ────────────────────────────────────────────────────────
create policy "Members can view ad accounts"
  on meta_ad_accounts for select
  using (is_agency_member(agency_id));

create policy "Admins can insert ad accounts"
  on meta_ad_accounts for insert
  with check (is_agency_admin(agency_id));

create policy "Admins can update ad accounts"
  on meta_ad_accounts for update
  using (is_agency_admin(agency_id));

create policy "Admins can delete ad accounts"
  on meta_ad_accounts for delete
  using (is_agency_admin(agency_id));

-- ─── spy_trackers ────────────────────────────────────────────────────────────
create policy "Members can view trackers"
  on spy_trackers for select
  using (is_agency_member(agency_id));

create policy "Admins can insert trackers"
  on spy_trackers for insert
  with check (is_agency_admin(agency_id));

create policy "Admins can update trackers"
  on spy_trackers for update
  using (is_agency_admin(agency_id));

create policy "Admins can delete trackers"
  on spy_trackers for delete
  using (is_agency_admin(agency_id));

-- ─── optimizer_rules ─────────────────────────────────────────────────────────
create policy "Members can view optimizer rules"
  on optimizer_rules for select
  using (is_agency_member(agency_id));

create policy "Admins can insert optimizer rules"
  on optimizer_rules for insert
  with check (is_agency_admin(agency_id));

create policy "Admins can update optimizer rules"
  on optimizer_rules for update
  using (is_agency_admin(agency_id));

create policy "Admins can delete optimizer rules"
  on optimizer_rules for delete
  using (is_agency_admin(agency_id));

-- ─── action_logs ─────────────────────────────────────────────────────────────
-- All members can read (transparency / audit trail).
-- Only the agent backend (service role) inserts.
-- Only admins can approve/deny (update status).
create policy "Members can view action logs"
  on action_logs for select
  using (is_agency_member(agency_id));

-- Approve/Deny updates only touch the approval fields
create policy "Admins can approve or deny actions"
  on action_logs for update
  using (
    is_agency_admin(agency_id)
    and status = 'pending_human_approval'
  )
  with check (
    status in ('approved', 'denied')
  );

-- Service role bypasses RLS entirely (used by agent API routes).
-- No explicit policy needed — service role is a superuser in Supabase.

-- ============================================================
-- SEED: Plan limits reference data
-- ============================================================
-- We store plan limits on the agency row for fast reads.
-- This comment documents the canonical values:
--
--  trial:   1 account, 3 trackers, $1k spend, 1 seat
--  starter: 1 account, 3 trackers, $10k spend, 1 seat
--  growth:  10 accounts, 15 trackers, $100k spend, 3 seats
--  scale:   999 accounts, 999 trackers, $1M spend, 999 seats
-- ============================================================
