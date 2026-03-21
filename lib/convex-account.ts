import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, formatUnits, getAddress, http } from "viem";
import type { BtcConvexAccountSnapshot } from "@/lib/trading.types";

const DEFAULT_MATCHING_CHAIN_ID = 8453;
const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const SUBACCOUNT_CACHE_TTL_MS = 60_000;

type CachedSubaccount = {
  expiresAt: number;
  subaccountId: bigint;
};

const subaccountIdCache = new Map<string, CachedSubaccount>();

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

function resolveAccountAddresses() {
  const chainId = getMatchingChainId();
  const matchingDeployment = resolveJsonFile(`../options/matching/deployments/${chainId}/matching.json`);
  const coreDeployment = resolveJsonFile(`../exchange-core/deployments/${chainId}/core.json`);

  return {
    cashAddress: getAddress(coreDeployment.cash || ""),
    matchingAddress: getAddress(
      process.env.MATCHING_ADDRESS?.trim() || matchingDeployment.matching || "",
    ),
    subAccountsAddress: getAddress(coreDeployment.subAccounts || ""),
  };
}

function getPublicClient() {
  return createPublicClient({
    transport: http(getBaseMainnetRpcUrl()),
  });
}

async function findSubaccountId(ownerAddress: `0x${string}`, matchingAddress: `0x${string}`) {
  const cacheKey = `${matchingAddress.toLowerCase()}:${ownerAddress.toLowerCase()}`;
  const cached = subaccountIdCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.subaccountId;
  }

  const publicClient = getPublicClient();
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
      subaccountIdCache.set(cacheKey, {
        expiresAt: Date.now() + SUBACCOUNT_CACHE_TTL_MS,
        subaccountId: accountId,
      });

      return accountId;
    }
  }

  throw new Error("No deposited matching subaccount found for this wallet");
}

export async function getBtcConvexAccountSnapshot(ownerAddress: string): Promise<BtcConvexAccountSnapshot> {
  const normalizedOwnerAddress = getAddress(ownerAddress);
  const { cashAddress, matchingAddress, subAccountsAddress } = resolveAccountAddresses();
  const publicClient = getPublicClient();
  const subaccountId = await findSubaccountId(normalizedOwnerAddress, matchingAddress);
  const cashBalance = (await publicClient.readContract({
    abi: [
      {
        inputs: [
          { type: "uint256" },
          { type: "address" },
          { type: "uint256" },
        ],
        name: "getBalance",
        outputs: [{ type: "int256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    address: subAccountsAddress,
    functionName: "getBalance",
    args: [subaccountId, cashAddress, 0n],
  })) as bigint;

  const cashBalanceUsd = Number(formatUnits(cashBalance, 18));

  return {
    cashBalanceUsd,
    cashBalanceUsdDisplay: cashBalanceUsd.toLocaleString("en-US", {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }),
    ownerAddress: normalizedOwnerAddress,
    subaccountId: subaccountId.toString(),
  };
}
