import { Navigate, useParams } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import TeacherRoom from "../pages/teacher/TeacherRoom"
import { normalizeRoomCode } from "../utils/roomCode"

// /rooms/:roomId -- signed-in teachers get the live room. Anyone else (a student
// opening a shared link) goes to the join page with the room code filled in.
export default function RoomEntry() {
    const { auth, loading } = useAuth()
    const { roomId = "" } = useParams()

    if (loading) {
        return <p>Loading...</p>
    }

    if (!auth?.user) {
        return <Navigate to={"/joinroom?code=" + encodeURIComponent(normalizeRoomCode(roomId))} replace />
    }

    return <TeacherRoom />
}
