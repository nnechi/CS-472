import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import { usePastRoom } from "../../hooks/usePastRoom"
import { normalizeRoomCode } from "../../utils/roomCode"
import { TeacherRoomView } from "./TeacherRoom"

// /previous-rooms/:roomId -- a room the teacher already ended, read-only: every
// student's saved work, the group chat and the private chats. No socket is
// opened, so no student can join it.
export default function PreviousRoom() {
    const { auth } = useAuth()
    const { roomId } = useParams()
    const roomCode = normalizeRoomCode(roomId ?? "")

    // Signed out (including a session the server lost, which usePastRoom turns
    // into setAuth(null)): RequireAuth sends the user to /login with this room as
    // the place to return to, so don't redirect to the list here.
    if (!auth) return null
    if (!roomCode) return <Navigate to="/dashboard/previous-activities" replace />

    return <PreviousRoomScreen roomCode={roomCode} username={auth.user.name} />
}

function PreviousRoomScreen({ roomCode, username }: { roomCode: string; username: string }) {
    const navigate = useNavigate()
    const room = usePastRoom(roomCode)

    if (room.status === "loading") {
        return <p className="p-8 text-brand">Loading room…</p>
    }

    if (room.status === "missing") {
        return (
            <div className="flex flex-col items-start gap-3 p-8 text-brand">
                <p>This room isn't in your previous activities.</p>
                <Link to="/dashboard/previous-activities" className="font-semibold underline">
                    Back to previous activities
                </Link>
            </div>
        )
    }

    if (room.status === "error") {
        return (
            <div className="flex flex-col items-start gap-3 p-8 text-brand">
                <p role="alert">{room.errorMessage}</p>
                <Link to="/dashboard/previous-activities" className="font-semibold underline">
                    Back to previous activities
                </Link>
            </div>
        )
    }

    const ended = room.endedAt
        ? new Date(room.endedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : null

    return (
        <TeacherRoomView
            room={room}
            session={{ username, role: "teacher", room: roomCode }}
            onLeave={() => navigate("/dashboard/previous-activities")}
            statusLabel={ended ? `Ended ${ended}` : "Ended"}
        />
    )
}
