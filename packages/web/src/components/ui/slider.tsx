import * as React from "react"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <input
        type="range"
        className={cn(
            "w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-indigo-500 [&::-webkit-slider-thumb]:to-purple-500",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/30",
            "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-indigo-500",
            "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
            className
        )}
        ref={ref}
        {...props}
    />
))
Slider.displayName = "Slider"

export { Slider }
