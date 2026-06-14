import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
    HTMLLabelElement,
    React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
    <label
        ref={ref}
        className={cn(
            "text-[10px] uppercase text-[#5e625a] font-bold",
            className
        )}
        {...props}
    />
))
Label.displayName = "Label"

export { Label }
