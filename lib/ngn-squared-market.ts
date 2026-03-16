import "server-only";

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getChainlinkNgnUsdSpot } from "@/lib/chainlink-ngn-usd";

const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const GET_INDEX_PRICE_SELECTOR = "0x58c0994a";
const GET_PERP_PRICE_SELECTOR = "0x90f76b18";
const E18 = 1_000_000_000_000_000_000n;

export type NgnSquaredPerpSnapshot = {
  confidence: number;
  contractAddress: string;
  displayIndexNgnPerUsd: number;
  displayMarkNgnPerUsd: number;
  fallbackUsed: boolean;
  indexSquaredNgnPerUsd: number;
  markSquaredNgnPerUsd: number;
  markSource: "chainlink_spot_fallback" | "index_fallback" | "perp";
  pair: "NGNUSDC-SQPERP";
};

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

function getExchangeCoreRoot() {
  return process.env.EXCHANGE_CORE_ROOT?.trim() || path.resolve(process.cwd(), "../exchange-core");
}

function getCngnSquaredArtifactPath() {
  return path.join(getExchangeCoreRoot(), "deployments/8453/NGN_SQUARED.json");
}

async function getCngnSquaredPerpAddress() {
  const artifactPath = getCngnSquaredArtifactPath();

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

function squareDisplayPrice(value: number) {
  return value * value;
}

function buildSpotFallbackSnapshot(contractAddress: string, confidence: number, priceNgnPerUsd: number): NgnSquaredPerpSnapshot {
  const squaredPrice = squareDisplayPrice(priceNgnPerUsd);

  return {
    confidence,
    contractAddress,
    displayIndexNgnPerUsd: priceNgnPerUsd,
    displayMarkNgnPerUsd: priceNgnPerUsd,
    fallbackUsed: true,
    indexSquaredNgnPerUsd: squaredPrice,
    markSquaredNgnPerUsd: squaredPrice,
    markSource: "chainlink_spot_fallback",
    pair: "NGNUSDC-SQPERP",
  };
}

export async function getNgnSquaredPerpSnapshot(): Promise<NgnSquaredPerpSnapshot> {
  const perpAddress = await getCngnSquaredPerpAddress();

  if (!perpAddress) {
    const spot = await getChainlinkNgnUsdSpot();
    return buildSpotFallbackSnapshot(spot.contractAddress, 1, spot.priceNgnPerUsd);
  }

  const [indexResult, perpResult] = await Promise.allSettled([
    callBaseRpc(perpAddress, GET_INDEX_PRICE_SELECTOR, "getIndexPrice()"),
    callBaseRpc(perpAddress, GET_PERP_PRICE_SELECTOR, "getPerpPrice()"),
  ]);

  if (indexResult.status === "rejected" && perpResult.status === "rejected") {
    const spot = await getChainlinkNgnUsdSpot();
    return buildSpotFallbackSnapshot(perpAddress, 1, spot.priceNgnPerUsd);
  }

  const indexHex = indexResult.status === "fulfilled" ? indexResult.value : null;
  const perpHex = perpResult.status === "fulfilled" ? perpResult.value : null;
  const fallbackUsed = perpHex === null;
  const resolvedIndexHex = indexHex ?? perpHex;
  const resolvedMarkHex = perpHex ?? indexHex;

  if (!resolvedIndexHex || !resolvedMarkHex) {
    const spot = await getChainlinkNgnUsdSpot();
    return buildSpotFallbackSnapshot(perpAddress, 1, spot.priceNgnPerUsd);
  }

  const indexSquaredNgnPerUsd = scale18ToNumber(decodeUint256(readWord(resolvedIndexHex, 0)));
  const markSquaredNgnPerUsd = scale18ToNumber(decodeUint256(readWord(resolvedMarkHex, 0)));
  const confidence = Number(decodeUint256(readWord(resolvedMarkHex, 1))) / 1e18;

  return {
    confidence,
    contractAddress: perpAddress,
    displayIndexNgnPerUsd: Math.sqrt(indexSquaredNgnPerUsd),
    displayMarkNgnPerUsd: Math.sqrt(markSquaredNgnPerUsd),
    fallbackUsed,
    indexSquaredNgnPerUsd,
    markSquaredNgnPerUsd,
    markSource: fallbackUsed ? "index_fallback" : "perp",
    pair: "NGNUSDC-SQPERP",
  };
}
