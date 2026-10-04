import useAuth from "./useAuth"

export default function useRefreshToken() {
    const { setAuth } = useAuth()

    // Should get an access token back after refresh token is verified 
    async function refresh() {
        const response = await fetch('/refresh', {
            method: 'GET',
            credentials: 'include'
        })

        if(!response.ok) 
            throw new Error('Unable to refresh authentication')

        const data = await response.json()

        setAuth({
            user: data.user,
            accessToken: data.accessToken
        })

        return data.accessToken
    }
    return refresh
}