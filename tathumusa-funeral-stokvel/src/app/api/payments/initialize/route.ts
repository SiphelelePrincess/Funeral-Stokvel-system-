import { NextResponse } from "next/server";
import { hasPaystackConfig, paystack } from "@/lib/paystack";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    amount?: number;
    email?: string;
    month?: string;
    reference?: string;
  };

  if (!hasPaystackConfig()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Paystack credentials are not configured yet. Add the live keys to enable payment initialization.",
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
    // Initialize transaction with Paystack
    const transaction = await paystack.transaction.initialize({
      amount: body.amount * 100, // Paystack expects amount in kobo (multiply by 100)
      email: body.email,
      reference: body.reference || `txn_${Date.now()}`,
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
  } catch (error: any) {
    console.error("Paystack initialization error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to initialize payment",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
