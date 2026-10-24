import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createRoom, deleteRoom, listActivities, saveActivity } from '../../api.ts'
import useAuth from "../../hooks/useAuth"
import { ActivitySummary } from "../../types"

// Later this can POST /api/rooms so codes are unique and persisted.
// Rendered inline on the teacher dashboard; `onClose` hides it again.
export default function RoomCreation(/*{ onClose }: { onClose: () => void }*/) {
    const navigate = useNavigate()

    const { auth } = useAuth();
    const [code, setCode] = useState("");
    // True while a create request is in flight. New code / Open room are
    // disabled meanwhile, so the teacher can't open a code that's about to be
    // replaced (and deleted).
    const [busy, setBusy] = useState(true);
    // The teacher's own activities, A to Z. null until they have loaded.
    const [activities, setActivities] = useState<ActivitySummary[] | null>(null);
    const [listError, setListError] = useState("");
    // The activity the room will use. Saved with the room code on Open room.
    const [selectedId, setSelectedId] = useState("");
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

    // Load the teacher's activities so they can pick one for this room.
    useEffect(() => {
        if (!auth) return;
        let cancelled = false;
        listActivities(auth.user.id)
            .then((list) => { if (!cancelled) setActivities(list); })
            .catch((e) => {
                if (!cancelled) setListError(e instanceof Error ? e.message : "Could not load your activities.");
            });
        return () => { cancelled = true; };
    }, [auth?.user.id]);

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

    // Save the chosen activity to the room, then go into the room.
    async function openRoom(){
        if (!auth || !selectedId || saving) return;
        setSaving(true);
        try {
            await saveActivity(code, auth.user.id, selectedId);
            navigate(`/rooms/${code}`);
        } catch (e) {
            window.alert(`Could not open the room. ${e instanceof Error ? e.message : ""}`.trim());
            setSaving(false);
        }
    }

    // Leave to make a new activity. This room's code is no longer needed.
    function createActivityFirst(){
        discardCode(code);
        navigate("/dashboard/create-activity");
    }

    function close(){
        discardCode(code);
        //onClose();
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

            <div className="mb-4">
                <h2 className="mb-2 text-sm text-gray-600">Choose an activity</h2>

                {listError && <p role="alert" className="text-red-600">{listError}</p>}
                {!listError && activities === null && <p className="text-gray-500">Loading your activities...</p>}

                {activities?.length === 0 && (
                    <p className="text-gray-600">
                        You haven't made any activities yet.{" "}
                        <button
                            type="button"
                            className="text-indigo-600 underline cursor-pointer"
                            onClick={createActivityFirst}
                        >
                            Create one
                        </button>
                    </p>
                )}

                {activities && activities.length > 0 && (
                    <div
                        role="radiogroup"
                        aria-label="Your activities"
                        className="max-h-64 overflow-y-auto rounded-lg border border-gray-300"
                    >
                        {activities.map((a) => (
                            <label
                                key={a.id}
                                className={`flex cursor-pointer items-center gap-3 border-b border-gray-200 px-3 py-2 last:border-b-0 hover:bg-neutral-100 ${selectedId === a.id ? "bg-indigo-50" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="activity"
                                    value={a.id}
                                    checked={selectedId === a.id}
                                    onChange={() => setSelectedId(a.id)}
                                />
                                <span>{a.name}</span>
                                <span className="ml-auto text-xs text-gray-500">{a.type === "parsons" ? "Parsons" : "Coding"}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

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
                    disabled = {!code || busy || saving || !selectedId}
                    onClick={openRoom}
                >
                    {saving ? "Opening..." : "Open room"}
                </button>
                {!selectedId && <span className="text-sm text-gray-500">Pick an activity to open the room.</span>}
            </div>
        </div>
    )
}
