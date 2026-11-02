// Put require login in front of any route that needs a logged in user

import type { NextFunction, Request, Response } from "express";

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.user) {
        res.status(401).json({ error: "Not logged in" });
        return;
    }
    next(); // logged in, carry on to route itself
}