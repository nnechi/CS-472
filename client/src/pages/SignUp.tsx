import { Link, useNavigate } from "react-router-dom"
import React, { useRef, useState, useEffect, type ChangeEvent } from "react"
import AuthCard from "../components/AuthCard";

const USER_REGEX = /^[A-Za-z]+(?:[-'][A-Za-z]+)* [A-Za-z]+(?:[-'][A-Za-z]+)*$/
const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%]).{8,24}$/

type SignUpForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function SignUp() {
    const navigate = useNavigate();

    const userRef = useRef<HTMLInputElement>(null);
    const errRef = useRef<HTMLParagraphElement>(null);

    const [form, setForm] = useState<SignUpForm>({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    
    const [validName, setValidName] = useState(false)
    const [userFocus, setUserFocus] = useState(false)
    
    const [validPassword, setValidPassword] = useState(false)
    const [passwordFocus, setPasswordFocus] = useState(false)

    const [validMatch, setValidMatch] = useState(false)
    const [matchFocus, setMatchFocus] = useState(false)

    const [errMsg, setErrMsg] = useState('')

    useEffect(() => {
        userRef.current?.focus()
    }, [])

    useEffect(() => {
        setValidName(USER_REGEX.test(form.name))
    }, [form.name])

    useEffect(() => {
        setValidPassword(PWD_REGEX.test(form.password))
        setValidMatch(form.password === form.confirmPassword)
    }, [form.password, form.confirmPassword])

    useEffect(() => {
        setErrMsg('')
    }, [form.name, form.password, form.confirmPassword])

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        // if button enabled with JS hack
        const v1 = USER_REGEX.test(form.name)
        const v2 = PWD_REGEX.test(form.password)
        const v3 = form.password === form.confirmPassword
        if (!v1 || !v2 || !v3) {
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
                    user: form.name,
                    email: form.email,
                    password: form.password
                })
            })

            if(!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Unable to create account')
            }

            const data = await response.json()
            console.log(data)
            setForm({
                name: '',
                email: '',
                password: '',
                confirmPassword: ''
            });
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
        <AuthCard title="Sign in">
            <p
                ref={errRef}
                className={errMsg ? "auth-error" : "sr-only"}
                role="alert"
                aria-live="assertive"
            >
                {errMsg}
            </p>
            
            <h1>Register</h1>
                <form onSubmit={handleSubmit}>
                    <div className="auth-field">
                        <label htmlFor="usersName">
                            Name
                        </label>
                        <input
                            type="text"
                            id="usersName"
                            name="name"
                            ref={userRef}
                            autoComplete="off"
                            onChange={handleChange}
                            value={form.name}
                            required
                            aria-invalid={validName ? "false" : "true"}
                            aria-describedby="userNameNote"
                            onFocus={() => setUserFocus(true)}
                            onBlur={() => setUserFocus(false)}
                        />
                        <p id="userNameNote" className={userFocus && form.name && !validName ? "auth-error" : "sr-only"}>
                            Enter your first name followed by your last name.<br />
                            Letters, commas, hyphens allowed.
                        </p>
                    </div>
                    <div className="auth-field">
                        <label htmlFor="email">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            autoComplete="off"
                            onChange={handleChange}
                            value={form.email}
                            required
                            aria-describedby="emailNote"
                        />
                       
                        <p id="emailNote" className= {"sr-only"}> 
                            {/* print out the errorMsg later???  */}
                            Enter a valid email address.
                        </p>
                    </div>
                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            onChange={handleChange}
                            value={form.password}
                            required
                            aria-invalid={validPassword ? "false" : "true"}
                            aria-describedby="passwordNote"
                            onFocus={() => setPasswordFocus(true)}
                            onBlur={() => setPasswordFocus(false)}
                        />
                        <p id="passwordNote" className={passwordFocus && !validPassword ? "auth-error" : "sr-only"}>
                            8 to 24 characters.<br />
                            Must include uppercase and lowercase letters, a number and a special character.<br />
                            Allowed special characters: <span aria-label="exclamation mark">!</span> <span aria-label="at symbol">@</span> <span aria-label="hashtag">#</span> <span aria-label="dollar sign">$</span> <span aria-label="percent">%</span>
                        </p>
                    </div>
                    <div className="auth-field">
                        <label htmlFor="confirm_pwd"> Confirm Password</label>
                        <input
                            type="password"
                            id="confirm_pwd"
                            name="confirmPassword"
                            onChange={handleChange}
                            value={form.confirmPassword}
                            required
                            aria-invalid={validMatch ? "false" : "true"}
                            aria-describedby="confirmNote"
                            onFocus={() => setMatchFocus(true)}
                            onBlur={() => setMatchFocus(false)}
                        />
                        <p id="confirmNote" className={matchFocus && !validMatch ? "auth-error" : "sr-only"}>
                            Must match the first password input field.
                        </p>
                    </div>
                        <button 
                            disabled={!validName || !validPassword || !validMatch ? true : false}
                            className="auth-submit"
                        >
                            Sign Up
                        </button>
                   
                </form>
                <p>
                    Already have an account?  
                    {<Link to="/login" style={{ marginLeft: '5px' }} className="auth-switch">Sign in</Link>} 
                </p>
        </AuthCard>
    )
}