"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, KeyRound, Plus, Sparkles } from "lucide-react";

import type { AgentSummary } from "@/lib/agents";
import { ROLE_META } from "@/lib/roles";
import type { AgentRole } from "@/lib/types";
import { centsToUsd, maskedPan } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const ROLE_ENTRIES = Object.entries(ROLE_META) as [
  AgentRole,
  { label: string; emoji: string; blurb: string },
][];

function statusBadge(status: string | null | undefined) {
  switch (status) {
    case "active":
      return <Badge variant="secondary">Active</Badge>;
    case "frozen":
      return <Badge variant="outline">Frozen</Badge>;
    case "canceled":
      return <Badge variant="destructive">Canceled</Badge>;
    default:
      return <Badge variant="outline">No card</Badge>;
  }
}

export function AgentsClient({ agents }: { agents: AgentSummary[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Every AI agent gets its own scoped, fundable virtual card. Single-use cards
            are the safe default for one-off tasks.
          </p>
        </div>
        <CreateAgentDialog />
      </div>

      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Link key={a.accountId} href={`/dashboard/agents/${a.accountId}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-xl">
                        {a.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_META[a.role]?.label ?? a.role}
                        </p>
                      </div>
                    </div>
                    {a.hasMcpKey && (
                      <Badge variant="outline" className="shrink-0">
                        <KeyRound /> MCP
                      </Badge>
                    )}
                  </div>

                  {a.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {a.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {maskedPan(a.card?.last4)}
                    </span>
                    {statusBadge(a.card?.status)}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-heading text-lg font-semibold tabular-nums">
                        {centsToUsd(a.spentLastMonthCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">spent last month</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {a.cardCount} {a.cardCount === 1 ? "card" : "cards"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <Bot className="size-6 text-muted-foreground" />
        </span>
        <div>
          <p className="font-medium">No agents yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Create your first agent to give it a scoped virtual card and an MCP key.
          </p>
        </div>
        <CreateAgentDialog />
      </CardContent>
    </Card>
  );
}

function CreateAgentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("shopper");
  const [description, setDescription] = useState("");
  const [autoIssueCard, setAutoIssueCard] = useState(true);

  async function submit() {
    if (!name.trim()) {
      toast.error("Give your agent a name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          description: description.trim() || undefined,
          autoIssueCard,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create agent");
      toast.success(`${name.trim()} created`);
      setOpen(false);
      setName("");
      setDescription("");
      setRole("shopper");
      setAutoIssueCard(true);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Create agent
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an agent</DialogTitle>
          <DialogDescription>
            A connected account, a virtual card and a spend policy — one trust boundary
            per agent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="Personal Shopper"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-desc">What should it do with the card?</Label>
            <Textarea
              id="agent-desc"
              rows={3}
              placeholder="e.g. Order weekly groceries from Whole Foods — max $150/week, groceries only."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AgentRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_ENTRIES.map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    <span>
                      {meta.emoji} {meta.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-muted-foreground" />
              Issue a virtual card now
            </span>
            <Switch
              checked={autoIssueCard}
              onCheckedChange={(c) => setAutoIssueCard(c)}
            />
          </label>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={submitting} className={cn(submitting && "opacity-70")}>
            {submitting ? "Creating…" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
