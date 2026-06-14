import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <input
        type="range"
        className={cn(
            "w-full h-1.5 bg-[#b8bab3] rounded-sm appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5",
            "[&::-webkit-slider-thumb]:bg-[#ff5a1f] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#96320f]",
            "[&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:transition-colors",
            "[&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:bg-[#ff5a1f]",
            "[&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:border-[#96320f]",
            className
        )}
        ref={ref}
        {...props}
    />
))
Slider.displayName = "Slider"

export { Slider }
