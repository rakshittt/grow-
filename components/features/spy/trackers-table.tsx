'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Eye, Play, Pause, MoreHorizontal, RefreshCw, Globe, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateTrackerStatus, deleteTracker } from '@/actions/spy'
import type { SpyTracker } from '@/lib/db'

const STATUS_BADGE = {
  active:   <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Active</Badge>,
  paused:   <Badge variant="secondary">Paused</Badge>,
  archived: <Badge variant="outline" className="text-muted-foreground">Archived</Badge>,
}

interface TrackersTableProps {
  trackers: SpyTracker[]
}

function TrackerRow({ tracker }: { tracker: SpyTracker }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const summary = tracker.last_report_summary as { top_ads_count?: number; insights?: string } | null

  function handleToggle() {
    const newStatus = tracker.status === 'active' ? 'paused' : 'active'
    startTransition(async () => {
      const result = await updateTrackerStatus(tracker.id, newStatus)
      if (result.error) {
        toast.error('Failed to update tracker', { description: result.error })
      } else {
        toast.success(newStatus === 'active' ? 'Tracker resumed' : 'Tracker paused')
      }
    })
  }

  function handleRunScan() {
    startTransition(async () => {
      const res = await fetch('/api/agents/spy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracker_id: tracker.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error('Scan failed to start', { description: err.error ?? 'Unknown error' })
      } else {
        toast.success('Scan started', {
          description: 'The report will appear in your Approvals inbox when ready.',
        })
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete tracker "${tracker.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteTracker(tracker.id)
      if (result.error) {
        toast.error('Failed to delete tracker', { description: result.error })
      } else {
        toast.success('Tracker deleted')
      }
    })
  }

  return (
    <TableRow key={tracker.id} className={isPending ? 'opacity-60 pointer-events-none' : ''}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-medium text-sm">{tracker.name}</p>
            <p className="text-xs text-muted-foreground">{tracker.competitor_name}</p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          {tracker.country_code}
        </div>
      </TableCell>

      <TableCell>
        <span className="text-sm">{tracker.min_longevity_days}+ days</span>
      </TableCell>

      <TableCell>
        {tracker.last_run_at ? (
          <div>
            <p className="text-sm">
              {formatDistanceToNow(new Date(tracker.last_run_at), { addSuffix: true })}
            </p>
            <p className="text-xs text-muted-foreground">{tracker.total_runs} total runs</p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Never</span>
        )}
      </TableCell>

      <TableCell>{STATUS_BADGE[tracker.status]}</TableCell>

      <TableCell className="max-w-xs">
        {summary?.insights ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{summary.insights}</p>
        ) : (
          <span className="text-xs text-muted-foreground">No report yet</span>
        )}
      </TableCell>

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => router.push(`/spy/${tracker.id}`)} disabled={!tracker.last_run_at}>
              <FileText className="w-3.5 h-3.5" />
              View report
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={handleRunScan} disabled={tracker.status !== 'active'}>
              <RefreshCw className="w-3.5 h-3.5" />
              Run scan now
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={handleToggle}>
              {tracker.status === 'active'
                ? <><Pause className="w-3.5 h-3.5" /> Pause tracker</>
                : <><Play className="w-3.5 h-3.5" /> Resume tracker</>
              }
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              Delete tracker
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function TrackersTable({ trackers }: TrackersTableProps) {
  if (trackers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-purple-50 mb-4">
          <Eye className="w-6 h-6 text-purple-400" />
        </div>
        <p className="text-sm font-medium">No trackers yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create your first tracker to start monitoring competitors.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracker</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Min. Longevity</TableHead>
          <TableHead>Last Scan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Insight</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {trackers.map((tracker) => (
          <TrackerRow key={tracker.id} tracker={tracker} />
        ))}
      </TableBody>
    </Table>
  )
}
