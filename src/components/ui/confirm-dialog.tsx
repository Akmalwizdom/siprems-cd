import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X, AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  onConfirm,
  variant = "default"
}: ConfirmDialogProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [open, onOpenChange])

  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const isDestructive = variant === "destructive"

  // Use portal to render at document.body level
  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        style={{ zIndex: 99998 }}
      />
      
      {/* Dialog */}
      <div 
        className={cn(
          "relative bg-white rounded-xl shadow-2xl border flex flex-col animate-in fade-in zoom-in-95 duration-200",
          isDestructive ? "border-red-200" : "border-slate-200"
        )}
        style={{ 
          zIndex: 99999,
          width: 'min(90vw, 500px)', // Increased width per user request
          maxWidth: '500px'
        }}
      >
        {/* Header with icon */}
        <div className={cn(
          "flex items-center gap-4 p-6 border-b",
          isDestructive ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
        )}>
          {isDestructive && (
            <div className="p-2.5 bg-red-100 rounded-full shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className={cn(
              "text-lg font-semibold truncate",
              isDestructive ? "text-red-900" : "text-slate-900"
            )}>
              {title}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full hover:bg-black/5 transition-colors shrink-0"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>

        {/* Footer */}
        <div className={cn(
          "flex justify-end gap-3 p-4 border-t",
          isDestructive ? "bg-red-50/30 border-red-100" : "bg-slate-50/50 border-slate-100"
        )}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-w-[90px]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            className={cn(
              "min-w-[90px]",
              isDestructive && "border-red-600 hover:bg-red-700" 
            )}
            style={isDestructive ? { backgroundColor: '#dc2626', color: 'white' } : undefined}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
