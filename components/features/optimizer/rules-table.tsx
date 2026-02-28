'use client'

import { useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  TrendingUp,
  Shield,
  MoreHorizontal,
  Pause,
  Play,
  Settings2,
  Clock,
  Loader2,
} from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { updateRuleStatus, deleteRule } from '@/actions/optimizer'
import type { OptimizerRule } from '@/lib/db'

export type RuleWithAccount = OptimizerRule & { account_name: string | null }

const STATUS_BADGE = {
  active:   <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Active</Badge>,
  paused:   <Badge variant="secondary">Paused</Badge>,
  archived: <Badge variant="outline" className="text-muted-foreground">Archived</Badge>,
}

const ATTRIBUTION_LABELS: Record<string, string> = {
  '1d_click':  '1d click',
  '7d_click':  '7d click',
  '28d_click': '28d click',
  '1d_view':   '1d view',
  '7d_view':   '7d view',
}

function RuleRow({ rule }: { rule: RuleWithAccount }) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const newStatus = rule.status === 'active' ? 'paused' : 'active'
    startTransition(async () => {
      const result = await updateRuleStatus(rule.id, newStatus)
      if (result.error) {
        toast.error('Failed to update rule', { description: result.error })
      } else {
        toast.success(newStatus === 'active' ? 'Rule resumed' : 'Rule paused')
      }
    })
  }

  function handleRunNow() {
    startTransition(async () => {
      const res = await fetch('/api/agents/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: rule.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Failed to start optimizer', { description: data.error ?? 'Unknown error' })
      } else {
        toast.success('Optimizer started', { description: data.message })
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteRule(rule.id)
      if (result.error) {
        toast.error('Failed to delete rule', { description: result.error })
      } else {
        toast.success('Rule deleted')
      }
    })
  }

  return (
    <TableRow className={isPending ? 'opacity-60 pointer-events-none' : ''}>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="font-medium text-sm">{rule.name}</p>
            {rule.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{rule.description}</p>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <span className="text-sm text-muted-foreground">{rule.account_name ?? '—'}</span>
      </TableCell>

      <TableCell>
        {rule.max_daily_budget_usd != null ? (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="text-sm font-medium">
                  ${Number(rule.max_daily_budget_usd).toLocaleString()}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Hard ceiling — the AI cannot breach this</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        <div className="space-y-0.5">
          {rule.target_roas && (
            <p className="text-sm font-medium">{Number(rule.target_roas)}x target</p>
          )}
          {rule.min_roas_threshold && (
            <p className="text-xs text-muted-foreground">
              Pause below {Number(rule.min_roas_threshold)}x
            </p>
          )}
          {!rule.target_roas && !rule.min_roas_threshold && (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <Badge variant="outline" className="text-xs font-mono">
          {ATTRIBUTION_LABELS[rule.attribution_window]}
        </Badge>
      </TableCell>

      <TableCell>
        {rule.last_run_at ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(rule.last_run_at), { addSuffix: true })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        )}
      </TableCell>

      <TableCell>{STATUS_BADGE[rule.status]}</TableCell>

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending}>
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <MoreHorizontal className="w-4 h-4" />
              }
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2"
              onClick={handleRunNow}
              disabled={rule.status !== 'active' || !rule.meta_ad_account_id}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Run now
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={handleToggle}>
              {rule.status === 'active'
                ? <><Pause className="w-3.5 h-3.5" /> Pause rule</>
                : <><Play className="w-3.5 h-3.5" /> Resume rule</>
              }
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              Delete rule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function RulesTable({ rules }: { rules: RuleWithAccount[] }) {
  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-blue-50 mb-4">
          <TrendingUp className="w-6 h-6 text-blue-400" />
        </div>
        <p className="text-sm font-medium">No rule sets yet</p>
        <p className="text-xs text-muted-foreground mt-1">Create a rule set to start optimizing your campaigns.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rule Set</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Budget Ceiling</TableHead>
          <TableHead>ROAS Target</TableHead>
          <TableHead>Attribution</TableHead>
          <TableHead>Last Check</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} />
        ))}
      </TableBody>
    </Table>
  )
}
