import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction} from 'react'
import { Role } from '../types'

export interface AuthState {
    user: {
        id: string,
        email: string,
        name: string,
        // Chosen on the sign-in form. Decides which dashboard and room view
        // the user gets, and is sent to the server when joining a room.
        role: Role,
    }
}

interface AuthContextType {
    auth: AuthState | null
    setAuth: Dispatch<SetStateAction<AuthState | null>>
    logout: () => void
    // loading: boolean
}

const AuthContext = createContext<AuthContextType>({
    auth: null,
    setAuth: () => {},
    logout: () => {}
    // loading: true
})

// Kept in sessionStorage so a page refresh inside a room doesn't bounce the
// user back to the sign-in page. Replace with a cookie session once the
// server implements /api/auth.
const STORAGE_KEY = 'cshelp.auth'

function readStoredAuth(): AuthState | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as AuthState) : null
    } catch {
        return null
    }
}

export function AuthProvider( {children}: {children: ReactNode} ) {
    const [auth, setAuth] = useState<AuthState | null>(readStoredAuth)
    //const [loading, setLoading] = useState(true)

    useEffect(() => {
        try {
            if (auth) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
            else sessionStorage.removeItem(STORAGE_KEY)
        } catch {
            // Storage can be unavailable (private mode); auth still works in memory.
        }
    }, [auth])
    
    // useEffect(() => {
    //    async function checkAuth() {
    //        try {
    //            const response = await fetch('/api/auth/user', {
    //                credentials: 'include'
    //            })
    //
    //            if(!response.ok) {
    //                setAuth(null)
    //                return
    //            }
    //            const data = await response.json()
    //            setAuth(data)
    //        } catch(error) {
    //            setAuth(null)
    //        } finally {
    //            setLoading(false)
    //        }
    //    }
    //    checkAuht()
    // },[])

    // Later use POST /api/auth/logout and setAuth(null) here
    function logout() {
        setAuth(null)
    }

    return(
        <AuthContext.Provider value={{ auth, setAuth, logout}}>
            { children }
        </AuthContext.Provider>
    )
}

export default AuthContext
