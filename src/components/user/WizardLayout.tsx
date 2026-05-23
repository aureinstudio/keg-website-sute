interface Props {
  currentStep: number
  steps: string[]
  children: React.ReactNode
}

export function WizardLayout({ currentStep, steps, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    i < currentStep
                      ? 'bg-blue-600 text-white'
                      : i === currentStep
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span
                  className={`text-sm hidden sm:block ${
                    i === currentStep ? 'font-semibold text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step}
                </span>
                {i < steps.length - 1 && (
                  <div className={`h-px w-6 ${i < currentStep ? 'bg-blue-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </div>
  )
}
