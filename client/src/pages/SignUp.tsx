import { Link, useNavigate } from "react-router-dom"
import React, { useRef, useState, useEffect } from "react"

const USER_REGEX = /^[A-Za-z]+(?:[-'][A-Za-z]+)* [A-Za-z]+(?:[-'][A-Za-z]+)*$/
const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,24}$/

export default function SignUp() {
    const navigate = useNavigate()
    const userRef = useRef<HTMLInputElement>(null)
    const errRef = useRef<HTMLParagraphElement>(null)

    const [user, setUser] = useState('')
    const [validName, setValidName] = useState(false)
    const [userFocus, setUserFocus] = useState(false)

    const [email, setEmail] = useState('')

    const [password, setPassword] = useState('')
    const [validPassword, setValidPassword] = useState(false)
    const [passwordFocus, setPasswordFocus] = useState(false)

    const [matchPassword, setMatchPassword] = useState('')
    const [validMatch, setValidMatch] = useState(false)
    const [matchFocus, setMatchFocus] = useState(false)

    const [errMsg, setErrMsg] = useState('')

    useEffect(() => {
        userRef.current?.focus()
    }, [])

    useEffect(() => {
        setValidName(USER_REGEX.test(user))
    }, [user])

    useEffect(() => {
        setValidPassword(PWD_REGEX.test(password))
        setValidMatch(password === matchPassword)
    }, [password, matchPassword])

    useEffect(() => {
        setErrMsg('')
    }, [user, password, matchPassword])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        // if button enabled with JS hack
        const v1 = USER_REGEX.test(user)
        const v2 = PWD_REGEX.test(password)
        if (!v1 || !v2) {
            setErrMsg("Invalid Entry")
            return
        }
        try {
            const response = await fetch('api/auth/signup', {
                method:'POST',
                headers: {
                    'Content-Type' : 'application/json'
                },
                body: JSON.stringify({
                    user,
                    email,
                    password
                })
            })

            if(!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Unable to create account')
            }

            const data = await response.json()
            console.log(data)
            setUser('')
            setEmail('')
            setPassword('')
            setMatchPassword('')
            navigate('/dashboard')
            
        } catch (err) {
            //if (!err?.response) {
            //    setErrMsg('No Server Response');
            //} else if (err.response?.status === 409) {
            //    setErrMsg('Username Taken');
            //} else {
            //    setErrMsg('Registration Failed')
            //}
            setErrMsg('Either no server response, username taken, or registration failed')
            errRef.current?.focus();
        }
    }

    return (
        <section>
            <p ref={errRef} 
                className={errMsg ? "mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-200 outline-none" : "sr-only"}
                aria-live="assertive"
            >
                {errMsg}
            </p>
            <h1>Register</h1>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="usersName">
                        Name
                    </label>
                    <input
                        type="text"
                        id="usersName"
                        ref={userRef}
                        autoComplete="off"
                        onChange={(e) => setUser(e.target.value)}
                        value={user}
                        required
                        aria-invalid={validName ? "false" : "true"}
                        aria-describedby="userNameNote"
                        onFocus={() => setUserFocus(true)}
                        onBlur={() => setUserFocus(false)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2
                                        text-gray-900 shadow-sm"
                    />
                    <p id="userNameNote" className={userFocus && user && !validName ? "mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-200 outline-none" : "sr-only"}>
                        Enter your first name followed by your last name.<br />
                        Letters, commas, hyphens allowed.
                    </p>

                    <label htmlFor="email">
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        autoComplete="off"
                        onChange={(e) => setEmail(e.target.value)}
                        value={email}
                        required
                        aria-describedby="emailNote"
                        className="w-full rounded-md border border-gray-300 px-3 py-2
                                        text-gray-900 shadow-sm"
                    />
                    <p id="emailNote" className="sr-only">
                            Enter a valid email address.
                    </p>

                    <label htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            onChange={(e) => setPassword(e.target.value)}
                            value={password}
                            required
                            aria-invalid={validPassword ? "false" : "true"}
                            aria-describedby="passwordNote"
                            onFocus={() => setPasswordFocus(true)}
                            onBlur={() => setPasswordFocus(false)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2
                                        text-gray-900 shadow-sm"
                        />
                        <p id="passwordNote" className={passwordFocus && !validPassword ? "mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-200 outline-none" : "sr-only"}>
                            8 to 24 characters.<br />
                            Must include uppercase and lowercase letters, a number and a special character.<br />
                            Allowed special characters: <span aria-label="exclamation mark">!</span> <span aria-label="at symbol">@</span> <span aria-label="hashtag">#</span> <span aria-label="dollar sign">$</span> <span aria-label="percent">%</span>
                        </p>


                        <label htmlFor="confirm_pwd">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirm_pwd"
                            onChange={(e) => setMatchPassword(e.target.value)}
                            value={matchPassword}
                            required
                            aria-invalid={validMatch ? "false" : "true"}
                            aria-describedby="confirmNote"
                            onFocus={() => setMatchFocus(true)}
                            onBlur={() => setMatchFocus(false)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2
                                        text-gray-900 shadow-sm"
                        />
                        <p id="confirmNote" className={matchFocus && !validMatch ? "mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600 border border-red-200 outline-none" : "sr-only"}>
                            Must match the first password input field.
                        </p>

                        <button 
                            disabled={!validName || !validPassword || !validMatch ? true : false}
                            className="border border-gray-300 text-gray-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Sign Up
                        </button>
                </form>
                <p>
                    Already have an account?  
                    {<Link to="/login" className="text-gray-800 hover:text-gray-700">Sign in</Link>} 
                </p>

        </section>
    )
}