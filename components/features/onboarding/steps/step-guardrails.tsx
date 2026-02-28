'use client'

import { useTransition } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveGuardrails } from '@/actions/onboarding'

interface StepGuardrailsProps {
  onComplete: () => void
}

export function StepGuardrails({ onComplete }: StepGuardrailsProps) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveGuardrails(formData)
      onComplete()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Set your safety guardrails</h2>
        <p className="text-sm text-muted-foreground">
          These limits are absolute. The AI cannot breach them under any circumstances, even if it predicts a positive outcome.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-400">
          All agent actions require your approval by default. These guardrails are an additional safety net on top of that.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="max_daily_budget">
            Maximum daily spend the AI can manage (USD)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="max_daily_budget"
              name="max_daily_budget"
              type="number"
              min={0}
              step={100}
              placeholder="10,000"
              className="pl-7"
              defaultValue={10000}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The optimizer will never increase total daily spend above this figure.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attribution_window">Default attribution window</Label>
          <Select name="attribution_window" defaultValue="7d_click">
            <SelectTrigger id="attribution_window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d_click">1-day click</SelectItem>
              <SelectItem value="7d_click">7-day click (recommended)</SelectItem>
              <SelectItem value="28d_click">28-day click</SelectItem>
              <SelectItem value="1d_view">1-day view</SelectItem>
              <SelectItem value="7d_view">7-day view</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Ads will not be paused until they've been evaluated against this window to prevent premature kills.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notification_email">Alert email (optional)</Label>
          <Input
            id="notification_email"
            name="notification_email"
            type="email"
            placeholder="alerts@agency.com"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            Receive email summaries of agent actions. You can also set up Slack in the next step.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save & Continue →'}
          </Button>
        </div>
      </form>
    </div>
  )
}
