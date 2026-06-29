import "server-only";
import type {
  Account,
  Card,
  Transfer,
  AccountLink,
  Deposit,
  SpendFrequency,
} from "./types";
import { whopIssuer } from "./whop";

/**
 * Issuer-agnostic interface. Whop is the only adapter today, but the entire app
 * and MCP server depend on THIS shape — never on Whop directly — so a Stripe
 * Issuing + Bridge adapter (with real-time authorization webhooks and JIT USDC
 * funding) can be dropped in later by implementing the same interface.
 */

export interface CreateCardInput {
  account_id?: string; // the card-issuing account (treasury biz_)
  user_id?: string; // or a user_'s personal ledger
  /** For business CIAs: the company member the card is assigned to (KYC'd user). */
  assigned_user_id?: string;
  name?: string;
  spend_limit?: number;
  spend_limit_frequency?: SpendFrequency; // "one_time" => single-use card
  transaction_limit?: number;
}

export interface CreateTransferInput {
  origin_id: string;
  destination_id?: string;
  amount: number;
  currency?: string;
  type?: "ledger" | "wallet_send" | "claim_link";
  idempotence_key?: string;
  notes?: string;
  metadata?: Record<string, string>;
  expires_at?: string;
  redeemable_count?: number;
}

export interface CreateDepositInput {
  /** Account id (biz_/user_) or wallet address, or the object form. */
  destination: string | { account_id?: string; address?: string; network?: string };
  amount?: number; // prefill on the hosted deposit page
  network?: string; // destination network override
  metadata?: Record<string, string>;
}

export interface Issuer {
  /** Adapter name, e.g. "whop" | "stripe". */
  name: string;
  isConfigured(): boolean;
  /** The parent account holding the funded balance. */
  treasuryAccountId(): string;
  /**
   * The KYC'd user that cards are issued to. Subaccounts can't pass KYC (duplicate
   * person), so cards are issued on this user and linked to an agent in-app.
   * Returns undefined if not configured.
   */
  cardUserId(): string | undefined;

  // Accounts (treasury + agents)
  listAccounts(): Promise<Account[]>;
  listAgentAccounts(): Promise<Account[]>;
  createAgentAccount(input: {
    email: string;
    name?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<Account>;
  createAccountLink(input: {
    company_id: string;
    use_case?: "account_onboarding" | "payouts_portal";
    refresh_url: string;
    return_url: string;
  }): Promise<AccountLink>;

  // Cards
  listCards(ownerId: string): Promise<Card[]>;
  getCard(cardId: string, ownerId: string): Promise<Card>;
  createCard(input: CreateCardInput): Promise<Card>;
  updateCardStatus(
    cardId: string,
    status: "active" | "frozen" | "canceled",
  ): Promise<Card>;

  // Money movement (funding)
  listTransfers(originId: string): Promise<Transfer[]>;
  createTransfer(input: CreateTransferInput): Promise<Transfer & { url?: string }>;
  /** Create a deposit to fund an account — returns crypto addresses + bank (wire/ACH) details. */
  createDeposit(input: CreateDepositInput): Promise<Deposit>;
}

/** The active issuer. Swap here (env-driven) when the Stripe adapter lands. */
export const issuer: Issuer = whopIssuer;

export function getIssuer(): Issuer {
  return issuer;
}
