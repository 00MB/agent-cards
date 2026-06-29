import { listAgentRoster } from "@/lib/agents";
import { getIssuer } from "@/lib/issuer";
import { FundClient } from "./fund-client";

export const dynamic = "force-dynamic";

export default async function FundPage() {
  const roster = await listAgentRoster();
  const live = getIssuer().isConfigured();

  const agents = roster.map((a) => ({
    accountId: a.accountId,
    name: a.name,
    emoji: a.emoji,
    spentLastMonthCents: a.spentLastMonthCents,
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Fund an agent</h1>
      <FundClient agents={agents} live={live} />
    </div>
  );
}
