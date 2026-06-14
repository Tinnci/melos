import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'

const baseBadgeClass =
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-bold transition-colors'

const variantClass: Record<BadgeVariant, string> = {
  default: 'bg-[#ff5a1f] text-black border-[#b43e16]',
  secondary: 'bg-[#cdd0c8] text-[#20221f] border-[#8f9289]',
  success: 'bg-[#dcedc6] text-[#245900] border-[#6ea82f]',
  warning: 'bg-[#f5dfaa] text-[#6b3f00] border-[#c77a00]',
  destructive: 'bg-[#ffd7d7] text-[#8a1111] border-[#d52222]',
  outline: 'border-[#8f9289] text-[#20221f]',
}

function badgeVariants({
  variant = 'default',
  className,
}: {
  variant?: BadgeVariant
  className?: string
} = {}) {
  return cn(baseBadgeClass, variantClass[variant], className)
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={badgeVariants({ variant, className })} {...props} />
}

export { Badge }
