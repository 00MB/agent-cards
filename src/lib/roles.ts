import type { AgentRole } from "./types";

/**
 * Pure, client-safe role display metadata. Lives apart from lib/agents.ts (which
 * is server-only) so "use client" components can import ROLE_META / roleEmoji
 * without pulling the server graph (fs, issuer) into the browser bundle.
 */
export const ROLE_META: Record<AgentRole, { label: string; emoji: string; blurb: string }> = {
  shopper: { label: "Personal Shopper", emoji: "🛍️", blurb: "Buys things you ask for online." },
  advisor: { label: "Financial Advisor", emoji: "📈", blurb: "Manages subscriptions & small spend." },
  travel: { label: "Travel Agent", emoji: "✈️", blurb: "Books flights, hotels & transport." },
  dev: { label: "Dev / Infra Agent", emoji: "🤖", blurb: "Pays for cloud, APIs & tooling." },
  ops: { label: "Ops Agent", emoji: "🗂️", blurb: "Handles recurring business spend." },
  research: { label: "Research Agent", emoji: "🔬", blurb: "Buys data, reports & access." },
  custom: { label: "Agent", emoji: "🪪", blurb: "A custom AI agent." },
};

export function roleEmoji(role: AgentRole | undefined): string {
  return ROLE_META[role ?? "custom"]?.emoji ?? "🪪";
}
