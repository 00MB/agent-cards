import "server-only";
import { createHash } from "crypto";
import { getAgents } from "@/lib/store";
import { getIssuer } from "@/lib/issuer";
import type { AgentProfile } from "@/lib/types";

/**
 * The mock-mode fallback agent. When no live API key is configured AND the
 * request carries no key that matches a stored agent, we resolve to this demo
 * account so the MCP server is fully demoable offline. This is MOCK-ONLY: in
 * live mode (issuer.isConfigured()) an invalid/missing key always fails auth.
 */
const MOCK_FALLBACK_ACCOUNT_ID = "biz_agent_shopper";

/** sha256-hex of the raw key — we only ever store/compare the hash. */
export function hashMcpKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Pull the raw MCP key from `Authorization: Bearer <key>` or `?key=`. */
export function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) return match[1].trim();
  }
  try {
    const key = new URL(req.url).searchParams.get("key");
    if (key) return key.trim();
  } catch {
    // malformed URL — ignore
  }
  return null;
}

/**
 * Resolve the authenticated agent for an MCP request.
 *
 * 1. If a key is present, sha256-hash it and find the AgentProfile whose
 *    `mcpKeyHash` matches.
 * 2. MOCK-ONLY fallback: if no profile matches and the live issuer is NOT
 *    configured, resolve to a synthetic profile for the first mock agent so the
 *    server can be demoed without provisioning a key.
 *
 * Returns the matched (or mock-fallback) profile, or null when unauthorized.
 */
export async function resolveAgentFromRequest(
  req: Request,
): Promise<AgentProfile | null> {
  const rawKey = extractKey(req);

  if (rawKey) {
    const hash = hashMcpKey(rawKey);
    const agents = await getAgents();
    const match = agents.find((a) => a.mcpKeyHash && a.mcpKeyHash === hash);
    if (match) return match;
  }

  // MOCK-ONLY: no matching key, but the live API isn't configured — let the
  // demo agent through so the server is clickable offline.
  if (!getIssuer().isConfigured()) {
    const agents = await getAgents();
    const stored = agents.find((a) => a.accountId === MOCK_FALLBACK_ACCOUNT_ID);
    if (stored) return stored;
    return {
      accountId: MOCK_FALLBACK_ACCOUNT_ID,
      name: "Personal Shopper",
      role: "shopper",
      createdAt: new Date().toISOString(),
    } satisfies AgentProfile;
  }

  return null;
}
