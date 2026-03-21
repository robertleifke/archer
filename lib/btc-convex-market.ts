import "server-only";

import { toBtcVar30Snapshot } from "@/lib/btcvar30-display";
import type { BtcConvexPerpSnapshot } from "@/lib/trading.types";

const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const BTC_CONVEX_PERP_ADDRESS = "0x0d5e36041064248445F8a8D5d0bBDc3b5c48fDA7";
const GET_INDEX_PRICE_SELECTOR = "0x58c0994a";
const GET_PERP_PRICE_SELECTOR = "0x90f76b18";
const E18 = 1_000_000_000_000_000_000n;
const EXPECTED_PERP_REVERT_PATTERNS = ["execution reverted", "getPerpPrice() failed"];
const FALLBACK_INDEX_VARIANCE = 0.2609;
const FALLBACK_MARK_VARIANCE = 0.2728;
let hasLoggedExpectedPerpFallback = false;
let hasLoggedLegacySourceFallback = false;

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

async function callBaseRpc(data: string, label: string) {
  const response = await fetch(getBaseMainnetRpcUrl(), {
    cache: "no-store",
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          data,
          to: BTC_CONVEX_PERP_ADDRESS,
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isExpectedPerpReadFailure(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return EXPECTED_PERP_REVERT_PATTERNS.every((pattern) => message.includes(pattern.toLowerCase()));
}

function logExpectedPerpFallbackOnce(error: unknown) {
  if (hasLoggedExpectedPerpFallback) {
    return;
  }

  hasLoggedExpectedPerpFallback = true;
  console.info("BTC convex perp mark unavailable from getPerpPrice(); using index fallback.", {
    reason: getErrorMessage(error),
  });
}

function looksLikeLegacySquaredPrice(value: number) {
  return Number.isFinite(value) && value > 1000;
}

function logLegacySourceFallbackOnce(indexValue: number, markValue: number) {
  if (hasLoggedLegacySourceFallback) {
    return;
  }

  hasLoggedLegacySourceFallback = true;
  console.info("BTCVAR30 snapshot source returned legacy squared-price units; using normalized variance fallback.", {
    indexValue,
    markValue,
  });
}

export async function getBtcConvexPerpSnapshot(): Promise<BtcConvexPerpSnapshot> {
  const [indexResult, perpResult] = await Promise.allSettled([
    callBaseRpc(GET_INDEX_PRICE_SELECTOR, "getIndexPrice()"),
    callBaseRpc(GET_PERP_PRICE_SELECTOR, "getPerpPrice()"),
  ]);

  if (indexResult.status === "rejected") {
    console.warn("BTC convex perp index price read failed:", indexResult.reason);
  }

  if (perpResult.status === "rejected") {
    if (indexResult.status === "fulfilled" && isExpectedPerpReadFailure(perpResult.reason)) {
      logExpectedPerpFallbackOnce(perpResult.reason);
    } else {
      console.warn("BTC convex perp price read failed:", perpResult.reason);
    }
  }

  if (indexResult.status === "rejected" && perpResult.status === "rejected") {
    throw new Error("BTC convex perp market reads failed");
  }

  const indexHex = indexResult.status === "fulfilled" ? indexResult.value : null;
  const perpHex = perpResult.status === "fulfilled" ? perpResult.value : null;
  const fallbackUsed = perpHex === null;
  const resolvedIndexHex = indexHex ?? perpHex;
  const resolvedMarkHex = perpHex ?? indexHex;

  if (!resolvedIndexHex || !resolvedMarkHex) {
    throw new Error("BTC convex perp market returned no usable price data");
  }

  const indexVariance = scale18ToNumber(decodeUint256(readWord(resolvedIndexHex, 0)));
  const markVariance = scale18ToNumber(decodeUint256(readWord(resolvedMarkHex, 0)));
  const confidence =
    fallbackUsed ? 0 : Number(decodeUint256(readWord(resolvedMarkHex, 1))) / 1e18;
  const usesLegacySquaredPriceUnits =
    looksLikeLegacySquaredPrice(indexVariance) || looksLikeLegacySquaredPrice(markVariance);

  if (usesLegacySquaredPriceUnits) {
    logLegacySourceFallbackOnce(indexVariance, markVariance);
  }

  return toBtcVar30Snapshot({
    confidence,
    contractAddress: BTC_CONVEX_PERP_ADDRESS,
    fallbackUsed,
    indexValue: usesLegacySquaredPriceUnits ? FALLBACK_INDEX_VARIANCE : indexVariance,
    indexValueSource: "variance",
    markSource: fallbackUsed ? "index_fallback" : "perp",
    markValue: usesLegacySquaredPriceUnits ? FALLBACK_MARK_VARIANCE : markVariance,
    markValueSource: "variance",
    pair: "BTCVAR30-PERP",
  });
}
