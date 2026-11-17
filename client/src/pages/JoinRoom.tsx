import { FormEvent, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"
import { getRoomStatus } from "../api.ts";

// Students land here, enter the room code their teacher shared, and go straight
// into the room. No account is needed. The name is only shown in the chat and
// in the teacher's hand queue, so the teacher knows who is asking for help.
export default function JoinRoom() {
    const navigate = useNavigate()
    // A shared link (/rooms/<CODE>) lands here as /joinroom?code=<CODE>, so the code starts filled in.
    // The student still types their name and presses Join.
    const [searchParams] = useSearchParams()
    const [code, setCode] = useState(() =>
        normalizeRoomCode(searchParams.get("code") ?? "").slice(0, ROOM_CODE_MAX_LENGTH)
    )
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
            const status = await getRoomStatus(roomCode);
            if (status === "ok" || status === "not-open") {
                navigate(`/rooms/join/${roomCode}`, { state: { username, waiting : status ==="not-open"} })
                
            } else {
                setError("That room doesn't exist or it has expired.");
            }
        } catch (e){ 
            setError("Couldn't reach server, try again."); 
            console.error(e);
            return;
        }

    }

    return(
        <div className="flex flex-col items-center justify-center gap-6 pb-12 pt-4">
            <h1 className="text-center text-5xl font-bold text-[#1F1666] [-webkit-text-stroke:1.5px_#1F1666]">Join a Room</h1>
            <div className="flex w-full max-w-md shrink-0 md:w-[28rem] flex-col gap-3 rounded-2xl bg-[#CDC8F4] px-9 pt-7 pb-11 text-[#1F1666] shadow-[0_4px_14px_rgba(34,21,116,0.15)]">

            <form onSubmit={handleSubmit} className="-mt-2 flex flex-col gap-3" noValidate>
                <label htmlFor="roomCode" className="relative top-2 text-center text-xl font-bold text-[#1F1666]">Code</label>
                <input
                    id="roomCode"
                    className="mx-auto w-[70%] rounded-lg border-2 border-[#5A52A6] bg-white text-[#1F1666] px-3 py-5 text-center text-xl uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-lg placeholder:text-[#6B6890] focus:border-[#1F1666] focus:outline-none focus:ring-4 focus:ring-[#A9A0F0]"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value)
                        setError("")
                    }}
                    placeholder="Enter code"
                    maxLength={ROOM_CODE_MAX_LENGTH}
                    autoComplete="off"
                />

                <label htmlFor="displayName" className="relative top-2 text-center text-xl font-bold text-[#1F1666]">Your Name</label>
                <input
                    id="displayName"
                    className="mx-auto w-[70%] rounded-lg border-2 border-[#5A52A6] bg-white text-[#1F1666] px-3 py-5 text-center text-xl placeholder:text-lg placeholder:text-[#6B6890] focus:border-[#1F1666] focus:outline-none focus:ring-4 focus:ring-[#A9A0F0]"
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
                    <p role="alert" className="rounded-md border border-[#C62839] bg-white px-3 py-2 text-sm text-[#C62839]">{error}</p>
                )}
                <button
                    type="submit"
                    className="mx-auto mt-5 w-[70%] rounded-lg bg-[#1F1666] px-4 py-4 text-xl text-white cursor-pointer hover:bg-[#2E2390]"
                >
                    Join Room
                </button>
            </form>
        </div>
        </div>
    )
}
