import "server-only";

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const GET_INDEX_PRICE_SELECTOR = "0x58c0994a";
const GET_PERP_PRICE_SELECTOR = "0x90f76b18";
const E18 = 1_000_000_000_000_000_000n;

export type NgnPerpSnapshot = {
  confidence: number;
  contractAddress: string;
  displayIndexNgnPerUsd: number;
  displayMarkNgnPerUsd: number;
  fallbackUsed: false;
  indexNgnPerUsd: number;
  markNgnPerUsd: number;
  markSource: "perp";
  pair: "NGNUSDC-PERP";
};

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

function getExchangeCoreRoot() {
  return process.env.EXCHANGE_CORE_ROOT?.trim() || path.resolve(process.cwd(), "../exchange-core");
}

function getNgnArtifactPath() {
  return path.join(getExchangeCoreRoot(), "deployments/8453/NGN.json");
}

async function getNgnPerpAddress() {
  const artifactPath = getNgnArtifactPath();

  try {
    await access(artifactPath);
  } catch {
    return null;
  }

  const content = await readFile(artifactPath, "utf8");
  const json = JSON.parse(content) as { perp?: string };
  return json.perp ?? null;
}

async function callBaseRpc(to: string, data: string, label: string) {
  const response = await fetch(getBaseMainnetRpcUrl(), {
    cache: "no-store",
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          data,
          to,
        },
        "latest",
      ],
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Base RPC request failed with status ${response.status}`);
  }

  const json = (await response.json()) as { error?: { message?: string }; result?: string };

  if (json.error) {
    throw new Error(`${label} failed: ${json.error.message ?? "Base RPC returned an unknown error"}`);
  }

  if (!json.result) {
    throw new Error(`${label} failed: Base RPC returned no result`);
  }

  return json.result;
}

function readWord(hex: string, index: number) {
  const start = 2 + index * 64;
  const end = start + 64;
  return hex.slice(start, end);
}

function decodeUint256(word: string) {
  return BigInt(`0x${word}`);
}

function scale18ToNumber(value: bigint) {
  const whole = value / E18;
  const fraction = value % E18;
  return Number(whole) + Number(fraction) / Number(E18);
}

export async function getNgnPerpSnapshot(): Promise<NgnPerpSnapshot> {
  const perpAddress = await getNgnPerpAddress();

  if (!perpAddress) {
    throw new Error("NGN perp deployment artifact not found");
  }

  const [indexHex, perpHex] = await Promise.all([
    callBaseRpc(perpAddress, GET_INDEX_PRICE_SELECTOR, "getIndexPrice()"),
    callBaseRpc(perpAddress, GET_PERP_PRICE_SELECTOR, "getPerpPrice()"),
  ]);

  const indexNgnPerUsd = scale18ToNumber(decodeUint256(readWord(indexHex, 0)));
  const markNgnPerUsd = scale18ToNumber(decodeUint256(readWord(perpHex, 0)));
  const confidence = Number(decodeUint256(readWord(perpHex, 1))) / 1e18;

  return {
    confidence,
    contractAddress: perpAddress,
    displayIndexNgnPerUsd: indexNgnPerUsd,
    displayMarkNgnPerUsd: markNgnPerUsd,
    fallbackUsed: false,
    indexNgnPerUsd,
    markNgnPerUsd,
    markSource: "perp",
    pair: "NGNUSDC-PERP",
  };
}
