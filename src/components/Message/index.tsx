import clsx from 'clsx'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import React from 'react'

/**
 * Inline status banner. ZAPLETANE uses tinted surfaces with a hairline border
 * and same-hue text (never a solid saturated fill, which the old default
 * produced — unreadable dark text on full-strength `bg-error`). Icon + text row
 * per the form patterns in DESIGN-SPEC §3.7.
 */
export const Message: React.FC<{
  className?: string
  error?: React.ReactNode
  message?: React.ReactNode
  success?: React.ReactNode
  warning?: React.ReactNode
}> = ({ className, error, message, success, warning }) => {
  const messageToRender = message || error || success || warning

  if (messageToRender) {
    const Icon = success ? CheckCircle : error || warning ? AlertCircle : Info

    return (
      <div
        className={clsx(
          'flex w-full items-start gap-3 rounded-default border p-4 font-sans text-sm',
          {
            'border-success/30 bg-success-light text-success': Boolean(success),
            'border-accent-300 bg-accent-50 text-brand': Boolean(warning),
            'border-error/30 bg-error-light text-error': Boolean(error),
            'border-gray-200 bg-gray-50 text-gray-700': Boolean(
              message && !success && !warning && !error,
            ),
          },
          className,
        )}
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">{messageToRender}</div>
      </div>
    )
  }
  return null
}
