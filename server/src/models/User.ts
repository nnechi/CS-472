import { Schema, model } from "mongoose";

// One document per person, whether they sign in with Google, a password, or both.
const userSchema = new Schema(
  {
    // Google's "sub". Only Google users have one. sparse lets many
    // password-only users have no googleId without breaking unique.
    // Don't default this to null: the sparse index still counts stored nulls.
    googleId: { type: String, unique: true, sparse: true },

    // Every user has an email, and it's what password users log in with.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Password users only. Store a hash, never the password itself.
    // select: false keeps it out of normal queries; ask for it with .select("+passwordHash").
    passwordHash: { type: String, select: false },

    authVersion: { type: Number, default: 0 },
    name: { type: String, default: null },
    pictureUrl: { type: String, default: null },
  },
  { timestamps: true }, // adds createdAt and updatedAt
);

// Each user needs at least one way to sign in.
userSchema.pre("validate", async function () {
  if (!this.googleId && !this.passwordHash) {
    this.invalidate("googleId", "User needs a googleId or a password.");
  }
});

export const User = model("User", userSchema);
