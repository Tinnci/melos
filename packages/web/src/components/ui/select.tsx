import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-7 w-full appearance-none rounded-sm border border-[#8f9289] bg-[#f6f6f1] px-2 py-1 pr-7 text-[12px] text-[#121212] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#ff5a1f] focus:border-[#ff5a1f]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          ref={ref}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d504a] pointer-events-none" />
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
