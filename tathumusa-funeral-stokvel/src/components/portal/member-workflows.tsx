"use client";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => Promise<void> | void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

import { useEffect, useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";

const paymentSchema = z.object({
  amount: z.number().min(380),
  month: z.string().min(1),
  cardNumber: z.string().optional(),
  expiry: z.string().optional(),
  cvv: z.string().optional(),
});

const claimSchema = z.object({
  beneficiaryIdNumber: z.string().min(5, "Enter the beneficiary's SA ID number"),
  idCopyUrl: z.string().optional(),
  deathCertificateUrl: z.string().optional(),
  notes: z.string().min(8),
});

const loanSchema = z.object({
  amount: z.number().min(500),
  reason: z.string().min(8),
  repaymentPlan: z.string().min(6),
});

type Transaction = {
  _id: string;
  memberName: string;
  amount: number;
  date: string;
  month?: string;
  status: string;
  paymentReference?: string;
};

type PaymentReceipt = {
  reference: string;
  amount: number;
  date: string;
  month: string;
};

export function MemberWorkflows() {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <PaymentCard />
      <ClaimCard />
      <LoanCard />
    </div>
  );
}

function PaymentCard() {
  const defaultMonth = useMemo(() => new Date().toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  }), []);

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [email, setEmail] = useState("");
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
  const paystackConfigured = Boolean(paystackPublicKey);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 380, month: defaultMonth, cardNumber: "", expiry: "", cvv: "" },
  });

  const { watch } = form;
  const selectedMonth = watch("month");

  const alreadyPaidForSelectedMonth = useMemo(() => {
    if (!selectedMonth || !transactionHistory.length) return false;
    return transactionHistory.some((transaction) =>
      transaction.status.toLowerCase() === "paid" &&
      transaction.month?.trim().toLowerCase() === selectedMonth.trim().toLowerCase(),
    );
  }, [selectedMonth, transactionHistory]);

  const loadPaystack = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.PaystackPop) {
      setPaystackLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setPaystackLoaded(true);
    document.body.appendChild(script);
  }, []);

  const fetchUserEmail = useCallback(async () => {
    try {
      const response = await fetch("/api/users/summary");
      if (!response.ok) return;
      const data = await response.json();
      setEmail(data.user?.email ?? "");
    } catch {
      // ignore
    }
  }, []);

  const fetchTransactionHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/contributions/list?mine=true");
      if (!response.ok) return;
      const data = (await response.json()) as { ok: boolean; items?: Transaction[] };
      if (data.ok && data.items) {
        setTransactionHistory(data.items.slice(-5).reverse());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPaystack();
    fetchUserEmail();
    fetchTransactionHistory();
  }, []);

  const verifyPayment = async (reference: string, amount: number, month: string) => {
    try {
      const response = await fetch(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
      const data = await response.json();
      if (data.ok && data.data?.status === "success") {
        setCheckoutOpen(false);
        setReceipt({ reference, amount, date: new Date().toISOString(), month });
        setMessage("Payment Successful – Thank you for your contribution!");
        fetchTransactionHistory();
        return;
      }
      setCheckoutOpen(false);
      setMessage("Payment Failed – Please try again or use another method.");
    } catch {
      setCheckoutOpen(false);
      setMessage("Payment verification failed. Please check your transaction reference.");
    }
  };

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    if (checkoutOpen) {
      return;
    }

    if (!paystackConfigured) {
      setMessage(
        "Paystack is not configured. Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local and restart the app."
      );
      return;
    }

    if (alreadyPaidForSelectedMonth) {
      setMessage(`You have already paid for ${values.month}. Only one payment per month is allowed.`);
      return;
    }

    if (!email) {
      setMessage("Unable to load your email. Please sign in again or refresh the page.");
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setReceipt(null);

    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: values.amount, month: values.month, email }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        data?: { authorization_url: string; reference: string };
      };

      if (!data.ok || !data.data) {
        setMessage(data.message ?? "Failed to start Paystack checkout.");
        return;
      }

      const reference = data.data.reference;
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
      setCheckoutOpen(true);

      if (window.PaystackPop && publicKey) {
        window.PaystackPop.setup({
          key: publicKey,
          email: email || "member@example.com",
          amount: values.amount * 100,
          ref: reference,
          metadata: { month: values.month },
          callback: async () => {
            await verifyPayment(reference, values.amount, values.month);
          },
          onClose: () => {
            setCheckoutOpen(false);
            if (!receipt) {
              setMessage("Payment window closed before completion.");
            }
          },
        }).openIframe();
      } else {
        window.location.href = data.data.authorization_url;
      }
    } catch {
      setCheckoutOpen(false);
      setMessage("Payment initialization failed. Please try again once the service is online.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextDueDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(7);
    return date.toLocaleDateString("en-ZA", {
      month: "long",
      day: "numeric",
    });
  }, []);

  return (
    <Card className="rounded-4xl">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Payment details</p>
      <h3 className="mt-3 text-2xl font-semibold text-zinc-950">Pay monthly contribution</h3>
      <div className="mt-5 grid gap-4">
        <div className="rounded-3xl border border-zinc-200/80 bg-white/85 p-4">
          <p className="text-sm text-zinc-600">Next contribution due</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{nextDueDate}</p>
          <p className="mt-2 text-sm text-zinc-600">Pay R380 before the due date to stay on track.</p>
          <Button
            className="mt-4"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isLoading || checkoutOpen || alreadyPaidForSelectedMonth || !paystackConfigured}
          >
            {isLoading ? "Loading Paystack..." : alreadyPaidForSelectedMonth ? "Paid for this month" : "Pay Now"}
          </Button>
          {!paystackConfigured ? (
            <p className="mt-3 text-sm text-amber-700">
              Paystack is not configured. Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local to enable checkout.
            </p>
          ) : null}
        </div>
        <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
          <Input {...form.register("month")} placeholder="Contribution month" />
          <Input
            type="number"
            {...form.register("amount", { valueAsNumber: true })}
            placeholder="Amount (R)"
          />
          <Input
            {...form.register("cardNumber")}
            placeholder="Card number"
            autoComplete="cc-number"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input {...form.register("expiry")} placeholder="Expiry (MM/YY)" autoComplete="cc-exp" />
            <Input {...form.register("cvv")} placeholder="CVV" type="password" autoComplete="cc-csc" />
          </div>
          <p className="text-xs text-zinc-500">Card details are securely handled by Paystack during checkout.</p>
          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading || !paystackLoaded || checkoutOpen || alreadyPaidForSelectedMonth || !paystackConfigured
            }
          >
            {isLoading ? "Opening Paystack..." : alreadyPaidForSelectedMonth ? "Paid for this month" : "Pay Now with Paystack"}
          </Button>
          {!paystackConfigured ? (
            <p className="text-sm text-amber-700">
              Paystack keys are missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, PAYSTACK_SECRET_KEY, and PAYSTACK_WEBHOOK_SECRET in .env.local.
            </p>
          ) : null}
        </form>
        {alreadyPaidForSelectedMonth ? (
          <p className="text-sm text-amber-700">You already have a completed payment for {selectedMonth}. Select a different month.</p>
        ) : null}
        {receipt ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Payment Successful – Thank you for your contribution!</p>
            <p className="mt-2 text-sm text-zinc-700">Reference: {receipt.reference}</p>
            <p className="text-sm text-zinc-700">Amount: R{receipt.amount.toFixed(2)}</p>
            <p className="text-sm text-zinc-700">Date: {new Date(receipt.date).toLocaleString()}</p>
            <p className="text-sm text-zinc-700">Month: {receipt.month}</p>
          </div>
        ) : null}
        {message ? <p className="text-sm leading-7 text-zinc-600">{message}</p> : null}
      </div>
      <div className="mt-6 rounded-[28px] border border-zinc-200/80 bg-white/85 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Transaction history</p>
        <div className="mt-4 space-y-3">
          {transactionHistory.length ? (
            transactionHistory.map((transaction) => (
              <div
                key={transaction._id}
                className="rounded-3xl border border-zinc-200/80 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-950">{transaction.month ?? `R${transaction.amount}`}</p>
                    <p className="text-xs text-zinc-500">
                      {transaction.month ? new Date(transaction.date).toLocaleString() : new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-500">
                    {transaction.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">Reference: {transaction.paymentReference ?? "N/A"}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No contribution transactions found yet.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ClaimCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof claimSchema>>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      beneficiaryIdNumber: "",
      idCopyUrl: "",
      deathCertificateUrl: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof claimSchema>) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/claims/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryIdNumber: values.beneficiaryIdNumber,
          idCopyUrl: values.idCopyUrl,
          deathCertificateUrl: values.deathCertificateUrl,
          notes: values.notes,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      setMessage(data.message ?? (data.ok ? "Claim submitted successfully." : "Submission failed."));
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="rounded-4xl">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Request for payment</p>
      <h3 className="mt-3 text-2xl font-semibold text-zinc-950">Funeral claim intake</h3>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          {...form.register("beneficiaryIdNumber")}
          placeholder="Beneficiary SA ID number"
        />
        <Input
          {...form.register("idCopyUrl")}
          placeholder="ID copy URL (optional)"
        />
        <Input
          {...form.register("deathCertificateUrl")}
          placeholder="Death certificate URL (optional)"
        />
        <Textarea {...form.register("notes")} placeholder="Family notes and support request" />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit claim"}
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm leading-7 text-zinc-600">{message}</p> : null}
    </Card>
  );
}

function LoanCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount: 1500,
      reason: "",
      repaymentPlan: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loanSchema>) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/loans/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          reason: `${values.reason} (Repayment: ${values.repaymentPlan})`,
        }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      setMessage(data.message ?? (data.ok ? "Loan request submitted." : "Submission failed."));
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="rounded-4xl">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Support request</p>
      <h3 className="mt-3 text-2xl font-semibold text-zinc-950">Loan application</h3>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input
          type="number"
          {...form.register("amount", { valueAsNumber: true })}
          placeholder="Loan amount"
        />
        <Textarea {...form.register("reason")} placeholder="Reason for loan request" />
        <Select {...form.register("repaymentPlan")}> 
          <option value="">Select a repayment plan</option>
          <option value="3 months">3 months</option>
          <option value="5 months">5 months</option>
          <option value="6 months">6 months</option>
        </Select>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send loan request"}
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm leading-7 text-zinc-600">{message}</p> : null}
    </Card>
  );
}
