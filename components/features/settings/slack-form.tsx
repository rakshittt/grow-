'use client'

import { useTransition, useState } from 'react'
import { Loader2, CheckCircle2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveAgencySettings } from '@/actions/settings'
import { testSlackWebhook } from '@/actions/onboarding'

interface SettingsSlackFormProps {
  currentWebhook: string
  currentEmail: string
  agencyName: string
}

export function SettingsSlackForm({ currentWebhook, currentEmail, agencyName }: SettingsSlackFormProps) {
  const [isSaving, startSave] = useTransition()
  const [isTesting, startTest] = useTransition()
  const [webhookValue, setWebhookValue] = useState(currentWebhook)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startSave(async () => {
      const result = await saveAgencySettings(formData)
      if (result.error) {
        toast.error('Failed to save', { description: result.error })
      } else {
        toast.success('Settings saved')
      }
    })
  }

  function handleTest() {
    if (!webhookValue) return
    startTest(async () => {
      const result = await testSlackWebhook(webhookValue)
      if (result.ok) {
        toast.success('Test message sent!', { description: 'Check your Slack channel.' })
      } else {
        toast.error('Slack test failed', { description: result.error })
      }
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="agency_name">Agency name</Label>
        <Input
          id="agency_name"
          name="agency_name"
          defaultValue={agencyName}
          placeholder="My Agency"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notification_email">Notification email</Label>
        <Input
          id="notification_email"
          name="notification_email"
          type="email"
          defaultValue={currentEmail}
          placeholder="alerts@myagency.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slack_webhook_url">Slack webhook URL</Label>
        <div className="flex gap-2">
          <Input
            id="slack_webhook_url"
            name="slack_webhook_url"
            value={webhookValue}
            onChange={e => setWebhookValue(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!webhookValue || isTesting}
            onClick={handleTest}
          >
            {isTesting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Create at api.slack.com/apps → Incoming Webhooks. Click the send icon to test.
        </p>
      </div>

      <Button type="submit" size="sm" disabled={isSaving}>
        {isSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save settings'}
      </Button>
    </form>
  )
}
