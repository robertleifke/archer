import "server-only";

const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const BTC_SQUARED_PERP_ADDRESS = "0x0d5e36041064248445F8a8D5d0bBDc3b5c48fDA7";
const GET_INDEX_PRICE_SELECTOR = "0x58c0994a";
const GET_PERP_PRICE_SELECTOR = "0x90f76b18";
const E18 = 1_000_000_000_000_000_000n;

export type BtcSquaredPerpSnapshot = {
  confidence: number;
  contractAddress: string;
  displayIndexBtcUsd: number;
  displayMarkBtcUsd: number;
  fallbackUsed: boolean;
  indexSquaredUsd: number;
  markSquaredUsd: number;
  markSource: "index_fallback" | "perp";
  pair: "BTCUSDC-SQPERP";
};

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
          to: BTC_SQUARED_PERP_ADDRESS,
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

export async function getBtcSquaredPerpSnapshot(): Promise<BtcSquaredPerpSnapshot> {
  const [indexResult, perpResult] = await Promise.allSettled([
    callBaseRpc(GET_INDEX_PRICE_SELECTOR, "getIndexPrice()"),
    callBaseRpc(GET_PERP_PRICE_SELECTOR, "getPerpPrice()"),
  ]);

  if (indexResult.status === "rejected") {
    console.warn("BTC squared index price read failed:", indexResult.reason);
  }

  if (perpResult.status === "rejected") {
    console.warn("BTC squared perp price read failed:", perpResult.reason);
  }

  if (indexResult.status === "rejected" && perpResult.status === "rejected") {
    throw new Error("BTC squared market reads failed");
  }

  const indexHex = indexResult.status === "fulfilled" ? indexResult.value : null;
  const perpHex = perpResult.status === "fulfilled" ? perpResult.value : null;
  const fallbackUsed = perpHex === null;
  const resolvedIndexHex = indexHex ?? perpHex;
  const resolvedMarkHex = perpHex ?? indexHex;

  if (!resolvedIndexHex || !resolvedMarkHex) {
    throw new Error("BTC squared market returned no usable price data");
  }

  const indexSquaredUsd = scale18ToNumber(decodeUint256(readWord(resolvedIndexHex, 0)));
  const markSquaredUsd = scale18ToNumber(decodeUint256(readWord(resolvedMarkHex, 0)));
  const confidence = Number(decodeUint256(readWord(resolvedMarkHex, 1))) / 1e18;

  return {
    confidence,
    contractAddress: BTC_SQUARED_PERP_ADDRESS,
    displayIndexBtcUsd: Math.sqrt(indexSquaredUsd),
    displayMarkBtcUsd: Math.sqrt(markSquaredUsd),
    fallbackUsed,
    indexSquaredUsd,
    markSquaredUsd,
    markSource: fallbackUsed ? "index_fallback" : "perp",
    pair: "BTCUSDC-SQPERP",
  };
}
