'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Eye,
  BarChart3,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { completeMetaStep } from '@/actions/onboarding'

interface StepConnectMetaProps {
  onComplete: () => void
}

const PERMISSIONS = [
  { icon: Eye,          label: 'ads_read',           description: 'View your campaign performance data' },
  { icon: BarChart3,    label: 'ads_management',      description: 'Adjust budgets and pause underperformers' },
  { icon: ShieldCheck,  label: 'business_management', description: 'Access Business Manager accounts' },
]

export function StepConnectMeta({ onComplete }: StepConnectMetaProps) {
  const searchParams = useSearchParams()
  const metaParam    = searchParams.get('meta')

  // Auto-detect returning from successful OAuth
  const [connected, setConnected] = useState(metaParam === 'connected')
  const [isPending, startTransition] = useTransition()

  const isDenied = metaParam === 'denied'
  const isError  = metaParam === 'error'

  function handleConnect() {
    window.location.href = '/api/auth/meta/connect'
  }

  function handleContinue() {
    startTransition(async () => {
      await completeMetaStep()
      onComplete()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Connect your Meta Ads account</h2>
        <p className="text-sm text-muted-foreground">
          We use the official Meta Marketing API. We only request the permissions we need — nothing more.
        </p>
      </div>

      {/* Permission list */}
      <div className="space-y-2">
        {PERMISSIONS.map(({ icon: Icon, label, description }) => (
          <div key={label} className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-foreground">{label}</code>
                <Badge variant="secondary" className="text-xs py-0">Required</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error / denied state */}
      {(isDenied || isError) && !connected && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-300">
            {isDenied
              ? 'You declined the Meta permissions. Please connect to continue.'
              : 'Something went wrong with the Meta connection. Please try again.'}
          </p>
        </div>
      )}

      {/* Connected success state */}
      {connected ? (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-400">
                Meta Ads connected
              </p>
              <p className="text-xs text-green-700 dark:text-green-500 mt-0.5">
                Your ad accounts are ready to be managed.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full gap-2" onClick={handleConnect}>
          <ExternalLink className="w-4 h-4" />
          Connect via Meta OAuth
        </Button>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          You can connect additional accounts later in Settings.
        </p>
        <Button
          onClick={handleContinue}
          disabled={!connected || isPending}
          size="sm"
        >
          {isPending
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
            : 'Continue →'
          }
        </Button>
      </div>
    </div>
  )
}
