import Link from 'next/link'
import {
  Eye,
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Clock,
  Lock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">MarketerAgents</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-32 pb-24 px-4 text-center">
      <div className="max-w-4xl mx-auto space-y-6">
        <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-blue-200 text-blue-700 bg-blue-50">
          <Sparkles className="w-3 h-3" />
          Powered by Claude 3.5 Sonnet + LangGraph
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Your Meta Ads on{' '}
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Autopilot.
          </span>
          <br />
          You Stay in Control.
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          AI agents monitor your campaigns 24/7, surface competitor intelligence, and propose data-backed optimisations — but nothing executes without your approval.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild size="lg" className="h-12 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 gap-2">
            <Link href="/signup">
              Start free — 14-day trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">No credit card required · Cancel anytime</p>
      </div>

      {/* Dashboard preview card */}
      <div className="mt-16 max-w-5xl mx-auto">
        <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
          <div className="bg-muted/50 border-b px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-background border rounded-full px-3 py-1">
                <Lock className="w-3 h-3" />
                app.marketeragents.ai/dashboard
              </div>
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-muted/20 to-background">
            {/* Mock approval card */}
            <div className="max-w-lg mx-auto space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                2 agent actions awaiting your approval
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-50">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">INCREASE BUDGET</p>
                      <p className="text-xs text-muted-foreground">Campaign: Spring Collection 2026</p>
                    </div>
                  </div>
                  <Badge className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Pending</Badge>
                </div>
                <div className="flex gap-2 text-xs bg-muted/40 border rounded-md px-2.5 py-2">
                  <span className="text-muted-foreground">daily budget</span>
                  <span className="font-medium">$1,200</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold text-green-600">$1,440</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Campaign ROAS averaged 4.2x over 7 days (target: 3.5x). Spend is $820 below the $2,500 ceiling. A 20% increase is projected to capture 340 additional high-intent users.
                </p>
                <div className="flex gap-2 pt-1">
                  <div className="flex-1 h-8 rounded-md bg-green-600 flex items-center justify-center text-xs text-white font-medium gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </div>
                  <div className="flex-1 h-8 rounded-md border flex items-center justify-center text-xs text-red-600 font-medium">
                    Deny
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Eye,
    color: 'bg-purple-100 text-purple-700',
    title: 'Competitor Spy Agent',
    description:
      "Automatically scrapes the Meta Ad Library daily for your competitors' ads. Surfaces only the longest-running creatives — the ones the algorithm is actually rewarding.",
    bullets: ['Daily automated scans', 'Longevity filter (proven ads only)', 'AI-written creative intelligence reports', 'Slack notifications when reports are ready'],
  },
  {
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-700',
    title: 'Live Optimizer Agent',
    description:
      'Monitors your campaign performance 24/7 and proposes data-backed budget adjustments, bid changes, and creative pauses — all within the strict guardrails you set.',
    bullets: ['Hourly ROAS monitoring', 'Budget increase / decrease proposals', 'Automatic ad pausing below ROAS threshold', 'Configurable guardrails per rule set'],
  },
  {
    icon: ShieldCheck,
    color: 'bg-green-100 text-green-700',
    title: 'Human-in-the-Loop Approvals',
    description:
      "Every proposed action lands in your Approvals inbox before execution. You review the reasoning, see the before/after diff, and approve or deny with one click.",
    bullets: ['24-hour approval window', 'Full AI reasoning shown', 'Auto-approve threshold for small changes', 'Instant Slack notifications'],
  },
  {
    icon: BarChart3,
    color: 'bg-amber-100 text-amber-700',
    title: 'Strict Guardrails',
    description:
      "Define hard budget ceilings the AI can never breach. Set minimum ROAS thresholds, max frequency caps, and per-rule auto-approve limits. Safety is built in, not bolted on.",
    bullets: ['Hard budget ceiling (AI-enforced)', 'ROAS targets and pause thresholds', 'Max increase % per action', 'Min spend before any action'],
  },
]

function Features() {
  return (
    <section id="features" className="py-24 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Two agents. One inbox. Full control.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            MarketerAgents runs the analysis and surfaces the actions. You make the calls.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="rounded-2xl border bg-card p-6 space-y-4 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
                <ul className="space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '01',
    title: 'Connect your Meta Ad Account',
    description: 'Link your Meta Business account in one click via OAuth. We request only the permissions we need.',
  },
  {
    step: '02',
    title: 'Set your guardrails',
    description: 'Define budget ceilings, ROAS targets, and approval rules. The AI works within these constraints — always.',
  },
  {
    step: '03',
    title: 'Agents go to work',
    description: 'The Spy agent scans competitors daily. The Optimizer checks your campaigns hourly. You get Slack pings when action is needed.',
  },
  {
    step: '04',
    title: 'You approve, it executes',
    description: 'Every proposed change lands in your Approvals inbox with full reasoning. One click to approve or deny. Nothing runs without you.',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Up and running in minutes</h2>
          <p className="text-muted-foreground text-lg">No code. No complex setup. Just connect and go.</p>
        </div>

        <div className="space-y-0">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {s.step}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 w-px bg-border my-2" />
                )}
              </div>
              <div className={`pb-10 ${i < STEPS.length - 1 ? '' : ''}`}>
                <h3 className="font-semibold text-base mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Social proof strip ──────────────────────────────────────────────────────

const STATS = [
  { value: '24/7', label: 'Campaign monitoring' },
  { value: '< 1min', label: 'Time to approve actions' },
  { value: '0', label: 'Budget ceiling violations' },
  { value: '14h', label: 'Avg. hours saved per week' },
]

function StatsStrip() {
  return (
    <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
        {STATS.map((s) => (
          <div key={s.label}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-blue-100 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for solo media buyers managing a few accounts.',
    features: [
      '3 spy trackers',
      '1 Meta ad account',
      'Hourly optimizer checks',
      'Human-in-loop approvals',
      'Slack notifications',
      '$1,000/mo spend under management',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$149',
    period: '/month',
    description: 'For growing agencies managing multiple clients.',
    features: [
      '10 spy trackers',
      '5 Meta ad accounts',
      'Hourly + real-time optimizer',
      'Auto-approve thresholds',
      'Slack + email notifications',
      '$10,000/mo spend under management',
      'Priority support',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Scale',
    price: '$399',
    period: '/month',
    description: 'For large agencies with high-volume campaigns.',
    features: [
      'Unlimited spy trackers',
      'Unlimited Meta accounts',
      'Custom check intervals',
      'API access',
      'Custom guardrail logic',
      'Unlimited spend under management',
      'Dedicated onboarding',
    ],
    cta: 'Contact us',
    highlight: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
          <p className="text-muted-foreground text-lg">14-day free trial on all plans. No credit card required.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 space-y-5 flex flex-col ${
                plan.highlight
                  ? 'border-blue-200 bg-gradient-to-b from-blue-50/50 to-card shadow-lg ring-1 ring-blue-200'
                  : 'bg-card'
              }`}
            >
              {plan.highlight && (
                <Badge className="w-fit bg-blue-600 text-white text-xs">Most popular</Badge>
              )}
              <div>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`w-full ${plan.highlight ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0' : ''}`}
                variant={plan.highlight ? 'default' : 'outline'}
              >
                <Link href={plan.cta === 'Contact us' ? 'mailto:hello@marketeragents.ai' : '/signup'}>
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Ready to let AI work your campaigns?
        </h2>
        <p className="text-muted-foreground text-lg">
          Start your free 14-day trial today. No credit card required. Cancel anytime.
        </p>
        <Button asChild size="lg" className="h-12 px-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 gap-2">
          <Link href="/signup">
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          {['14-day free trial', 'No credit card', 'Cancel anytime'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-medium text-foreground">MarketerAgents</span>
          <span>© 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          <Link href="/signup" className="hover:text-foreground transition-colors">Sign up</Link>
          <a href="mailto:hello@marketeragents.ai" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Features />
      <StatsStrip />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  )
}
