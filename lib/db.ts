import mongoose from "mongoose";

/**
 * Maintain a cached connection across hot reloads in development and
 * across route handlers in production to avoid creating new connections.
 */
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Please set the MONGODB_URI environment variable.");
}

interface GlobalWithMongoose {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const globalWithMongoose = global as typeof global & GlobalWithMongoose;

let cached = globalWithMongoose.mongoose;

if (!cached) {
  cached = globalWithMongoose.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached?.conn) {
    return cached.conn;
  }

  if (!cached?.promise) {
    const uri = (MONGODB_URI as string).trim();

    const hasValidScheme = uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
    if (!hasValidScheme) {
      throw new Error(
        "Invalid MONGODB_URI. It must start with mongodb:// or mongodb+srv://. Current value: " + uri
      );
    }

    cached!.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB_NAME,
    });
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}

export default connectDB;