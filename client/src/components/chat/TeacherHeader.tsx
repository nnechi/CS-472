import { AnswerProgress, Session } from "../../types";
import Timer from "../Timer"
import { HandRaiseAlert } from "../HandQueue"
import { RoomCodeBadge } from "./RoomCodeBadge"
import { socket } from "../../socket"
import type { RoomSocket } from "../../hooks/useRoomSocket"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface TeacherHeaderProps {
    session: Session
    room: RoomSocket
    progress?: AnswerProgress
}

// This component represents the header for the teacher interface. Contains the room code like the student header,
// but also has the timer and raise hand queue
export default function TeacherHeader({ session, room, progress } : TeacherHeaderProps){
    // Picking a question moves every student in the room to it.
    const questions = room.activity?.questions ?? []
    const index = Math.min(room.currentQuestion, questions.length - 1)
    const onFirstQuestion = index === 0
    const onLastQuestion = index === questions.length - 1

    return (
        <div className="bg-white text-black">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
                <RoomCodeBadge code={session.room} hint="Share this with your students" />
                <HandRaiseAlert count={room.handQueue.length} />
            </div>

            <div>
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

                {questions.length > 0 && (
                    <Pagination aria-label="Questions">
                        <PaginationContent className="flex-wrap justify-center">
                            <PaginationItem>
                                <PaginationPrevious
                                    aria-label="Go to previous question"
                                    aria-disabled={onFirstQuestion}
                                    className={onFirstQuestion ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                                    className={onLastQuestion ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    onClick={() => !onLastQuestion && room.selectQuestion(index + 1)}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>
        </div>
    )
}