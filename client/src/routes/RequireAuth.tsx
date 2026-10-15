import { useLocation, Navigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function RequireAuth() {
    const { auth} = useAuth()
    //const { auth, loading } = useAuth()
    const location = useLocation()

    // if(loading) {
    //     return <p>Loading...</p>
    // }
    
    return(
        auth?.user 
            ? <Outlet /> 
            : <Navigate to="/login" state={{ from: location }} replace />
    )
}