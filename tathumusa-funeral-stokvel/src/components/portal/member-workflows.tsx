"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";

const paymentSchema = z.object({
  amount: z.number().min(380),
  month: z.string().min(1),
});

const claimSchema = z.object({
  beneficiary: z.string().min(2),
  idDocumentName: z.string().min(2),
  deathCertificateName: z.string().min(2),
  notes: z.string().min(8),
});

const loanSchema = z.object({
  amount: z.number().min(500),
  reason: z.string().min(8),
  repaymentPlan: z.string().min(6),
});

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
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 380, month: "April 2026" },
  });

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: values.amount, month: values.month }),
      });
      const data = (await response.json()) as { message?: string };
      setMessage(
        data.message ??
          `Prepared a Paystack checkout request for ${values.month} at R${values.amount}.`,
      );
    } catch {
      setMessage("Payment initialization failed. Please try again once the service is online.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="rounded-[32px]">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Make a payment</p>
      <h3 className="mt-3 text-2xl font-semibold text-zinc-950">Contribution checkout</h3>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input {...form.register("month")} placeholder="Contribution month" />
        <Input
          type="number"
          {...form.register("amount", { valueAsNumber: true })}
          placeholder="Amount"
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Preparing..." : "Prepare Paystack payment"}
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm leading-7 text-zinc-600">{message}</p> : null}
    </Card>
  );
}

function ClaimCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof claimSchema>>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      beneficiary: "",
      idDocumentName: "",
      deathCertificateName: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof claimSchema>) => {
    setIsLoading(true);
    setMessage(null);
    await new Promise((resolve) => setTimeout(resolve, 400));
    setMessage(
      `Claim prepared for ${values.beneficiary}. The workflow will move to member voting after the ID and death certificate are uploaded to live storage.`,
    );
    setIsLoading(false);
  };

  return (
    <Card className="rounded-[32px]">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Request for payment</p>
      <h3 className="mt-3 text-2xl font-semibold text-zinc-950">Funeral claim intake</h3>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <Input {...form.register("beneficiary")} placeholder="Beneficiary name" />
        <Input {...form.register("idDocumentName")} placeholder="ID document file name" />
        <Input
          {...form.register("deathCertificateName")}
          placeholder="Death certificate file name"
        />
        <Textarea {...form.register("notes")} placeholder="Family notes and support request" />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit claim draft"}
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
    await new Promise((resolve) => setTimeout(resolve, 400));
    setMessage(
      `Loan request for R${values.amount} captured. Admin review will apply the 7% interest rule before approval.`,
    );
    setIsLoading(false);
  };

  return (
    <Card className="rounded-[32px]">
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
