// Google sign in redirect routes

import { randomBytes } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { authConfig } from "./config";

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

        // TEMPORARY TEST
        res.send("WORKS: the state matched and Google sent a code.");
    }),
);