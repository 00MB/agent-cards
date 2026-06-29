import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/issuer";
import { WhopError } from "@/lib/whop";

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof WhopError) {
    return NextResponse.json({ error: e.message, type: e.type }, { status: e.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** GET /api/cards/[id]?owner=<accountId> — retrieve a card WITH secrets (human reveal). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const issuer = getIssuer();
  // Cards live on the treasury's card-issuing account; the company key is
  // authorized there (not on a user's personal ledger), so reveal via account_id.
  const owner = issuer.treasuryAccountId();
  try {
    const card = await issuer.getCard(id, owner);
    return NextResponse.json({ data: card });
  } catch (e) {
    return errorResponse(e, "Failed to reveal card");
  }
}

/** POST /api/cards/[id] — body { status } to freeze / unfreeze / cancel. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "active" && status !== "frozen" && status !== "canceled") {
    return NextResponse.json(
      { error: "status must be 'active', 'frozen', or 'canceled'." },
      { status: 400 },
    );
  }

  try {
    const card = await getIssuer().updateCardStatus(id, status);
    return NextResponse.json({ data: card });
  } catch (e) {
    // Whop's Beta Cards API currently supports only create/list/retrieve — no
    // status mutation. Surface a clear message instead of a raw 404.
    if (e instanceof WhopError && e.status === 404) {
      return NextResponse.json(
        { error: "Freezing or canceling a card isn't supported by the issuer yet." },
        { status: 501 },
      );
    }
    return errorResponse(e, "Failed to update card");
  }
}
