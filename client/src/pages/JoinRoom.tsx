import { FormEvent, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"
import { checkRoomExists } from "../api.ts"; 

// Students land here, enter the room code their teacher shared, and go straight
// into the room. No account is needed. The name is only shown in the chat and
// in the teacher's hand queue, so the teacher knows who is asking for help.
export default function JoinRoom() {
    const navigate = useNavigate()
    const [code, setCode] = useState("")
    const [name, setName] = useState("")
    const [error, setError] = useState("")

    const handleSubmit =  async (e: FormEvent) => {
        e.preventDefault()
        const roomCode = normalizeRoomCode(code)
        const username = name.trim().slice(0, 32)
        if (!roomCode) {
            setError("Enter the room code your teacher shared.")
            return
        }
        if (!username) {
            setError("Enter a name so your teacher knows who you are.")
            return
        }
        // The name travels in router state, not the URL, so it stays out of links.

        try { 
            const verifyRoom = await (checkRoomExists(roomCode)); 
            if (verifyRoom){
            navigate(`/rooms/join/${roomCode}`, { state: { username } })
            } else { 
                setError("That room doesn't exist or it has expired."); 
                return; 
            }
        } catch (e){ 
            setError("Couldn't reach server, try again."); 
            console.error(e);
            return;
        }

    }

    return(
        <div className="mx-auto flex max-w-sm flex-col gap-3 p-6">
            <h1 className="text-2xl font-bold">Join a Room</h1>

            <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3" noValidate>
                <label htmlFor="roomCode" className="font-bold">Code</label>
                <input
                    id="roomCode"
                    className="rounded-lg border border-gray-300 px-3 py-2 uppercase placeholder:normal-case"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value)
                        setError("")
                    }}
                    placeholder="Enter code"
                    maxLength={ROOM_CODE_MAX_LENGTH}
                    autoComplete="off"
                    autoFocus
                />

                <label htmlFor="displayName" className="font-bold">Your name</label>
                <input
                    id="displayName"
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError("")
                    }}
                    placeholder="Enter your name"
                    maxLength={32}
                    autoComplete="nickname"
                />

                {error && (
                    <p role="alert" className="text-sm text-red-700">{error}</p>
                )}
                <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                >
                    Join 
                </button>
            </form>

            <p className="mt-4 text-sm text-gray-500">
                Are you a teacher?{" "}
                <Link to="/login" className="underline hover:text-black">Sign in</Link>
                {" "}to create a room.
            </p>
        </div>
    )
}
