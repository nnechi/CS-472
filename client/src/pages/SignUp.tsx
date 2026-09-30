import { Link } from "react-router-dom"
import React, { useState } from "react"

export default function SignUp() {
    const [password, setPassword] = useState<string>("")
    const [confirmPassword, setConfirmPassword] = useState<string>("")
    const [error, setError] = useState<string>("")

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if(password !== confirmPassword){
             setError("Passwords do not match, try again")
             setPassword("")
             setConfirmPassword("")
             return
        }

        setError("")
        console.log("Passwords match")
    }

    return(
        <>
            <h1>Our Name/Logo Goes Here!</h1>
            <div>
                <form
                    onSubmit={handleSubmit}
                    aria-label="Sign up form"
                    aira-describedby="form-description"
                >
                    <div id="form-description" className="sr-only">
                        Use this form to sign up for an account. Enter your full name,
                        email address, password, and confirmation password. Check the 
                        final box to agree to our terms and conditions.
                    </div>

                    <h2>Sign Up</h2>

                    <label htmlFor="name">Name</label>
                        <input 
                            type="text"
                            name="name"
                            id="name"
                            placeholder="John Doe"
                            required
                            aria-required="true"
                            //aria-describedby if we want?
                        />

                    <label htmlFor="email">Email</label>
                        <input 
                            type="email"
                            name="email"
                            id="email"
                            placeholder="xyz@gmail.com"
                            required
                            aria-required="true"
                            //aria-describedby if we want?
                        />
                        
                    <label htmlFor="password">Password</label>
                        <input 
                            type="password"
                            name="password"
                            id="password"
                            value={password}
                            onChange = {(e) => setPassword(e.target.value)}
                            required
                            aria-required="true"
                            // TODO: npm package zxcvbn? to check for strong password
                        />

                    <label htmlFor="confirmPassword">Password</label>
                        <input 
                            type="password"
                            name="confirmPassword"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange = {(e) => setConfirmPassword(e.target.value)}
                            required
                            aria-required="true"
                        />

                    {error && <p>{error}</p>}

                    <button
                        type="submit"
                        // TODO: aria-busy=
                    >
                        Sign up
                    </button>

                    <p>
                        Already have an account?  
                        {<Link to="/login">Sign in</Link>} 
                    </p>

                </form>
            </div>
        </>
    )
}