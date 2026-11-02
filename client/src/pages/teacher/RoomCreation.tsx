import { useState, useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { createRoom, deleteRoom, saveActivity } from '../../api.ts'
import useAuth from "../../hooks/useAuth.tsx"

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
        <div className="mt-4 rounded-lg border border-gray-300 p-4">
            <div className="flex items-start justify-between">
                {/* Fix later to adjust for backend: delete a room/room code  */}
                <button
                    type="button"
                    className="cursor-pointer text-gray-600 hover:text-black"
                    aria-label="Close create a room"
                    onClick={close}
                >
                    X
                </button>
            </div>
            <p className="text-gray-600">Share this code with your students so they can join.</p>

            <p className="my-4 text-4xl font-bold tracking-widest">{code}</p>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900 cursor-pointer hover:bg-neutral-100"
                    disabled = {busy}
                    onClick={() => createNewCode()}
                >
                    New code
                </button>
                <button
                    type="button"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled = {!code || busy || saving || !startingActivityId}
                    onClick={openRoom}
                >
                    {saving ? "Opening..." : "Open room"}
                </button>
                {!startingActivityId && <span className="text-sm text-gray-500">Pick an activity to open the room.</span>}
            </div>
        </div>
    )
}
