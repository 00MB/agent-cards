"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Plug,
  Plus,
  Repeat,
  ShieldCheck,
  Snowflake,
} from "lucide-react";

import type {
  Card as CardType,
  CardSecrets,
  SpendPolicy,
  SpendFrequency,
  AgentTransaction,
} from "@/lib/types";
import { usd, centsToUsd, formatDate, formatPan } from "@/lib/format";
import { CardArt } from "@/components/card-art";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FREQUENCY_LABELS: Record<SpendFrequency, string> = {
  one_time: "Single-use",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

/** Whop returns card limit frequencies like "per7DayPeriod" — map to friendly labels. */
function cardFreqLabel(freq?: string | null): string {
  if (!freq) return "";
  const map: Record<string, string> = {
    per24HourPeriod: "Daily",
    daily: "Daily",
    per7DayPeriod: "Weekly",
    weekly: "Weekly",
    monthly: "Monthly",
    allTime: "Total",
    one_time: "Single-use",
    perAuthorization: "Per transaction",
  };
  return map[freq] ?? FREQUENCY_LABELS[freq as SpendFrequency] ?? freq;
}

function statusBadge(status: string | null | undefined) {
  switch (status) {
    case "active":
      return <Badge variant="secondary">Active</Badge>;
    case "frozen":
      return <Badge variant="outline">Frozen</Badge>;
    case "canceled":
      return <Badge variant="destructive">Canceled</Badge>;
    default:
      return <Badge variant="outline">{status ?? "—"}</Badge>;
  }
}

function txStatusBadge(status: AgentTransaction["status"]) {
  if (status === "approved") return <Badge variant="secondary">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`Copied ${label ?? "value"}`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      <span className="sr-only">Copy {label}</span>
    </Button>
  );
}

export function AgentDetailClient({
  accountId,
  cards,
  primaryCardId,
  policy,
  mandate,
  transactions,
  hasMcpKey,
  mcpKeyPrefix,
}: {
  accountId: string;
  cards: CardType[];
  primaryCardId: string | null;
  policy: SpendPolicy | null;
  mandate: string | null;
  transactions: AgentTransaction[];
  hasMcpKey: boolean;
  mcpKeyPrefix: string | null;
}) {
  const primary = useMemo(() => {
    return (
      cards.find((c) => c.id === primaryCardId) ??
      cards.find((c) => c.status === "active") ??
      cards[0] ??
      null
    );
  }, [cards, primaryCardId]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <PrimaryCardPanel card={primary} accountId={accountId} />
        <SpendPolicyPanel card={primary} policy={policy} mandate={mandate} />
        <TransactionsPanel transactions={transactions} />
      </div>

      <div className="flex flex-col gap-6">
        <McpPanel
          accountId={accountId}
          hasMcpKey={hasMcpKey}
          mcpKeyPrefix={mcpKeyPrefix}
        />
      </div>
    </div>
  );
}

/* -------------------- Primary card + reveal + lifecycle -------------------- */

function PrimaryCardPanel({
  card,
  accountId,
}: {
  card: CardType | null;
  accountId: string;
}) {
  const router = useRouter();
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!card) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual card</CardTitle>
          <CardDescription>This agent has no card yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCardDialog accountId={accountId} />
        </CardContent>
      </Card>
    );
  }

  const canceled = card.status === "canceled";
  const frozen = card.status === "frozen";

  async function reveal() {
    if (secrets) {
      setSecrets(null);
      return;
    }
    setRevealing(true);
    try {
      const res = await fetch(
        `/api/cards/${card!.id}?owner=${encodeURIComponent(accountId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to reveal");
      setSecrets(json.data?.secrets ?? null);
      if (!json.data?.secrets) toast.error("No secrets available for this card");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reveal");
    } finally {
      setRevealing(false);
    }
  }

  async function setStatus(status: "active" | "frozen" | "canceled") {
    setUpdating(true);
    try {
      const res = await fetch(`/api/cards/${card!.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update card");
      toast.success(
        status === "active"
          ? "Card unfrozen"
          : status === "frozen"
            ? "Card frozen"
            : "Card canceled",
      );
      setSecrets(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update card");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          {card.name || "Virtual card"}
        </CardTitle>
        <CardDescription>
          The agent never sees the PAN — only you can reveal it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <CardArt card={card} secrets={secrets} flipped={!!secrets} />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-2">
            {statusBadge(card.status)}
            {card.limit?.frequency === "one_time" && (
              <Badge variant="outline">Single-use</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reveal} disabled={revealing || canceled}>
              {secrets ? <EyeOff /> : <Eye />}
              {secrets ? "Hide details" : revealing ? "Revealing…" : "Reveal details"}
            </Button>
            {!canceled && (
              <Button
                variant="outline"
                size="sm"
                disabled={updating}
                onClick={() => setStatus(frozen ? "active" : "frozen")}
              >
                <Snowflake />
                {frozen ? "Unfreeze" : "Freeze"}
              </Button>
            )}
            {!canceled && (
              <Button
                variant="destructive"
                size="sm"
                disabled={updating}
                onClick={() => setStatus("canceled")}
              >
                <Ban /> Cancel card
              </Button>
            )}
          </div>

          {secrets && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                Human-only reveal. Never paste these into an agent&apos;s context — use a
                checkout intent over MCP instead.
              </p>
              <SecretRow label="Card number" value={formatPan(secrets.card_number)} copy={secrets.card_number} />
              <SecretRow
                label="Expires"
                value={`${String(card.expiration_month ?? "").padStart(2, "0")}/${String(card.expiration_year ?? "").slice(-2)}`}
              />
              <SecretRow label="CVC" value={secrets.cvc} copy={secrets.cvc} />
              {secrets.name_on_card && (
                <SecretRow label="Name on card" value={secrets.name_on_card} />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SecretRow({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm">{value}</p>
      </div>
      {copy && <CopyButton value={copy} label={label} />}
    </div>
  );
}

/* -------------------- Create card (single-use prominent) -------------------- */

function TypeTile({
  selected,
  onClick,
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Lock;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-input hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}

function CreateCardDialog({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"single" | "recurring">("single");
  const [frequency, setFrequency] = useState<Exclude<SpendFrequency, "one_time">>("monthly");
  const [amount, setAmount] = useState(""); // single-use
  const [spendLimit, setSpendLimit] = useState("");
  const [txLimit, setTxLimit] = useState("");

  function reset() {
    setName("");
    setMode("single");
    setFrequency("monthly");
    setAmount("");
    setSpendLimit("");
    setTxLimit("");
  }

  async function submit() {
    setSubmitting(true);
    try {
      const single = mode === "single";
      const amt = amount ? Number(amount) : undefined;
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentAccountId: accountId,
          name: name.trim() || undefined,
          spend_limit_frequency: single ? "one_time" : frequency,
          spend_limit: single ? amt : spendLimit ? Number(spendLimit) : undefined,
          transaction_limit: single ? amt : txLimit ? Number(txLimit) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create card");
      toast.success("Card issued");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Create card
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a card</DialogTitle>
          <DialogDescription>
            Give this agent a virtual card scoped to a budget.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-name">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="card-name"
              placeholder="Amazon — AirPods Pro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Card type</Label>
            <div className="flex flex-col gap-2">
              <TypeTile
                selected={mode === "single"}
                onClick={() => setMode("single")}
                icon={Lock}
                title="Single-use"
                subtitle="Locks after one charge"
                badge="Recommended"
              />
              <TypeTile
                selected={mode === "recurring"}
                onClick={() => setMode("recurring")}
                icon={Repeat}
                title="Recurring"
                subtitle="Daily / weekly / monthly budget"
              />
            </div>
          </div>

          {mode === "single" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                placeholder="280"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Locked to a single charge up to this amount.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Resets</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) =>
                    setFrequency(v as Exclude<SpendFrequency, "one_time">)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => FREQUENCY_LABELS[v as SpendFrequency]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="spend-limit">Budget ($)</Label>
                  <Input
                    id="spend-limit"
                    type="number"
                    inputMode="decimal"
                    placeholder="500"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-limit">Per-transaction ($)</Label>
                  <Input
                    id="tx-limit"
                    type="number"
                    inputMode="decimal"
                    placeholder="100"
                    value={txLimit}
                    onChange={(e) => setTxLimit(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Issuing…" : "Issue card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Spend policy summary -------------------- */

/** Heuristically pull a budget out of the agent's free-text mandate (e.g. "$150/week"). */
function parseMandateBudget(
  text?: string | null,
): { amount: number; frequency?: SpendFrequency } | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const t = text.toLowerCase();
  let frequency: SpendFrequency | undefined;
  if (/one[\s-]?time|single|per task|each task/.test(t)) frequency = "one_time";
  else if (/dai?ly|\/\s?d\b|per day/.test(t)) frequency = "daily";
  else if (/week|\/\s?wk|\/\s?w\b|per week/.test(t)) frequency = "weekly";
  else if (/month|\/\s?mo\b|per month/.test(t)) frequency = "monthly";
  return { amount, frequency };
}

function SpendPolicyPanel({
  card,
  policy,
  mandate,
}: {
  card: CardType | null;
  policy: SpendPolicy | null;
  mandate: string | null;
}) {
  const rows: { label: string; value: string }[] = [];

  if (card?.limit) {
    rows.push({
      label: "Card limit (enforced)",
      value: `${usd(card.limit.amount)} · ${cardFreqLabel(card.limit.frequency) || "—"}`,
    });
  }

  // Surface the budget implied by the mandate as the *intended* policy, even when
  // no card limit is enforcing it yet — so the policy doesn't contradict the mandate.
  const mandateBudget = parseMandateBudget(mandate);
  if (mandateBudget && !card?.limit) {
    rows.push({
      label: "Budget (from mandate)",
      value: `${usd(mandateBudget.amount)}${mandateBudget.frequency ? ` · ${FREQUENCY_LABELS[mandateBudget.frequency]}` : ""}`,
    });
  }
  if (policy?.spendLimit != null) {
    rows.push({
      label: "Policy spend cap",
      value: `${usd(policy.spendLimit)}${policy.spendLimitFrequency ? ` · ${FREQUENCY_LABELS[policy.spendLimitFrequency]}` : ""}`,
    });
  }
  if (policy?.transactionLimit != null) {
    rows.push({ label: "Per-transaction cap", value: usd(policy.transactionLimit) });
  }
  if (policy?.requireApprovalOver != null) {
    rows.push({ label: "Requires approval over", value: usd(policy.requireApprovalOver) });
  }
  if (policy?.allowedMerchants?.length) {
    rows.push({ label: "Merchant lock", value: policy.allowedMerchants.join(", ") });
  }
  if (policy?.allowedCategories?.length) {
    rows.push({ label: "Allowed categories", value: policy.allowedCategories.join(", ") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Spend policy
        </CardTitle>
        <CardDescription>The trust boundary between you and this agent.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No explicit limits set. Issue a single-use card per task to keep spend scoped.
          </p>
        ) : (
          <>
            <dl className="flex flex-col">
              {rows.map((r, i) => (
                <div key={r.label}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="text-right font-medium">{r.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {mandateBudget && !card && (
              <p className="mt-2 text-xs text-muted-foreground">
                Not enforced yet — issue a card to apply it.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------- Transactions -------------------- */

function TransactionsPanel({ transactions }: { transactions: AgentTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>Every action this agent takes is auditable.</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.merchant}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{t.kind}</TableCell>
                  <TableCell>{txStatusBadge(t.status)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      t.amount < 0 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {usd(t.amount)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------- MCP connect panel -------------------- */

// Frequently-used MCP clients shown as one-click connect targets (display/vision).
const favicon = (domain: string) => `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
// Popular MCP clients & tools an agent already uses — social proof that its card
// plugs into the same ecosystem (display/vision).
const MCP_CLIENTS = [
  { name: "Claude", short: "C", cls: "bg-[#D97757] text-white", logo: favicon("claude.ai") },
  { name: "ChatGPT", short: "G", cls: "bg-[#10A37F] text-white", logo: favicon("openai.com") },
  { name: "Cursor", short: "C", cls: "bg-foreground text-background", logo: favicon("cursor.com") },
  { name: "Devin", short: "D", cls: "bg-[#1F1147] text-white", logo: favicon("devin.ai") },
];

/** Client logo from favicon, with a lettered fallback if it fails to load. */
function ClientIcon({ src, name, short, cls }: { src: string; name: string; short: string; cls: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold", cls)}>
        {short}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="size-6 shrink-0 rounded-md bg-white object-contain ring-1 ring-black/5"
      onError={() => setOk(false)}
    />
  );
}

function McpPanel({
  accountId,
  hasMcpKey,
  mcpKeyPrefix,
}: {
  accountId: string;
  hasMcpKey: boolean;
  mcpKeyPrefix: string | null;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/agents/${accountId}/mcp-key`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate key");
      setRawKey(json.key);
      toast.success("MCP key generated — copy it now, it won't be shown again");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  }

  const snippet = rawKey
    ? JSON.stringify(
        {
          mcpServers: {
            agentcards: {
              url: "/api/mcp",
              headers: { Authorization: `Bearer ${rawKey}` },
            },
          },
        },
        null,
        2,
      )
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4 text-muted-foreground" />
          Connect via MCP
        </CardTitle>
        <CardDescription>
          Give this agent an MCP key so it can request checkout intents — never the raw
          card number.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Works with</p>
          <div className="grid grid-cols-2 gap-2">
            {MCP_CLIENTS.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:bg-muted/50 disabled:opacity-60"
              >
                <ClientIcon src={c.logo} name={c.name} short={c.short} cls={c.cls} />
                <span className="flex-1 truncate text-left">{c.name}</span>
                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {hasMcpKey && !rawKey && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <KeyRound className="size-4 text-muted-foreground" />
            <span className="font-mono text-xs">{mcpKeyPrefix ?? "ak_live_…"}••••••••</span>
            <Badge variant="secondary" className="ml-auto">
              Active
            </Badge>
          </div>
        )}

        {rawKey && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <p className="text-xs text-muted-foreground">
              Copy this key now — it is shown only once and never stored in plaintext.
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                {rawKey}
              </code>
              <CopyButton value={rawKey} label="MCP key" />
            </div>
            {snippet && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Add to your agent</p>
                  <CopyButton value={snippet} label="config" />
                </div>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed">
                  {snippet}
                </pre>
              </div>
            )}
          </div>
        )}

        <Button variant={hasMcpKey ? "outline" : "default"} onClick={generate} disabled={generating}>
          <KeyRound />
          {generating
            ? "Generating…"
            : hasMcpKey
              ? "Regenerate MCP key"
              : "Generate MCP key"}
        </Button>
      </CardContent>
    </Card>
  );
}
