import { useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"

export default function TeacherDashboard() {
    const navigate = useNavigate()
    const { auth, logout } = useAuth()

    return (
        <> {auth && <>
            <h1>This is the dashboard home page</h1>
            <h2>Ready to start a class?</h2>
                {/* Create a room is another page and link but we can change it to a component and keep on 
                dashboard page (kind of like students joining a room on the home page?) */}
                <p>Create a room for your students to join.</p>

                <button className="border border-gray-300 text-gray-900 cursor-pointer" onClick={() => navigate("/dashboard/rooms/new")}>
                    Create a Room
                </button> 

                <button className="border border-gray-300 text-gray-900 cursor-pointer" onClick={logout}>
                    Logout
                </button>
            </>
            }
        </>
        
    )
}