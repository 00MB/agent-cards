import "server-only";
import type {
  Issuer,
  CreateCardInput,
  CreateTransferInput,
  CreateDepositInput,
} from "./issuer";
import type { Account, Card, Transfer, AccountLink, Deposit } from "./types";
import { mockAccounts, mockCards, mockTransfers, mockDeposit } from "./mock";

/**
 * Whop Beta API adapter for AgentCards.
 * Base: https://api.whop.com/api/v1 — Bearer auth with WHOP_API_KEY.
 * All calls are server-side only. Falls back to mock data when no key is set,
 * so the app is fully demoable before going live.
 *
 * This module implements the issuer-agnostic `Issuer` interface (lib/issuer.ts);
 * a Stripe Issuing adapter can satisfy the same shape later without touching the
 * UI or the MCP server.
 */

const BASE = process.env.WHOP_API_BASE ?? "https://api.whop.com/api/v1";

// Default "treasury" (test company). Non-secret — safe fallback so the app
// renders even before .env.local exists.
const DEFAULT_TREASURY_ACCOUNT_ID = "biz_bvf4adVopetggv";

export function treasuryAccountId(): string {
  return process.env.TREASURY_ACCOUNT_ID ?? DEFAULT_TREASURY_ACCOUNT_ID;
}

/** The KYC'd user that cards are issued to (cards live on the parent, not subaccounts). */
export function cardUserId(): string | undefined {
  return process.env.CARD_USER_ID || undefined;
}

/** Whether the live API key is configured. */
export function isConfigured(): boolean {
  return !!process.env.WHOP_API_KEY;
}

export class WhopError extends Error {
  status: number;
  type?: string;
  constructor(message: string, status: number, type?: string) {
    super(message);
    this.name = "WhopError";
    this.status = status;
    this.type = type;
  }
}

function apiKey(): string {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new WhopError("WHOP_API_KEY is not configured — create .env.local", 500);
  return key;
}

type QueryValue = string | number | boolean | undefined | null;

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Record<string, QueryValue>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const err = (json as { error?: { message?: string; type?: string } } | null)?.error;
    throw new WhopError(err?.message ?? `Whop API ${res.status}`, res.status, err?.type);
  }
  return json as T;
}

function ownerQuery(ownerId: string): Record<string, QueryValue> {
  return ownerId.startsWith("user_") ? { user_id: ownerId } : { account_id: ownerId };
}

// ---------------- Accounts (treasury + agents) ----------------

type PageInfo = { has_next_page?: boolean; end_cursor?: string | null };

async function listAccounts(): Promise<Account[]> {
  if (!isConfigured()) return mockAccounts;
  // GET /accounts is cursor-paginated (default page size 10). Walk every page via
  // `first` + `after` so the full set of connected accounts is returned.
  const all: Account[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const r = await request<{ data: Account[]; page_info?: PageInfo }>("GET", "/accounts", {
      query: { first: 100, after },
    });
    all.push(...(r.data ?? []));
    if (!r.page_info?.has_next_page || !r.page_info?.end_cursor) break;
    after = r.page_info.end_cursor;
  }
  return all;
}

/** Connected accounts under the treasury — i.e. our agents. */
async function listAgentAccounts(): Promise<Account[]> {
  const treasury = treasuryAccountId();
  return (await listAccounts()).filter((a) => a.parent_account_id === treasury);
}

async function createAgentAccount(input: {
  email: string;
  name?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<Account> {
  const { email, name, description, metadata } = input;
  // title/description aren't settable at creation (Whop ignores them and the
  // account title defaults to the email), so we store the agent's name + mandate
  // in metadata, which is reliably persisted.
  return request<Account>("POST", "/accounts", {
    body: {
      email,
      metadata: {
        ...(metadata ?? {}),
        ...(name ? { agent_name: name } : {}),
        ...(description ? { mandate: description.slice(0, 480) } : {}),
      },
    },
  });
}

async function createAccountLink(input: {
  company_id: string;
  use_case?: "account_onboarding" | "payouts_portal";
  refresh_url: string;
  return_url: string;
}): Promise<AccountLink> {
  return request<AccountLink>("POST", "/account_links", {
    body: { use_case: "account_onboarding", ...input },
  });
}

// ---------------- Cards ----------------

async function listCards(ownerId: string): Promise<Card[]> {
  if (!isConfigured()) return mockCards;
  // GET /cards is cursor-paginated (default page size ~10). Walk all pages so a
  // newly-issued card is never missed when an account has many cards.
  const all: Card[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const r = await request<{ data: Card[]; page_info?: PageInfo }>("GET", "/cards", {
      query: { ...ownerQuery(ownerId), first: 100, after },
    });
    all.push(...(r.data ?? []));
    if (!r.page_info?.has_next_page || !r.page_info?.end_cursor) break;
    after = r.page_info.end_cursor;
  }
  return all;
}

/** Retrieve a single card WITH secrets (PAN/CVV/name). Requires the owner id. */
async function getCard(cardId: string, ownerId: string): Promise<Card> {
  if (!isConfigured()) {
    const c = mockCards.find((m) => m.id === cardId);
    if (c) return c;
    throw new WhopError("Card not found", 404);
  }
  return request<Card>("GET", `/cards/${cardId}`, { query: ownerQuery(ownerId) });
}

async function createCard(input: CreateCardInput): Promise<Card> {
  return request<Card>("POST", "/cards", { body: input });
}

/** Freeze / unfreeze / cancel — issuer-native lifecycle (best-effort on beta). */
async function updateCardStatus(
  cardId: string,
  status: "active" | "frozen" | "canceled",
): Promise<Card> {
  return request<Card>("POST", `/cards/${cardId}`, { body: { status } });
}

// ---------------- Transfers (funding) ----------------

async function listTransfers(originId: string): Promise<Transfer[]> {
  if (!isConfigured()) return mockTransfers;
  const r = await request<{ data: Transfer[] }>("GET", "/transfers", {
    query: { origin_id: originId },
  });
  return r.data ?? [];
}

async function createTransfer(
  input: CreateTransferInput,
): Promise<Transfer & { url?: string }> {
  return request<Transfer & { url?: string }>("POST", "/transfers", {
    body: { type: "ledger", currency: "usd", ...input },
  });
}

/**
 * Create a deposit (POST /deposits). Returns crypto addresses (wallet/EVM/Solana)
 * and, when enabled, bank deposit instructions (wire / ACH / SEPA). In mock mode
 * we return demo instructions so the funding UI is fully clickable offline.
 */
async function createDeposit(input: CreateDepositInput): Promise<Deposit> {
  if (!isConfigured()) {
    const accountId =
      typeof input.destination === "string"
        ? input.destination
        : (input.destination.account_id ?? mockDeposit.account_id ?? "biz_demo");
    return mockDepositFor(accountId ?? "biz_demo", input.amount);
  }
  return request<Deposit>("POST", "/deposits", { body: input });
}

/** Deterministic per-account demo deposit so each agent shows its own address/details. */
function mockDepositFor(accountId: string, amount?: number): Deposit {
  let h = 0;
  for (const ch of accountId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, "0");
  const acctNum = (h % 9_000_000_000 + 1_000_000_000).toString();
  const ref = `ACDEP-${hex.slice(0, 6).toUpperCase()}`;
  const [usd, eur] = mockDeposit.methods.bank!.currencies;
  return {
    ...mockDeposit,
    amount: amount != null ? String(amount) : mockDeposit.amount,
    account_id: accountId,
    methods: {
      crypto: mockDeposit.methods.crypto.map((n) => ({
        ...n,
        deposit_address:
          n.name === "Solana"
            ? hex.slice(0, 4) + n.deposit_address.slice(4)
            : "0x" + hex + n.deposit_address.slice(10),
      })),
      bank: {
        currencies: [
          { ...usd, account_number: acctNum, deposit_reference: ref },
          { ...eur, deposit_reference: ref },
        ],
      },
    },
  };
}

// ---------------- The adapter ----------------

export const whopIssuer: Issuer = {
  name: "whop",
  isConfigured,
  treasuryAccountId,
  cardUserId,
  listAccounts,
  listAgentAccounts,
  createAgentAccount,
  createAccountLink,
  listCards,
  getCard,
  createCard,
  updateCardStatus,
  listTransfers,
  createTransfer,
  createDeposit,
};
