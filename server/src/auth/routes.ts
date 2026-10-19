// Google sign in redirect routes

import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { authConfig } from "./config";
import { findOrCreateUserFromGoogle } from "./users"; 

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
        req.session.user = { id: user.id, email: user.email, name: user.name };
        await saveSession(req);

        // send them on, to a clean address without the one-time code
        res.redirect(authConfig.appUrl);

    }   catch (err) {
        console.error("Google login failed:", err);
        res.status(400).send("Login failed. Please try signing in again.");
    }

    }),
);