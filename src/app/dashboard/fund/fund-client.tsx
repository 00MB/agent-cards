"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Bot, Building2, Check, Coins, Copy, Landmark } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Deposit } from "@/lib/types";

interface AgentOption {
  accountId: string;
  name: string;
  emoji: string;
  spentLastMonthCents: number;
}

export function FundClient({ agents, live }: { agents: AgentOption[]; live: boolean }) {
  const [agentId, setAgentId] = useState<string>(agents[0]?.accountId ?? "");
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDeposit(null);
    fetch("/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: agentId }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? `Couldn't load deposit details (${r.status})`);
        return j.data as Deposit;
      })
      .then((d) => !cancelled && setDeposit(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-muted-foreground">No agents yet.</p>
          <Button render={<a href="/dashboard">Go to Agents</a>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            Which agent?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => {
                    const a = agents.find((x) => x.accountId === value);
                    return a ? (
                      <span className="flex items-center gap-2">
                        <span>{a.emoji}</span>
                        {a.name}
                      </span>
                    ) : (
                      "Select an agent"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.accountId} value={a.accountId}>
                    <span className="mr-1">{a.emoji}</span>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingCard />
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : deposit ? (
        <Tabs defaultValue="crypto" className="gap-6">
          <TabsList>
            <TabsTrigger value="crypto">
              <Coins />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Landmark />
              Bank transfer
            </TabsTrigger>
          </TabsList>
          <TabsContent value="crypto">
            <CryptoPanel deposit={deposit} live={live} />
          </TabsContent>
          <TabsContent value="bank">
            <BankPanel deposit={deposit} live={live} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  async function copy(value: string, key: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success(label);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }
  return { copiedKey, copy };
}

function CopyField({
  label,
  value,
  mono = true,
  copiedKey,
  fieldKey,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copiedKey: string | null;
  fieldKey: string;
  onCopy: (value: string, key: string, label?: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          className={cn("text-sm", mono && "font-mono text-xs")}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onCopy(value, fieldKey, `${label} copied`)}
          aria-label={`Copy ${label}`}
        >
          {copiedKey === fieldKey ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

function ModeBadge({ live }: { live: boolean }) {
  return <Badge variant={live ? "default" : "secondary"}>{live ? "Live" : "Demo"}</Badge>;
}

/* -------------------------------- crypto -------------------------------- */

/** Network/token icon from the deposit API, with a lettered fallback. */
function CoinIcon({
  src,
  name,
  className = "size-4",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground",
          className,
        )}
      >
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("rounded-full bg-white object-contain ring-1 ring-black/5", className)}
      onError={() => setOk(false)}
    />
  );
}

function CryptoPanel({ deposit, live }: { deposit: Deposit; live: boolean }) {
  const { copiedKey, copy } = useCopy();
  const networks = deposit.methods.crypto ?? [];
  const [selected, setSelected] = useState<string>(networks[0]?.name ?? "");
  const active = networks.find((n) => n.name === selected) ?? networks[0] ?? null;

  if (!active) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No crypto deposit networks available for this agent.
        </CardContent>
      </Card>
    );
  }

  const tokens = active.supported_currencies ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Fund with crypto
          <ModeBadge live={live} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {networks.map((n) => (
            <button
              key={n.name}
              type="button"
              onClick={() => setSelected(n.name)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-sm font-medium transition-colors",
                active.name === n.name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <CoinIcon src={n.icon_url} name={n.name} className="size-5" />
              {n.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-3 ring-1 ring-border">
              <QRCodeSVG value={active.deposit_address} size={140} marginSize={0} />
            </div>
          </div>
          <div className="space-y-2 self-center">
            <CopyField
              label={`${active.name} deposit address`}
              value={active.deposit_address}
              copiedKey={copiedKey}
              fieldKey="crypto-address"
              onCopy={copy}
            />
            {tokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-xs text-muted-foreground">Accepts</span>
                {tokens.map((t) => (
                  <span
                    key={t.name}
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    <CoinIcon src={t.icon_url} name={t.name} className="size-3.5" />
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- bank --------------------------------- */

const RAIL_LABEL: Record<string, string> = { wire: "Wire", ach: "ACH", sepa: "SEPA" };

function BankPanel({ deposit, live }: { deposit: Deposit; live: boolean }) {
  const { copiedKey, copy } = useCopy();
  const currencies = deposit.methods.bank?.currencies ?? [];
  const [currency, setCurrency] = useState<string>(
    currencies.find((c) => c.currency === "USD")?.currency ?? currencies[0]?.currency ?? "",
  );
  const selected = useMemo(
    () => currencies.find((c) => c.currency === currency) ?? currencies[0] ?? null,
    [currencies, currency],
  );

  if (!selected) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Bank transfers aren&apos;t enabled for this agent — use crypto to fund it.
        </CardContent>
      </Card>
    );
  }

  const fields = [
    { label: "Beneficiary", value: selected.deposit_beneficiary_name, key: "beneficiary", mono: false },
    { label: "Bank", value: selected.deposit_bank_name, key: "bank", mono: false },
    { label: "Account / IBAN", value: selected.account_number, key: "account" },
    { label: "Routing", value: selected.routing_number, key: "routing" },
    { label: "Reference (required)", value: selected.deposit_reference, key: "reference" },
  ].filter((f) => f.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          Bank transfer
          <ModeBadge live={live} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {currencies.length > 1 ? (
            <Select value={currency} onValueChange={(v) => setCurrency(v as string)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.currency} value={c.currency}>
                    {c.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">{selected.currency}</Badge>
          )}
          {selected.rails.map((r) => (
            <Badge key={r} variant="secondary">
              {RAIL_LABEL[r] ?? r.toUpperCase()}
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <CopyField
              key={f.key}
              label={f.label}
              value={f.value!}
              mono={f.mono}
              copiedKey={copiedKey}
              fieldKey={`bank-${f.key}`}
              onCopy={copy}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- helpers -------------------------------- */

function LoadingCard() {
  return (
    <Card>
      <CardContent className="space-y-3 py-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full" />
      </CardContent>
    </Card>
  );
}
