import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq, and } from 'drizzle-orm'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ArrowLeft,
  Eye,
  Globe,
  Clock,
  BarChart3,
  Lightbulb,
  FlaskConical,
  Star,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import { db, spyTrackersTable } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TopAd {
  ad_id:        string
  page_name:    string
  media_type:   string
  active_days:  number
  why_it_works: string
  hook_pattern: string
  cta_pattern:  string
}

interface ReportSummary {
  top_ads_count:      number
  avg_longevity_days: number
  top_format:         string
  insights:           string
  recommended_tests:  string[]
  confidence:         number
  generated_at:       string
  top_ads:            TopAd[]
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function SpyReportPage({ params }: Props) {
  const { id } = await params

  const session = await auth()
  if (!session?.user) redirect('/login')

  const tracker = await db.query.spyTrackersTable.findFirst({
    where: and(
      eq(spyTrackersTable.id, id),
      eq(spyTrackersTable.agency_id, session.user.agencyId),
    ),
  })

  if (!tracker) notFound()

  const report = tracker.last_report_summary as ReportSummary | null

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
          <Link href="/spy"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold">{tracker.name}</h2>
            <Badge variant={tracker.status === 'active' ? 'outline' : 'secondary'} className="text-xs">
              {tracker.status === 'active' ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                </span>
              ) : tracker.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Tracking: <strong className="text-foreground">{tracker.competitor_name}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {tracker.country_code}
            </span>
            {tracker.last_run_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Last scan: {formatDistanceToNow(new Date(tracker.last_run_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* No report yet */}
      {!report ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-purple-50 mb-4">
              <Eye className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-sm font-medium">No report yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Trigger a scan from the Spy page to generate the first intelligence report.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/spy">Go to Spy page</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<BarChart3 className="w-4 h-4 text-purple-600" />} label="Top Ads Found"   value={String(report.top_ads_count)} />
            <StatCard icon={<Clock      className="w-4 h-4 text-blue-600"   />} label="Avg Longevity"  value={`${report.avg_longevity_days}d`} />
            <StatCard icon={<TrendingUp className="w-4 h-4 text-green-600"  />} label="Top Format"    value={report.top_format ?? '—'} />
            <StatCard icon={<ShieldCheck className="w-4 h-4 text-amber-600" />} label="Confidence"    value={`${Math.round((report.confidence ?? 0) * 100)}%`} />
          </div>

          {/* Key insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Key Insights
              </CardTitle>
              {report.generated_at && (
                <CardDescription>
                  Generated {format(new Date(report.generated_at), 'MMM d, yyyy HH:mm')}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{report.insights}</p>
            </CardContent>
          </Card>

          {/* Top performing ads */}
          {report.top_ads && report.top_ads.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Top Performing Ads
                </CardTitle>
                <CardDescription>
                  Sorted by longevity — longer-running ads are market-proven creatives.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {report.top_ads.map((ad, i) => (
                  <div key={ad.ad_id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{ad.page_name}</p>
                          <p className="text-xs text-muted-foreground">{ad.media_type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 font-mono">
                        {ad.active_days}d running
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{ad.why_it_works}</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-background border px-3 py-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Hook Pattern</p>
                        <p className="text-xs">{ad.hook_pattern}</p>
                      </div>
                      <div className="rounded-md bg-background border px-3 py-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">CTA Pattern</p>
                        <p className="text-xs">{ad.cta_pattern}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommended tests */}
          {report.recommended_tests && report.recommended_tests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-blue-500" />
                  Recommended Tests
                </CardTitle>
                <CardDescription>
                  Specific creative experiments to run based on this analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="space-y-2">
                  {report.recommended_tests.map((test, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="flex-none w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{test}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </Card>
  )
}
