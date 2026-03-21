import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, encodeAbiParameters, getAddress, http, zeroHash } from "viem";
import type {
  MatchingBackendCreateOrderRequest,
  PreparedConvexPerpOrder,
} from "@/lib/trading.types";

const DEFAULT_MATCHING_CHAIN_ID = 8453;
const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const DEFAULT_ORDER_EXPIRY_SECONDS = 60 * 60;
const DEFAULT_MARKET_ORDER_SLIPPAGE_BPS = 500;
const DECIMAL_STRING_PATTERN = /^\d+(\.\d+)?$/;

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

function getMatchingChainId() {
  return Number(process.env.MATCHING_CHAIN_ID?.trim() || DEFAULT_MATCHING_CHAIN_ID);
}

function resolveJsonFile(candidatePath: string) {
  const resolvedPath = path.resolve(process.cwd(), candidatePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing deployment file: ${resolvedPath}`);
  }

  return JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, string>;
}

function resolveMatchingAddresses() {
  const chainId = getMatchingChainId();
  const matchingDeployment = resolveJsonFile(`../options/matching/deployments/${chainId}/matching.json`);
  const exchangeDeployment = resolveJsonFile(`../exchange-core/deployments/${chainId}/BTC_SQUARED.json`);

  return {
    assetAddress: getAddress(
      process.env.BTC_PERP_ASSET_ADDRESS?.trim() || exchangeDeployment.perp || "",
    ),
    chainId,
    matchingAddress: getAddress(
      process.env.MATCHING_ADDRESS?.trim() || matchingDeployment.matching || "",
    ),
    tradeModuleAddress: getAddress(
      process.env.TRADE_MODULE_ADDRESS?.trim() || matchingDeployment.trade || "",
    ),
  };
}

function decimalToScaledInteger(value: string, decimals: number) {
  const normalizedValue = value.trim();

  if (!DECIMAL_STRING_PATTERN.test(normalizedValue)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [whole, fraction = ""] = normalizedValue.split(".");
  const paddedFraction = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
}

function formatAggressiveLimitPrice(markPrice: string, side: "buy" | "sell") {
  const [whole, fraction = ""] = markPrice.split(".");
  const scaledMarkPrice = decimalToScaledInteger(`${whole}.${fraction}`, 2);
  const slippageBps = BigInt(process.env.MATCHING_MARKET_ORDER_SLIPPAGE_BPS?.trim() || DEFAULT_MARKET_ORDER_SLIPPAGE_BPS);
  const numerator = side === "buy" ? 10_000n + slippageBps : 10_000n - slippageBps;
  const scaledAggressivePrice = (scaledMarkPrice * numerator) / 10_000n;
  const outputWhole = scaledAggressivePrice / 100n;
  const outputFraction = (scaledAggressivePrice % 100n).toString().padStart(2, "0");

  return `${outputWhole}.${outputFraction}`;
}

async function findSubaccountId(ownerAddress: `0x${string}`, matchingAddress: `0x${string}`) {
  const publicClient = createPublicClient({
    transport: http(getBaseMainnetRpcUrl()),
  });

  const subAccountsAddress = getAddress(
    (await publicClient.readContract({
      abi: [
        {
          inputs: [],
          name: "subAccounts",
          outputs: [{ type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      address: matchingAddress,
      functionName: "subAccounts",
    })) as string,
  );
  const lastAccountId = (await publicClient.readContract({
    abi: [
      {
        inputs: [],
        name: "lastAccountId",
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    address: subAccountsAddress,
    functionName: "lastAccountId",
  })) as bigint;

  for (let accountId = 1n; accountId <= lastAccountId; accountId += 1n) {
    const depositedOwner = getAddress(
      (await publicClient.readContract({
        abi: [
          {
            inputs: [{ type: "uint256" }],
            name: "subAccountToOwner",
            outputs: [{ type: "address" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        address: matchingAddress,
        functionName: "subAccountToOwner",
        args: [accountId],
      })) as string,
    );

    if (depositedOwner.toLowerCase() === ownerAddress.toLowerCase()) {
      return accountId;
    }
  }

  throw new Error("No deposited matching subaccount found for this wallet");
}

async function findNextTradeNonce(
  ownerAddress: `0x${string}`,
  tradeModuleAddress: `0x${string}`,
) {
  const publicClient = createPublicClient({
    transport: http(getBaseMainnetRpcUrl()),
  });

  const initialNonce = BigInt(Date.now());

  for (let nonce = initialNonce; nonce < initialNonce + 512n; nonce += 1n) {
    const storedHash = (await publicClient.readContract({
      abi: [
        {
          inputs: [
            { type: "address" },
            { type: "uint256" },
          ],
          name: "seenNonces",
          outputs: [{ type: "bytes32" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      address: tradeModuleAddress,
      functionName: "seenNonces",
      args: [ownerAddress, nonce],
    })) as `0x${string}`;

    if (storedHash === zeroHash) {
      return nonce;
    }
  }

  throw new Error("Could not find an unused trade nonce for this wallet");
}

export async function prepareBtcConvexOrder({
  markPrice,
  ownerAddress,
  side,
  sizeBtc,
}: {
  markPrice: string;
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
}): Promise<PreparedConvexPerpOrder> {
  const signerAddress = getAddress(ownerAddress);
  const { assetAddress, chainId, matchingAddress, tradeModuleAddress } = resolveMatchingAddresses();
  const subaccountId = await findSubaccountId(signerAddress, matchingAddress);
  const nonce = await findNextTradeNonce(signerAddress, tradeModuleAddress);
  const recipientId = subaccountId;
  const limitPriceDisplay = formatAggressiveLimitPrice(markPrice, side);
  const limitPrice = decimalToScaledInteger(limitPriceDisplay, 18);
  const desiredAmount = decimalToScaledInteger(sizeBtc, 8);
  const expiry =
    BigInt(Math.floor(Date.now() / 1000)) +
    BigInt(process.env.MATCHING_ORDER_EXPIRY_SECONDS?.trim() || DEFAULT_ORDER_EXPIRY_SECONDS);
  const actionData = encodeAbiParameters(
    [
      {
        components: [
          { name: "asset", type: "address" },
          { name: "subId", type: "uint256" },
          { name: "limitPrice", type: "int256" },
          { name: "desiredAmount", type: "int256" },
          { name: "worstFee", type: "uint256" },
          { name: "recipientId", type: "uint256" },
          { name: "isBid", type: "bool" },
        ],
        type: "tuple",
      },
    ],
    [
      {
        asset: assetAddress,
        desiredAmount,
        isBid: side === "buy",
        limitPrice,
        recipientId,
        subId: 0n,
        worstFee: 0n,
      },
    ],
  );
  const order = {
    action_json: {
      data: actionData,
      expiry: expiry.toString(),
      module: tradeModuleAddress,
      nonce: nonce.toString(),
      owner: signerAddress,
      signer: signerAddress,
      subaccount_id: subaccountId.toString(),
    },
    asset_address: assetAddress,
    desired_amount: desiredAmount.toString(),
    expiry: Number(expiry),
    filled_amount: "0",
    limit_price: limitPrice.toString(),
    nonce: nonce.toString(),
    order_id: `archer-${Date.now()}-${nonce.toString()}`,
    owner_address: signerAddress,
    recipient_id: recipientId.toString(),
    side,
    signer_address: signerAddress,
    sub_id: "0",
    subaccount_id: subaccountId.toString(),
    worst_fee: "0",
  } satisfies Omit<MatchingBackendCreateOrderRequest, "signature">;

  return {
    limitPriceDisplay,
    order,
    typedData: {
      domain: {
        chainId,
        name: "Matching",
        verifyingContract: matchingAddress,
        version: "1.0",
      },
      message: {
        data: actionData,
        expiry: expiry.toString(),
        module: tradeModuleAddress,
        nonce: nonce.toString(),
        owner: signerAddress,
        signer: signerAddress,
        subaccountId: subaccountId.toString(),
      },
      primaryType: "Action",
      types: {
        Action: [
          { name: "subaccountId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "module", type: "address" },
          { name: "data", type: "bytes" },
          { name: "expiry", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "signer", type: "address" },
        ],
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
    },
  };
}
