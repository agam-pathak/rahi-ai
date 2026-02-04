import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { status: "not_available" },
    { status: 501 }
  );
}
