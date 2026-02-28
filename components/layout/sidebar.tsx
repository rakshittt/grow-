'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Eye,
  TrendingUp,
  CheckSquare,
  Settings,
  HelpCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/spy', label: 'Competitor Spy', icon: Eye },
  { href: '/optimizer', label: 'Optimizer', icon: TrendingUp },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare },
]

const BOTTOM_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help & Docs', icon: HelpCircle },
]

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-blue-500 hover:bg-blue-500 text-white rounded-full">
          {item.badge}
        </Badge>
      )}
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-zinc-950 border-r border-zinc-800 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-zinc-800">
        <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white tracking-tight">MarketerAgents</span>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom nav */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </div>
    </aside>
  )
}
