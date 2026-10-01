import { useNavigate } from 'react-router-dom'

export default function Home() {
    const navigate = useNavigate()

    return(
        <>
            <h1>Home page</h1>
            <p>Enter a code to join...</p>
            <button onClick={() => navigate("/room/1")}>
                Click here to view a student room 
            </button>
        
        </>
    )
}