'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Zap,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { signOutAction } from '@/actions/auth'
import { Sidebar } from './sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/spy': 'Competitor Spy',
  '/optimizer': 'Optimizer',
  '/approvals': 'Approvals',
  '/settings': 'Settings',
}

interface HeaderProps {
  userEmail?: string
  userName?: string
  userAvatar?: string
  agencyName?: string
  pendingCount?: number
}

export function Header({ userEmail, userName, userAvatar, agencyName, pendingCount = 0 }: HeaderProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const pageTitle = PAGE_TITLES[pathname] ?? 'MarketerAgents'
  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (userEmail?.[0] ?? 'U').toUpperCase()

  return (
    <header className="h-16 border-b bg-background flex items-center px-4 gap-4 sticky top-0 z-10">
      {/* Mobile sidebar trigger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden -ml-1">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <h1 className="font-semibold text-base">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Pending approvals bell */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <a href="/approvals">
            <Bell className="w-4.5 h-4.5" />
            {pendingCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-amber-500 hover:bg-amber-500 text-white rounded-full">
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            )}
          </a>
        </Button>

        {/* Workspace / user dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 px-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium leading-none">
                  {agencyName ?? 'My Workspace'}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {userEmail ?? ''}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{userName ?? 'Account'}</span>
                <span className="text-xs text-muted-foreground">{userEmail}</span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <a href="/settings/profile" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings/billing" className="cursor-pointer">
                <Zap className="w-4 h-4 mr-2" />
                Billing & Plan
              </a>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOutAction()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
