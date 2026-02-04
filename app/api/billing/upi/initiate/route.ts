import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "UPI payments are not available yet." },
    { status: 501 }
  );
}
