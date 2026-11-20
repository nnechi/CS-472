// Google sign in redirect routes

import { randomBytes } from "node:crypto";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { authConfig } from "./config";
import {
    createPasswordUser,
    findOrCreateUserFromGoogle,
    findUserWithPasswordByEmail,
    type AppUser,
} from "./users";
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from "./passwords";
import type { SessionUser } from "./session";

const googleClient = new OAuth2Client ({
    clientId: authConfig.googleClientId,
    clientSecret: authConfig.googleClientSecret,
    redirectUri: authConfig.googleRedirectUri,
});

export const authRouter = Router(); // makes router that holds related routes

// handle function, lets async routes report errors to user for Express 4
function handle (fn: (req: Request, res: Response) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res).catch(next);
    };
}

// save session function, async since we have to wait for session to save.
function saveSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => 
        req.session.save((err) => (err ? reject(err) : resolve())),
    );
}

// swaps the session for a fresh one with a new id
function regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
}

// Deletes the session completely
function destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => 
    req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
}

// Step 1, Sign in with Google link points here:
authRouter.get(
    "/auth/google", // runs this code when browser asks for this
    handle(async (req, res) => {
        // random value we want to see when Google sends user back to us
        const state = randomBytes(32).toString("hex");
        req.session.oauthState = state;
        await saveSession(req); // store it before they leave site

        const googleLoginUrl = googleClient.generateAuthUrl ({ // builds Google's sign in address
            scope: ["openid", "email", "profile"], state,
            prompt: "select_account", // show Google's account picker
        });

        res.redirect(googleLoginUrl); // tells browser to go to this address
    }),
);

// Step 2 of login, Google sends them back to us
authRouter.get(
    "/auth/google/callback",
    handle(async (req, res) => {
        const { code, state, error } = req.query; // holds values after ? in address, get code state and error
        const expectedState = req.session.oauthState;
        delete req.session.oauthState; // each state value works only once

        // If they clicked cancel on Google's page, or Google gave a problem
        if (typeof error === "string") {
            res.redirect(`${authConfig.appUrl}?login=cancelled`);
            return;
        }

        // Reject anything that didn't start at our /auth/google route
        if (typeof state !== "string" || !expectedState || state !== expectedState) {
            res.status(400).send("Login failed (state mismatch). Please try signing in again.");
            return;
        }

        if (typeof code !== "string") {
            res.status(400).send("Login failed (missing code). Please try signing in again.");
            return;
        }

        try {
        // trade one-time code for tokens. Server sends this to Google, with client secret
        const { tokens } = await googleClient.getToken(code); // sends the code and client secret straight from our server to google. Browser never sees this. We get back tokens from Google
        if (!tokens.id_token) { // no openid scope from earlier
            throw new Error("Google sent no ID token. Is 'openid' in the scopes?");
        }

        // check the ID token, Googles signature, that it was made for our client ID, Google issued it, and it hasn't expired
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: authConfig.googleClientId,
        });
        const payload = ticket.getPayload(); // returns whats inside the token. Contains person's id, email, and name
        if (!payload) {
            throw new Error("The ID token had no payload.");
        }

        if (!payload.email || payload.email_verified !== true) {
            res.status(403).send("Your Google account's email address isn't verified."); // forbidden aka not an email google recognizes
            return;
        }

        // Find or create person in our users using the payload given to us
        const user = await findOrCreateUserFromGoogle({
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
        });

        // log them in. Brand new session id at login stops session fixation attacks
        await regenerateSession(req);
        req.session.user = { id: user.id, email: user.email, name: user.name, picture: user.pictureUrl };
        await saveSession(req);

        // send them on, to a clean address without the one-time code
        res.redirect(authConfig.appUrl);

    }   catch (err) {
        console.error("Google login failed:", err);
        res.status(400).send("Login failed. Please try signing in again.");
    }

    }),
);

// ---- Email/password sign up and log in ----

// Same rules as the sign-up page (client/src/pages/SignUp.tsx). The browser
// checks these too, but anyone can skip the browser, so the server checks again.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,24}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;

// These routes are mounted before the app-wide express.json(), so they parse JSON themselves.
const jsonBody = express.json({ limit: "10kb" });

function asString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

// Turn our user into what we keep in the session (same shape the Google login uses).
function toSessionUser(user: AppUser): SessionUser {
    return { id: user.id, email: user.email, name: user.name, picture: user.pictureUrl };
}

// Log someone in: brand new session id (stops session fixation), then save.
async function startSession(req: Request, user: AppUser): Promise<SessionUser> {
    const sessionUser = toSessionUser(user);
    await regenerateSession(req);
    req.session.user = sessionUser;
    await saveSession(req);
    return sessionUser;
}

// Body: { user: string (their name), email: string, password: string }
authRouter.post(
    "/api/auth/signup",
    jsonBody,
    handle(async (req, res) => {
        const name = asString(req.body?.user).trim();
        const email = asString(req.body?.email).trim();
        const password = asString(req.body?.password);

        if (!name || name.length > MAX_NAME_LENGTH) {
            res.status(400).json({ message: "Please enter your name." });
            return;
        }
        if (!EMAIL_REGEX.test(email)) {
            res.status(400).json({ message: "Please enter a valid email address." });
            return;
        }
        if (!PASSWORD_REGEX.test(password)) {
            res.status(400).json({
                message: "Password must be 8-24 characters with an uppercase letter, a lowercase letter, and a number.",
            });
            return;
        }

        const user = await createPasswordUser({ email, name, passwordHash: await hashPassword(password) });
        if (!user) {
            res.status(409).json({ message: "An account with this email already exists." });
            return;
        }

        res.status(201).json({ user: await startSession(req, user) });
    }),
);

// Body: { email: string, password: string }
authRouter.post(
    "/api/auth/login",
    jsonBody,
    handle(async (req, res) => {
        const email = asString(req.body?.email).trim();
        const password = asString(req.body?.password);

        if (!email || !password) {
            res.status(400).json({ message: "Please enter both your email and password." });
            return;
        }

        const found = await findUserWithPasswordByEmail(email);
        // Always run a hash check, even with no user or a Google-only user,
        // so the response time doesn't reveal which emails have accounts.
        const ok = await verifyPassword(password, found?.passwordHash ?? (await DUMMY_HASH_PROMISE));

        if (!found || !found.passwordHash || !ok) {
            // One message for every failure, so it doesn't reveal which emails exist.
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        res.status(200).json({ user: await startSession(req, found.user) });
    }),
);

// log out of our app. (they are still signed in to google, that's normal)
authRouter.post(
    "/auth/logout",
    handle(async (req, res) => {
        await destroySession(req);
        res.clearCookie("sid");
        res.redirect(authConfig.appUrl);
    }),
);