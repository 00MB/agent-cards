# AgentCards — Build Spec (shared contract)

**Product:** A dashboard + MCP server that gives each AI agent its own scoped,
fundable virtual charge card. Built on the Whop Beta API behind an issuer
abstraction. Stack: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
+ shadcn/ui. **All UI uses shadcn/ui components already in `src/components/ui/`.**

This is the reframe of a "community bank" scaffold: **bank → treasury**,
**member → agent**, **cashback → (removed)**.

## Domain & lib API (already written — DO NOT redefine; import these)

- `src/lib/types.ts` — `Card`, `Account`, `Transfer`, `CardSecrets`, `AccountLink`
  (issuer shapes) and `AgentProfile`, `SpendPolicy`, `AgentRole`, `SpendFrequency`,
  `AgentTransaction`, `AgentData` (domain).
- `src/lib/issuer.ts` — `getIssuer(): Issuer`. The `Issuer` interface:
  `treasuryAccountId()`, `isConfigured()`, `listAccounts()`, `listAgentAccounts()`,
  `createAgentAccount({email,metadata})`, `createAccountLink(...)`,
  `listCards(ownerId)`, `getCard(cardId, ownerId)`, `createCard(CreateCardInput)`,
  `updateCardStatus(cardId, "active"|"frozen"|"canceled")`,
  `listTransfers(originId)`, `createTransfer(CreateTransferInput)`.
  `CreateCardInput = { account_id?, user_id?, name?, spend_limit?, spend_limit_frequency?, transaction_limit? }`.
- `src/lib/whop.ts` — the Whop adapter (`whopIssuer`, `WhopError`, `treasuryAccountId`,
  `isConfigured`). Use the issuer via `getIssuer()`, not these directly, except `WhopError`/`isConfigured`.
- `src/lib/agents.ts` — `listAgentRoster(): AgentSummary[]`, `getAgentDetail(accountId): AgentDetail`,
  `ROLE_META`, `roleEmoji(role)`. `AgentSummary = { accountId, name, role, emoji, description?, card, cardCount, spentLastMonthCents, hasMcpKey, createdAt }`.
- `src/lib/store.ts` — `getAgents`, `getAgent(id)`, `upsertAgent(p)`, `removeAgent(id)`,
  `getTransactions`, `addTransaction(tx)`, `mutate(fn)`.
- `src/lib/format.ts` — `usd`, `centsToUsd`, `formatDate`, `formatPan`, `maskedPan`.
- Mock mode: when `WHOP_API_KEY` is unset, the issuer returns demo data
  (`src/lib/mock.ts`: a treasury + 4 agents + cards). The app must be fully
  clickable in mock mode.

## Route map (authoritative — all workstreams must match)

Pages:
- `/` — marketing landing.
- `/dashboard` — overview: agent count, total spend, recent activity, quick actions.
- `/dashboard/agents` — agent roster (grid of agent cards) + "Create agent" dialog.
- `/dashboard/agents/[id]` — agent detail: the virtual card (art + reveal PAN/CVV/exp),
  spend policy, freeze/cancel, transactions, "Create card" (incl. single-use),
  "Connect via MCP" panel (key + config snippet).
- `/dashboard/fund` — funding: crypto deposit (stub UI) + treasury/agent transfers.

Removed: `/dashboard/card`, `/dashboard/members`, `/dashboard/rewards`, `/account`.

API routes (Next route handlers):
- `GET /api/agents` · `POST /api/agents` — list / create agent
  (POST body `{ name, role, description?, email, autoIssueCard?, policy? }` →
  `issuer.createAgentAccount`, persist `AgentProfile` via `upsertAgent`, optionally `issuer.createCard`).
- `DELETE /api/agents/[id]` — remove local profile (`removeAgent`).
- `POST /api/agents/[id]/mcp-key` — (re)generate an MCP key: return the RAW key
  ONCE in the response, persist only `mcpKeyHash` + `mcpKeyPrefix` on the profile.
- `POST /api/cards` — body `{ agentAccountId, name?, spend_limit?, spend_limit_frequency?, transaction_limit? }`.
- `GET /api/cards/[id]?owner=<accountId>` — retrieve WITH secrets.
- `POST /api/cards/[id]` — body `{ status }` to freeze/unfreeze/cancel.
- `POST /api/transfers` — body `{ origin_id, destination_id, amount, notes? }`.

## Safety doctrine (the product's differentiator — reflect it in UI copy)

1. **Single-use / merchant-locked cards are the default per task** — `spend_limit_frequency: "one_time"`.
2. **Card secrets never enter the agent's context.** In the dashboard a human may
   reveal PAN/CVV. Over MCP, the agent gets a *checkout intent* tool, NOT the raw PAN.
3. **Per-agent spend policy** (limit, per-tx cap, merchant lock, approval threshold) is the trust boundary.
4. **Everything is auditable** — every agent action shows in the transaction feed.

## Branding
Name: **AgentCards**. Tone: modern fintech-for-agents ("a bank for your AI agents").
Replace all Princeville/Hawaii/`pb-*` theme tokens. Dark, technical, trustworthy palette.
