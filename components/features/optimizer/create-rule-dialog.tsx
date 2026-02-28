'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createRule } from '@/actions/optimizer'
import type { MetaAdAccount } from '@/lib/db'

interface CreateRuleDialogProps {
  accounts: Pick<MetaAdAccount, 'id' | 'ad_account_name'>[]
}

export function CreateRuleDialog({ accounts }: CreateRuleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createRule(formData)
      if (result.error) {
        toast.error('Failed to create rule', { description: result.error })
        return
      }
      toast.success('Rule set created', {
        description: 'The optimizer will begin monitoring on its next scheduled run.',
      })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Rule Set
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Optimizer Rule Set</DialogTitle>
          <DialogDescription>
            Define the guardrails the AI must respect. Every proposed action outside these limits will be blocked.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Rule set name</Label>
            <Input id="name" name="name" placeholder="Spring Campaign Safety Rails" required />
          </div>

          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="meta_ad_account_id">Meta Ad Account</Label>
              <Select name="meta_ad_account_id">
                <SelectTrigger id="meta_ad_account_id">
                  <SelectValue placeholder="Select account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.ad_account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="max_daily_budget_usd">Max daily budget ceiling ($)</Label>
              <Input
                id="max_daily_budget_usd"
                name="max_daily_budget_usd"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 2500"
              />
              <p className="text-xs text-muted-foreground">AI cannot exceed this</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min_daily_budget_usd">Min daily budget floor ($)</Label>
              <Input
                id="min_daily_budget_usd"
                name="min_daily_budget_usd"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target_roas">Target ROAS (x)</Label>
              <Input
                id="target_roas"
                name="target_roas"
                type="number"
                min={0}
                step="0.1"
                placeholder="e.g. 3.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min_roas_threshold">Pause ad below ROAS (x)</Label>
              <Input
                id="min_roas_threshold"
                name="min_roas_threshold"
                type="number"
                min={0}
                step="0.1"
                placeholder="e.g. 1.8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="max_budget_increase_pct">Max single increase (%)</Label>
              <Input
                id="max_budget_increase_pct"
                name="max_budget_increase_pct"
                type="number"
                min={1}
                max={100}
                defaultValue={20}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="attribution_window">Attribution window</Label>
              <Select name="attribution_window" defaultValue="7d_click">
                <SelectTrigger id="attribution_window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d_click">1-day click</SelectItem>
                  <SelectItem value="7d_click">7-day click</SelectItem>
                  <SelectItem value="28d_click">28-day click</SelectItem>
                  <SelectItem value="1d_view">1-day view</SelectItem>
                  <SelectItem value="7d_view">7-day view</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto_approve_below_usd">Auto-approve actions below ($)</Label>
            <Input
              id="auto_approve_below_usd"
              name="auto_approve_below_usd"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
            />
            <p className="text-xs text-muted-foreground">
              Budget changes smaller than this amount execute automatically. Set to $0 to require approval for everything.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Rule Set'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
