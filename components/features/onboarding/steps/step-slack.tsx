'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveSlackAndComplete, testSlackWebhook } from '@/actions/onboarding'

interface StepSlackProps {
  onComplete: () => void
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function StepSlack({ onComplete }: StepSlackProps) {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  async function handleTest() {
    if (!webhookUrl) return
    setTestState('testing')
    setTestError(undefined)
    const result = await testSlackWebhook(webhookUrl)
    if (result.ok) {
      setTestState('success')
    } else {
      setTestState('error')
      setTestError(result.error)
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveSlackAndComplete(formData)
      onComplete()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Connect Slack alerts</h2>
        <p className="text-sm text-muted-foreground">
          Get notified instantly when an agent recommends an action that needs your approval. You can approve or deny directly from Slack.
        </p>
      </div>

      {/* How to get webhook URL */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
        <p className="text-xs font-medium">How to get your webhook URL:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to your Slack workspace → Apps → Incoming Webhooks</li>
          <li>Click "Add to Slack" and choose a channel</li>
          <li>Copy the Webhook URL and paste it below</li>
        </ol>
        <a
          href="https://api.slack.com/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open Slack Apps <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="slack_webhook_url">Slack Webhook URL</Label>
          <div className="flex gap-2">
            <Input
              id="slack_webhook_url"
              name="slack_webhook_url"
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value)
                setTestState('idle')
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!webhookUrl || testState === 'testing'}
              className="shrink-0"
            >
              {testState === 'testing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Test'
              )}
            </Button>
          </div>

          {testState === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Message sent! Check your Slack channel.
            </div>
          )}
          {testState === 'error' && (
            <p className="text-xs text-destructive">{testError}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              startTransition(async () => {
                const fd = new FormData()
                await saveSlackAndComplete(fd)
                onComplete()
              })
            }}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            disabled={isPending}
          >
            Skip for now
          </button>

          <Button type="submit" disabled={isPending || !webhookUrl}>
            {isPending ? 'Finishing…' : 'Finish Setup →'}
          </Button>
        </div>
      </form>
    </div>
  )
}
