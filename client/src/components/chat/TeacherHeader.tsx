import { AnswerProgress, Session } from "../../types"
import Timer from "../Timer"
import { HandRaiseAlert } from "../HandQueue"
import { RoomCodeBadge } from "./RoomCodeBadge"
import { LeaveRoomButton } from "./LeaveRoomButton"
import UserAvatar from "../UserAvatar"
import useAuth from "../../hooks/useAuth"
import shortLogo from "../../assets/LittlePointers Logo/Short Logo.png"
import { socket } from "../../socket"
import { cn } from "@/lib/utils"
import type { RoomSocket } from "../../hooks/useRoomSocket"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"

// Previous/Next render as the shared Pagination's "ghost" variant by default,
// which is nearly invisible against the brand-light header -- give them the
// same visible, bordered pill look as the header's other icon buttons.
const QUESTION_NAV_CLASS =
    "rounded-full border border-brand/40 bg-white text-brand shadow-sm hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"

interface TeacherHeaderProps {
    session: Session
    room: RoomSocket
    progress?: AnswerProgress

    // Leaving unmounts the chat, which disconnects the socket and ends the room.
    onLeave: () => void
}

// The teacher's room header: one consolidated bar (this replaced two separate
// stacked bars -- a site-style navbar plus an unstyled controls strip). Room
// identity sits on the left, the timer is mathematically centered via a
// 3-column grid regardless of how wide the two sides are, and the hand-raise
// alert, teacher identity, and leave control sit on the right. Below md, the
// three groups stack instead of competing for one row. The question picker
// sits in a lighter secondary row beneath, since it controls the activity
// panel below rather than being header-level room info.
export default function TeacherHeader({ session, room, progress, onLeave }: TeacherHeaderProps) {
    const { auth } = useAuth()
    // Picking a question moves every student in the room to it.
    const questions = room.activity?.questions ?? []
    const index = Math.min(room.currentQuestion, questions.length - 1)
    const onFirstQuestion = index === 0
    const onLastQuestion = index === questions.length - 1

    return (
        <div className="border-b border-brand bg-brand-light text-brand">
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-8 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
                    <img src={shortLogo} alt="LittlePointers" className="h-8 w-auto shrink-0" />
                    <RoomCodeBadge code={session.room} hint="Share this with your students" size="lg" />
                </div>

                <div className="flex items-center justify-center">
                    <Timer
                        durationMs={room.timer.durationMs}
                        remainingMs={room.timer.remainingMs}
                        running={room.timer.running}
                        isTeacher={true}
                        onPlay={() => socket.emit("timer play")}
                        onPause={() => socket.emit("timer pause")}
                        onRestart={() => socket.emit("timer restart")}
                        onSetMinutes={(minutes) => socket.emit("timer set", { minutes })}
                    />
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 sm:gap-4">
                    <HandRaiseAlert count={room.handQueue.length} />
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <span
                                        tabIndex={0}
                                        aria-label={session.username}
                                        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                                    >
                                        <UserAvatar name={session.username} picture={auth?.user.picture ?? null} size="md" />
                                    </span>
                                }
                            />
                            <TooltipContent>{session.username}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <span className="h-6 w-px shrink-0 bg-brand/20" aria-hidden="true" />
                    <LeaveRoomButton onLeave={onLeave} />
                </div>
            </div>

            {questions.length > 0 && (
                <div className="border-t border-brand/15 px-4 py-2 sm:px-8">
                    <Pagination aria-label="Questions">
                        <PaginationContent className="flex-wrap justify-center">
                            <PaginationItem>
                                <PaginationPrevious
                                    aria-label="Go to previous question"
                                    aria-disabled={onFirstQuestion}
                                    className={cn(QUESTION_NAV_CLASS, onFirstQuestion ? "pointer-events-none opacity-50" : "cursor-pointer")}
                                    onClick={() => !onFirstQuestion && room.selectQuestion(index - 1)}
                                />
                            </PaginationItem>
                            {questions.map((_, i) => {
                                const correct = progress?.results[i] === true
                                return (
                                    <PaginationItem key={i}>
                                        <PaginationLink
                                            aria-label={`Question ${i + 1}${correct ? ", correct" : ""}`}
                                            isActive={i === index}
                                            className={`cursor-pointer ${correct ? "text-green-700" : ""}`}
                                            onClick={() => room.selectQuestion(i)}
                                        >
                                            {i + 1}
                                        </PaginationLink>
                                    </PaginationItem>
                                )
                            })}
                            <PaginationItem>
                                <PaginationNext
                                    aria-label="Go to next question"
                                    aria-disabled={onLastQuestion}
                                    className={cn(QUESTION_NAV_CLASS, onLastQuestion ? "pointer-events-none opacity-50" : "cursor-pointer")}
                                    onClick={() => !onLastQuestion && room.selectQuestion(index + 1)}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </div>
    )
}
