import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { accountRouter } from "./account";
import { User } from "../models/User";
import { hashPassword, verifyPassword } from "./passwords";

test("account routes check credentials, rotate sessions, and delete the signed-in account", async (t) => {
    let user: any = { _id: "test-user", email: "old@example.com", authVersion: 0, passwordHash: await hashPassword("Password123") };
    t.mock.method(User, "findById", () => {
        const query = Promise.resolve(user) as any;
        query.select = () => query;
        return query;
    });
    t.mock.method(User, "findOneAndUpdate", async (_filter: any, update: any) => {
        if (update.$set.email === "taken@example.com") throw Object.assign(new Error(), { code: 11000 });
        Object.assign(user, update.$set);
        user.authVersion++;
        return user;
    });
    t.mock.method(User, "deleteOne", async () => { user = null; return { deletedCount: 1 }; });
    const app = express();
    app.use(session({ secret: "test-only-secret", resave: false, saveUninitialized: false }));
    app.post("/test-login", (req, res) => {
        req.session.user = { id: user._id, email: user.email, name: "Test", picture: null, authVersion: user.authVersion };
        res.json({});
    });
    app.use(accountRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}`;
    let cookie = "";
    async function request(path: string, body?: object) {
        const response = await fetch(url + path, {
            method: body ? "POST" : "GET", headers: { Cookie: cookie, "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        const setCookie = response.headers.get("set-cookie");
        if (setCookie) cookie = setCookie.split(";")[0];
        return response;
    }
    assert.equal((await request("/api/account")).status, 401);
    await request("/test-login", {});
    const oldCookie = cookie;
    assert.equal((await request("/api/account/email", { email: "new@example.com", currentPassword: "wrong" })).status, 403);
    assert.equal((await request("/api/account/email", { email: "taken@example.com", currentPassword: "Password123" })).status, 409);
    assert.equal((await request("/api/account/email", { email: " NEW@example.com ", currentPassword: "Password123" })).status, 200);
    assert.equal(user.email, "new@example.com");
    assert.notEqual(cookie, oldCookie);
    assert.equal((await fetch(url + "/api/account", { headers: { Cookie: oldCookie } })).status, 401);
    for (const password of ["short1A", "lowercase123", "UPPERCASE123", "NoNumbersHere", "A1234567890123456789012345"]) {
        assert.equal((await request("/api/account/password", { currentPassword: "Password123", newPassword: password })).status, 400);
    }
    assert.equal((await request("/api/account/password", { currentPassword: "Password123", newPassword: "NewPassword123" })).status, 200);
    assert.equal(await verifyPassword("NewPassword123", user.passwordHash), true);
    assert.equal((await request("/api/account/delete", { confirm: true, currentPassword: "wrong" })).status, 403);
    assert.equal((await request("/api/account/delete", { confirm: false, currentPassword: "NewPassword123" })).status, 400);
    assert.equal((await request("/api/account/delete", { confirm: true, currentPassword: "NewPassword123" })).status, 200);
    assert.equal(user, null);
    assert.equal((await request("/api/account")).status, 401);
});
