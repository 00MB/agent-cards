import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/issuer";
import { addTransaction, getAgent } from "@/lib/store";
import { WhopError } from "@/lib/whop";
import type { AgentTransaction } from "@/lib/types";

/**
 * Move money. Defaults origin to the treasury.
 * Body: { origin_id?, destination_id, amount, notes? }
 */
export async function POST(req: Request) {
  let body: {
    origin_id?: unknown;
    destination_id?: unknown;
    amount?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const issuer = getIssuer();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a positive amount." }, { status: 400 });
  }

  const origin_id =
    typeof body.origin_id === "string" && body.origin_id
      ? body.origin_id
      : issuer.treasuryAccountId();
  const destination_id =
    typeof body.destination_id === "string" && body.destination_id
      ? body.destination_id
      : undefined;
  const notes = typeof body.notes === "string" && body.notes ? body.notes : undefined;

  try {
    const transfer = await issuer.createTransfer({
      origin_id,
      destination_id,
      amount,
      notes,
      idempotence_key: crypto.randomUUID(),
    });

    // Log a funding row in the local activity feed when we know the recipient agent.
    if (destination_id) {
      const profile = await getAgent(destination_id);
      const tx: AgentTransaction = {
        id: `txn_${crypto.randomUUID()}`,
        agentAccountId: destination_id,
        agentName: profile?.name ?? "Agent",
        kind: "funding",
        merchant: "Treasury funding",
        amount, // positive = credit
        status: "approved",
        createdAt: new Date().toISOString(),
      };
      await addTransaction(tx).catch(() => {});
    }

    return NextResponse.json({ data: transfer }, { status: 201 });
  } catch (e) {
    if (e instanceof WhopError) {
      return NextResponse.json({ error: e.message, type: e.type }, { status: e.status });
    }
    return NextResponse.json({ error: "Transfer failed" }, { status: 500 });
  }
}
