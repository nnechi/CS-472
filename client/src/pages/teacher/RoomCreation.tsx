import { useState, useEffect, useRef } from "react"
import { createRoom, deleteRoom, saveActivity, markRoomOpen} from '../../api.ts'
import { Link, useLocation, useNavigate } from "react-router-dom"
import shortLogo from "../../assets/LittlePointers Logo/Short Logo.png"


import useAuth from "../../hooks/useAuth.tsx"
import { socket } from "../../socket"
import { Participant } from "../../types"

// Later this can POST /api/rooms so codes are unique and persisted.
export default function RoomCreation() {
    const navigate = useNavigate()

    // "Start Room" on an activity sends its id here so it starts out the activity is already chosen
    const location = useLocation()
    const startingActivityId : string = location.state?.activityId ?? ""; // activityId of the activity chosen

    const { auth } = useAuth();
    const [code, setCode] = useState("");
    // True while a create request is in flight. New code / Open room are
    // disabled meanwhile, so the teacher can't open a code that's about to be
    // replaced (and deleted).
    const [busy, setBusy] = useState(true);

    const [saving, setSaving] = useState(false);
    const [participants, setParticipants] = useState<Participant[]>([]);
    // False once the panel unmounts, so a late response can clean up after itself.
    const mounted = useRef(false);


 // request code from the backend for the current room.
    async function requestCode() : Promise<string>{
        if (!auth){
            return ""; // no user found.
        }
        try {
           const newCode : string = await createRoom(auth.user.id);
            if (newCode === ""){
                throw new Error("Server did not return a room code.");
            }

           return newCode;


        } catch(e) {
            console.error(e);
            return "";
        }


    }


    function discardCode(code : string){
        if (auth && code) deleteRoom(code, auth.user.id).catch(console.error);
    }


    //render this once before component shows.
    useEffect( () => {
        let cancelled = false;
        requestCode().then((newCode) => {
            if (cancelled) discardCode(newCode)
            else { setCode(newCode); setBusy(false); }
    });

    return  () => { cancelled = true; }
}, []);

    // Link the chosen activity to the room code in the background, as soon as
    // both exist and again whenever either changes. Open room saves it once
    // more, so a failure here only gets logged.
    useEffect(() => {
        // If no user logged in or no room or no activity ID then do nothing
        if (!auth || !code || !startingActivityId) return;

        // API call to saveActivity to bind the room to the activity using the activity Id
        saveActivity(code, auth.user.id, startingActivityId).catch(console.error);
    }, [auth?.user.id, code, startingActivityId]);

    useEffect(() => {
        if (!auth || !code) return;

        const onParticipants = (list: Participant[]) => setParticipants(list);

        socket.on("participants", onParticipants);
        socket.connect();
        socket.emit("join", { username: auth.user.name, role: "teacher", room: code });

        return () => {
            socket.off("participants", onParticipants);
            socket.disconnect();
            setParticipants([]);
        };
    }, [code, auth?.user.id]);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    async function createNewCode(){
        if (busy) return;
        setBusy(true);
        const oldCode = code;
        const newCode = await requestCode();
        // Panel closed (X or navigation) while waiting: nobody will use this room.
        if (!mounted.current) { discardCode(newCode); return; }
        setBusy(false);
        if (!newCode) return ;
        setCode(newCode);
        discardCode(oldCode);
    }

    // Navigate into the room
    async function openRoom(){
        if (!auth || !startingActivityId || saving) return;
        setSaving(true);
        try {
            await saveActivity(code, auth.user.id, startingActivityId); 
            await markRoomOpen(code, auth.user.id, startingActivityId); 
            navigate(`/rooms/${code}`);
        } catch (e) {
            window.alert(`Could not open the room. ${e instanceof Error ? e.message : ""}`.trim());
            setSaving(false);
        }
    }

    function close(){
        discardCode(code);
        navigate("/dashboard")
    }

    return (
        <div className="min-h-screen bg-white text-brand">
            {/* Header bar, same height as the dashboard navbar. */}
            <header className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-brand-light py-3 pr-4 shadow-[0_4px_12px_rgba(34,21,116,0.25)] sm:h-20 sm:py-0 sm:pr-8">
                {/* Empty left column keeps the title centered in the header. */}
                <div aria-hidden="true" />
                {/* Short logo on each side of the title. The left one goes back to the dashboard. */}
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" aria-label="LittlePointers dashboard">
                        <img src={shortLogo} alt="" className="h-10" />
                    </Link>
                    <h1 className="text-center text-3xl font-bold">LittlePointers</h1>
                    <img src={shortLogo} alt="" className="h-10" aria-hidden="true" />
                </div>
                {/* Fix later to adjust for backend: delete a room/room code  */}
                <button
                    type="button"
                    className="justify-self-end rounded-lg px-2 text-4xl leading-none text-brand cursor-pointer hover:bg-white/60"
                    aria-label="Close create a room"
                    title="Close"
                    onClick={close}
                >
                    ×
                </button>
            </header>
            {/* Thin brand line under the header, same as the dashboard's content divider. */}
            <div className="border-t border-brand" aria-hidden="true" />

            <section className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-6 px-6 pb-8">
            <div className="flex flex-col gap-4 rounded-lg border border-brand/30 p-6">
                <p className="text-base text-brand/70">Room Code:</p>

                <p className="-mt-2 text-5xl font-bold tracking-widest text-brand">{code}</p>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        className="rounded-lg border border-brand/30 px-4 py-2 text-base text-brand cursor-pointer hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() => createNewCode()}
                    >
                        New code
                    </button>
                    <button
                        type="button"
                        className="rounded-lg bg-brand px-4 py-2 text-base text-white cursor-pointer hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!code || busy || saving || !startingActivityId}
                        onClick={openRoom}
                    >
                        {saving ? "Opening..." : "Open room"}
                    </button>
                    {!startingActivityId && <span className="text-sm text-brand/70">Pick an activity to open the room.</span>}
                </div>
            </div>
            </section>

            <div className="mx-auto mb-8 min-h-96 w-[85%] rounded-lg bg-brand-light p-6" aria-label="Students who have joined">
                <h2 className="text-center text-3xl font-bold text-brand">Participants</h2>
                {participants.length === 0 ? (
                    <p className="mt-6 text-center text-brand/70">No one has joined yet.</p>
                ) : (
                    <ul className="mt-6 flex flex-wrap justify-center gap-3">
                        {participants.map((p) => (
                            <li key={p.id} className="rounded-lg bg-white px-4 py-2 text-lg text-brand shadow-sm">
                                {p.username}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
