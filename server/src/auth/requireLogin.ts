import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User";

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
    const sessionUser = req.session.user;
    if (!sessionUser) {
        res.status(401).json({ error: "Not logged in" });
        return;
    }
    User.findById(sessionUser.id).then(user => {
        if (!user || user.authVersion !== (sessionUser.authVersion ?? 0)) {
            req.session.destroy(() => {});
            res.clearCookie("sid");
            res.status(401).json({ error: "Please sign in again." });
            return;
        }
        sessionUser.email = user.email;
        next();
    }).catch(next);
}
