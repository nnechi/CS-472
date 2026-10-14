import { useState } from "react"
import useAuth from "../../hooks/useAuth"
import CreateRoom from "../../components/CreateRoom"

// Teachers create a Socket.IO room and share its code with students.
export default function TeacherDashboard() {
    const { auth } = useAuth()
    const [showCreateRoom, setShowCreateRoom] = useState(false)

    return (
        <>
            
            {showCreateRoom ? (
                <CreateRoom onClose={() => setShowCreateRoom(false)} />
            ) : (
                <>
                    <h1 className="text-2xl font-bold">Welcome{auth ? `, ${auth.user.name}` : ""}</h1>
                    <h2 className="mt-4 text-lg">Ready to start a class?</h2>
                    <p className="text-gray-600">Create a room for your students to join.</p>
                    {/* Before the "create a room", well add "insert a template" (which has premade skeleton code) 
                    or "start from scratch" (which has a blank code editor). The template will be a dropdown menu of premade templates the teacher made already. */}
                    <button
                        type="button"
                        className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                        onClick={() => setShowCreateRoom(true)}
                    >
                        Create a Room
                    </button>
                </>
            )}
        </>
    )
}
