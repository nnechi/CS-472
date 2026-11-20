// Your users, stored in MongoDB. The id each person gets here is permanent,
// so anything you save under it (like a teacherId) still matches next login.

import { User } from "../models/User";

export interface AppUser {
  id: string; // YOUR app's id for this person (the MongoDB _id, as text)
  authVersion: number;
  googleId: string | null; // Google's "sub", or null for password-only users
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

type UserDoc = InstanceType<typeof User>;

function toAppUser(user: UserDoc): AppUser {
  return {
    id: user._id.toString(),
    authVersion: user.authVersion,
    googleId: user.googleId ?? null,
    email: user.email,
    name: user.name ?? null,
    pictureUrl: user.pictureUrl ?? null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Create a password user. Returns null if the email is already taken.
export async function createPasswordUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<AppUser | null> {
  try {
    const user = await User.create({
      email: normalizeEmail(input.email),
      name: input.name,
      passwordHash: input.passwordHash,
    });
    return toAppUser(user);
  } catch (err) {
    // 11000 = duplicate key, i.e. the unique email index caught it.
    if ((err as { code?: number }).code === 11000) return null;
    throw err;
  }
}

// Look up a user by email, including their password hash (normally hidden).
export async function findUserWithPasswordByEmail(
  email: string,
): Promise<{ user: AppUser; passwordHash: string | null } | null> {
  const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash");
  if (!user) return null;
  return { user: toAppUser(user), passwordHash: user.passwordHash ?? null };
}

// Only call this with a Google-verified email (the callback checks email_verified).
export async function findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<AppUser> {
  const email = normalizeEmail(profile.email);
  const details = {
    email,
    name: profile.name ?? null,
    pictureUrl: profile.picture ?? null,
  };

  // 1. Returning Google user: refresh their details.
  let user = await User.findOneAndUpdate(
    { googleId: profile.googleId },
    { $set: details },
    { returnDocument: "after" },
  );
  if (user) return toAppUser(user);

  // 2. Someone already signed up with this email using a password: link Google
  //    to that account. Google has verified the email, but we haven't, so the
  //    account may have been pre-registered by someone else. Clearing the
  //    password means only the real owner (via Google) can get in from now on.
  user = await User.findOneAndUpdate(
    { email, googleId: { $exists: false } },
    { $set: { ...details, googleId: profile.googleId }, $unset: { passwordHash: "" } },
    { returnDocument: "after" },
  );
  if (user) return toAppUser(user);

  // 3. Brand new person.
  user = await User.create({ ...details, googleId: profile.googleId });
  return toAppUser(user);
}
