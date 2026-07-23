import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ motto: "Ship it fast" }, { status: 200 });
}
