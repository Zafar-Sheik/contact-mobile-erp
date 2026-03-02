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
    return null;
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
