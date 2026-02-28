import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================
// Enums
// ============================================================
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'growth', 'scale'])
export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member'])
export const accountStatusEnum = pgEnum('account_status', ['active', 'expired', 'revoked'])
export const trackerStatusEnum = pgEnum('tracker_status', ['active', 'paused', 'archived'])
export const ruleScopeEnum = pgEnum('rule_scope', ['account', 'campaign', 'adset', 'ad'])
export const attributionWindowEnum = pgEnum('attribution_window', [
  '1d_click', '7d_click', '28d_click', '1d_view', '7d_view',
])
export const agentTypeEnum = pgEnum('agent_type', ['spy', 'optimizer'])
export const actionStatusEnum = pgEnum('action_status', [
  'pending_human_approval',
  'approved',
  'denied',
  'executing',
  'executed',
  'failed',
  'cancelled',
  'auto_approved',
])

// ============================================================
// Tables
// ============================================================

export const agenciesTable = pgTable('agencies', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  name:                  text('name').notNull(),
  slug:                  text('slug').notNull().unique(),
  plan:                  planTierEnum('plan').notNull().default('trial'),
  plan_meta_accounts:    integer('plan_meta_accounts').notNull().default(1),
  plan_spy_trackers:     integer('plan_spy_trackers').notNull().default(3),
  plan_spend_limit_usd:  numeric('plan_spend_limit_usd', { precision: 12, scale: 2 }).notNull().default('1000'),
  plan_seats:            integer('plan_seats').notNull().default(1),
  slack_webhook_url:     text('slack_webhook_url'),
  notification_email:    text('notification_email'),
  stripe_customer_id:    text('stripe_customer_id').unique(),
  stripe_subscription_id: text('stripe_subscription_id').unique(),
  trial_ends_at:         timestamp('trial_ends_at', { withTimezone: true }),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usersTable = pgTable('users', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  agency_id:             uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  email:                 text('email').notNull().unique(),
  password_hash:         text('password_hash'),         // null for OAuth users
  role:                  memberRoleEnum('role').notNull().default('member'),
  full_name:             text('full_name'),
  avatar_url:            text('avatar_url'),
  onboarding_step:       integer('onboarding_step').notNull().default(0),
  onboarding_completed:  boolean('onboarding_completed').notNull().default(false),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const agencyInvitationsTable = pgTable('agency_invitations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  agency_id:   uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  email:       text('email').notNull(),
  role:        memberRoleEnum('role').notNull().default('member'),
  token:       text('token').notNull().unique(),
  invited_by:  uuid('invited_by').references(() => usersTable.id, { onDelete: 'set null' }),
  accepted_at: timestamp('accepted_at', { withTimezone: true }),
  expires_at:  timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const metaAdAccountsTable = pgTable('meta_ad_accounts', {
  id:               uuid('id').primaryKey().defaultRandom(),
  agency_id:        uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  connected_by:     uuid('connected_by').references(() => usersTable.id, { onDelete: 'set null' }),
  ad_account_id:    text('ad_account_id').notNull(),
  ad_account_name:  text('ad_account_name').notNull(),
  business_id:      text('business_id'),
  business_name:    text('business_name'),
  currency:         text('currency').notNull().default('USD'),
  timezone:         text('timezone').notNull().default('America/New_York'),
  access_token:     text('access_token').notNull(),
  token_expires_at: timestamp('token_expires_at', { withTimezone: true }),
  refresh_token:    text('refresh_token'),
  granted_scopes:   text('granted_scopes').array().notNull().default([]),
  status:           accountStatusEnum('status').notNull().default('active'),
  last_synced_at:   timestamp('last_synced_at', { withTimezone: true }),
  created_at:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const spyTrackersTable = pgTable('spy_trackers', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  agency_id:             uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  created_by:            uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
  name:                  text('name').notNull(),
  competitor_name:       text('competitor_name').notNull(),
  competitor_page_url:   text('competitor_page_url'),
  competitor_page_id:    text('competitor_page_id'),
  country_code:          text('country_code').notNull().default('US'),
  search_terms:          text('search_terms').array().notNull().default([]),
  ad_types:              text('ad_types').array().notNull().default([]),
  min_longevity_days:    integer('min_longevity_days').notNull().default(3),
  max_results:           integer('max_results').notNull().default(50),
  schedule_cron:         text('schedule_cron').notNull().default('0 9 * * 1'),
  status:                trackerStatusEnum('status').notNull().default('active'),
  meta_ad_account_id:    uuid('meta_ad_account_id').references(() => metaAdAccountsTable.id, { onDelete: 'set null' }),
  last_run_at:           timestamp('last_run_at', { withTimezone: true }),
  next_run_at:           timestamp('next_run_at', { withTimezone: true }),
  apify_run_id:          text('apify_run_id'),
  last_report_summary:   jsonb('last_report_summary').$type<Record<string, unknown>>(),
  total_runs:            integer('total_runs').notNull().default(0),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const optimizerRulesTable = pgTable('optimizer_rules', {
  id:                          uuid('id').primaryKey().defaultRandom(),
  agency_id:                   uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  created_by:                  uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
  meta_ad_account_id:          uuid('meta_ad_account_id').references(() => metaAdAccountsTable.id, { onDelete: 'cascade' }),
  name:                        text('name').notNull(),
  description:                 text('description'),
  scope:                       ruleScopeEnum('scope').notNull().default('campaign'),
  campaign_ids:                text('campaign_ids').array().notNull().default([]),
  adset_ids:                   text('adset_ids').array().notNull().default([]),
  max_daily_budget_usd:        numeric('max_daily_budget_usd', { precision: 12, scale: 2 }),
  min_daily_budget_usd:        numeric('min_daily_budget_usd', { precision: 12, scale: 2 }),
  max_budget_increase_pct:     integer('max_budget_increase_pct').notNull().default(20),
  max_budget_decrease_pct:     integer('max_budget_decrease_pct').notNull().default(20),
  target_roas:                 numeric('target_roas', { precision: 6, scale: 2 }),
  min_roas_threshold:          numeric('min_roas_threshold', { precision: 6, scale: 2 }),
  attribution_window:          attributionWindowEnum('attribution_window').notNull().default('7d_click'),
  min_spend_before_action_usd: numeric('min_spend_before_action_usd', { precision: 12, scale: 2 }).notNull().default('50'),
  max_ad_frequency:            numeric('max_ad_frequency', { precision: 4, scale: 2 }),
  max_cpm_increase_pct:        integer('max_cpm_increase_pct').notNull().default(30),
  max_bid_cap_usd:             numeric('max_bid_cap_usd', { precision: 12, scale: 2 }),
  check_interval_minutes:      integer('check_interval_minutes').notNull().default(60),
  schedule_cron:               text('schedule_cron').notNull().default('0 * * * *'),
  require_approval:            boolean('require_approval').notNull().default(true),
  auto_approve_below_usd:      numeric('auto_approve_below_usd', { precision: 12, scale: 2 }).default('0'),
  status:                      trackerStatusEnum('status').notNull().default('active'),
  last_run_at:                 timestamp('last_run_at', { withTimezone: true }),
  next_run_at:                 timestamp('next_run_at', { withTimezone: true }),
  total_actions_taken:         integer('total_actions_taken').notNull().default(0),
  created_at:                  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:                  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const actionLogsTable = pgTable('action_logs', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  agency_id:             uuid('agency_id').notNull().references(() => agenciesTable.id, { onDelete: 'cascade' }),
  agent_type:            agentTypeEnum('agent_type').notNull(),
  action_type:           text('action_type').notNull(),
  meta_ad_account_id:    uuid('meta_ad_account_id').references(() => metaAdAccountsTable.id, { onDelete: 'set null' }),
  optimizer_rule_id:     uuid('optimizer_rule_id').references(() => optimizerRulesTable.id, { onDelete: 'set null' }),
  spy_tracker_id:        uuid('spy_tracker_id').references(() => spyTrackersTable.id, { onDelete: 'set null' }),
  target_entity_type:    text('target_entity_type'),
  target_entity_id:      text('target_entity_id'),
  target_entity_name:    text('target_entity_name'),
  current_value:         jsonb('current_value').$type<Record<string, unknown>>(),
  proposed_value:        jsonb('proposed_value').$type<Record<string, unknown>>(),
  reasoning:             text('reasoning'),
  confidence_score:      numeric('confidence_score', { precision: 4, scale: 3 }),
  status:                actionStatusEnum('status').notNull().default('pending_human_approval'),
  requires_approval:     boolean('requires_approval').notNull().default(true),
  approved_by:           uuid('approved_by').references(() => usersTable.id, { onDelete: 'set null' }),
  approved_at:           timestamp('approved_at', { withTimezone: true }),
  denied_by:             uuid('denied_by').references(() => usersTable.id, { onDelete: 'set null' }),
  denied_at:             timestamp('denied_at', { withTimezone: true }),
  denial_reason:         text('denial_reason'),
  executing_at:          timestamp('executing_at', { withTimezone: true }),
  executed_at:           timestamp('executed_at', { withTimezone: true }),
  execution_result:      jsonb('execution_result').$type<Record<string, unknown>>(),
  error_message:         text('error_message'),
  langgraph_thread_id:   text('langgraph_thread_id'),
  langgraph_checkpoint:  jsonb('langgraph_checkpoint').$type<Record<string, unknown>>(),
  created_at:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expires_at:            timestamp('expires_at', { withTimezone: true }),
})

// ============================================================
// Relations
// ============================================================
export const agenciesRelations = relations(agenciesTable, ({ many }) => ({
  users:              many(usersTable),
  metaAdAccounts:     many(metaAdAccountsTable),
  spyTrackers:        many(spyTrackersTable),
  optimizerRules:     many(optimizerRulesTable),
  actionLogs:         many(actionLogsTable),
  invitations:        many(agencyInvitationsTable),
}))

export const usersRelations = relations(usersTable, ({ one }) => ({
  agency: one(agenciesTable, { fields: [usersTable.agency_id], references: [agenciesTable.id] }),
}))

// ============================================================
// Inferred TypeScript types
// ============================================================
export type Agency          = typeof agenciesTable.$inferSelect
export type AgencyInsert    = typeof agenciesTable.$inferInsert
export type User            = typeof usersTable.$inferSelect
export type UserInsert      = typeof usersTable.$inferInsert
export type MetaAdAccount   = typeof metaAdAccountsTable.$inferSelect
export type SpyTracker      = typeof spyTrackersTable.$inferSelect
export type OptimizerRule   = typeof optimizerRulesTable.$inferSelect
export type ActionLog       = typeof actionLogsTable.$inferSelect
export type ActionLogInsert = typeof actionLogsTable.$inferInsert
export type ActionStatus    = (typeof actionStatusEnum.enumValues)[number]
