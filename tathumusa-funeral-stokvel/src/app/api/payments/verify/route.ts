import { NextRequest, NextResponse } from "next/server";
import { hasPaystackConfig, paystack } from "@/lib/paystack";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json(
      { ok: false, message: "Reference parameter is required" },
      { status: 400 }
    );
  }

  if (!hasPaystackConfig()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Paystack credentials are not configured",
      },
      { status: 503 }
    );
  }

  try {
    const verification = await paystack.transaction.verify(reference);

    return NextResponse.json({
      ok: true,
      data: verification.data,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to verify payment",
        error: error.message,
      },
      { status: 500 }
    );
  }
}