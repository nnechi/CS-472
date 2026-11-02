// Sessions for remembering whos logged in

import session from "express-session";
import { authConfig } from "./config.js";

// What to store about someone logged-in
export interface SessionUser {
    id: string;
    email: string;
    name: string | null;
    picture: string | null; // Google profile picture URL, if they have one
}

// Tells ts which values are kept in a session
declare module "express-session" {
    interface SessionData {
        oauthState: string; // a onetime random value for a login in progress
        user: SessionUser; // set once the person is logged
    }
}

export const sessionMiddleware = session({
    name: "sid", // cookie name
    secret: authConfig.sessionSecret, // signs cookie so they can't be forged
    resave: false, // don't re-save sessions that don't change
    saveUninitialized: false, // dont create sessions for visitors who don't log in
    cookie: {
        httpOnly: true, // JavaScript in browser can't read the cookie
        sameSite: "lax", // still sent when Google redirects back to us
        secure: authConfig.isProduction, // HTTPS-only in prod
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, in milliseconds
    },
});