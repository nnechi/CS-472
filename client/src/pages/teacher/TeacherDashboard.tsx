import { useNavigate } from "react-router-dom"

export default function TeacherDashboard() {
    const navigate = useNavigate()
    
    return (
        <>
            <h1>This is the dashboard home page</h1>
            <h2>Ready to start a class?</h2>
                <p>Create a room for your students to join.</p>

                <button onClick={() => navigate("/dashboard/rooms/new")}>
                    Create a Room
                </button> 
        </>
        
    )
}