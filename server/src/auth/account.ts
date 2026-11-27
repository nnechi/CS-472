import express, { Router } from "express";
import { User } from "../models/User";
import { requireLogin } from "./requireLogin";
import { hashPassword, verifyPassword } from "./passwords";
import { normalizeEmail } from "./users";

export type AccountDeletedHandler = (userId: string) => Promise<void>;

export function createAccountRouter(onDeleted?: AccountDeletedHandler): Router {
    const accountRouter = Router();
    accountRouter.use("/api/account", requireLogin);
    accountRouter.get("/api/account", (req, res, next) => {
        User.findById(req.session.user!.id).select("+passwordHash").then(user => {
            res.json({ passwordAccount: Boolean(user?.passwordHash && !user.googleId) });
        }).catch(next);
    });

    // JSON-only mutations prevent cross-site HTML forms from changing an account.
    accountRouter.use("/api/account", (req, res, next) => {
        if (!req.is("application/json")) {
            res.status(415).json({ error: "Expected JSON." });
            return;
        }
        next();
    }, express.json({ limit: "10kb" }));

    for (const action of ["email", "password", "delete"] as const) {
        accountRouter.post(`/api/account/${action}`, (req, res, next) => {
            (async () => {
                const user = await User.findById(req.session.user!.id).select("+passwordHash");
                if (!user) { res.status(401).json({ error: "Please sign in again." }); return; }
                if (action !== "delete" && (user.googleId || !user.passwordHash)) {
                    res.status(403).json({ error: "Manage your email and password through your Google account." }); return;
                }
                const current = req.body?.currentPassword;
                if (user.passwordHash && (typeof current !== "string" || current.length > 1024 || !await verifyPassword(current, user.passwordHash))) {
                    res.status(403).json({ error: "Current password is incorrect." }); return;
                }
                // Match the old hash/version too, so concurrent credential changes cannot overwrite one another.
                const filter = { _id: user._id, $or: [{ authVersion: user.authVersion }, ...(user.authVersion === 0 ? [{ authVersion: { $exists: false } }] : [])], ...(user.passwordHash ? { passwordHash: user.passwordHash } : {}) };
                if (action === "delete") {
                    if (req.body?.confirm !== true) { res.status(400).json({ error: "Confirm account deletion." }); return; }
                    const deleted = await User.deleteOne(filter);
                    if (!deleted.deletedCount) { res.status(409).json({ error: "Account changed. Please sign in again." }); return; }
                    if (onDeleted) await onDeleted(String(user._id)).catch(err => console.error("[account] failed to delete account data:", err));
                    await new Promise<void>((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
                    res.clearCookie("sid");
                    res.json({ message: "Account deleted." });
                    return;
                }
                const changes: Record<string, string> = {};
                if (action === "email") {
                    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
                    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === user.email) {
                        res.status(400).json({ error: "Enter a valid, different email address." }); return;
                    }
                    changes.email = email;
                } else {
                    const password = req.body?.newPassword;
                    if (typeof password !== "string" || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,24}$/.test(password) || password === current) {
                        res.status(400).json({ error: "Use a different password with 8–24 characters, uppercase and lowercase letters, and a number." }); return;
                    }
                    changes.passwordHash = await hashPassword(password);
                }
                const updated = await User.findOneAndUpdate(filter, { $set: changes, $inc: { authVersion: 1 } }, { returnDocument: "after" });
                if (!updated) { res.status(409).json({ error: "Account changed. Please sign in again." }); return; }
                const sessionUser = { ...req.session.user!, email: updated.email, authVersion: updated.authVersion };
                await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
                req.session.user = sessionUser;
                await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
                res.json({ user: sessionUser, message: action === "email" ? "Email updated." : "Password updated." });
            })().catch(err => {
                if (err?.code === 11000) { res.status(409).json({ error: "An account with this email already exists." }); return; }
                next(err);
            });
        });
    }
    return accountRouter;
}
