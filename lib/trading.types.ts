export type MarketStat = {
  label: string;
  tone?: "accent" | "negative" | "positive" | "neutral";
  value: string;
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
  price: number;
  riskAdjustedSize?: number;
  size: number;
  total: number;
};

export type OrderBookDisplayMode = "convex" | "delta" | "price";

export type ConvexSizingMode = "convex" | "delta" | "notional";

export type ConvexExposureMetrics = {
  convexNotionalUsd: number;
  convexityExposurePer1PctSquared: number;
  convexUnits: number;
  deltaEquivalentBtc: number;
  entryReferencePrice: number;
  gammaPer1kMove: number;
  markPrice: number;
  pnlUsd: number;
  side: "buy" | "sell";
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
  frontMonth: string;
  id: string;
  lastPrice: string;
  marketType: "Futures";
  region: "Crypto" | "FX";
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
  cells: string[];
  positiveCellIndexes?: number[];
};

export type ActivityView = {
  columns: string[];
  rows: ActivityRow[];
};

export type BtcSquaredPerpSnapshot = {
  confidence: number;
  contractAddress: string;
  displayIndexBtcUsd: number;
  displayMarkBtcUsd: number;
  fallbackUsed: boolean;
  indexSquaredUsd: number;
  markSquaredUsd: number;
  markSource: "index_fallback" | "perp";
  pair: "BTCUSDC-CVXPERP";
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
