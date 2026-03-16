import "server-only";

import type { NgnUsdSpotSnapshot } from "@/lib/trading.types";

const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const CHAINLINK_NGN_USD_FEED_ADDRESS = "0xdfbb5Cbc88E382de007bfe6CE99C388176ED80aD";
const DECIMALS_SELECTOR = "0x313ce567";
const LATEST_ROUND_DATA_SELECTOR = "0xfeaf968c";

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

async function callBaseRpc(data: string) {
  const response = await fetch(getBaseMainnetRpcUrl(), {
    cache: "no-store",
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          data,
          to: CHAINLINK_NGN_USD_FEED_ADDRESS,
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
    throw new Error(json.error.message ?? "Base RPC returned an unknown error");
  }

  if (!json.result) {
    throw new Error("Base RPC returned no result");
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

function decodeInt256(word: string) {
  const value = BigInt(`0x${word}`);
  const maxInt256 = 2n ** 255n;
  return value >= maxInt256 ? value - 2n ** 256n : value;
}

function invertNgnUsdToNgnPerUsd(answer: bigint, decimals: number) {
  const normalized = Number(answer) / 10 ** decimals;

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("Chainlink returned a non-positive NGN/USD answer");
  }

  return 1 / normalized;
}

export async function getChainlinkNgnUsdSpot(): Promise<NgnUsdSpotSnapshot> {
  const [decimalsHex, latestRoundDataHex] = await Promise.all([
    callBaseRpc(DECIMALS_SELECTOR),
    callBaseRpc(LATEST_ROUND_DATA_SELECTOR),
  ]);

  const decimals = Number(decodeUint256(readWord(decimalsHex, 0)));
  const answer = decodeInt256(readWord(latestRoundDataHex, 1));
  const updatedAt = Number(decodeUint256(readWord(latestRoundDataHex, 3)));

  return {
    confidence: 1,
    contractAddress: CHAINLINK_NGN_USD_FEED_ADDRESS,
    feedUrl: "https://data.chain.link/feeds/base/mainnet/ngn-usd",
    pair: "NGN/USD",
    priceNgnPerUsd: invertNgnUsdToNgnPerUsd(answer, decimals),
    updatedAt: updatedAt > 0 ? updatedAt : null,
  };
}
