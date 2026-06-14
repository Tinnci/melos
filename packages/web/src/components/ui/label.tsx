import * as React from "react"
import { cn } from "@/lib/utils"

const Label = React.forwardRef<
    HTMLLabelElement,
    React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Call sites provide htmlFor or compose the label with a control.
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
