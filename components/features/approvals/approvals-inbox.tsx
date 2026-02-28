'use client'

import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalCard } from './approval-card'
import type { ActionLog, ActionStatus } from '@/lib/db'

interface ApprovalsInboxProps {
  initialLogs: ActionLog[]
}

type TabValue = 'pending' | 'resolved' | 'all'

const RESOLVED_STATUSES: ActionStatus[] = ['approved', 'denied', 'executed', 'auto_approved', 'failed', 'cancelled']

export function ApprovalsInbox({ initialLogs }: ApprovalsInboxProps) {
  const [logs, setLogs] = useState(initialLogs)

  function handleAction(id: string, action: 'approved' | 'denied') {
    setLogs(prev =>
      prev.map(l => l.id === id ? { ...l, status: action } : l)
    )
  }

  const pending = logs.filter(l => l.status === 'pending_human_approval')
  const resolved = logs.filter(l => RESOLVED_STATUSES.includes(l.status))

  return (
    <Tabs defaultValue="pending">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            {pending.length > 0 && (
              <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-amber-500 hover:bg-amber-500 text-white rounded-full">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="pending" className="space-y-3 mt-0">
        {pending.length === 0 ? (
          <EmptyState message="No pending approvals. The agents are monitoring your campaigns." />
        ) : (
          pending.map(log => (
            <ApprovalCard key={log.id} log={log} onAction={handleAction} />
          ))
        )}
      </TabsContent>

      <TabsContent value="resolved" className="space-y-3 mt-0">
        {resolved.length === 0 ? (
          <EmptyState message="No resolved actions yet." />
        ) : (
          resolved.map(log => (
            <ApprovalCard key={log.id} log={log} onAction={handleAction} />
          ))
        )}
      </TabsContent>

      <TabsContent value="all" className="space-y-3 mt-0">
        {logs.length === 0 ? (
          <EmptyState message="No agent actions yet." />
        ) : (
          logs.map(log => (
            <ApprovalCard key={log.id} log={log} onAction={handleAction} />
          ))
        )}
      </TabsContent>
    </Tabs>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Inbox className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
