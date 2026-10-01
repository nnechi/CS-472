import {useNavigate } from "react-router-dom"

export default function TeacherRoom() {
    const navigate = useNavigate()

    return (
        <>
            <button onClick={() => navigate("/dashboard")}>
                X
            </button>

            <h1>This is going to be the main feature teacher-mode</h1>            
        </>
       
        
    )
}