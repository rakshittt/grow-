'use client'

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign,
  Pause,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { ActionLog } from '@/lib/db'

const ACTION_ICONS: Record<string, React.ElementType> = {
  INCREASE_BUDGET: DollarSign,
  DECREASE_BUDGET: DollarSign,
  PAUSE_AD: Pause,
  SPY_REPORT_READY: FileText,
}

const AGENT_CONFIG = {
  spy: { label: 'Spy Agent', color: 'bg-purple-100 text-purple-700' },
  optimizer: { label: 'Optimizer', color: 'bg-blue-100 text-blue-700' },
}

interface ApprovalCardProps {
  log: ActionLog
  onAction: (id: string, action: 'approved' | 'denied') => void
}

function ValueDiff({ current, proposed }: {
  current: Record<string, unknown> | null
  proposed: Record<string, unknown> | null
}) {
  if (!current || !proposed) return null

  const keys = Object.keys({ ...current, ...proposed }).filter(
    k => current[k] !== proposed[k]
  )
  if (keys.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {keys.map(key => {
        const from = current[key]
        const to = proposed[key]
        const isIncrease = typeof from === 'number' && typeof to === 'number' && to > from
        const isDecrease = typeof from === 'number' && typeof to === 'number' && to < from

        return (
          <div key={key} className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1.5">
            <span className="text-muted-foreground font-mono">{key.replace(/_/g, ' ')}</span>
            <span className="font-medium">{String(from)}</span>
            <span className="text-muted-foreground">→</span>
            <span className={`font-semibold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-amber-600' : 'text-foreground'}`}>
              {String(to)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ApprovalCard({ log, onAction }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPendingApprove, startApprove] = useTransition()
  const [isPendingDeny, startDeny] = useTransition()

  const agentCfg = AGENT_CONFIG[log.agent_type]
  const ActionIcon = ACTION_ICONS[log.action_type] ?? (log.agent_type === 'spy' ? Eye : TrendingUp)
  const isPending = log.status === 'pending_human_approval'

  function handleApprove() {
    startApprove(async () => {
      const res = await fetch(`/api/approvals/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error('Approval failed', { description: err.error ?? 'Unknown error' })
        return
      }
      onAction(log.id, 'approved')
      toast.success('Action approved', {
        description: `The agent will execute: ${log.action_type.replace(/_/g, ' ')} on ${log.target_entity_name}`,
      })
    })
  }

  function handleDeny() {
    startDeny(async () => {
      const res = await fetch(`/api/approvals/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny' }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error('Denial failed', { description: err.error ?? 'Unknown error' })
        return
      }
      onAction(log.id, 'denied')
      toast.info('Action denied', {
        description: 'The agent will skip this action and continue monitoring.',
      })
    })
  }

  return (
    <Card className={isPending ? 'border-amber-200/70' : ''}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-muted shrink-0">
            <ActionIcon className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-semibold text-sm">
                {log.action_type.replace(/_/g, ' ')}
              </span>
              <Badge className={`text-[10px] h-4 px-1.5 py-0 border-0 ${agentCfg.color}`}>
                {agentCfg.label}
              </Badge>
              {isPending && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 border-amber-300 text-amber-700">
                  Awaiting approval
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {log.target_entity_type && (
                <span className="capitalize">{log.target_entity_type}: </span>
              )}
              {log.target_entity_name}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </div>
        </div>

        {/* Before → After diff */}
        <ValueDiff current={log.current_value} proposed={log.proposed_value} />

        {/* AI Reasoning */}
        <div className="rounded-md bg-muted/40 border px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground mb-1">Agent reasoning</p>
          <p className={`text-sm leading-relaxed ${!expanded && 'line-clamp-3'}`}>
            {log.reasoning}
          </p>
          {log.reasoning && log.reasoning.length > 200 && (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : 'Read full reasoning'}
            </button>
          )}
        </div>

        {/* Confidence */}
        {log.confidence_score != null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${(Number(log.confidence_score) * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums">
              {(Number(log.confidence_score) * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* Action buttons */}
        {isPending && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isPendingApprove || isPendingDeny}
            >
              {isPendingApprove
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />
              }
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDeny}
              disabled={isPendingApprove || isPendingDeny}
            >
              {isPendingDeny
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <XCircle className="w-4 h-4" />
              }
              Deny
            </Button>
          </div>
        )}

        {/* Resolved state */}
        {log.status === 'approved' && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Approved · Queued for execution
          </div>
        )}
        {log.status === 'denied' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="w-4 h-4 text-red-500" />
            Denied · Agent will skip this action
          </div>
        )}
        {log.status === 'auto_approved' && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="w-4 h-4" />
            Auto-approved (below threshold) · Executed
          </div>
        )}
      </CardContent>
    </Card>
  )
}
