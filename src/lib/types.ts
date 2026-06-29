// AgentCards — shared types
//
// Two layers:
//  1. Issuer shapes (Card / Account / Transfer) — mirror the Whop Beta API, but
//     intentionally issuer-agnostic so a Stripe Issuing adapter can satisfy the
//     same `Issuer` interface later (see lib/issuer.ts).
//  2. AgentCards domain (AgentProfile / SpendPolicy / AgentTransaction) — the
//     things no issuer models for us, persisted in our small local store.

// ---------------- Issuer shapes (Whop Beta today) ----------------

export interface WhopBilling {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
}

export interface CardSecrets {
  card_number: string;
  cvc: string;
  name_on_card: string | null;
}

export interface Card {
  object?: "card";
  id: string; // icrd_...
  name: string | null;
  type: "virtual" | "physical" | null;
  status: "active" | "frozen" | "canceled" | "invited" | null;
  last4: string | null;
  expiration_month: string | null;
  expiration_year: string | null;
  user_id: string | null;
  spent_last_month: number | null; // cents
  limit: { amount: number; frequency: string } | null;
  billing: WhopBilling | null;
  created_at: string | null;
  canceled_at: string | null;
  secrets?: CardSecrets | null;
}

export interface Account {
  id: string; // biz_... (treasury or an agent's connected account)
  email: string | null;
  title: string;
  route?: string;
  logo_url?: string | null;
  business_type?: string | null;
  country?: string | null;
  parent_account_id?: string | null;
  created_at?: string;
  metadata?: Record<string, string> | null;
  balances?: unknown;
}

export interface Transfer {
  id: string; // ctt_...
  amount: number;
  currency: string;
  created_at: string;
  fee_amount?: number;
  notes?: string | null;
  metadata?: Record<string, string> | null;
  origin_ledger_account_id?: string;
  destination_ledger_account_id?: string;
}

export interface AccountLink {
  url: string;
  expires_at: string;
}

/** One fiat rail's deposit instructions (wire / ACH / SEPA). */
export interface DepositBankCurrency {
  currency: string;
  account_number: string | null;
  routing_number: string | null;
  deposit_bank_name: string | null;
  deposit_beneficiary_name: string | null;
  deposit_reference: string | null;
  rails: string[]; // e.g. "ach" | "wire" | "sepa"
}

export interface DepositCryptoToken {
  name: string;
  icon_url?: string | null;
}

/** One crypto network you can deposit on (e.g. Ethereum, Base, Solana). */
export interface DepositCryptoNetwork {
  name: string;
  deposit_address: string;
  icon_url?: string | null;
  supported_currencies?: DepositCryptoToken[];
}

/** A funding deposit: per-network crypto addresses + (optionally) bank wire/ACH details. */
export interface Deposit {
  object?: "deposit";
  amount?: string;
  account_id: string | null;
  hosted_url: string | null;
  metadata?: Record<string, string> | null;
  methods: {
    crypto: DepositCryptoNetwork[];
    bank: { currencies: DepositBankCurrency[] } | null;
  };
}

// ---------------- AgentCards domain (local store) ----------------

/** Preset roles drive the default emoji/spend posture in the UI. */
export type AgentRole =
  | "shopper"
  | "advisor"
  | "travel"
  | "dev"
  | "ops"
  | "research"
  | "custom";

export type SpendFrequency = "daily" | "weekly" | "monthly" | "one_time";

/**
 * The trust boundary between you and an autonomous agent. Limits map onto the
 * issuer's native controls (spend_limit / transaction_limit); merchant/category
 * locks + approval thresholds are enforced in our policy layer (and, once the
 * issuer exposes an authorization webhook, at auth time).
 */
export interface SpendPolicy {
  spendLimit?: number; // dollars over the frequency window
  spendLimitFrequency?: SpendFrequency;
  transactionLimit?: number; // per-transaction cap, dollars
  allowedMerchants?: string[]; // merchant locks
  allowedCategories?: string[]; // MCC-style categories
  requireApprovalOver?: number; // human-in-the-loop threshold, dollars
}

/** An AI agent = a connected account + a card + a spend policy + an MCP key. */
export interface AgentProfile {
  accountId: string; // biz_ connected account
  name: string; // "Personal Shopper"
  role: AgentRole;
  description?: string;
  emoji?: string;
  cardId?: string | null; // primary card icrd_
  cardIds?: string[]; // all cards linked to this agent (issued on the parent/KYC'd user)
  policy?: SpendPolicy;
  /** We store only a hash + a display prefix of the MCP key — never the raw key. */
  mcpKeyHash?: string | null;
  mcpKeyPrefix?: string | null;
  createdAt: string;
}

/** A derived activity-feed row (from card spend + funding transfers). */
export interface AgentTransaction {
  id: string;
  agentAccountId: string;
  agentName: string;
  kind: "purchase" | "funding" | "refund";
  merchant: string;
  amount: number; // signed dollars: negative = spend, positive = credit
  status: "approved" | "declined" | "pending";
  cardId?: string | null;
  createdAt: string;
}

/** Everything we persist locally (the issuer owns accounts/cards/balances). */
export interface AgentData {
  agents: AgentProfile[];
  transactions: AgentTransaction[];
}
