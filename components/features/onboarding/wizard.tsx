'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepConnectMeta } from './steps/step-connect-meta'
import { StepGuardrails } from './steps/step-guardrails'
import { StepSlack } from './steps/step-slack'

const STEPS = [
  { id: 1, label: 'Connect Meta' },
  { id: 2, label: 'Set Guardrails' },
  { id: 3, label: 'Slack Alerts' },
]

interface WizardProps {
  initialStep?: number
}

export function OnboardingWizard({ initialStep = 0 }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)

  function advance() {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-8">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm text-white">
          MA
        </div>
        <span className="font-semibold tracking-tight">MarketerAgents</span>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const isCompleted = currentStep > i
          const isActive = currentStep === i

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary text-primary bg-background'
                        : 'border-muted-foreground/30 text-muted-foreground bg-background'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-px mx-3 mb-5 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        {currentStep === 0 && <StepConnectMeta onComplete={advance} />}
        {currentStep === 1 && <StepGuardrails onComplete={advance} />}
        {currentStep === 2 && <StepSlack onComplete={() => {}} />}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Step {currentStep + 1} of {STEPS.length} — takes less than 5 minutes
      </p>
    </div>
  )
}
