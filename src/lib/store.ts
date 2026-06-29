import "server-only";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { AgentData, AgentProfile, AgentTransaction } from "./types";

/**
 * Tiny JSON-file store (no database). Holds only what the issuer doesn't model
 * for us: the agent roster (role/description/policy/MCP key hash) and a local
 * activity log.
 *
 * The runtime source of truth is an in-memory cache, so the app never crashes on
 * a read-only filesystem (e.g. serverless). Mutations are best-effort written to
 * a writable runtime file; initial data loads from committed `data/seed.json`.
 */

const RUNTIME_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), "agentcards.json")
  : path.join(process.cwd(), "data", "agentcards.json");

const SEED_FILE = path.join(process.cwd(), "data", "seed.json");

const SEED: AgentData = { agents: [], transactions: [] };

let cache: AgentData | null = null;
let writeLock: Promise<void> = Promise.resolve();

function normalize(parsed: Partial<AgentData>): AgentData {
  return {
    agents: parsed.agents ?? [],
    transactions: parsed.transactions ?? [],
  };
}

async function tryRead(file: string): Promise<AgentData | null> {
  try {
    return normalize(JSON.parse(await fs.readFile(file, "utf8")) as Partial<AgentData>);
  } catch {
    return null;
  }
}

export async function readData(): Promise<AgentData> {
  if (cache) return cache;
  cache =
    (await tryRead(RUNTIME_FILE)) ??
    (await tryRead(SEED_FILE)) ??
    structuredClone(SEED);
  return cache;
}

async function writeData(data: AgentData): Promise<void> {
  cache = data;
  try {
    await fs.mkdir(path.dirname(RUNTIME_FILE), { recursive: true });
    await fs.writeFile(RUNTIME_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // Read-only filesystem — in-memory cache stands in.
  }
}

/** Serialize mutations so concurrent route handlers don't clobber the file. */
export async function mutate<T>(fn: (data: AgentData) => T | Promise<T>): Promise<T> {
  let result: T;
  writeLock = writeLock.then(async () => {
    const data = await readData();
    result = await fn(data);
    await writeData(data);
  });
  await writeLock;
  return result!;
}

// ---- Convenience helpers ----

export async function getAgents(): Promise<AgentProfile[]> {
  return (await readData()).agents;
}

export async function getAgent(accountId: string): Promise<AgentProfile | null> {
  return (await getAgents()).find((a) => a.accountId === accountId) ?? null;
}

export async function getTransactions(): Promise<AgentTransaction[]> {
  return (await readData()).transactions;
}

export async function upsertAgent(agent: AgentProfile): Promise<AgentProfile> {
  return mutate((data) => {
    const idx = data.agents.findIndex((a) => a.accountId === agent.accountId);
    if (idx >= 0) data.agents[idx] = { ...data.agents[idx], ...agent };
    else data.agents.push(agent);
    return agent;
  });
}

export async function removeAgent(accountId: string): Promise<void> {
  await mutate((data) => {
    data.agents = data.agents.filter((a) => a.accountId !== accountId);
  });
}

export async function addTransaction(tx: AgentTransaction): Promise<AgentTransaction> {
  return mutate((data) => {
    data.transactions.unshift(tx);
    return tx;
  });
}
