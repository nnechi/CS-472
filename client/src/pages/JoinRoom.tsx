import { FormEvent, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"
import { checkRoomExists } from "../api.ts"; 

import wideLogo from "../assets/LittlePointers Logo/Full Logo Wide.png"

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
        <div className="flex flex-col items-center justify-center gap-10 pb-12 pt-4 md:flex-row md:gap-16 md:-translate-x-32">
            <img src={wideLogo} alt="LittlePointers" className="h-auto w-96 md:w-[44rem] md:shrink-0 -translate-y-6 md:translate-x-12" />
            <div className="flex w-full max-w-md shrink-0 md:w-[28rem] md:-translate-x-12 flex-col gap-3 rounded-2xl bg-[#ccc9f7] px-9 py-11 text-brand shadow-[0_4px_14px_rgba(34,21,116,0.15)]">
            <h1 className="text-center text-4xl font-bold">Join a Room</h1>

            <form onSubmit={handleSubmit} className="-mt-2 flex flex-col gap-3" noValidate>
                <label htmlFor="roomCode" className="relative top-2 text-center text-xl font-bold text-[#7A2E0E]">Code</label>
                <input
                    id="roomCode"
                    className="mx-auto w-[70%] rounded-lg border-2 border-[#D1003F] text-[#7A2E0E] px-3 py-5 text-center text-xl uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-lg placeholder:text-[#7A2E0E]/85 focus:border-[#800026] focus:outline-none"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value)
                        setError("")
                    }}
                    placeholder="Enter code"
                    maxLength={ROOM_CODE_MAX_LENGTH}
                    autoComplete="off"
                />

                <label htmlFor="displayName" className="relative top-2 text-center text-xl font-bold text-[#7A2E0E]">Your name</label>
                <input
                    id="displayName"
                    className="mx-auto w-[70%] rounded-lg border-2 border-[#D1003F] text-[#7A2E0E] px-3 py-5 text-center text-xl placeholder:text-lg placeholder:text-[#7A2E0E]/85 focus:border-[#800026] focus:outline-none"
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
                    className="mx-auto w-1/2 rounded-lg bg-brand px-4 py-4 text-xl text-white cursor-pointer hover:bg-brand/90"
                >
                    Join 
                </button>
            </form>
        </div>
        </div>
    )
}
