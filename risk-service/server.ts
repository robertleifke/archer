import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, formatUnits, getAddress, http } from "viem";

const DEFAULT_PORT = 8083;
const DEFAULT_MATCHING_CHAIN_ID = 8453;
const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const SUBACCOUNT_CACHE_TTL_MS = 60_000;
const UNIT = 1_000_000_000_000_000_000n;

type BtcConvexAccountSnapshot = {
  cashBalanceUsd: number;
  cashBalanceUsdDisplay: string;
  ownerAddress: string;
  subaccountId: string;
};

type BtcConvexRiskSnapshot = {
  account: BtcConvexAccountSnapshot;
  currentInitialMarginUsd: number;
  currentInitialMarginUsdDisplay: string;
  currentMaintenanceMarginUsd: number;
  currentMaintenanceMarginUsdDisplay: string;
  deltaNotionalUsd: number;
  freeCollateralUsd: number;
  freeCollateralUsdDisplay: string;
  marginModel: "squared_perp_manager_v1";
  orderAllowed: boolean;
  postTradeFreeCollateralUsd: number;
  postTradeFreeCollateralUsdDisplay: string;
  postTradeInitialMarginUsd: number;
  postTradeInitialMarginUsdDisplay: string;
};

type CachedSubaccount = {
  expiresAt: number;
  subaccountId: bigint;
};

type AccountBalance = {
  asset: `0x${string}`;
  balance: bigint;
  subId: bigint;
};

type PerpRiskParams = {
  initialMarginRatio: bigint;
  initialMaxLeverage: bigint;
  initialSpotShockDown: bigint;
  initialSpotShockUp: bigint;
  isSquared: boolean;
  isWhitelisted: boolean;
  maintenanceMarginRatio: bigint;
  maintenanceMaxLeverage: bigint;
  maintenanceSpotShockDown: bigint;
  maintenanceSpotShockUp: bigint;
};

type PositionRiskState = {
  currentInitialRequirement: bigint;
  currentMaintenanceRequirement: bigint;
  currentUnrealizedPnl: bigint;
  postTradeInitialRequirement: bigint;
  postTradeMaintenanceRequirement: bigint;
  postTradeUnrealizedPnl: bigint;
};

const subaccountIdCache = new Map<string, CachedSubaccount>();

const MATCHING_ABI = [
  {
    inputs: [],
    name: "subAccounts",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }],
    name: "subAccountToOwner",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const SUB_ACCOUNTS_ABI = [
  {
    inputs: [],
    name: "lastAccountId",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ type: "uint256" }],
    name: "getAccountBalances",
    outputs: [
      {
        components: [
          { name: "asset", type: "address" },
          { name: "subId", type: "uint256" },
          { name: "balance", type: "int256" },
        ],
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
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
] as const;

const PERP_ASSET_ABI = [
  {
    inputs: [{ type: "uint256" }],
    name: "getUnsettledAndUnrealizedCash",
    outputs: [{ type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getIndexPrice",
    outputs: [
      { type: "uint256" },
      { type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPerpPrice",
    outputs: [
      { type: "uint256" },
      { type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "spotFeed",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const SPOT_FEED_ABI = [
  {
    inputs: [],
    name: "getSpot",
    outputs: [
      { type: "uint256" },
      { type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const MANAGER_ABI = [
  {
    inputs: [{ type: "address" }],
    name: "perpRiskParams",
    outputs: [
      { type: "bool" },
      { type: "bool" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

function getPort() {
  return Number(process.env.RISK_SERVICE_PORT?.trim() || DEFAULT_PORT);
}

function getBaseMainnetRpcUrl() {
  return process.env.BASE_RPC_URL?.trim() || DEFAULT_BASE_MAINNET_RPC_URL;
}

function getMatchingChainId() {
  return Number(process.env.MATCHING_CHAIN_ID?.trim() || DEFAULT_MATCHING_CHAIN_ID);
}

function absBigInt(value: bigint) {
  return value < 0n ? -value : value;
}

function divideDecimal(value: bigint, divisor: bigint) {
  if (divisor === 0n) {
    return 0n;
  }

  return (value * UNIT) / divisor;
}

function formatScaledUsd(value: bigint) {
  return Number(formatUnits(value, 18));
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatUsdFromScaled(value: bigint) {
  return formatUsd(formatScaledUsd(value));
}

function multiplySignedDecimal(left: bigint, right: bigint) {
  return (left * right) / UNIT;
}

function multiplyUnsignedDecimal(left: bigint, right: bigint) {
  return (left * right) / UNIT;
}

function parseDecimalToScaledInteger(value: string, decimals: number) {
  const normalizedValue = value.trim();

  if (!DECIMAL_PATTERN.test(normalizedValue)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [whole, fraction = ""] = normalizedValue.split(".");
  const paddedFraction = `${fraction}${"0".repeat(decimals)}`.slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`);
}

function resolveJsonFile(candidatePath: string) {
  const resolvedPath = path.resolve(process.cwd(), candidatePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing deployment file: ${resolvedPath}`);
  }

  return JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, string>;
}

function resolveAddresses() {
  const chainId = getMatchingChainId();
  const matchingDeployment = resolveJsonFile(`../options/matching/deployments/${chainId}/matching.json`);
  const coreDeployment = resolveJsonFile(`../exchange-core/deployments/${chainId}/core.json`);
  const btcSquaredDeployment = resolveJsonFile(`../exchange-core/deployments/${chainId}/BTC_SQUARED.json`);

  return {
    btcConvexPerpAddress: getAddress(btcSquaredDeployment.perp || ""),
    cashAddress: getAddress(coreDeployment.cash || ""),
    managerAddress: getAddress(btcSquaredDeployment.manager || ""),
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

function getRequirement({
  currentMark,
  isInitial,
  params,
  position,
  shockedPriceDown,
  shockedPriceUp,
}: {
  currentMark: bigint;
  isInitial: boolean;
  params: PerpRiskParams;
  position: bigint;
  shockedPriceDown: bigint;
  shockedPriceUp: bigint;
}) {
  if (position === 0n) {
    return 0n;
  }

  const notional = multiplyUnsignedDecimal(absBigInt(position), currentMark);
  const ratioRequirement = multiplyUnsignedDecimal(
    notional,
    isInitial ? params.initialMarginRatio : params.maintenanceMarginRatio,
  );
  const leverageRequirement = divideDecimal(
    notional,
    isInitial ? params.initialMaxLeverage : params.maintenanceMaxLeverage,
  );
  const scenarioLoss = getScenarioLoss({
    currentMark,
    position,
    shockedPriceDown,
    shockedPriceUp,
  });

  return [ratioRequirement, leverageRequirement, scenarioLoss].reduce((largest, nextValue) => {
    return nextValue > largest ? nextValue : largest;
  }, 0n);
}

function getScenarioLoss({
  currentMark,
  position,
  shockedPriceDown,
  shockedPriceUp,
}: {
  currentMark: bigint;
  position: bigint;
  shockedPriceDown: bigint;
  shockedPriceUp: bigint;
}) {
  return [shockedPriceDown, shockedPriceUp].reduce((largest, shockedPrice) => {
    const pnl = multiplySignedDecimal(shockedPrice - currentMark, position);
    const loss = pnl < 0n ? -pnl : 0n;

    return loss > largest ? loss : largest;
  }, 0n);
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
      abi: MATCHING_ABI,
      address: matchingAddress,
      functionName: "subAccounts",
    })) as string,
  );
  const lastAccountId = (await publicClient.readContract({
    abi: SUB_ACCOUNTS_ABI,
    address: subAccountsAddress,
    functionName: "lastAccountId",
  })) as bigint;

  for (let accountId = 1n; accountId <= lastAccountId; accountId += 1n) {
    const depositedOwner = getAddress(
      (await publicClient.readContract({
        abi: MATCHING_ABI,
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

async function getAccountBalances(subaccountId: bigint) {
  const { subAccountsAddress } = resolveAddresses();
  const publicClient = getPublicClient();

  return (await publicClient.readContract({
    abi: SUB_ACCOUNTS_ABI,
    address: subAccountsAddress,
    functionName: "getAccountBalances",
    args: [subaccountId],
  })) as AccountBalance[];
}

async function getPerpRiskParams(perpAddress: `0x${string}`): Promise<PerpRiskParams> {
  const { managerAddress } = resolveAddresses();
  const publicClient = getPublicClient();
  const result = (await publicClient.readContract({
    abi: MANAGER_ABI,
    address: managerAddress,
    functionName: "perpRiskParams",
    args: [perpAddress],
  })) as readonly [
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return {
    initialMarginRatio: result[2],
    initialMaxLeverage: result[4],
    initialSpotShockDown: result[7],
    initialSpotShockUp: result[6],
    isSquared: result[1],
    isWhitelisted: result[0],
    maintenanceMarginRatio: result[3],
    maintenanceMaxLeverage: result[5],
    maintenanceSpotShockDown: result[9],
    maintenanceSpotShockUp: result[8],
  };
}

async function getShockedPrices(perpAddress: `0x${string}`, params: PerpRiskParams, isInitial: boolean) {
  const publicClient = getPublicClient();
  const currentMark = await getCurrentMarkPrice(perpAddress);

  const shockUp = isInitial ? params.initialSpotShockUp : params.maintenanceSpotShockUp;
  const shockDown = isInitial ? params.initialSpotShockDown : params.maintenanceSpotShockDown;

  if (params.isSquared) {
    const spotFeedAddress = getAddress(
      (await publicClient.readContract({
        abi: PERP_ASSET_ABI,
        address: perpAddress,
        functionName: "spotFeed",
      })) as string,
    );
    const [spotPrice] = (await publicClient.readContract({
      abi: SPOT_FEED_ABI,
      address: spotFeedAddress,
      functionName: "getSpot",
    })) as readonly [bigint, bigint];
    const shockedUnderlyingUp = multiplyUnsignedDecimal(spotPrice, UNIT + shockUp);
    const shockedUnderlyingDown = multiplyUnsignedDecimal(spotPrice, UNIT - shockDown);

    return {
      currentMark,
      shockedPriceDown: multiplyUnsignedDecimal(shockedUnderlyingDown, shockedUnderlyingDown),
      shockedPriceUp: multiplyUnsignedDecimal(shockedUnderlyingUp, shockedUnderlyingUp),
    };
  }

  const [indexPrice] = (await publicClient.readContract({
    abi: PERP_ASSET_ABI,
    address: perpAddress,
    functionName: "getIndexPrice",
  })) as readonly [bigint, bigint];

  return {
    currentMark,
    shockedPriceDown: multiplyUnsignedDecimal(indexPrice, UNIT - shockDown),
    shockedPriceUp: multiplyUnsignedDecimal(indexPrice, UNIT + shockUp),
  };
}

async function getCurrentMarkPrice(perpAddress: `0x${string}`) {
  const publicClient = getPublicClient();

  try {
    const [currentMark] = (await publicClient.readContract({
      abi: PERP_ASSET_ABI,
      address: perpAddress,
      functionName: "getPerpPrice",
    })) as readonly [bigint, bigint];

    return currentMark;
  } catch {
    const [indexPrice] = (await publicClient.readContract({
      abi: PERP_ASSET_ABI,
      address: perpAddress,
      functionName: "getIndexPrice",
    })) as readonly [bigint, bigint];

    return indexPrice;
  }
}

async function getPositionRiskState({
  currentPosition,
  perpAddress,
  postTradePosition,
  subaccountId,
}: {
  currentPosition: bigint;
  perpAddress: `0x${string}`;
  postTradePosition: bigint;
  subaccountId: bigint;
}): Promise<PositionRiskState> {
  const publicClient = getPublicClient();
  const params = await getPerpRiskParams(perpAddress);

  if (!params.isWhitelisted) {
    throw new Error(`Unsupported asset in convex risk service: ${perpAddress}`);
  }

  const currentUnrealizedPnl = (await publicClient.readContract({
    abi: PERP_ASSET_ABI,
    address: perpAddress,
    functionName: "getUnsettledAndUnrealizedCash",
    args: [subaccountId],
  })) as bigint;
  const currentShocks = await getShockedPrices(perpAddress, params, true);
  const maintenanceShocks = await getShockedPrices(perpAddress, params, false);

  return {
    currentInitialRequirement: getRequirement({
      currentMark: currentShocks.currentMark,
      isInitial: true,
      params,
      position: currentPosition,
      shockedPriceDown: currentShocks.shockedPriceDown,
      shockedPriceUp: currentShocks.shockedPriceUp,
    }),
    currentMaintenanceRequirement: getRequirement({
      currentMark: maintenanceShocks.currentMark,
      isInitial: false,
      params,
      position: currentPosition,
      shockedPriceDown: maintenanceShocks.shockedPriceDown,
      shockedPriceUp: maintenanceShocks.shockedPriceUp,
    }),
    currentUnrealizedPnl,
    postTradeInitialRequirement: getRequirement({
      currentMark: currentShocks.currentMark,
      isInitial: true,
      params,
      position: postTradePosition,
      shockedPriceDown: currentShocks.shockedPriceDown,
      shockedPriceUp: currentShocks.shockedPriceUp,
    }),
    postTradeMaintenanceRequirement: getRequirement({
      currentMark: maintenanceShocks.currentMark,
      isInitial: false,
      params,
      position: postTradePosition,
      shockedPriceDown: maintenanceShocks.shockedPriceDown,
      shockedPriceUp: maintenanceShocks.shockedPriceUp,
    }),
    postTradeUnrealizedPnl: currentUnrealizedPnl,
  };
}

async function getAccountSnapshot(ownerAddress: string): Promise<BtcConvexAccountSnapshot> {
  const normalizedOwnerAddress = getAddress(ownerAddress);
  const { cashAddress, matchingAddress, subAccountsAddress } = resolveAddresses();
  const publicClient = getPublicClient();
  const subaccountId = await findSubaccountId(normalizedOwnerAddress, matchingAddress);
  const cashBalance = (await publicClient.readContract({
    abi: SUB_ACCOUNTS_ABI,
    address: subAccountsAddress,
    functionName: "getBalance",
    args: [subaccountId, cashAddress, 0n],
  })) as bigint;
  const cashBalanceUsd = Number(formatUnits(cashBalance, 18));

  return {
    cashBalanceUsd,
    cashBalanceUsdDisplay: formatUsd(cashBalanceUsd),
    ownerAddress: normalizedOwnerAddress,
    subaccountId: subaccountId.toString(),
  };
}

async function buildRiskSnapshot({
  ownerAddress,
  side,
  sizeBtc,
}: {
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
}): Promise<BtcConvexRiskSnapshot> {
  const normalizedOwnerAddress = getAddress(ownerAddress);
  const { btcConvexPerpAddress, cashAddress, matchingAddress } = resolveAddresses();
  const subaccountId = await findSubaccountId(normalizedOwnerAddress, matchingAddress);
  const balances = await getAccountBalances(subaccountId);
  const account = await getAccountSnapshot(normalizedOwnerAddress);
  const signedTradeDelta = parseDecimalToScaledInteger(sizeBtc, 8) * (side === "buy" ? 1n : -1n);
  let cashBalance = 0n;
  let currentInitialMarginRequirement = 0n;
  let currentMaintenanceMarginRequirement = 0n;
  let currentMarkToMarket = 0n;
  let postTradeInitialMarginRequirement = 0n;
  let postTradeMarkToMarket = 0n;
  let deltaNotionalUsd = 0n;

  for (const balance of balances) {
    if (balance.asset.toLowerCase() === cashAddress.toLowerCase()) {
      cashBalance += balance.balance;
      continue;
    }

    const positionRisk = await getPositionRiskState({
      currentPosition: balance.balance,
      perpAddress: balance.asset,
      postTradePosition:
        balance.asset.toLowerCase() === btcConvexPerpAddress.toLowerCase()
          ? balance.balance + signedTradeDelta
          : balance.balance,
      subaccountId,
    });

    currentInitialMarginRequirement += positionRisk.currentInitialRequirement;
    currentMaintenanceMarginRequirement += positionRisk.currentMaintenanceRequirement;
    currentMarkToMarket += positionRisk.currentUnrealizedPnl;
    postTradeInitialMarginRequirement += positionRisk.postTradeInitialRequirement;
    postTradeMarkToMarket += positionRisk.postTradeUnrealizedPnl;

    if (balance.asset.toLowerCase() === btcConvexPerpAddress.toLowerCase()) {
      deltaNotionalUsd = multiplyUnsignedDecimal(
        absBigInt(signedTradeDelta),
        await getCurrentMarkPrice(btcConvexPerpAddress),
      );
    }
  }

  if (deltaNotionalUsd === 0n) {
    deltaNotionalUsd = multiplyUnsignedDecimal(
      absBigInt(signedTradeDelta),
      await getCurrentMarkPrice(btcConvexPerpAddress),
    );
  }

  const currentEquity = cashBalance + currentMarkToMarket;
  const postTradeEquity = cashBalance + postTradeMarkToMarket;
  const freeCollateral = currentEquity - currentInitialMarginRequirement;
  const postTradeFreeCollateral = postTradeEquity - postTradeInitialMarginRequirement;

  return {
    account,
    currentInitialMarginUsd: formatScaledUsd(currentInitialMarginRequirement),
    currentInitialMarginUsdDisplay: formatUsdFromScaled(currentInitialMarginRequirement),
    currentMaintenanceMarginUsd: formatScaledUsd(currentMaintenanceMarginRequirement),
    currentMaintenanceMarginUsdDisplay: formatUsdFromScaled(currentMaintenanceMarginRequirement),
    deltaNotionalUsd: formatScaledUsd(deltaNotionalUsd),
    freeCollateralUsd: formatScaledUsd(freeCollateral),
    freeCollateralUsdDisplay: formatUsdFromScaled(freeCollateral),
    marginModel: "squared_perp_manager_v1",
    orderAllowed: postTradeFreeCollateral >= 0n,
    postTradeFreeCollateralUsd: formatScaledUsd(postTradeFreeCollateral),
    postTradeFreeCollateralUsdDisplay: formatUsdFromScaled(postTradeFreeCollateral),
    postTradeInitialMarginUsd: formatScaledUsd(postTradeInitialMarginRequirement),
    postTradeInitialMarginUsdDisplay: formatUsdFromScaled(postTradeInitialMarginRequirement),
  };
}

function writeJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      writeJson(response, 400, { error: "Missing request URL" });
      return;
    }

    const url = new URL(request.url, `http://127.0.0.1:${getPort()}`);

    if (request.method === "GET" && url.pathname === "/healthz") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/v1/btcusdc-cvxperp/risk") {
      const ownerAddress = url.searchParams.get("ownerAddress");
      const side = url.searchParams.get("side");
      const sizeBtc = url.searchParams.get("sizeBtc");

      if (!ownerAddress || (side !== "buy" && side !== "sell") || !sizeBtc || !DECIMAL_PATTERN.test(sizeBtc)) {
        writeJson(response, 400, { error: "Invalid convex perp risk preview query" });
        return;
      }

      writeJson(
        response,
        200,
        await buildRiskSnapshot({
          ownerAddress,
          side,
          sizeBtc,
        }),
      );
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  } catch (error) {
    writeJson(response, 502, {
      error: error instanceof Error ? error.message : "Unknown risk service error",
    });
  }
});

server.listen(getPort(), () => {
  console.log(`risk-service listening on :${getPort()}`);
});
