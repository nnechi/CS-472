// Your users, stored in MongoDB. The id each person gets here is permanent,
// so anything you save under it (like a teacherId) still matches next login.

import { User } from "../models/User";

export interface AppUser {
  id: string; // YOUR app's id for this person (the MongoDB _id, as text)
  googleId: string; // Google's "sub": permanent and never reused
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<AppUser> {
  // Find the person by googleId and refresh their details. If there's no such
  // person yet, "upsert" creates them. Either way, we get the saved document back.
  const user = await User.findOneAndUpdate(
    { googleId: profile.googleId },
    {
      $set: {
        email: profile.email,
        name: profile.name ?? null,
        pictureUrl: profile.picture ?? null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!user) {
    throw new Error("Could not save the user.");
  }

  return {
    id: user._id.toString(),
    googleId: user.googleId,
    email: user.email,
    name: user.name ?? null,
    pictureUrl: user.pictureUrl ?? null,
  };
}