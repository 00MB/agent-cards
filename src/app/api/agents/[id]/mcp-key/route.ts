import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { getAgent, upsertAgent } from "@/lib/store";
import { roleEmoji } from "@/lib/agents";
import type { AgentProfile } from "@/lib/types";

/**
 * (Re)generate an MCP key for an agent. The RAW key is returned ONCE in this
 * response and never stored — we persist only a sha256 hash + a display prefix
 * so the dashboard can show "has MCP key" without ever holding the secret.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const key = `ak_live_${randomBytes(16).toString("hex")}`; // 32 hex chars
    const mcpKeyHash = createHash("sha256").update(key).digest("hex");
    const mcpKeyPrefix = key.slice(0, 11); // "ak_live_" + 3 hex

    const existing = await getAgent(id);
    const profile: AgentProfile = existing
      ? { ...existing, mcpKeyHash, mcpKeyPrefix }
      : {
          accountId: id,
          name: "Agent",
          role: "custom",
          emoji: roleEmoji("custom"),
          createdAt: new Date().toISOString(),
          mcpKeyHash,
          mcpKeyPrefix,
        };

    await upsertAgent(profile);
    return NextResponse.json({ key, prefix: mcpKeyPrefix });
  } catch {
    return NextResponse.json({ error: "Failed to generate MCP key" }, { status: 500 });
  }
}
