import { NextResponse } from "next/server";
import { callQuery, getConvexClient } from "@/lib/convex-server";

export async function GET() {
  const client = getConvexClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, message: "Convex is not configured yet." },
      { status: 503 },
    );
  }

  const contributions = await callQuery<
    unknown,
    Array<{
      _id: string;
      memberId: string;
      amount: number;
      date: string;
      status: string;
      paymentReference?: string;
    }>
  >(client, "contributions:listAll", {});

  // Get member names
  const memberIds = [...new Set(contributions.map(c => c.memberId))];
  const members = await Promise.all(
    memberIds.map(async (memberId) => {
      try {
        const member = await callQuery<unknown, { name: string } | null>(
          client,
          "users:get",
          { userId: memberId }
        );
        return { id: memberId, name: member?.name ?? "Unknown Member" };
      } catch {
        return { id: memberId, name: "Unknown Member" };
      }
    })
  );

  const memberMap = new Map(members.map(m => [m.id, m.name]));

  const items = contributions.map((contribution) => ({
    _id: contribution._id,
    memberName: memberMap.get(contribution.memberId) ?? "Unknown Member",
    amount: contribution.amount,
    date: contribution.date,
    status: contribution.status,
  }));

  return NextResponse.json({ ok: true, items });
}