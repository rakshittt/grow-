import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface StatsCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  trend?: { value: string; positive: boolean }
  className?: string
}

export function StatsCard({ label, value, subtext, icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground">{subtext}</p>
            )}
            {trend && (
              <p className={cn('text-xs font-medium', trend.positive ? 'text-green-600' : 'text-red-500')}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </p>
            )}
          </div>
          <div className="p-2.5 rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
