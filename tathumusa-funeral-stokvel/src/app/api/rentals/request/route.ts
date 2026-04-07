import { NextResponse } from "next/server";
import { callMutation, getConvexClient } from "@/lib/convex-server";
import { getCurrentUserProfile } from "@/lib/clerk-server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    type?: "car" | "equipment";
    item?: string;
    date?: string;
    notes?: string;
  };

  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, message: "You must be signed in." },
      { status: 401 },
    );
  }

  const client = getConvexClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, message: "Convex is not configured yet." },
      { status: 503 },
    );
  }

  if (!body.type || !body.item || !body.date) {
    return NextResponse.json(
      { ok: false, message: "Rental type, item, and date are required." },
      { status: 400 },
    );
  }

  await callMutation(client, "rentals:create", {
    memberName: profile.name,
    type: body.type,
    item: body.item,
    date: body.date,
    notes: body.notes,
  });

  return NextResponse.json({ ok: true, message: "Rental request submitted." });
}
