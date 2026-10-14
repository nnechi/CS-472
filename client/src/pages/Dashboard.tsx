import { Navigate } from "react-router-dom"
import useAuth from "../hooks/useAuth"
import TeacherDashboard from "./teacher/TeacherDashboard"

// /dashboard: teachers create rooms. Students don't sign in, so anyone else
// is sent to the home page to enter a room code.
export default function Dashboard() {
    const { auth } = useAuth()
    if (!auth) return null // RequireAuth already redirects; this keeps TS happy.

    return auth.user.role === "teacher" ? <TeacherDashboard /> : <Navigate to="/" replace />
}
