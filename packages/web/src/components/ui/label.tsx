import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
    HTMLLabelElement,
    React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
    <label
        ref={ref}
        className={cn(
            "text-[10px] uppercase tracking-wider text-slate-500 font-medium",
            className
        )}
        {...props}
    />
))
Label.displayName = "Label"

export { Label }
