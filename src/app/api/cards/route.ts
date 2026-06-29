import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/issuer";
import { getAgent, upsertAgent } from "@/lib/store";
import { WhopError } from "@/lib/whop";
import type { SpendFrequency } from "@/lib/types";

const FREQUENCIES: SpendFrequency[] = ["daily", "weekly", "monthly", "one_time"];

/**
 * Issue a card for an agent.
 * Body: { agentAccountId, name?, spend_limit?, spend_limit_frequency?, transaction_limit?, setAsPrimary? }
 */
export async function POST(req: Request) {
  let body: {
    agentAccountId?: unknown;
    name?: unknown;
    spend_limit?: unknown;
    spend_limit_frequency?: unknown;
    transaction_limit?: unknown;
    setAsPrimary?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const agentAccountId =
    typeof body.agentAccountId === "string" ? body.agentAccountId : "";
  if (!agentAccountId) {
    return NextResponse.json({ error: "agentAccountId is required." }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;
  const spend_limit =
    body.spend_limit != null && Number.isFinite(Number(body.spend_limit))
      ? Number(body.spend_limit)
      : undefined;
  const transaction_limit =
    body.transaction_limit != null && Number.isFinite(Number(body.transaction_limit))
      ? Number(body.transaction_limit)
      : undefined;
  const spend_limit_frequency = FREQUENCIES.includes(
    body.spend_limit_frequency as SpendFrequency,
  )
    ? (body.spend_limit_frequency as SpendFrequency)
    : undefined;

  const issuer = getIssuer();

  try {
    // Cards are issued on the treasury's approved card-issuing account (subaccounts
    // can't pass KYC), then linked to this agent in our store. Business CIAs also
    // require assigned_user_id (the KYC'd company member); individual CIAs don't.
    const card = await issuer.createCard({
      account_id: issuer.treasuryAccountId(),
      assigned_user_id: issuer.cardUserId(),
      name,
      spend_limit,
      spend_limit_frequency,
      transaction_limit,
    });

    // Link the card to the agent (and set primary if it's the first / requested).
    const profile = await getAgent(agentAccountId);
    if (profile) {
      const cardIds = Array.from(new Set([...(profile.cardIds ?? []), card.id]));
      await upsertAgent({
        ...profile,
        cardIds,
        cardId: body.setAsPrimary === true || !profile.cardId ? card.id : profile.cardId,
      });
    }

    return NextResponse.json({ data: card }, { status: 201 });
  } catch (e) {
    if (e instanceof WhopError) {
      return NextResponse.json({ error: e.message, type: e.type }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to issue card" }, { status: 500 });
  }
}
