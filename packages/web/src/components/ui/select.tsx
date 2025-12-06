import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: { value: string; label: string }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, options, ...props }, ref) => {
        return (
            <div className="relative">
                <select
                    className={cn(
                        "flex h-9 w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1 pr-8 text-sm text-white shadow-sm transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className
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
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
