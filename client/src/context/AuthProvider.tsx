import { createContext, useState, useEffect, ReactNode, Dispatch, SetStateAction} from 'react'

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
    loading: boolean
}

const AuthContext = createContext<AuthContextType>({
    auth: null,
    setAuth: () => {},
    logout: () => {},
    loading: true,
})

// The server's address, from VITE_SERVER_URL in docker-compose.yml
const SERVER_URL = import.meta.env.VITE_SERVER_URL

// What the server's GET /api/me sends back when someone is logged in
type MeResponse = {
    user: { id: string, email: string, name: string | null }
}

export function AuthProvider( {children}: {children: ReactNode} ) {
    const [auth, setAuth] = useState<AuthState | null>(null)
    const [loading, setLoading] = useState(true)

    // When the app loads, ask the server who is logged in, if anyone.
    useEffect(() => {
        let cancelled = false

        async function checkAuth() {
            try {
                const response = await fetch(`${SERVER_URL}/api/me`, {
                    credentials: 'include', // send the session cookie along
                })
                if (!response.ok) {
                    if (!cancelled) setAuth(null)
                    return
                }
                const data = (await response.json()) as MeResponse
                if (!cancelled) {
                    setAuth({
                        user: {
                            id: data.user.id,
                            email: data.user.email,
                            name: data.user.name ?? data.user.email,
                        },
                    })
                }
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

// TEMP, DELETE IF WORKS

// export interface AuthState {
//     user: {
//         id: string,
//         email: string,
//         name: string,
//     }
// }

// interface AuthContextType {
//     auth: AuthState | null
//     setAuth: Dispatch<SetStateAction<AuthState | null>>
//     logout: () => void
//     // loading: boolean
// }

// const AuthContext = createContext<AuthContextType>({
//     auth: null,
//     setAuth: () => {},
//     logout: () => {}
//     // loading: true
// })

// // Kept in sessionStorage so a page refresh inside a room doesn't bounce the
// // user back to the sign-in page. Replace with a cookie session once the
// // server implements /api/auth.
// const STORAGE_KEY = 'littlepointers.auth'

// function readStoredAuth(): AuthState | null {
//     try {
//         const raw = sessionStorage.getItem(STORAGE_KEY)
//         return raw ? (JSON.parse(raw) as AuthState) : null
//     } catch {
//         return null
//     }
// }

// export function AuthProvider( {children}: {children: ReactNode} ) {
//     const [auth, setAuth] = useState<AuthState | null>(readStoredAuth)
//     //const [loading, setLoading] = useState(true)

//     useEffect(() => {
//         try {
//             if (auth) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
//             else sessionStorage.removeItem(STORAGE_KEY)
//         } catch {
//             // Storage can be unavailable (private mode); auth still works in memory.
//         }
//     }, [auth])
    
//     // useEffect(() => {
//     //    async function checkAuth() {
//     //        try {
//     //            const response = await fetch('/api/auth/user', {
//     //                credentials: 'include'
//     //            })
//     //
//     //            if(!response.ok) {
//     //                setAuth(null)
//     //                return
//     //            }
//     //            const data = await response.json()
//     //            setAuth(data)
//     //        } catch(error) {
//     //            setAuth(null)
//     //        } finally {
//     //            setLoading(false)
//     //        }
//     //    }
//     //    checkAuht()
//     // },[])

//     // Later use POST /api/auth/logout and setAuth(null) here
//     function logout() {
//         setAuth(null)
//     }

//     return(
//         <AuthContext.Provider value={{ auth, setAuth, logout}}>
//             { children }
//         </AuthContext.Provider>
//     )
// }

export default AuthContext
