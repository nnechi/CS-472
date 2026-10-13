import { useNavigate } from 'react-router-dom'

export default function Home() {
    const navigate = useNavigate()

    return(
        <>
            <h1>Home page</h1>
            <p>Enter a code to join and all that goes on this page...</p>
            {/* If we want we can make joining a seperate page or we
            can keep it on the home page. */}
            {/* Need to replace this with POST /api/rooms/join and code later*/}
            <button onClick={() => navigate("/rooms/join/1")}>
                Click here to view a student room 
            </button>
        
        </>
    )
}