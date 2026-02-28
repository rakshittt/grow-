/**
 * Apify API client for the Meta Ad Library scraper.
 * We outsource scraping entirely to Apify to avoid Meta's anti-bot detection.
 * Actor: apify/facebook-ads-scraper (or equivalent)
 */

const APIFY_BASE = 'https://api.apify.com/v2'

export interface ApifyRunInput {
  /** Facebook page URL or search query */
  startUrls?: Array<{ url: string }>
  searchTerms?: string[]
  country: string
  adType: 'ALL' | 'IMAGE' | 'VIDEO' | 'CAROUSEL'
  limit: number
}

export interface ApifyRunStatus {
  id: string
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTING' | 'ABORTED' | 'TIMING-OUT' | 'TIMED-OUT'
  startedAt: string
  finishedAt?: string
  defaultDatasetId: string
}

export interface ScrapedAd {
  adId: string
  pageId: string
  pageName: string
  adTitle?: string
  adBody?: string
  adUrl?: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'UNKNOWN'
  thumbnailUrl?: string
  startDate: string          // ISO string — when the ad started running
  endDate?: string           // null = still active
  activeDays: number         // computed longevity
  countries: string[]
  estimatedImpressions?: string
  spendRange?: string
  platforms: string[]        // ['facebook', 'instagram']
}

/**
 * Trigger an Apify run for the Meta Ad Library scraper.
 * Returns the run ID immediately — use pollRunStatus to wait for completion.
 */
export async function triggerApifyRun(input: ApifyRunInput): Promise<string> {
  const actorId = process.env.APIFY_ACTOR_ID ?? 'apify/facebook-ads-scraper'
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Apify run trigger failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.data.id as string
}

/**
 * Poll the status of an Apify run.
 */
export async function pollRunStatus(runId: string): Promise<ApifyRunStatus> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${process.env.APIFY_API_TOKEN}` },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Apify status poll failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.data as ApifyRunStatus
}

/**
 * Fetch the scraped ads from a completed run's dataset.
 * Filters to only ads meeting the minimum longevity threshold.
 */
export async function fetchRunResults(
  datasetId: string,
  minLongevityDays: number
): Promise<ScrapedAd[]> {
  const url = new URL(`${APIFY_BASE}/datasets/${datasetId}/items`)
  url.searchParams.set('limit', '200')
  url.searchParams.set('fields', 'adId,pageId,pageName,adTitle,adBody,adUrl,mediaType,thumbnailUrl,startDate,endDate,activeDays,countries,estimatedImpressions,spendRange,platforms')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.APIFY_API_TOKEN}` },
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Apify dataset fetch failed: ${JSON.stringify(err)}`)
  }

  const items: ScrapedAd[] = await res.json()

  // Filter and sort by longevity descending
  return items
    .filter(ad => ad.activeDays >= minLongevityDays)
    .sort((a, b) => b.activeDays - a.activeDays)
}

/**
 * Send a Slack notification with a spy report.
 */
export async function sendSlackReport(
  webhookUrl: string,
  report: {
    trackerName: string
    competitorName: string
    topAdsCount: number
    longestRunningDays: number
    topFormat: string
    insights: string
    reportUrl?: string
  }
): Promise<void> {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🔍 Spy Report: ${report.competitorName}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Tracker:*\n${report.trackerName}` },
        { type: 'mrkdwn', text: `*Top Ads Found:*\n${report.topAdsCount}` },
        { type: 'mrkdwn', text: `*Longest-Running Ad:*\n${report.longestRunningDays} days` },
        { type: 'mrkdwn', text: `*Dominant Format:*\n${report.topFormat}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*AI Insight:*\n${report.insights}` },
    },
  ]

  if (report.reportUrl) {
    blocks.push({
      type: 'section',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text: { type: 'mrkdwn', text: `<${report.reportUrl}|View full report →>` } as any,
    })
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!res.ok) {
    throw new Error(`Slack notification failed: ${res.status}`)
  }
}
