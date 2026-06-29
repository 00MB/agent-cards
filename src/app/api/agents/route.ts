import { NextResponse } from "next/server";
import { getIssuer } from "@/lib/issuer";
import { listAgentRoster } from "@/lib/agents";
import { upsertAgent } from "@/lib/store";
import { WhopError } from "@/lib/whop";
import type { AgentProfile, AgentRole } from "@/lib/types";
import { ROLE_META, roleEmoji } from "@/lib/agents";

const ROLES = Object.keys(ROLE_META) as AgentRole[];

/** Pull a card budget out of the agent's free-text mandate (e.g. "max $150/week"). */
function parseBudget(text?: string): {
  spend_limit?: number;
  spend_limit_frequency?: "daily" | "weekly" | "monthly" | "one_time";
} {
  if (!text) return {};
  const m = text.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/);
  if (!m) return {};
  const amount = Number(m[1]);
  if (!(amount > 0)) return {};
  const t = text.toLowerCase();
  let spend_limit_frequency: "daily" | "weekly" | "monthly" | "one_time" | undefined;
  if (/one[\s-]?time|single|per task|each task/.test(t)) spend_limit_frequency = "one_time";
  else if (/dai?ly|per day/.test(t)) spend_limit_frequency = "daily";
  else if (/week|per week/.test(t)) spend_limit_frequency = "weekly";
  else if (/month|per month/.test(t)) spend_limit_frequency = "monthly";
  return { spend_limit: amount, spend_limit_frequency };
}

/**
 * Build a deliverable +tagged email from AGENT_BASE_EMAIL so users needn't supply
 * one. Kept short: the Whop account title defaults to the email and is capped at
 * 40 chars, so we use a compact `+ac<rand>` tag rather than the agent name.
 */
function generateEmail(): string | null {
  const base = process.env.AGENT_BASE_EMAIL;
  if (!base || !base.includes("@")) return null;
  const [local, domain] = base.split("@");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${local}+ac${rand}@${domain}`;
}

function errorResponse(e: unknown, fallback: string) {
  if (e instanceof WhopError) {
    return NextResponse.json({ error: e.message, type: e.type }, { status: e.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const agents = await listAgentRoster();
    return NextResponse.json({ data: agents });
  } catch (e) {
    return errorResponse(e, "Failed to load agents");
  }
}

export async function POST(req: Request) {
  let body: {
    name?: unknown;
    role?: unknown;
    description?: unknown;
    email?: unknown;
    autoIssueCard?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const providedEmail = typeof body.email === "string" ? body.email.trim() : "";
  const role: AgentRole = ROLES.includes(body.role as AgentRole)
    ? (body.role as AgentRole)
    : "custom";
  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : undefined;
  const autoIssueCard = body.autoIssueCard === true;

  if (!name) {
    return NextResponse.json({ error: "Agent name is required." }, { status: 400 });
  }

  const issuer = getIssuer();
  const email = providedEmail || generateEmail() || "";

  if (issuer.isConfigured() && !email) {
    return NextResponse.json(
      { error: "Set AGENT_BASE_EMAIL or provide an email for the agent's account." },
      { status: 400 },
    );
  }

  try {
    let accountId: string;
    if (issuer.isConfigured()) {
      const account = await issuer.createAgentAccount({
        email,
        name,
        description,
        metadata: { app: "agentcards", role },
      });
      accountId = account.id;
    } else {
      // Mock mode: synthesize a connected-account id so the UI updates.
      accountId = `biz_agent_${Math.random().toString(36).slice(2, 10)}`;
    }

    const profile: AgentProfile = {
      accountId,
      name,
      role,
      description,
      emoji: roleEmoji(role),
      createdAt: new Date().toISOString(),
    };

    if (autoIssueCard) {
      try {
        // Issue on the treasury's approved CIA (subaccounts fail KYC); link to agent.
        // Carry the budget parsed from the mandate so the card's limit matches it.
        const budget = parseBudget(description);
        const card = await issuer.createCard({
          account_id: issuer.treasuryAccountId(),
          assigned_user_id: issuer.cardUserId(),
          name,
          ...budget,
        });
        profile.cardId = card.id;
        profile.cardIds = [card.id];
      } catch {
        // Card issuance can fail (scope/KYC/mock); the agent still persists.
      }
    }

    await upsertAgent(profile);
    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create agent");
  }
}
