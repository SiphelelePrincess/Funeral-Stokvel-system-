import { NextResponse } from "next/server";
import { callMutation, getConvexClient } from "@/lib/convex-server";
import { getCurrentUserProfile } from "@/lib/clerk-server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    amount?: number;
    reason?: string;
    repaymentPlan?: string;
  };

  const client = getConvexClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Convex is not configured." }, { status: 503 });
  }

  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, message: "You must be signed in." }, { status: 401 });
  }

  if (!body.amount || !body.reason) {
    return NextResponse.json({ ok: false, message: "Amount and reason are required." }, { status: 400 });
  }

  const memberId = await callMutation<unknown, string>(client, "users:ensure", {
    clerkId: profile.userId,
    name: profile.name,
    email: profile.email,
  });

  await callMutation(client, "loans:create", {
    memberId,
    amount: body.amount,
    reason: body.reason,
    interestRate: 7,
  });

  return NextResponse.json({
    ok: true,
    message: `Loan request for R${body.amount} submitted. Admin will review with 7% interest applied.`,
  });
}
