import { Link } from "react-router-dom"

export default function SignIn() {
    return(
        <>
            <h1>Our Name/Logo Goes Here!</h1>
            <div>
                <form
                    aria-label="Sign up form"
                    aira-describedby="form-description"
                >
                    <div id="form-description" className="sr-only">
                        Use this form to sign in to your account. Enter your email
                        and password.
                    </div>

                    <h2>Sign in</h2>

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
                            required
                            aria-required="true"
                            // TODO: npm package zxcvbn? to check for strong password
                        />

                    <button
                        type="submit"
                        // TODO: aria-busy=
                    >
                        Sign In
                            {/* JSX state element when signing in later here  */}
                    </button>

                    <p>
                        Don't have an account yet? 
                        {<Link to="/signup">Sign up</Link>} 
                    </p>

                </form>
            </div>
        </>
    )
}