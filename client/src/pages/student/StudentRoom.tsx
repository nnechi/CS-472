import { useNavigate } from 'react-router-dom'

export default function StudentRoom() {
    const navigate = useNavigate()
    return( 
        <>
            <h1>Student room stuff here</h1>
            <button onClick={() => navigate("/")}>
                Go back to home
            </button>
        </>
    )
}