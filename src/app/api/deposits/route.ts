import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/issuer";
import { WhopError } from "@/lib/whop";

/**
 * POST /api/deposits — create deposit instructions for a specific agent's
 * sub-account. Body: { accountId, amount? }. Returns crypto addresses + bank
 * (wire/ACH/SEPA) details for funding that agent's balance directly.
 */
export async function POST(req: Request) {
  let body: { accountId?: string; amount?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const accountId = body.accountId?.trim();
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const issuer = getIssuer();
  try {
    const deposit = await issuer.createDeposit({
      destination: accountId,
      amount:
        typeof body.amount === "number" && body.amount > 0 ? body.amount : undefined,
    });

    // ⚠️ PROOF OF CONCEPT — DO NOT DO THIS IN PRODUCTION.
    // Whop only provisions bank (wire/ACH) rails at the treasury level, not on
    // agent sub-accounts. Here we fall back to showing the TREASURY's bank details
    // for every agent so the Bank tab is populated. This is misleading: a wire to
    // these details credits the treasury, NOT the individual agent's balance — there
    // is no per-agent reconciliation. A real implementation needs per-agent virtual
    // bank accounts (or an internal allocation/ledger that maps deposits to agents).
    const hasBank = (deposit.methods.bank?.currencies ?? []).length > 0;
    const treasuryId = issuer.treasuryAccountId();
    if (!hasBank && accountId !== treasuryId) {
      const treasury = await issuer
        .createDeposit({ destination: treasuryId })
        .catch(() => null);
      if (treasury?.methods.bank) deposit.methods.bank = treasury.methods.bank;
    }

    return NextResponse.json({ data: deposit });
  } catch (e) {
    if (e instanceof WhopError) {
      return NextResponse.json({ error: e.message, type: e.type }, { status: e.status });
    }
    return NextResponse.json({ error: "Failed to create deposit" }, { status: 500 });
  }
}
