import { listAgentRoster } from "@/lib/agents";
import { AgentsClient } from "./agents/agents-client";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await listAgentRoster();
  return <AgentsClient agents={agents} />;
}
