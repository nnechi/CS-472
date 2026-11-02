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
        <div className="flex item-center justify-center py-12">
            <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-brand bg-white p-9 text-brand shadow-[0_4px_14px_rgba(34,21,116,0.15)]">
            <h1 className="text-2xl font-bold">Join a Room</h1>

            <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3" noValidate>
                <label htmlFor="roomCode" className="font-bold">Code</label>
                <input
                    id="roomCode"
                    className="rounded-lg border border-brand/30 px-3 py-2 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-brand/40 focus:border-brand focus:outline-none"
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
                    className="rounded-lg border border-brand/30 px-3 py-2 placeholder:text-brand/40 focus:border-brand focus:outline-none"
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
                    <p role="alert" className="rounded-md bg-warn px-3 py-2 text-sm text-brand">{error}</p>
                )}
                <button
                    type="submit"
                    className="rounded-lg bg-brand px-4 py-2 text-white cursor-pointer hover:bg-brand/90"
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
        </div>
    )
}
