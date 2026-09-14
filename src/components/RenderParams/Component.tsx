'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/utilities/cn'

export type Props = {
  className?: string
  message?: string
  onParams?: (paramValues: ((null | string | undefined) | string[])[]) => void
  params?: string[]
}

/** Visual treatment per query-param key — ZAPLETANE error/success tokens, `accent` for a neutral warning/notice. */
const paramStyles: Record<
  string,
  { wrap: string; icon: React.ComponentType<{ className?: string }> }
> = {
  error: {
    wrap: 'border-error/20 bg-error-light text-error',
    icon: AlertCircle,
  },
  success: {
    wrap: 'border-success/30 bg-success-light text-success',
    icon: CheckCircle2,
  },
  warning: {
    wrap: 'border-accent-200 bg-accent-50 text-accent-700',
    icon: Info,
  },
  message: {
    wrap: 'border-gray-200 bg-gray-50 text-black',
    icon: Info,
  },
}

export const RenderParamsComponent: React.FC<Props> = ({
  className,
  onParams,
  params = ['error', 'warning', 'success', 'message'],
}) => {
  const searchParams = useSearchParams()
  const paramValues = params.map((param) => searchParams?.get(param))

  useEffect(() => {
    if (paramValues.length && onParams) {
      onParams(paramValues)
    }
  }, [paramValues, onParams])

  if (paramValues.length) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {paramValues.map((paramValue, index) => {
          if (!paramValue) return null

          const style = paramStyles[params[index] ?? 'message'] ?? paramStyles.message!
          const Icon = style.icon

          return (
            <div
              key={paramValue}
              className={cn(
                'flex items-start gap-3 rounded-default border p-4 font-sans text-sm',
                style.wrap,
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p>{paramValue}</p>
            </div>
          )
        })}
      </div>
    )
  }

  return null
}
