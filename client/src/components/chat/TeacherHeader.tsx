import { Session } from "../../types";
import Timer from "../Timer"
import { HandQueue } from "../HandQueue"
import { socket } from "../../socket"
import type { RoomSocket } from "../../hooks/useRoomSocket"

interface TeacherHeaderProps {
    session: Session
    room: RoomSocket
}

// This component represents the header for the teacher interface. Contains the room code like the student header,
// but also has the timer and raise hand queue
export default function TeacherHeader({ session, room } : TeacherHeaderProps){
    return (
        <div className="border-b border-brand/20 bg-paper text-brand shadow-[0_2px_8px_rgba(34,21,116,0.08)]">
            <div className="flex flex-wrap items-center gap-3 px-6 pt-4 text-sm">
                <span className="text-brand/70">Room code</span>
                <strong className="rounded-md border border-brand bg-white px-3 py-1 text-xl tracking-[0.2em] text-brand">{session.room}</strong>
                <span className="text-brand/70">Share this with your students</span>
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
                <HandQueue
                    queue={room.handQueue}
                    onLowerHand={room.lowerHand}
                    onOpenPrivateChat={room.openPrivateChat}
                />
            </div>
        </div>
    )
}