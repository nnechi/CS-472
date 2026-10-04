// THIS WILL BE DELETED!! Used to test front-end setup for login.
// What is stored in db (hashed password in real db, unencrypted one here)
export interface MockUser {
    id: string
    name: string
    email: string
    password: string
}

// What api gives back
export interface AuthResponse {
    user: {
        id: string
        name: string
        email: string
    }
    accessToken: string
}

export const mockUsersDatabase: MockUser[] = [
    {
        id:"1",
        name: "Bob",
        email: "b@b.com",
        password: "P123!"
    },
    {
        id:"2",
        name: "Jane",
        email: "j@j.com",
        password: "P123!"
    }
]

export const fakeLoginApi = (
    email: string,
    password: string
): Promise<AuthResponse> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const foundUser = mockUsersDatabase.find(
                (u) =>
                    u.email.toLowerCase() === email.toLowerCase() &&
                    u.password === password
            )

            if (foundUser) {
                resolve({
                    user: {
                        id: foundUser.id,
                        name: foundUser.name,
                        email: foundUser.email
                    },
                    accessToken: "fake-jwt-token-123"
                })
            } else {
                reject(new Error("Invalid email or password"))
            }
        }, 1000)
    })
}

