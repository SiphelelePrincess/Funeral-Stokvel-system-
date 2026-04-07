import { NextResponse } from "next/server";
import { hasPaystackCredentials, paystack } from "@/lib/paystack";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    amount?: number;
    email?: string;
    month?: string;
    reference?: string;
  };

  if (!hasPaystackCredentials()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Paystack credentials are not configured yet. Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY.",
        payload: body,
      },
      { status: 503 },
    );
  }

  if (!body.amount || !body.email) {
    return NextResponse.json(
      {
        ok: false,
        message: "Amount and email are required",
        payload: body,
      },
      { status: 400 },
    );
  }

  try {
    const monthSlug = body.month
      ? body.month.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      : `payment-${Date.now()}`;
    const reference = body.reference || `monthly-contribution-${monthSlug}-${Date.now()}`;

    // Initialize transaction with Paystack
    const transaction = await paystack.transaction.initialize({
      amount: body.amount * 100, // Paystack expects amount in kobo (multiply by 100)
      email: body.email,
      reference,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`,
      metadata: {
        month: body.month,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Payment initialized successfully",
      data: {
        authorization_url: transaction.data.authorization_url,
        access_code: transaction.data.access_code,
        reference: transaction.data.reference,
      },
    });
  } catch (error: unknown) {
    console.error("Paystack initialization error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to initialize payment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
