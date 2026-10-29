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
        <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 text-black">
            <HandQueue
                queue={room.handQueue}
                onLowerHand={room.lowerHand}
                onOpenPrivateChat={room.openPrivateChat}
            />
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
            <span className="ml-auto flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Room code: {session.room}
                </span>
                <span className="text-sm text-gray-500">Share this with your students</span>
            </span>
        </div>
    )
}