/**
 * Meta Marketing API client wrapper.
 * Wraps the official Graph API (v25.0).
 * All write operations are gated behind HITL approval — this module only
 * executes them; the decision to call is made elsewhere.
 */

const META_API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION ?? 'v25.0'}`

export interface MetaCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  daily_budget: number    // in account currency cents
  lifetime_budget: number
  objective: string
  insights?: MetaInsights
}

export interface MetaAdSet {
  id: string
  name: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  daily_budget: number
  bid_amount: number | null
  targeting: Record<string, unknown>
  insights?: MetaInsights
}

export interface MetaAd {
  id: string
  name: string
  adset_id: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  creative: { id: string; thumbnail_url?: string }
  insights?: MetaInsights
}

export interface MetaInsights {
  spend: number
  impressions: number
  clicks: number
  purchases: number
  purchase_roas: number
  frequency: number
  cpm: number
  cpc: number
  date_start: string
  date_stop: string
}

// ─── Read Operations ──────────────────────────────────────────────────────────

/**
 * Fetch campaigns for an ad account with their 7-day insights.
 * Uses batch API to minimize round-trips.
 */
export async function fetchCampaigns(
  adAccountId: string,
  accessToken: string,
  attributionWindow: string = '7d_click'
): Promise<MetaCampaign[]> {
  const fields = [
    'id', 'name', 'status', 'daily_budget', 'lifetime_budget', 'objective',
    `insights.date_preset(last_7d){spend,impressions,clicks,purchase_roas,frequency,cpm,cpc}`,
  ].join(',')

  const url = new URL(`${META_API_BASE}/${adAccountId}/campaigns`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta API error fetching campaigns: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return (data.data ?? []).map(normalizeCampaign)
}

/**
 * Fetch ads within a campaign with performance data.
 */
export async function fetchAds(
  campaignId: string,
  accessToken: string
): Promise<MetaAd[]> {
  const fields = [
    'id', 'name', 'adset_id', 'status', 'creative{id,thumbnail_url}',
    'insights.date_preset(last_7d){spend,impressions,purchase_roas,frequency,cpm}',
  ].join(',')

  const url = new URL(`${META_API_BASE}/${campaignId}/ads`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta API error fetching ads: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.data ?? []
}

// ─── Write Operations (only called after HITL approval) ──────────────────────

/**
 * Update a campaign's daily budget.
 * MUST only be called after action_log.status === 'approved'.
 */
export async function updateCampaignBudget(
  campaignId: string,
  dailyBudgetCents: number,
  accessToken: string
): Promise<{ success: boolean; id: string }> {
  const url = `${META_API_BASE}/${campaignId}`

  const body = new URLSearchParams({
    daily_budget: String(dailyBudgetCents),
    access_token: accessToken,
  })

  const res = await fetch(url, { method: 'POST', body })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta API error updating budget: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return { success: true, id: data.id }
}

/**
 * Pause or resume an ad.
 * MUST only be called after action_log.status === 'approved'.
 */
export async function setAdStatus(
  adId: string,
  status: 'ACTIVE' | 'PAUSED',
  accessToken: string
): Promise<{ success: boolean; id: string }> {
  const url = `${META_API_BASE}/${adId}`

  const body = new URLSearchParams({
    status,
    access_token: accessToken,
  })

  const res = await fetch(url, { method: 'POST', body })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta API error setting ad status: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return { success: true, id: data.id }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalizeCampaign(raw: Record<string, unknown>): MetaCampaign {
  const insights = (raw.insights as { data?: unknown[] } | undefined)?.data?.[0] as Record<string, unknown> | undefined
  return {
    id: raw.id as string,
    name: raw.name as string,
    status: raw.status as MetaCampaign['status'],
    daily_budget: Number(raw.daily_budget ?? 0),
    lifetime_budget: Number(raw.lifetime_budget ?? 0),
    objective: raw.objective as string,
    insights: insights ? {
      spend: Number(insights.spend ?? 0),
      impressions: Number(insights.impressions ?? 0),
      clicks: Number(insights.clicks ?? 0),
      purchases: Number(insights.purchases ?? 0),
      purchase_roas: Number((insights.purchase_roas as { value?: number }[])?.[0]?.value ?? 0),
      frequency: Number(insights.frequency ?? 0),
      cpm: Number(insights.cpm ?? 0),
      cpc: Number(insights.cpc ?? 0),
      date_start: insights.date_start as string,
      date_stop: insights.date_stop as string,
    } : undefined,
  }
}
