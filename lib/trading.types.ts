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
  price: number;
  size: number;
  total: number;
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
  pair: "BTCUSDC-SQPERP";
};

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

export type NgnUsdSpotSnapshot = {
  confidence: number;
  contractAddress: string;
  feedUrl: string;
  pair: "NGN/USD";
  priceNgnPerUsd: number;
  updatedAt: number | null;
};
