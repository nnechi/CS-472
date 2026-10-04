import { Link, useNavigate, useLocation } from "react-router-dom"
import React, { useRef, useState, useEffect } from 'react'
import useAuth from "../hooks/useAuth"
import { fakeLoginApi } from '../mockDb'

export default function SignIn() {
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || "/dashboard"
    const { setAuth } = useAuth()

    const userRef = useRef<HTMLInputElement>(null)
    const errRef = useRef<HTMLParagraphElement>(null)

    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')
    const [errMsg, setErrMsg] = useState('')

    useEffect(() => {
        userRef.current?.focus()
    },[])

    useEffect(() => {
        setErrMsg('')
    }, [user, password])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            // Commented out code what we will actually use when the server is set up
            // const response = await fetch('api/auth/login', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({
            //         user, password
            //     })
            // })

            // if(!response.ok) 
            //     throw new Error('Invalid email or password')

            // const data = await response.json()
            // setAuth(data)

            const response = await fakeLoginApi(user, password)
            setAuth(response)
            setUser('')
            setPassword('')
            navigate(from, { replace: true })

        } catch (err){
            // Later add 400, 401 and no server response messages later
             if (err instanceof Error) 
                setErrMsg(err.message)
            else 
                setErrMsg('Something went wrong. Please try again.')
            
            errRef.current?.focus()
        }
    }

    return(
        <section>
            <p 
                ref={errRef}
                className={errMsg ? "mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-200 outline-none" : "sr-only"}
                aria-live="assertive"
            >
                {errMsg}
            </p>
            <h1>Sign In</h1>
            <form onSubmit={handleSubmit}>
                <label htmlFor="email">Email:</label>
                    <input 
                        type="email"
                        name="email"
                        id="email"
                        ref={userRef}
                        autoComplete = "off"
                        onChange = {(e) => setUser(e.target.value)}
                        value={user}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2
                                     text-gray-900 shadow-sm"
                    />
                <label htmlFor="password">Password:</label>
                    <input 
                        type="password"
                        name="password"
                        id="password"
                        onChange = {(e) => setPassword(e.target.value)}
                        value={password}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2
                                     text-gray-900 shadow-sm"
                    />
                <button className="border border-gray-300 text-gray-900 cursor-pointer">Sign In</button>
           </form>
           <p>
                Don't have an account yet? 
                {<Link to="/signup" className="text-gray-800 hover:text-gray-700">Sign up</Link>} 
            </p>
        </section>
    )
}