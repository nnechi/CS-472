import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { createRoom, deleteRoom } from '../api.ts'
import useAuth from "../hooks/useAuth"

// Later this can POST /api/rooms so codes are unique and persisted.
// Rendered inline on the teacher dashboard; `onClose` hides it again.
export default function CreateRoom({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate()

    const { auth } = useAuth(); 
    const [code, setCode] = useState("");
    // True while a create request is in flight. New code / Open room are
    // disabled meanwhile, so the teacher can't open a code that's about to be
    // replaced (and deleted).
    const [busy, setBusy] = useState(true);
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

    function close(){ 
        discardCode(code); 
        onClose(); 
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

            <div className="flex gap-3">
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
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700"
                    disabled = {!code || busy}
                    onClick={() => navigate(`/rooms/${code}`)}
                >
                    Open room
                </button>
            </div>
        </div>
    )
}
