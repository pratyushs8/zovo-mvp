import { NextResponse } from "next/server";

// Used by uptime monitoring and deployment health checks.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
