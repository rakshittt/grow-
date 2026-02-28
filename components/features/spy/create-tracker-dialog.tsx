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
import { createTracker } from '@/actions/spy'

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'IN', label: '🇮🇳 India' },
]

export function CreateTrackerDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createTracker(formData)
      if (result.error) {
        toast.error('Failed to create tracker', { description: result.error })
        return
      }
      toast.success('Tracker created', {
        description: 'Your first scan will run within the next 24 hours.',
      })
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Tracker
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Competitor Tracker</DialogTitle>
          <DialogDescription>
            The Spy agent will scan the Meta Ad Library daily and surface your competitor&apos;s longest-running (proven) ads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tracker name</Label>
            <Input id="name" name="name" placeholder="Nike US Footwear" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="competitor_name">Competitor brand name</Label>
            <Input id="competitor_name" name="competitor_name" placeholder="Nike" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="competitor_page_url">
              Facebook Page URL{' '}
              <span className="text-muted-foreground font-normal">(optional but recommended)</span>
            </Label>
            <Input
              id="competitor_page_url"
              name="competitor_page_url"
              type="url"
              placeholder="https://www.facebook.com/nike"
            />
            <p className="text-xs text-muted-foreground">
              Using the exact Page URL produces much more accurate results.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="country_code">Target country</Label>
              <Select name="country_code" defaultValue="US">
                <SelectTrigger id="country_code">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="min_longevity_days">Min. days running</Label>
              <Input
                id="min_longevity_days"
                name="min_longevity_days"
                type="number"
                min={1}
                defaultValue={7}
              />
              <p className="text-xs text-muted-foreground">Only show ads live this long</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="search_terms">
              Keywords{' '}
              <span className="text-muted-foreground font-normal">(comma separated, optional)</span>
            </Label>
            <Input
              id="search_terms"
              name="search_terms"
              placeholder="running shoes, air max, jordan"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Tracker'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
