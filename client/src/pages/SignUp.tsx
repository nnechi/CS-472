import { Link, useNavigate } from "react-router-dom"
import React, { useState, useEffect } from "react"
import SignupForm from "../components/SignupForm"
import textLogo from "../assets/LittlePointers Logo/Text Logo.png"

// Regex for username and password
// Rules for username: must use first and last name with a space separating them
// Hyphens and apostrophes allowed
const USER_REGEX = /^[A-Za-z]+(?:[-'][A-Za-z]+)* [A-Za-z]+(?:[-'][A-Za-z]+)*$/

// Rules for password:
// Must be between 8 and 24 characters
// Must contain at least one lowercase letter
// Must contain at least one uppercase letter
// Must contain at least one digit
const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,24}$/

// The values that we get from the inputs on the sign up form
type SignUpValues = {
  name: string; // user's name
  email: string; // user's email
  password: string; // user's password
  confirmPassword: string; // text from "confirm password" field
};

// This component renders the sign up page, using the sign up form for the design.
// Most error checking is done here
export default function SignUp() {
    const navigate = useNavigate();

    // The form state contains the information from the form and updates as needed
    const [form, setForm] = useState<SignUpValues>({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    
    // Represents if the name is valid
    const [validName, setValidName] = useState(false)

    // Represents if the password is valid
    const [validPassword, setValidPassword] = useState(false)

    // Represents if the "confirm password" is valid
    const [validMatch, setValidMatch] = useState(false)

    // Sets the error message
    const [errMsg, setErrMsg] = useState('')

    // True once the user has typed in Full Name and then left it, so "John" isn't flagged while they're still typing.
    const [nameTouched, setNameTouched] = useState(false)
    const nameError = nameTouched && form.name !== '' && !validName ? 'Must use full name.' : ''

    // Only once they've started typing in Confirm Password, so it isn't red before they try.
    const confirmPasswordError =
        form.confirmPassword !== '' && !validMatch ? 'Please ensure that the passwords match.' : ''

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

    // Attached to the div around <SignupForm />: the form's submit event bubbles up to it.
    async function handleSubmit(e: React.FormEvent) {
        // Prevents page from reloading when submitted
        e.preventDefault()

        // The button is disabled until these pass, but it can be forced on (e.g. in dev tools).
        if (!validName || !validPassword || !validMatch) {
            setErrMsg("Invalid Entry")
            return
        }

        try {
            const response = await fetch('api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: form.name,
                    email: form.email,
                    password: form.password
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Unable to create account')
            }

            navigate('/dashboard')
        } catch (err) {
            setErrMsg('Either no server response, username taken, or registration failed')
        }
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div className="flex w-full max-w-lg flex-col gap-6">
                {/* LittlePointers logo, navigates back to homepage when clicked */}
                <Link to="/" className="self-center" aria-label="LittlePointers home">
                    <img src={textLogo} alt="LittlePointers" />
                </Link>

                {/* Actual form */}
                {/* Typing in and leaving SignupForm's inputs bubble up here, so the page can check them. */}
                <div
                    onSubmit={handleSubmit}
                    onChange={(e) => {
                        const input = e.target as HTMLInputElement
                        if (input.id === 'name') {
                            setForm((prev) => ({ ...prev, name: input.value }))
                            // Emptied the field: start over, so retyping isn't flagged straight away.
                            if (input.value === '') setNameTouched(false)
                        }
                        if (input.id === 'email') setForm((prev) => ({ ...prev, email: input.value }))
                        if (input.id === 'password') setForm((prev) => ({ ...prev, password: input.value }))
                        if (input.id === 'confirm-password') setForm((prev) => ({ ...prev, confirmPassword: input.value }))
                    }}
                    onBlur={(e) => {
                        // Ignore leaving an empty field, e.g. switching windows while it has autofocus.
                        const input = e.target as HTMLInputElement
                        if (input.id === 'name' && input.value !== '') setNameTouched(true)
                    }}
                >
                    <SignupForm
                        nameError={nameError}
                        confirmPasswordError={confirmPasswordError}
                        submitDisabled={!validName}
                    />
                </div>
            </div>
        </div>
    )
}