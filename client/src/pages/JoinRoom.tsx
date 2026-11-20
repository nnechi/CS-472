import { FormEvent, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ROOM_CODE_MAX_LENGTH, normalizeRoomCode } from "../utils/roomCode"
import { getRoomStatus } from "../api.ts";
import PupAvatar, { PUPS, PUP_IDS, type PupId, loadPupId, randomPupId, savePupId } from "../components/chat/PupAvatar"

// Students land here, enter the room code their teacher shared, and go straight
// into the room. No account is needed. The name is only shown in the chat and
// in the teacher's hand queue, so the teacher knows who is asking for help.
// like joining a Zoom meeting, the student also picks a pup here,
// all on one screen. The pup can't be changed once they are in the room.
export default function JoinRoom() {
    const navigate = useNavigate()
    // A shared link (/rooms/<CODE>) lands here as /joinroom?code=<CODE>, so the code starts filled in.
    // The student still types their name and presses Join.
    const [searchParams] = useSearchParams()
    const [code, setCode] = useState(() =>
        normalizeRoomCode(searchParams.get("code") ?? "").slice(0, ROOM_CODE_MAX_LENGTH)
    )
    const [name, setName] = useState("")
    // starts on the pup saved on this browser, or a random one the first time.
    const [pup, setPup] = useState<PupId>(() => loadPupId())
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
                // save the pup before entering. The room reads it when it connects.
                savePupId(pup)
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

    // the whole form below was restyled into one white card:
    // room code, name, pup, then Join room.
    return(
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center pb-12 pt-4">
            <form
                onSubmit={handleSubmit}
                noValidate
                className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-brand bg-white p-7 text-brand shadow-[0_4px_14px_rgba(34,21,116,0.15)]"
            >
                <h1 className="text-center text-3xl font-bold">Join a Room</h1>

                <div className="flex flex-col gap-2">
                    <label htmlFor="roomCode" className="font-bold">Room code</label>
                    <input
                        id="roomCode"
                        className="rounded-lg border-2 border-brand/40 bg-white px-3 py-3 text-center text-xl uppercase tracking-widest text-brand placeholder:normal-case placeholder:tracking-normal placeholder:text-lg placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-pop"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value)
                            setError("")
                        }}
                        placeholder="Enter code"
                        maxLength={ROOM_CODE_MAX_LENGTH}
                        autoComplete="off"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="displayName" className="font-bold">Your name</label>
                    <input
                        id="displayName"
                        className="rounded-lg border-2 border-brand/40 bg-white px-3 py-3 text-lg text-brand placeholder:text-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-pop"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value)
                            setError("")
                        }}
                        placeholder="Enter your name"
                        maxLength={32}
                        autoComplete="nickname"
                    />
                </div>

                {/* pick a pup. */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">Pick your pup</span>
                        <button
                            type="button"
                            className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold underline hover:bg-brand-light/40"
                            onClick={() => setPup(randomPupId(pup))}
                        >
                            Shuffle
                        </button>
                    </div>

                    {/* What the class will see next to this student's messages. */}
                    <div className="flex items-center gap-3 rounded-xl bg-brand-light/30 p-3">
                        <PupAvatar pup={pup} size={54} />
                        <div className="flex flex-col">
                            <span className="font-bold">{name.trim() || "You"} as a {PUPS[pup].label}</span>
                            <span className="text-sm text-brand/70">You keep this pup until you leave the room.</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pups">
                        {PUP_IDS.map((id) => {
                            const selected = id === pup
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-xs font-semibold ${
                                        selected
                                            ? "border-2 border-brand bg-brand-light/30"
                                            : "border border-brand/15 bg-white hover:bg-brand-light/20"
                                    }`}
                                    onClick={() => setPup(id)}
                                    aria-pressed={selected}
                                >
                                    <PupAvatar pup={id} size={44} />
                                    {PUPS[id].label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {error && (
                    <p role="alert" className="rounded-md border border-[#C62839] bg-white px-3 py-2 text-sm text-[#C62839]">{error}</p>
                )}
                <button
                    type="submit"
                    className="h-12 w-full cursor-pointer rounded-xl bg-brand text-lg font-bold text-white hover:bg-brand/90"
                >
                    Join room
                </button>
            </form>
        </div>
    )
}
