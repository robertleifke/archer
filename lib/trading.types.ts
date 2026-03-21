import type { ReactNode } from "react";

export type MarketStat = {
  label: string;
  tone?: "accent" | "negative" | "positive" | "neutral";
  value: string;
};

export type ChartDisplayMode = "BTC Spot" | "Variance" | "Vol";

export type PriceSemantics = "price" | "variance";

export type DisplaySemantics = "price" | "volatility";

export type MarketSemantics = {
  defaultChartMode?: ChartDisplayMode;
  displayName: string;
  displaySemantics: DisplaySemantics;
  infoHint: string;
  marketTag?: string;
  priceSemantics: PriceSemantics;
  shortDisplayName: string;
  tickSize?: number;
};

export type Candle = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: string;
  volume: number;
};

export type OrderBookLevel = {
  convexUnits?: number;
  deltaEquivalent?: number;
  distanceBps?: number;
  gammaPer1PctMove?: number;
  price: number;
  riskAdjustedSize?: number;
  size: number;
  total: number;
};

export type OrderBookDisplayMode = "convex" | "delta" | "price";

export type ConvexSizingMode = "convex" | "delta" | "notional";

export type ConvexScenario = {
  changeLabel: string;
  displayValue?: string;
  pnlUsd: number;
  spotPrice: number;
};

export type ConvexExposureMetrics = {
  breakEvenMovePercent: number;
  convexNotionalUsd: number;
  convexityExposurePer1PctSquared: number;
  convexUnits: number;
  deltaNotionalUsd: number;
  deltaEquivalentBtc: number;
  entryReferencePrice: number;
  estimatedFundingUsd8h: number;
  gammaPer1PctMove: number;
  gammaPer1kMove: number;
  markVariance: number;
  markPrice: number;
  markVolPercent: number;
  pnlUsd: number;
  referenceVariance: number;
  referenceVolPercent: number;
  scenarioPnl: ConvexScenario[];
  side: "buy" | "sell";
  varianceExposurePerPoint01Usd: number;
  volExposurePerPointUsd: number;
};

export type ConvexRiskModel = {
  convexityRisk: number;
  fundingRateBps: number;
  inventorySkew: number;
  ladderType: "nonlinear";
  realizedVol: number;
  spreadBps: number;
  topLevelSizeFactor: number;
};

export type ContractPresentation = {
  displayMode?: OrderBookDisplayMode;
  semantics?: MarketSemantics;
  nonlinearLadderLabel?: string;
  riskModel?: ConvexRiskModel;
  sizingModes?: ConvexSizingMode[];
  variant: "convex" | "linear";
};

export type TradePrint = {
  price: number;
  side: "buy" | "sell";
  size: number;
  time: string;
};

export type ActivityTab = {
  id: string;
  label: string;
};

export type ChartTool = {
  id: string;
  label: string;
};

export type ContractTab = {
  active?: boolean;
  label: string;
};

export type MarketOption = {
  contractLabel?: string;
  displayName?: string;
  frontMonth: string;
  id: string;
  lastPrice: string;
  marketType: "Futures";
  region: "Crypto" | "FX";
  semantics?: MarketSemantics;
  subtitle?: string;
  symbol: string;
};

export type DeliveryTerm = {
  label: string;
  value: string;
};

export type ContractMarket = {
  basis: string;
  candles: Candle[];
  contractDetails: DeliveryTerm[];
  id: string;
  index: string;
  infoBar: MarketStat[];
  mark: string;
  orderBookAsks: OrderBookLevel[];
  orderBookBids: OrderBookLevel[];
  presentation?: ContractPresentation;
  positionOverview: DeliveryTerm[];
  ticker: string;
  timeToExpiry: string;
  trades: TradePrint[];
};

export type ActivityRow = {
  cells: ReactNode[];
  positiveCellIndexes?: number[];
};

export type ActivityView = {
  columns: string[];
  rows: ActivityRow[];
};

export type BtcConvexPerpSnapshot = {
  confidence: number;
  contractAddress: string;
  display_name: string;
  display_semantics: DisplaySemantics;
  displayIndexVolPct: number;
  displayMarkVolPct: number;
  fallbackUsed: boolean;
  indexVariance: number;
  markSource: "index_fallback" | "perp";
  markVariance: number;
  pair: "BTCVAR30-PERP";
  price_semantics: PriceSemantics;
  short_display_name: string;
  tick_size: number;
};

export type MatchingBackendOrderBookSnapshot = {
  asks: OrderBookLevel[];
  assetAddress: string;
  bids: OrderBookLevel[];
  market: string;
  source: "matching-backend";
  subId: string;
  updatedAt: string;
};

export type MatchingBackendActionPayload = {
  data: string;
  expiry: string;
  module: string;
  nonce: string;
  owner: string;
  signer: string;
  subaccount_id: string;
};

export type MatchingBackendCreateOrderRequest = {
  action_json: MatchingBackendActionPayload;
  asset_address: string;
  desired_amount: string;
  expiry: number;
  filled_amount: string;
  limit_price: string;
  nonce: string;
  order_id: string;
  owner_address: string;
  recipient_id: string;
  side: "buy" | "sell";
  signature: string;
  signer_address: string;
  sub_id: string;
  subaccount_id: string;
  worst_fee: string;
};

export type PreparedConvexPerpOrder = {
  limitPriceDisplay: string;
  order: Omit<MatchingBackendCreateOrderRequest, "signature">;
  typedData: {
    domain: {
      chainId: number;
      name: "Matching";
      verifyingContract: string;
      version: "1.0";
    };
    message: {
      data: string;
      expiry: string;
      module: string;
      nonce: string;
      owner: string;
      signer: string;
      subaccountId: string;
    };
    primaryType: "Action";
    types: {
      Action: { name: string; type: string }[];
      EIP712Domain: { name: string; type: string }[];
    };
  };
};

export type ConvexPerpOrderSubmission = {
  accepted: boolean;
  backend: unknown;
  orderId: string;
  receivedAt: string;
  signer: string;
};

export type ConvexPerpOrderCancellation = {
  accepted: boolean;
  backend: unknown;
  cancelledAt: string;
  nonce: string;
  ownerAddress: string;
};

export type ManagedConvexOrder = {
  limitPriceVariance: number;
  nonce: string;
  orderId: string;
  ownerAddress: string;
  side: "buy" | "sell";
  sizeBtc: string;
  submittedAt: string;
};

export type BtcConvexAccountSnapshot = {
  cashBalanceUsd: number;
  cashBalanceUsdDisplay: string;
  ownerAddress: string;
  subaccountId: string;
};

export type BtcConvexRiskSnapshot = {
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

export type NgnUsdSpotSnapshot = {
  confidence: number;
  contractAddress: string;
  feedUrl: string;
  pair: "NGN/USD";
  priceNgnPerUsd: number;
  updatedAt: number | null;
};
