// Users, for now they live in memory and are gone when server restarts
// when database stuff is up we'll replace findOrCreateUserFromGoogle with database code

import { randomUUID } from "node:crypto";

export interface AppUser {
    id: string; // Our app's id for user
    googleId: string; // Google's 'sub', permanent and never reused
    email: string;
    name: string | null;
    pictureUrl: string | null;
}

export interface GoogleProfile {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
}

const usersByGoogleId = new Map<string, AppUser>();

export async function findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<AppUser> {
    // look people up by googleId, since emails can change
    const existing = usersByGoogleId.get(profile.googleId);
    if (existing) {
        // returning user = refresh their details in case they changed at Google
        existing.email = profile.email;
        existing.name = profile.name ?? null;
        existing.pictureUrl = profile.picture ?? null;
        return existing;
    }

    // on first visit, create them
    const user: AppUser = {
        id: randomUUID(),
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name ?? null,
        pictureUrl: profile.picture ?? null,
    };
    usersByGoogleId.set(user.googleId, user);
    return user;
}