export function usd(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount ?? 0);
}

/** spent_last_month comes back in cents. */
export function centsToUsd(cents: number | null | undefined): string {
  return usd((cents ?? 0) / 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPan(pan: string | null | undefined): string {
  if (!pan) return "•••• •••• •••• ••••";
  return pan.replace(/(.{4})/g, "$1 ").trim();
}

export function maskedPan(last4: string | null | undefined): string {
  return `•••• •••• •••• ${last4 ?? "••••"}`;
}
