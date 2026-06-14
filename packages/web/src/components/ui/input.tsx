import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-7 w-full rounded-sm border border-[#8f9289] bg-[#f6f6f1] px-2 py-1 text-[12px] text-[#121212] transition-colors',
          'file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-[#5e625a]',
          'placeholder:text-[#777b73]',
          'focus:outline-none focus:ring-2 focus:ring-[#ff5a1f] focus:border-[#ff5a1f]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
