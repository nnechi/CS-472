import { useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import CreateRoom from "../../components/CreateRoom"
import Activity from "../../components/Activity"

// Teachers create a Socket.IO room and share its code with students.
export default function TeacherDashboard() {
    const { auth } = useAuth()
    const navigate = useNavigate()
    const [showCreateRoom, setShowCreateRoom] = useState(false)

    return (
        <>
            
            {showCreateRoom ? (
                <CreateRoom onClose={() => setShowCreateRoom(false)} />
            ) : (
                <>
                    {/* Section for creating the room */}
                    <section>
                        <h1 className="mt-8 text-6xl font-bold">Welcome{auth ? `, ${auth.user.name}!` : ""}</h1>
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
                    </section>
                    
                    {/* Section for showing the activites created by the current user */}
                    <section>
                        <div className="mt-10 flex items-center justify-between">
                            <h2 className="text-4xl font-bold">Your Activities</h2>
                            <button
                                type="button"
                                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                                onClick={() => navigate("/dashboard/create-activity")}
                            >
                                Create New Activity
                            </button>
                        </div>

                        {/* These are placeholder activities for now. TODO: Show the activites saved under that teacher's profile */}
                        <div className="mt-4 rounded-lg bg-gray-100 p-4 h-128 overflow-y-auto space-y-4">
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                            <Activity name="Activity Name" />
                        </div>
                    </section>
                </>
            )}
        </>
    )
}
