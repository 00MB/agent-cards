import { cn } from "@/lib/utils";

/**
 * AgentCards mark — a card with a spark/agent motif. Themeable via currentColor:
 * the card body uses the brand gradient, the spark picks up the current text color.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="AgentCards"
    >
      <defs>
        <linearGradient id="ac-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.6 0.25 300)" />
          <stop offset="100%" stopColor="oklch(0.55 0.24 277)" />
        </linearGradient>
      </defs>
      {/* card body */}
      <rect x="3" y="9" width="42" height="30" rx="7" fill="url(#ac-card)" />
      {/* magstripe / chip hint */}
      <rect x="3" y="16" width="42" height="4.5" fill="#000" opacity="0.18" />
      {/* agent spark — four-point star, inherits text color */}
      <path
        d="M29 21 C29 25, 32 28, 36 28 C32 28, 29 31, 29 35 C29 31, 26 28, 22 28 C26 28, 29 25, 29 21 Z"
        fill="currentColor"
      />
      {/* small accent spark */}
      <circle cx="14" cy="31" r="2.4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export function Logo({
  className,
  showText = true,
  textClassName,
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8 shrink-0 text-white drop-shadow-sm" />
      {showText && (
        <span className={cn("flex flex-col leading-none", textClassName)}>
          <span className="text-base font-semibold tracking-tight text-foreground">
            AgentCards
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            A bank for AI agents
          </span>
        </span>
      )}
    </span>
  );
}
