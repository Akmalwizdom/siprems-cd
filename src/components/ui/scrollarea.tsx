import * as React from "react"
import { cn } from "./utils"

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div className="h-full w-full rounded-[inherit] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent hover:scrollbar-thumb-slate-400">
        {children}
      </div>
    </div>
  )
})
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
