import mongoose from "mongoose";

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
}
