import type { Account, Card, Transfer, Deposit } from "./types";

/**
 * Demo data used when WHOP_API_KEY is not configured, so AgentCards is fully
 * clickable offline. Real API data takes over automatically once the key is set.
 *
 * Shape: one treasury (parent) account + a roster of AI-agent connected accounts,
 * each with its own virtual card.
 */

export const MOCK_TREASURY_ID = process.env.TREASURY_ACCOUNT_ID ?? "biz_demo";

export const mockAccounts: Account[] = [
  {
    id: MOCK_TREASURY_ID,
    email: "you@agentcards.dev",
    title: "My Treasury",
    parent_account_id: null,
    created_at: "2026-01-04T00:00:00.000Z",
  },
  {
    id: "biz_agent_shopper",
    email: "personal-shopper@agentcards.dev",
    title: "Personal Shopper",
    parent_account_id: MOCK_TREASURY_ID,
    created_at: "2026-02-10T18:31:43.700Z",
    metadata: { app: "agentcards", role: "shopper" },
  },
  {
    id: "biz_agent_advisor",
    email: "financial-advisor@agentcards.dev",
    title: "Financial Advisor",
    parent_account_id: MOCK_TREASURY_ID,
    created_at: "2026-03-02T14:33:44.811Z",
    metadata: { app: "agentcards", role: "advisor" },
  },
  {
    id: "biz_agent_travel",
    email: "travel-agent@agentcards.dev",
    title: "Travel Agent",
    parent_account_id: MOCK_TREASURY_ID,
    created_at: "2026-04-06T14:43:02.015Z",
    metadata: { app: "agentcards", role: "travel" },
  },
  {
    id: "biz_agent_dev",
    email: "dev-agent@agentcards.dev",
    title: "Dev / Infra Agent",
    parent_account_id: MOCK_TREASURY_ID,
    created_at: "2026-05-01T15:53:43.543Z",
    metadata: { app: "agentcards", role: "dev" },
  },
];

const BILLING = {
  line1: "548 Market St",
  line2: "",
  city: "San Francisco",
  region: "CA",
  postal_code: "94104",
  country_code: "US",
};

export const mockCards: Card[] = [
  {
    object: "card",
    id: "icrd_shopper",
    name: "Personal Shopper",
    type: "virtual",
    status: "active",
    last4: "4242",
    expiration_month: "8",
    expiration_year: "2031",
    user_id: "biz_agent_shopper",
    spent_last_month: 48230,
    limit: { amount: 1500, frequency: "monthly" },
    billing: BILLING,
    created_at: "2026-02-10T18:30:00.000Z",
    canceled_at: null,
    secrets: { card_number: "4242424242424242", cvc: "311", name_on_card: "PERSONAL SHOPPER" },
  },
  {
    object: "card",
    id: "icrd_advisor",
    name: "Financial Advisor",
    type: "virtual",
    status: "active",
    last4: "8821",
    expiration_month: "11",
    expiration_year: "2030",
    user_id: "biz_agent_advisor",
    spent_last_month: 9900,
    limit: { amount: 500, frequency: "monthly" },
    billing: BILLING,
    created_at: "2026-03-02T18:30:00.000Z",
    canceled_at: null,
    secrets: { card_number: "4485118821064739", cvc: "904", name_on_card: "FINANCIAL ADVISOR" },
  },
  {
    object: "card",
    id: "icrd_travel",
    name: "Travel Agent",
    type: "virtual",
    status: "active",
    last4: "1077",
    expiration_month: "3",
    expiration_year: "2032",
    user_id: "biz_agent_travel",
    spent_last_month: 132640,
    limit: { amount: 5000, frequency: "monthly" },
    billing: BILLING,
    created_at: "2026-04-06T18:30:00.000Z",
    canceled_at: null,
    secrets: { card_number: "4716101077064712", cvc: "550", name_on_card: "TRAVEL AGENT" },
  },
  {
    object: "card",
    id: "icrd_dev",
    name: "Dev / Infra Agent",
    type: "virtual",
    status: "frozen",
    last4: "6310",
    expiration_month: "6",
    expiration_year: "2029",
    user_id: "biz_agent_dev",
    spent_last_month: 21075,
    limit: { amount: 1000, frequency: "monthly" },
    billing: BILLING,
    created_at: "2026-05-01T18:30:00.000Z",
    canceled_at: null,
    secrets: { card_number: "4539631006310642", cvc: "128", name_on_card: "DEV INFRA AGENT" },
  },
  {
    object: "card",
    id: "icrd_shopper_singleuse",
    name: "Amazon — AirPods Pro (single-use)",
    type: "virtual",
    status: "canceled",
    last4: "9904",
    expiration_month: "8",
    expiration_year: "2031",
    user_id: "biz_agent_shopper",
    spent_last_month: 24900,
    limit: { amount: 280, frequency: "one_time" },
    billing: BILLING,
    created_at: "2026-06-20T11:02:00.000Z",
    canceled_at: "2026-06-20T11:14:00.000Z",
    secrets: { card_number: "4242990409904242", cvc: "777", name_on_card: "PERSONAL SHOPPER" },
  },
];

export const mockDeposit: Deposit = {
  object: "deposit",
  amount: "0",
  account_id: MOCK_TREASURY_ID,
  hosted_url: null,
  methods: {
    crypto: [
      { name: "Ethereum", deposit_address: "0x9A3f7b21D4eE5c9F1a8B0d2E4F6c1aB3D5e7C7E2", supported_currencies: [{ name: "USDC" }, { name: "USDT" }] },
      { name: "Base", deposit_address: "0x9A3f7b21D4eE5c9F1a8B0d2E4F6c1aB3D5e7C7E2", supported_currencies: [{ name: "USDC" }] },
      { name: "Arbitrum", deposit_address: "0x9A3f7b21D4eE5c9F1a8B0d2E4F6c1aB3D5e7C7E2", supported_currencies: [{ name: "USDC" }, { name: "USDT" }] },
      { name: "Polygon", deposit_address: "0x9A3f7b21D4eE5c9F1a8B0d2E4F6c1aB3D5e7C7E2", supported_currencies: [{ name: "USDC" }] },
      { name: "Solana", deposit_address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j", supported_currencies: [{ name: "USDC" }, { name: "USDT" }] },
    ],
    bank: {
      currencies: [
        {
          currency: "USD",
          account_number: "8410029376",
          routing_number: "021000021",
          deposit_bank_name: "Lead Bank",
          deposit_beneficiary_name: "AgentCards Treasury LLC",
          deposit_reference: "ACDEP-7F3K9Q",
          rails: ["wire", "ach"],
        },
        {
          currency: "EUR",
          account_number: "DE89 3704 0044 0532 0130 00",
          routing_number: null,
          deposit_bank_name: "Whop Payments SA",
          deposit_beneficiary_name: "AgentCards Treasury LLC",
          deposit_reference: "ACDEP-7F3K9Q",
          rails: ["sepa"],
        },
      ],
    },
  },
};

export const mockTransfers: Transfer[] = [
  {
    id: "ctt_fund_shopper",
    amount: 500,
    currency: "usd",
    created_at: "2026-06-18T09:00:00.000Z",
    notes: "Treasury → Personal Shopper",
    destination_ledger_account_id: "biz_agent_shopper",
  },
  {
    id: "ctt_fund_travel",
    amount: 2000,
    currency: "usd",
    created_at: "2026-06-15T09:00:00.000Z",
    notes: "Treasury → Travel Agent",
    destination_ledger_account_id: "biz_agent_travel",
  },
];
