export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAgentDetail, ROLE_META } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { AgentDetailClient } from "./agent-detail-client";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAgentDetail(id).catch(() => null);
  if (!detail) notFound();

  const roleLabel = ROLE_META[detail.role]?.label ?? detail.role;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
          <ArrowLeft /> All agents
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-3xl">
          {detail.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {detail.name}
          </h1>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
        </div>
      </div>

      {detail.description && (
        <div className="rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">What it does with the card</p>
          <p className="mt-1 text-sm">{detail.description}</p>
        </div>
      )}

      <AgentDetailClient
        accountId={id}
        cards={detail.cards}
        primaryCardId={detail.profile?.cardId ?? null}
        policy={detail.profile?.policy ?? null}
        mandate={detail.description ?? null}
        transactions={detail.transactions}
        hasMcpKey={!!detail.profile?.mcpKeyHash}
        mcpKeyPrefix={detail.profile?.mcpKeyPrefix ?? null}
      />
    </div>
  );
}
