import useAuth from "../hooks/useAuth"
import StudentDashboard from "./student/StudentDashboard"
import TeacherDashboard from "./teacher/TeacherDashboard"

// /dashboard: students pick a room to join, teachers create one.
export default function Dashboard() {
    const { auth } = useAuth()
    if (!auth) return null // RequireAuth already redirects; this keeps TS happy.

    return auth.user.role === "teacher" ? <TeacherDashboard /> : <StudentDashboard />
}
