import { NextResponse } from "next/server";
import { callMutation, callQuery, getConvexClient } from "@/lib/convex-server";
import { getCurrentUserProfile } from "@/lib/clerk-server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    beneficiaryIdNumber?: string;
    idCopyUrl?: string;
    deathCertificateUrl?: string;
    notes?: string;
  };

  const client = getConvexClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Convex is not configured." }, { status: 503 });
  }

  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, message: "You must be signed in." }, { status: 401 });
  }

  if (!body.beneficiaryIdNumber) {
    return NextResponse.json({ ok: false, message: "Beneficiary ID number is required." }, { status: 400 });
  }

  const memberId = await callMutation<unknown, string>(client, "users:ensure", {
    clerkId: profile.userId,
    name: profile.name,
    email: profile.email,
  });

  const beneficiary = await callQuery<
    { idNumber: string },
    { _id: string; name: string } | null
  >(client, "beneficiaries:getByIdNumber", { idNumber: body.beneficiaryIdNumber });

  if (!beneficiary) {
    return NextResponse.json(
      { ok: false, message: "Beneficiary not found. Please check the ID number." },
      { status: 404 },
    );
  }

  await callMutation(client, "claims:create", {
    memberId,
    beneficiaryId: beneficiary._id,
    idCopyUrl: body.idCopyUrl,
    deathCertificateUrl: body.deathCertificateUrl,
  });

  await callMutation(client, "beneficiaries:markDeceased", { idNumber: body.beneficiaryIdNumber });

  return NextResponse.json({
    ok: true,
    message: `Claim submitted for ${beneficiary.name}. Committee will now vote before payment is authorised.`,
  });
}
