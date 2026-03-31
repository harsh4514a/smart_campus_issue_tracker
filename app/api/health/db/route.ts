import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  try {
    await connectDB();

    return NextResponse.json({
      ok: true,
      status: "connected",
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || null,
      dbName: mongoose.connection.name || null,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        readyState: mongoose.connection.readyState,
        latencyMs: Date.now() - startedAt,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
