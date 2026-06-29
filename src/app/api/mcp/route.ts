import { NextResponse } from "next/server";
import { resolveAgentFromRequest } from "@/lib/mcp/auth";
import { TOOL_DEFS, runTool, ToolError } from "@/lib/mcp/tools";
import { WhopError } from "@/lib/whop";

/**
 * AgentCards MCP server — a self-contained, spec-compliant MCP endpoint speaking
 * JSON-RPC 2.0 over the Streamable HTTP transport (single POST returning
 * application/json). One agent connects here scoped to its own MCP key, so the
 * agent can manage and use ONLY its own card.
 *
 * No SDK: we implement the small protocol surface ourselves to avoid adding
 * dependencies. Methods handled: initialize, notifications/initialized, ping,
 * tools/list, tools/call.
 *
 * SAFETY: every tools/* call is scoped to the authenticated agent. No tool ever
 * returns card secrets (PAN/CVV).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "agentcards", version: "0.1.0" };

// JSON-RPC error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
const UNAUTHORIZED = -32001;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: { code, message, ...(data ? { data } : {}) } };
}

/** Tool results travel as a stringified-JSON text content block. */
function toolContent(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

async function handleRpc(
  msg: JsonRpcRequest,
  req: Request,
): Promise<object | null> {
  const id = msg.id ?? null;
  const method = msg.method;

  if (msg.jsonrpc !== "2.0" || typeof method !== "string") {
    return rpcError(id, INVALID_REQUEST, "Invalid JSON-RPC request");
  }

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
    case "initialized":
      // Notification — no response body.
      return null;

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOL_DEFS });

    case "tools/call": {
      const agent = await resolveAgentFromRequest(req);
      if (!agent) {
        return rpcError(id, UNAUTHORIZED, "Unauthorized: missing or invalid MCP key");
      }
      const params = msg.params ?? {};
      const name = params.name;
      const args = (params.arguments as Record<string, unknown>) ?? {};
      if (typeof name !== "string") {
        return rpcError(id, INVALID_PARAMS, "tools/call requires a string `name`");
      }
      try {
        const value = await runTool(name, args, agent);
        return rpcResult(id, toolContent(value));
      } catch (err) {
        if (err instanceof ToolError) {
          return rpcError(id, INVALID_PARAMS, err.message);
        }
        if (err instanceof WhopError) {
          return rpcError(id, INTERNAL_ERROR, err.message, { status: err.status });
        }
        const message = err instanceof Error ? err.message : "Tool execution failed";
        return rpcError(id, INTERNAL_ERROR, message);
      }
    }

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, PARSE_ERROR, "Parse error"), { status: 400 });
  }

  // Batch request support.
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map((m) => handleRpc(m as JsonRpcRequest, req)))).filter(
      (r): r is object => r !== null,
    );
    if (responses.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(responses);
  }

  const response = await handleRpc(body as JsonRpcRequest, req);
  // Notifications produce no response → 202 Accepted with empty body.
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

/** Minimal discovery info; MCP clients must POST, so GET is informational. */
export async function GET() {
  return NextResponse.json(
    {
      server: SERVER_INFO,
      transport: "streamable-http",
      protocolVersion: PROTOCOL_VERSION,
      hint: "POST JSON-RPC 2.0 to this endpoint. Authenticate with `Authorization: Bearer <mcp-key>`.",
      tools: TOOL_DEFS.map((t) => t.name),
    },
    { headers: { Allow: "POST" } },
  );
}
