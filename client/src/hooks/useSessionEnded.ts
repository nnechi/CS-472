import { useCallback } from "react"
import { SessionEndedError } from "../api"
import useAuth from "./useAuth"

// For a failed server request. If the error says the sign-in ended (e.g. the server
// restarted), this signs the teacher out, so RequireAuth sends them to /login and back
// to this page afterwards, and returns true. Any other error returns false so the
// caller can show it.
export default function useSessionEnded(): (error: unknown) => boolean {
    const { setAuth } = useAuth()
    return useCallback((error: unknown) => {
        if (!(error instanceof SessionEndedError)) return false
        setAuth(null)
        return true
    }, [setAuth])
}
