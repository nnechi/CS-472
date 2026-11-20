import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface LeaveRoomButtonProps {
  onLeave: () => void
  className?: string
}

// Shared by the student header and the room navbar so both roles leave a
// room through the exact same callback — this only changes how the control
// looks, never what happens when it's pressed.
export function LeaveRoomButton({ onLeave, className }: LeaveRoomButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Leave Room"
              onClick={onLeave}
              className={cn(
                "cursor-pointer rounded-full border-brand/40 bg-white text-brand shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600",
                className
              )}
            >
              <LogOut />
            </Button>
          }
        />
        <TooltipContent>Leave Room</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
