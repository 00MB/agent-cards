import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo, LogoMark } from "@/components/logo";
import { CardArt } from "@/components/card-art";
import { CreditCard, ShieldCheck, Plug, ScrollText } from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Single-use by default",
    description:
      "Every task gets a merchant-locked, one-time card. The agent can buy exactly what you approved — nothing more.",
  },
  {
    icon: ShieldCheck,
    title: "Per-agent spend policy",
    description:
      "Set spend limits, per-transaction caps, merchant locks, and approval thresholds. That's the trust boundary you control.",
  },
  {
    icon: Plug,
    title: "Connect over MCP",
    description:
      "Agents check out through an MCP tool that returns a checkout intent — never the raw PAN. Secrets stay out of the model's context.",
  },
  {
    icon: ScrollText,
    title: "Everything is auditable",
    description:
      "Every purchase, funding event, and policy change lands in one transaction feed. No surprises, full provenance.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* ---- Top nav ---- */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <Button size="lg" render={<Link href="/dashboard" />}>
            Open dashboard
          </Button>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="absolute -top-24 right-[-10%] -z-10 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 left-[-10%] -z-10 h-[24rem] w-[24rem] rounded-full bg-chart-2/15 blur-3xl" />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-24 pt-16 md:grid-cols-2 md:pt-24">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              A bank for AI agents
            </Badge>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Give every AI agent its own card.
            </h1>
            <p className="max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
              AgentCards issues scoped, fundable virtual cards for your
              autonomous agents — single-use by default, governed by a spend
              policy you set, and connected over MCP. Fund the treasury with
              stablecoins and let your agents transact safely.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="px-6" render={<Link href="/dashboard" />}>
                Open dashboard
              </Button>
              <span className="text-sm text-muted-foreground">
                Fully clickable in mock mode. No keys required.
              </span>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-[420px] rotate-3 transition-transform duration-500 hover:rotate-0">
              <CardArt
                card={{
                  name: "Personal Shopper",
                  last4: "4242",
                  expiration_month: "8",
                  expiration_year: "2031",
                  status: "active",
                  cardholder: "PERSONAL SHOPPER",
                }}
                secrets={null}
                flipped={false}
                className="drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Safe spend, by design.
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Autonomy you can trust. AgentCards puts a hard boundary between an
            agent&apos;s ambitions and your money.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="transition-all hover:-translate-y-1 hover:ring-primary/40"
              >
                <CardHeader>
                  <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---- CTA band ---- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-chart-1 to-chart-2" />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center text-white">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to put your agents on a card?
          </h2>
          <p className="max-w-xl text-lg text-white/90">
            Spin up an agent, set its spend policy, and connect it over MCP in
            minutes.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="px-6"
            render={<Link href="/dashboard" />}
          >
            Open dashboard
          </Button>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <Logo />
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LogoMark className="h-5 w-5 text-primary" />
            A bank for your AI agents
          </p>
        </div>
      </footer>
    </div>
  );
}
