import { useNavigate } from 'react-router-dom'

export default function CreateRoom() {
    const navigate = useNavigate()

    return (
        <>
            <button onClick={() => navigate("/dashboard")}>
                X
            </button>
            <h1>Here we will enter logic to create a room</h1>
            <button onClick={() => navigate("/teacher/room/1")}>
                Click here to enter a prototype room page!
            </button>
        </>
        
    )
}