import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction} from 'react'
import { getMe, SERVER_URL } from '../api'

export interface AuthState {
    user: {
        id: string,
        email: string,
        name: string,
        picture?: string | null,
    }
}

interface AuthContextType {
    auth: AuthState | null
    setAuth: Dispatch<SetStateAction<AuthState | null>>
    logout: () => void
    loading: boolean
}

const AuthContext = createContext<AuthContextType>({
    auth: null,
    setAuth: () => {},
    logout: () => {},
    loading: true,
})

export function AuthProvider( {children}: {children: ReactNode} ) {
    const [auth, setAuth] = useState<AuthState | null>(null)
    const [loading, setLoading] = useState(true)

    // When the app loads, ask the server who is logged in, if anyone.
    useEffect(() => {
        let cancelled = false

        async function checkAuth() {
            try {
                const found = await getMe()
                if (!cancelled) setAuth(found)
            } catch {
                if (!cancelled) setAuth(null)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        checkAuth()
        return () => { cancelled = true }
    }, [])

    // Logging out has to happen on the server, which ends the session.
    // A form post takes the whole page there; the server then sends the
    // browser back to APP_URL.
    function logout() {
        const form = document.createElement('form')
        form.method = 'post'
        form.action = `${SERVER_URL}/auth/logout`
        document.body.appendChild(form)
        form.submit()
    }

    return(
        <AuthContext.Provider value={{ auth, setAuth, logout, loading }}>
            { children }
        </AuthContext.Provider>
    )
}

export default AuthContext
