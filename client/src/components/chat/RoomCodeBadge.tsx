import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface RoomCodeBadgeProps {
  code: string
  // Shown on hover/focus instead of always-visible text (e.g. "Share this
  // with your students"). Omit for headers that don't need a hint.
  hint?: string
  // "lg" is a bigger rendering of the exact same pill — same shape and
  // colors, just more prominent for headers with fewer other elements.
  size?: "default" | "lg"
}

// A branded pill for the room code, shared by the teacher and student
// headers. Students join with this value, so it stays fully readable at
// all times — any extra hint only ever appears on hover/focus.
export function RoomCodeBadge({ code, hint, size = "default" }: RoomCodeBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-brand text-white",
        size === "lg" ? "gap-2.5 px-4 py-2" : "gap-2 px-3 py-1.5"
      )}
      tabIndex={hint ? 0 : undefined}
    >
      <span
        className={cn(
          "font-semibold tracking-wider text-brand-light uppercase",
          size === "lg" ? "text-xs" : "text-[11px]"
        )}
      >
        Room Code
      </span>
      <span
        className={cn(
          "font-mono font-bold tracking-[0.2em]",
          size === "lg" ? "text-lg" : "text-sm"
        )}
      >
        {code}
      </span>
    </span>
  )

  if (!hint) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={badge} />
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
