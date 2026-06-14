import * as React from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon"

const baseButtonClass =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border text-[11px] font-bold transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0"

const variantClass: Record<ButtonVariant, string> = {
    default:
        "border-[#b43e16] bg-[#ff5a1f] text-black hover:bg-[#ff713d]",
    destructive:
        "border-[#9a1717] bg-[#d52222] text-white hover:bg-[#ef3333]",
    outline:
        "border-[#8f9289] bg-transparent text-[#151515] hover:border-[#ff5a1f] hover:bg-[#f4e3db]",
    secondary:
        "border-[#8f9289] bg-[#d2d4ce] text-[#151515] hover:border-[#74766e] hover:bg-[#ecece7]",
    ghost:
        "border-transparent bg-transparent text-[#2b2d29] hover:border-[#9b9d95] hover:bg-[#d9dbd5]",
    link:
        "border-transparent bg-transparent text-[#c94412] underline-offset-4 hover:underline",
}

const sizeClass: Record<ButtonSize, string> = {
    default: "h-8 px-3 py-1",
    sm: "h-7 px-2.5 text-[11px]",
    lg: "h-9 px-4 text-xs",
    icon: "h-7 w-7 p-0",
}

function buttonVariants({
    variant = "default",
    size = "default",
    className,
}: {
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
} = {}) {
    return cn(baseButtonClass, variantClass[variant], sizeClass[size], className)
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={buttonVariants({ variant, size, className })}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
