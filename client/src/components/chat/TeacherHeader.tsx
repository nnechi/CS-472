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
        <div className="bg-white text-black">
            <div className="border-b border-gray-200 px-4 py-2 text-sm">
                Room code: <strong>{session.room}</strong>
                <span className="text-gray-500"> — share this with your students</span>
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