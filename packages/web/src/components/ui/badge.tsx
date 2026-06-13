import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline"

const baseBadgeClass = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"

const variantClass: Record<BadgeVariant, string> = {
    default: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
    secondary: "bg-slate-700 text-slate-300 border border-slate-600",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    destructive: "bg-red-500/20 text-red-400 border border-red-500/30",
    outline: "border border-slate-600 text-slate-400",
}

function badgeVariants({
    variant = "default",
    className,
}: {
    variant?: BadgeVariant
    className?: string
} = {}) {
    return cn(baseBadgeClass, variantClass[variant], className)
}

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement> {
    variant?: BadgeVariant
}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={badgeVariants({ variant, className })} {...props} />
    )
}

export { Badge }
