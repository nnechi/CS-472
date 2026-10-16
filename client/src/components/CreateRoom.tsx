import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { createRoom } from '../api.ts'
import useAuth from "../hooks/useAuth"

// Later this can POST /api/rooms so codes are unique and persisted.
// Rendered inline on the teacher dashboard; `onClose` hides it again.
export default function CreateRoom({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate()

    const { auth } = useAuth(); 
    const [code, setCode] = useState(""); 


 // request code from the backend for the current room. 
    async function requestCode(){ 
        if (!auth){ 
            return; // no user found. 
        }
        try { 
           const newCode : string = await createRoom(auth.user.id); 
            if (newCode === ""){
                throw new Error("Server did not return a room code."); 
            } 

            setCode(newCode); 

        } catch(e) { 
            console.error(e); 
        }
    }


    //render this once before component shows. 
    useEffect(() => {  requestCode(); }, []); 


    return (
        <div className="mt-4 rounded-lg border border-gray-300 p-4">
            <div className="flex items-start justify-between">
                {/* Fix later to adjust for backend: delete a room/room code  */}
                <button
                    type="button"
                    className="cursor-pointer text-gray-600 hover:text-black"
                    aria-label="Close create a room"
                    onClick={onClose}
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
                    onClick={() => requestCode()}
                >
                    New code
                </button>
                <button
                    type="button"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-white cursor-pointer hover:bg-neutral-700"
                    disabled = {!code}
                    onClick={() => navigate(`/rooms/${code}`)}
                >
                    Open room
                </button>
            </div>
        </div>
    )
}
