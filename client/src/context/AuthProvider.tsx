import { createContext, useState, ReactNode, Dispatch, SetStateAction} from 'react'

export interface AuthState {
    user: {
        id: string,
        email: string,
        name: string,
    }
    accessToken: string;
}

interface AuthContextType {
    auth: AuthState | null
    setAuth: Dispatch<SetStateAction<AuthState | null>>
    logout: () => void
}

const AuthContext = createContext<AuthContextType>({
    auth: null,
    setAuth: () => {},
    logout: () => {}
})

export function AuthProvider( {children}: {children: ReactNode} ) {
    const [auth, setAuth] = useState<AuthState | null>(null)

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