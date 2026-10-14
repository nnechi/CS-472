import { FormEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
import useAuth from "../../hooks/useAuth"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../../utils/roomCode"

// Students join an existing Socket.IO room by entering the code their
// teacher shared. The chat itself is rendered at /rooms/join/:roomCode.
export default function StudentDashboard() {
    const navigate = useNavigate()
    const { auth } = useAuth()
    const [room, setRoom] = useState("")
    const [error, setError] = useState("")

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        const code = normalizeRoomCode(room)
        if (!code) {
            setError("Enter the room code your teacher shared.")
            return
        }
        navigate(`/rooms/join/${code}`)
    }

    return (
        <>
            <h1 className="text-2xl font-bold">Welcome{auth ? `, ${auth.user.name}` : ""}</h1>
            <h2 className="mt-4 text-lg">Ready to join a class?</h2>
            <p className="text-gray-600">Enter the room code your teacher gave you.</p>

            <form onSubmit={handleSubmit} className="mt-4 flex max-w-sm flex-col gap-3" noValidate>
                <label htmlFor="roomCode" className="font-bold">Room code</label>
                <input
                    id="roomCode"
                    className="rounded-lg border border-gray-300 px-3 py-2 uppercase placeholder:normal-case"
                    value={room}
                    onChange={(e) => {
                        setRoom(e.target.value)
                        setError("")
                    }}
                    placeholder="e.g. AB12CD"
                    maxLength={ROOM_CODE_MAX_LENGTH}
                    autoComplete="off"
                    autoFocus
                />
                {error && (
                    <p role="alert" className="text-sm text-red-700">{error}</p>
                )}
                <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                >
                    Join room
                </button>
            </form>
        </>
    )
}
