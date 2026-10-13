import { useNavigate } from 'react-router-dom'

export default function CreateRoom() {
    const navigate = useNavigate()

    return (
        <>
            <button onClick={() => navigate("/dashboard")}>
                X
            </button>
            <h1>Here we will enter logic to create a room</h1>
            {/* POST /api/rooms 
                GET /api/rooms (depending on if teachers can have >1 room at a time?) */}
            <button onClick={() => navigate("/rooms/1")}>
                Click here to enter a prototype room page!
            </button>
        </>
        
    )
}