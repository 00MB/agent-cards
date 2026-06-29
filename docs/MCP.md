# AgentCards MCP Server

Each AI agent gets its own scoped, fundable virtual card — and can manage and use
that card autonomously by connecting to the AgentCards **MCP server**. This is the
product's differentiator: the agent gets a *checkout* tool, never the raw card.

## Endpoint

```
POST /api/mcp
```

- Transport: **Streamable HTTP** (JSON-RPC 2.0, single POST returning `application/json`).
- A `GET /api/mcp` returns a small info JSON (server name, protocol version, tool list).
- Protocol version: `2024-11-05`.

## Authentication

The connection is scoped to **one agent** by its MCP key.

- Send `Authorization: Bearer <mcp-key>` (a `?key=<mcp-key>` query param is also accepted).
- The server sha256-hashes the key and matches it to the agent whose `mcpKeyHash` it equals.
- **Mock mode:** when no live `WHOP_API_KEY` is configured and no key matches, the
  server falls back to the demo agent (`biz_agent_shopper`) so it is instantly demoable.
- Unauthorized `tools/call` returns JSON-RPC error `-32001` "Unauthorized: missing or invalid MCP key".

### Getting a key

In the dashboard, open an agent (**Dashboard → Agents → \<agent\>**) and use the
**Connect via MCP** panel to generate a key. The raw key is shown **once**; AgentCards
stores only its hash and a display prefix.

## Client configuration

A Claude / Cursor `mcpServers` entry using Streamable HTTP with the auth header:

```json
{
  "mcpServers": {
    "agentcards": {
      "type": "http",
      "url": "https://your-deployment.example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer mcpk_your_agent_key"
      }
    }
  }
}
```

For local development the URL is `http://localhost:3000/api/mcp`.

## Tools

All tools are scoped to the authenticated agent's account. **No tool ever returns
card secrets (PAN/CVV)** — there is intentionally no `get_card_secrets` tool.

| Tool | Input | Purpose |
| --- | --- | --- |
| `list_cards` | — | List the agent's cards: `id, name, status, last4, limit, spent_last_month` (no secrets). |
| `create_card` | `{ name?, spend_limit?, spend_limit_frequency?, transaction_limit? }` | Issue a new scoped card. |
| `create_single_use_card` | `{ limit, name? }` | **Safe default** for a single purchase — a one-time, capped card. |
| `get_spend_summary` | — | `{ cards, spent_last_month_usd, limits }` for the agent. |
| `list_transactions` | — | The agent's auditable transaction history. |
| `freeze_card` | `{ card_id }` | Freeze one of the agent's cards (must be its own). |
| `checkout_intent` | `{ merchant, amount, description? }` | **The safe purchase tool.** Records a pending purchase intent; AgentCards completes the buy server-side. Never returns the PAN/CVV. |

`spend_limit_frequency` ∈ `daily | weekly | monthly | one_time`.

## Safety doctrine

1. **Single-use / capped cards are the default per task** (`create_single_use_card`).
2. **Card secrets never enter the agent's context** — the agent buys via `checkout_intent`.
3. **Per-agent spend policy** (limits, per-tx caps) is the trust boundary.
4. **Everything is auditable** — every action lands in the transaction feed.

## Example `tools/call`

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "checkout_intent",
    "arguments": { "merchant": "Amazon", "amount": 249.0, "description": "AirPods Pro" }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"status\": \"recorded\",\n  \"intent_id\": \"txn_...\",\n  \"merchant\": \"Amazon\",\n  \"amount\": 249,\n  \"description\": \"AirPods Pro\",\n  \"note\": \"Card secrets are never exposed to the agent; AgentCards completes the purchase server-side.\"\n }"
      }
    ]
  }
}
```
