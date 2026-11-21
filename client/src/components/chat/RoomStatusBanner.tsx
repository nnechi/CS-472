import type { ReactNode } from "react"
import { CloudOff, UserRoundX } from "lucide-react"
import { cn } from "@/lib/utils"

interface RoomStatusBannerProps {
    // "offline": this page lost its connection. "away": someone else is out of the room.
    kind: "offline" | "away"
    children: ReactNode
}

// A thin bar under a room's header for news about the connection: this page
// reconnecting, or a student's teacher being away. Screen readers hear it
// when it appears.
export default function RoomStatusBanner({ kind, children }: RoomStatusBannerProps) {
    const Icon = kind === "offline" ? CloudOff : UserRoundX
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "flex items-center gap-2 border-b px-4 py-2 text-sm sm:px-8",
                kind === "offline"
                    ? "border-accent/40 bg-accent/10 text-brand"
                    : "border-brand/15 bg-pop/40 text-brand"
            )}
        >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </div>
    )
}
