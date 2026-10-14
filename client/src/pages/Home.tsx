import { useNavigate } from 'react-router-dom'

export default function Home() {
    const navigate = useNavigate()

    return(
        <>
            <h1>Home page</h1>
            <p>Sign in as a student to join a room with a code, or as a teacher to create one.</p>
            {/* Joining/creating rooms happens on the dashboard after sign-in.
                RequireAuth sends signed-out users to /login first. */}
            <button onClick={() => navigate("/dashboard")}>
                Go to your dashboard
            </button>
        
        </>
    )
}
