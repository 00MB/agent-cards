import "server-only";
import { getIssuer } from "./issuer";
import { getAgents, getTransactions } from "./store";
import { ROLE_META, roleEmoji } from "./roles";
import type {
  Account,
  AgentProfile,
  AgentRole,
  AgentTransaction,
  Card,
} from "./types";

// Re-export the client-safe role metadata so existing server-side imports of
// `@/lib/agents` (pages, API routes) keep working unchanged.
export { ROLE_META, roleEmoji };

/** A fully hydrated agent for the roster: account + local profile + primary card. */
export interface AgentSummary {
  accountId: string;
  name: string;
  role: AgentRole;
  emoji: string;
  description?: string;
  card: Card | null;
  cardCount: number;
  spentLastMonthCents: number;
  hasMcpKey: boolean;
  createdAt: string;
}

/** Infer a role from a connected account's metadata (live mode has no local profile yet). */
function inferRole(account: Account, profile?: AgentProfile): AgentRole {
  if (profile?.role) return profile.role;
  const r = account.metadata?.role as AgentRole | undefined;
  return r && r in ROLE_META ? r : "custom";
}

/**
 * An agent's cards. Live: cards are issued on the KYC'd parent user and linked via
 * profile.cardIds. Mock: cards carry user_id === the agent account.
 */
function cardsForAgent(all: Card[], accountId: string, profile?: AgentProfile): Card[] {
  const linked = new Set(profile?.cardIds ?? []);
  return all.filter((c) => linked.has(c.id) || c.user_id === accountId);
}

/**
 * The agent roster: every connected account under the treasury, merged with its
 * local profile and primary card. Works in mock mode and live.
 */
export async function listAgentRoster(): Promise<AgentSummary[]> {
  const issuer = getIssuer();
  const [accounts, profiles] = await Promise.all([
    issuer.listAgentAccounts().catch(() => [] as Account[]),
    getAgents(),
  ]);

  const profileById = new Map(profiles.map((p) => [p.accountId, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Live: drive the roster from local profiles (every agent created through
  // AgentCards), enriching from the Whop account when available. This avoids
  // depending on the paginated GET /accounts list, so newly-created agents always
  // show. Mock: drive from the demo accounts (no profiles exist).
  const entries: { accountId: string; profile?: AgentProfile; account?: Account }[] =
    issuer.isConfigured()
      ? profiles.map((p) => ({
          accountId: p.accountId,
          profile: p,
          account: accountById.get(p.accountId),
        }))
      : accounts.map((a) => ({ accountId: a.id, profile: profileById.get(a.id), account: a }));

  // One card fetch scoped to the treasury covers mock mode; live mode scopes per owner.
  const treasuryCards = await issuer
    .listCards(issuer.treasuryAccountId())
    .catch(() => [] as Card[]);

  return Promise.all(
    entries.map(async ({ accountId, profile, account }) => {
      const role = inferRole(account ?? ({ metadata: {} } as Account), profile);
      const cards = cardsForAgent(treasuryCards, accountId, profile);
      const primary =
        cards.find((c) => c.id === profile?.cardId) ??
        cards.find((c) => c.status === "active") ??
        cards[0] ??
        null;

      return {
        accountId,
        name: profile?.name ?? account?.metadata?.agent_name ?? account?.title ?? "Agent",
        role,
        emoji: profile?.emoji ?? roleEmoji(role),
        description: profile?.description ?? account?.metadata?.mandate ?? undefined,
        card: primary,
        cardCount: cards.length,
        spentLastMonthCents: cards.reduce((s, c) => s + (c.spent_last_month ?? 0), 0),
        hasMcpKey: !!profile?.mcpKeyHash,
        createdAt: profile?.createdAt ?? account?.created_at ?? "",
      } satisfies AgentSummary;
    }),
  );
}

export interface AgentDetail {
  account: Account | null;
  profile: AgentProfile | null;
  role: AgentRole;
  emoji: string;
  name: string;
  description?: string;
  cards: Card[];
  transactions: AgentTransaction[];
}

/** Full detail for one agent: account, profile, all its cards, its activity. */
export async function getAgentDetail(accountId: string): Promise<AgentDetail | null> {
  const issuer = getIssuer();
  const [accounts, profiles, allTx] = await Promise.all([
    issuer.listAgentAccounts().catch(() => [] as Account[]),
    getAgents(),
    getTransactions(),
  ]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const profile = profiles.find((p) => p.accountId === accountId) ?? null;
  if (!account && !profile) return null;

  // Cards live on the parent (KYC'd) account; resolve this agent's linked cards.
  const allCards = await issuer.listCards(issuer.treasuryAccountId()).catch(() => [] as Card[]);
  const cards = cardsForAgent(allCards, accountId, profile ?? undefined);
  const role = inferRole(account ?? ({ metadata: {} } as Account), profile ?? undefined);

  return {
    account,
    profile,
    role,
    emoji: profile?.emoji ?? roleEmoji(role),
    name: profile?.name ?? account?.metadata?.agent_name ?? account?.title ?? "Agent",
    description: profile?.description ?? account?.metadata?.mandate ?? undefined,
    cards,
    transactions: allTx.filter((t) => t.agentAccountId === accountId),
  };
}
