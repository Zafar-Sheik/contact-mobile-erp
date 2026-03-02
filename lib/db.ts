import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Skip connection check during build time (when MONGODB_URI may not be set)
const isBuildTime = !MONGODB_URI;

if (!isBuildTime && !MONGODB_URI) throw new Error("Missing MONGODB_URI");

// ✅ Use globalThis (typed) instead of global
const g = globalThis as typeof globalThis & {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const cached = g.mongoose ?? (g.mongoose = { conn: null, promise: null });

export async function dbConnect() {
  // Return early during build time when MONGODB_URI is not available
  if (isBuildTime || !MONGODB_URI) {
    console.log("[db] Skipping connection during build time");
    return null;
  }

  if (cached.conn) {
    console.log("[db] Using existing connection");
    return cached.conn;
  }

  if (!cached.promise) {
    console.log("[db] Creating new connection to MongoDB...");
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
    console.log("[db] Connected to MongoDB successfully");
    return cached.conn;
  } catch (error) {
    console.error("[db] MongoDB connection error:", error);
    throw error;
  }
}
