import { createContext, useState, ReactNode, Dispatch, SetStateAction} from 'react'

export interface AuthState {
    user: {
        id: string,
        email: string,
        name: string,
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

export function AuthProvider( {children}: {children: ReactNode} ) {
    const [auth, setAuth] = useState<AuthState | null>(null)
    //const [loading, setLoading] = useState(true)
    
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