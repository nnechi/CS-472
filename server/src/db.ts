import mongoose from "mongoose";
import { User } from "./models/User";

// Read the connection string from the environment. In Docker this points at
// the "mongo" service (see docker-compose.yml). Locally you could point it at
// mongodb://localhost:27017/chat instead.
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chat";

export async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[db] connected to MongoDB at", MONGO_URI);
  } catch (err) {
    console.error("[db] failed to connect to MongoDB:", err);
    // Exit so Docker can restart the container and retry.
    process.exit(1);
  }

  // Make MongoDB's indexes match the schemas (e.g. the sparse googleId and
  // unique email indexes on User). Mongoose won't change existing indexes
  // on its own. A failure here (like two users sharing an email) is logged
  // but doesn't stop the server.
  try {
    await User.syncIndexes();
  } catch (err) {
    console.error("[db] failed to sync User indexes:", err);
  }
}
