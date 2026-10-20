// Reads the Google sign in settings from the .env file
// Server stops if requirement is missing and tells which is missing

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable ${name}, add it to your .env file.`);
    }
    return value;
}

export const authConfig = {
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: required("GOOGLE_REDIRECT_URI"),
    sessionSecret: required("SESSION_SECRET"),

    // Where people land after logging in/out.
    appUrl: process.env.APP_URL ?? "/",

    isProduction: process.env.NODE_ENV === "production",
};