import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { generateRoomCode } from "../../utils/roomCode"

// Rooms live in Socket.IO: a teacher "creates" one by joining a fresh code.
// The code is generated here; the server starts the room on the first join.
// Later this can POST /api/rooms so codes are unique and persisted.
export default function CreateRoom() {
    const navigate = useNavigate()
    const [code, setCode] = useState(generateRoomCode)

    return (
        <>
            <button
                type="button"
                className="cursor-pointer text-gray-600 hover:text-black"
                aria-label="Back to dashboard"
                onClick={() => navigate("/dashboard")}
            >
                X
            </button>
            <h1 className="mt-2 text-2xl font-bold">Create a room</h1>
            <p className="text-gray-600">Share this code with your students so they can join.</p>

            <p className="my-4 text-4xl font-bold tracking-widest">{code}</p>

            <div className="flex gap-3">
                <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                    onClick={() => setCode(generateRoomCode())}
                >
                    New code
                </button>
                <button
                    type="button"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700"
                    onClick={() => navigate(`/rooms/${code}`)}
                >
                    Open room
                </button>
            </div>
        </>
    )
}
