"use client";

import { cn } from "@/lib/utils";
import { formatPan, maskedPan } from "@/lib/format";
import type { Card, CardSecrets } from "@/lib/types";

function VisaMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-bold italic tracking-tight text-white drop-shadow",
        className,
      )}
    >
      VISA
    </span>
  );
}

/** AgentCards card face — electric indigo/violet gradient with a circuit motif. */
function AgentScene() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 340 214"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="ac-card-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.6 0.25 300)" />
          <stop offset="55%" stopColor="oklch(0.52 0.24 280)" />
          <stop offset="100%" stopColor="oklch(0.4 0.2 270)" />
        </linearGradient>
        <radialGradient id="ac-glow" cx="0.8" cy="0.15" r="0.7">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="340" height="214" fill="url(#ac-card-bg)" />
      <rect width="340" height="214" fill="url(#ac-glow)" />
      {/* circuit traces */}
      <g stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" fill="none">
        <path d="M-10 60 H120 V20" />
        <path d="M40 240 V150 H160" />
        <path d="M360 110 H250 V60 H300" />
        <path d="M200 -10 V40 H140" />
      </g>
      <g fill="#ffffff" fillOpacity="0.18">
        <circle cx="120" cy="20" r="3" />
        <circle cx="160" cy="150" r="3" />
        <circle cx="250" cy="60" r="3" />
        <circle cx="140" cy="40" r="3" />
      </g>
    </svg>
  );
}

export function CardArt({
  card,
  secrets,
  flipped = false,
  className,
}: {
  card: Pick<Card, "name" | "last4" | "expiration_month" | "expiration_year" | "status"> & {
    cardholder?: string | null;
  };
  secrets?: CardSecrets | null;
  flipped?: boolean;
  className?: string;
}) {
  const exp =
    card.expiration_month && card.expiration_year
      ? `${String(card.expiration_month).padStart(2, "0")}/${String(card.expiration_year).slice(-2)}`
      : "••/••";
  const cardholder =
    secrets?.name_on_card || card.cardholder || card.name || "AGENT";
  const canceled = card.status === "canceled";
  const frozen = card.status === "frozen";

  return (
    <div className={cn("ac-flip aspect-[1.586/1] w-full max-w-[400px]", className)}>
      <div className={cn("ac-flip-inner", flipped && "is-flipped")}>
        {/* FRONT */}
        <div className="ac-flip-face overflow-hidden rounded-2xl shadow-[0_18px_40px_-18px_oklch(0.45_0.22_280/0.7)] ring-1 ring-white/10">
          <AgentScene />
          {(canceled || frozen) && (
            <div className="absolute inset-0 z-20 bg-black/40 backdrop-grayscale" />
          )}
          <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-[0.12em] drop-shadow">
                  AGENTCARDS
                </span>
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-80">
                  Agent Virtual Card
                </span>
              </div>
              <div className="h-7 w-9 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/80 ring-1 ring-white/40" />
            </div>
            <div>
              <div className="font-mono text-[15px] tracking-[0.18em] drop-shadow-sm">
                {maskedPan(card.last4)}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="min-w-0">
                  <div className="text-[8px] uppercase tracking-widest opacity-80">
                    Cardholder
                  </div>
                  <div className="truncate text-xs font-medium uppercase tracking-wide">
                    {cardholder}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] uppercase tracking-widest opacity-80">
                    Expires
                  </div>
                  <div className="text-xs font-medium">{exp}</div>
                </div>
                <VisaMark className="ml-2 text-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="ac-flip-face ac-flip-back overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.3_0.08_280)] to-[oklch(0.18_0.03_270)] text-white shadow-[0_18px_40px_-18px_oklch(0.45_0.22_280/0.7)] ring-1 ring-white/10">
          <div className="mt-5 h-9 w-full bg-black/70" />
          <div className="space-y-3 p-5 pt-4">
            <Field label="Card number" value={formatPan(secrets?.card_number)} mono />
            <div className="flex gap-6">
              <Field label="Expiry" value={exp} mono />
              <Field label="CVC" value={secrets?.cvc ?? "•••"} mono />
            </div>
            <Field label="Name on card" value={cardholder} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-widest text-white/60">{label}</div>
      <div className={cn("text-sm", mono && "font-mono tracking-wide")}>{value}</div>
    </div>
  );
}
