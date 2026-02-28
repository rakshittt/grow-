'use client'

import { useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Unplug, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { disconnectMetaAccount } from '@/actions/settings'

interface MetaAccount {
  id: string
  ad_account_id: string
  ad_account_name: string
  business_name: string | null
  currency: string
  timezone: string
  status: 'active' | 'expired' | 'revoked'
  token_expires_at: Date | null
  created_at: Date
}

function AccountRow({ account }: { account: MetaAccount }) {
  const [isPending, startTransition] = useTransition()

  const isExpired  = account.status === 'expired' ||
    (account.token_expires_at && new Date(account.token_expires_at) < new Date())
  const isRevoked  = account.status === 'revoked'

  function handleDisconnect() {
    if (!confirm(`Disconnect "${account.ad_account_name}"? Active rules using this account will stop working.`)) return
    startTransition(async () => {
      const result = await disconnectMetaAccount(account.id)
      if (result.error) {
        toast.error('Failed to disconnect', { description: result.error })
      } else {
        toast.success('Account disconnected')
      }
    })
  }

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${isPending ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{account.ad_account_name}</p>
          {isRevoked ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">Disconnected</Badge>
          ) : isExpired ? (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />Token expired
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />Active
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {account.ad_account_id}
          {account.business_name && ` · ${account.business_name}`}
          {' · '}{account.currency} · {account.timezone}
        </p>
        {account.token_expires_at && !isRevoked && (
          <p className="text-xs text-muted-foreground">
            Token {isExpired ? 'expired' : 'expires'}{' '}
            {formatDistanceToNow(new Date(account.token_expires_at), { addSuffix: true })}
          </p>
        )}
      </div>
      {!isRevoked && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={handleDisconnect}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
        </Button>
      )}
    </div>
  )
}

interface SettingsMetaAccountsProps {
  accounts: MetaAccount[]
}

export function SettingsMetaAccounts({ accounts }: SettingsMetaAccountsProps) {
  const active = accounts.filter(a => a.status !== 'revoked')

  if (active.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No Meta accounts connected. Click "Connect account" to add one.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {active.map(account => (
        <AccountRow key={account.id} account={account} />
      ))}
    </div>
  )
}
