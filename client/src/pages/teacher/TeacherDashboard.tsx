import { useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"

// Teachers create a Socket.IO room and share its code with students.
export default function TeacherDashboard() {
    const navigate = useNavigate()
    const { auth } = useAuth()

    return (
        <>
            <h1 className="text-2xl font-bold">Welcome{auth ? `, ${auth.user.name}` : ""}</h1>
            <h2 className="mt-4 text-lg">Ready to start a class?</h2>
            {/* Create a room is another page and link but we can change it to a component and keep on 
            dashboard page (kind of like students joining a room on the dashboard page?) */}
            <p className="text-gray-600">Create a room for your students to join.</p>

            <button
                type="button"
                className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                onClick={() => navigate("/dashboard/rooms/new")}
            >
                Create a Room
            </button>
        </>
    )
}
