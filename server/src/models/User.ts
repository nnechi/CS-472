import { Schema, model } from "mongoose";

// One document per person who has signed in with Google.
const userSchema = new Schema(
  {
    googleId: { type: String, required: true, unique: true }, // Google's "sub"
    email: { type: String, required: true },
    name: { type: String, default: null },
    pictureUrl: { type: String, default: null },
  },
  { timestamps: true }, // adds createdAt and updatedAt
);

export const User = model("User", userSchema);