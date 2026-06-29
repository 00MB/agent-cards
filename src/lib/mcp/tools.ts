import "server-only";
import { getIssuer } from "@/lib/issuer";
import { getTransactions, addTransaction } from "@/lib/store";
import { WhopError } from "@/lib/whop";
import type { AgentProfile, Card, SpendFrequency } from "@/lib/types";

/**
 * MCP tool implementations + JSON Schemas, all scoped to ONE authenticated
 * agent. The route handler stays thin: it auths, then dispatches to runTool().
 *
 * SAFETY DOCTRINE: no tool here ever returns card secrets (PAN/CVV). There is
 * intentionally NO get_card_secrets tool. The agent's purchase path is
 * `checkout_intent`, which records intent and lets AgentCards complete the buy
 * server-side — the raw card details never enter the agent's context.
 */

// ---------------- JSON Schema (subset used for tools/list) ----------------

interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [k: string]: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

const FREQUENCIES: SpendFrequency[] = ["daily", "weekly", "monthly", "one_time"];

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "list_cards",
    description:
      "List this agent's virtual cards. Never returns card secrets (PAN/CVV) — only id, name, status, last4, limit, and last-month spend.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_card",
    description:
      "Issue a new virtual card scoped to this agent. Prefer create_single_use_card for one-off purchases. Card secrets are never returned.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Human-readable label for the card." },
        spend_limit: { type: "number", description: "Spend cap in USD over the chosen frequency window." },
        spend_limit_frequency: {
          type: "string",
          enum: FREQUENCIES,
          description: "Window for the spend limit. Use 'one_time' for a single-use card.",
        },
        transaction_limit: { type: "number", description: "Per-transaction cap in USD." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_single_use_card",
    description:
      "THE SAFE DEFAULT for a single purchase: issues a one-time, limit-capped card (spend_limit_frequency='one_time'). The card is exhausted after one use, minimizing blast radius. Secrets are never returned.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Hard spend cap in USD for this single purchase." },
        name: { type: "string", description: "Optional label, e.g. the merchant or item." },
      },
      required: ["limit"],
      additionalProperties: false,
    },
  },
  {
    name: "get_spend_summary",
    description:
      "Summarize this agent's spend posture: number of cards, USD spent last month, and per-card limits.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_transactions",
    description: "List this agent's auditable transaction history (purchases, funding, refunds).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "freeze_card",
    description: "Freeze one of this agent's cards immediately (reversible). Use to halt spend.",
    inputSchema: {
      type: "object",
      properties: { card_id: { type: "string", description: "The icrd_ id of the card to freeze." } },
      required: ["card_id"],
      additionalProperties: false,
    },
  },
  {
    name: "checkout_intent",
    description:
      "THE SAFE PURCHASE TOOL. Request a purchase by describing it — AgentCards completes the checkout server-side using the agent's scoped card. Card secrets (PAN/CVV) are NEVER exposed to you. Records an auditable, pending purchase intent.",
    inputSchema: {
      type: "object",
      properties: {
        merchant: { type: "string", description: "The merchant or store to buy from." },
        amount: { type: "number", description: "Purchase amount in USD." },
        description: { type: "string", description: "What is being purchased." },
      },
      required: ["merchant", "amount"],
      additionalProperties: false,
    },
  },
];

// ---------------- Helpers ----------------

const centsToUsd = (cents: number | null | undefined): number =>
  Math.round(((cents ?? 0) / 100) * 100) / 100;

/** Only the agent's own cards — mock listCards returns all, so always filter. */
async function agentCards(accountId: string): Promise<Card[]> {
  const cards = await getIssuer().listCards(accountId);
  return cards.filter((c) => c.user_id === accountId);
}

/** Public (secret-free) card view exposed to the agent. */
function publicCard(c: Card) {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    last4: c.last4,
    limit: c.limit,
    spent_last_month: centsToUsd(c.spent_last_month),
  };
}

export class ToolError extends Error {}

type ToolArgs = Record<string, unknown>;

function str(args: ToolArgs, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}
function num(args: ToolArgs, key: string): number | undefined {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// ---------------- Dispatch ----------------

/**
 * Execute a tool by name for the authenticated agent. Returns a plain JSON
 * value (the route serializes it into the MCP `content[0].text` envelope).
 * Throws ToolError for bad input and lets WhopError surface to the route.
 */
export async function runTool(
  name: string,
  args: ToolArgs,
  agent: AgentProfile,
): Promise<unknown> {
  const issuer = getIssuer();
  const accountId = agent.accountId;

  switch (name) {
    case "list_cards": {
      const cards = await agentCards(accountId);
      return { cards: cards.map(publicCard) };
    }

    case "create_card": {
      const card = await issuer.createCard({
        account_id: accountId,
        name: str(args, "name"),
        spend_limit: num(args, "spend_limit"),
        spend_limit_frequency: str(args, "spend_limit_frequency") as SpendFrequency | undefined,
        transaction_limit: num(args, "transaction_limit"),
      });
      return { card: publicCard(card) };
    }

    case "create_single_use_card": {
      const limit = num(args, "limit");
      if (limit === undefined || limit <= 0) {
        throw new ToolError("`limit` (positive USD number) is required.");
      }
      const card = await issuer.createCard({
        account_id: accountId,
        name: str(args, "name") ?? "Single-use card",
        spend_limit: limit,
        spend_limit_frequency: "one_time",
      });
      return {
        card: publicCard(card),
        note: "Single-use card issued. It is capped and exhausted after one purchase.",
      };
    }

    case "get_spend_summary": {
      const cards = await agentCards(accountId);
      return {
        cards: cards.length,
        spent_last_month_usd: centsToUsd(
          cards.reduce((s, c) => s + (c.spent_last_month ?? 0), 0),
        ),
        limits: cards.map((c) => ({ card_id: c.id, name: c.name, limit: c.limit })),
      };
    }

    case "list_transactions": {
      const all = await getTransactions();
      return { transactions: all.filter((t) => t.agentAccountId === accountId) };
    }

    case "freeze_card": {
      const cardId = str(args, "card_id");
      if (!cardId) throw new ToolError("`card_id` is required.");
      // Scope check: agents may only freeze their own cards.
      const owned = await agentCards(accountId);
      if (!owned.some((c) => c.id === cardId)) {
        throw new ToolError("Card not found for this agent.");
      }
      const card = await issuer.updateCardStatus(cardId, "frozen");
      return { card: publicCard(card) };
    }

    case "checkout_intent": {
      const merchant = str(args, "merchant");
      const amount = num(args, "amount");
      if (!merchant) throw new ToolError("`merchant` is required.");
      if (amount === undefined || amount <= 0) {
        throw new ToolError("`amount` (positive USD number) is required.");
      }
      const description = str(args, "description");
      // MVP: record the intent. A real implementation would hand this to a
      // server-side checkout worker that completes the purchase with the
      // agent's scoped card — the PAN/CVV stay server-side, never in the agent.
      const tx = await addTransaction({
        id: `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        agentAccountId: accountId,
        agentName: agent.name,
        kind: "purchase",
        merchant,
        amount: -Math.abs(amount),
        status: "pending",
        cardId: agent.cardId ?? null,
        createdAt: new Date().toISOString(),
      });
      return {
        status: "recorded",
        intent_id: tx.id,
        merchant,
        amount,
        description,
        note: "Card secrets are never exposed to the agent; AgentCards completes the purchase server-side.",
      };
    }

    default:
      throw new ToolError(`Unknown tool: ${name}`);
  }
}

/** Re-export for the route's error mapping. */
export { WhopError };
