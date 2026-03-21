import {
  ArrowRightLeft,
  Brush,
  ChartCandlestick,
  Crosshair,
  Eraser,
  Highlighter,
  Minus,
  PenLine,
  Ruler,
  Search,
  SquareDashedMousePointer,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buildConvexExposureMetrics, generateNonlinearConvexOrderBook } from "@/lib/convex-perp";
import {
  formatVariancePrice,
  formatVolPercentFromVariance,
  getBtcVar30DisplayFields,
  getBtcVar30Semantics,
  varianceToVolPercent,
  volPercentToVariance,
} from "@/lib/btcvar30-display";
import type {
  ActivityTab,
  ActivityView,
  Candle,
  ChartDisplayMode,
  ChartTool,
  ContractMarket,
  ContractTab,
  MarketOption,
  TradePrint,
} from "@/lib/trading.types";

const BASE_VOL_CANDLES = [
  [49.8, 50.6, 49.4, 50.1, 220],
  [50.1, 51.0, 49.9, 50.8, 245],
  [50.8, 51.6, 50.5, 51.2, 260],
  [51.2, 52.1, 50.9, 51.9, 272],
  [51.9, 52.4, 51.3, 51.5, 255],
  [51.5, 52.8, 51.1, 52.2, 249],
  [52.2, 53.1, 51.8, 52.7, 281],
  [52.7, 53.8, 52.5, 53.4, 296],
  [53.4, 54.2, 52.9, 53.8, 308],
  [53.8, 54.8, 53.4, 54.1, 325],
  [54.1, 54.9, 53.6, 54.4, 356],
  [54.4, 55.3, 54.0, 54.8, 372],
  [54.8, 55.8, 54.5, 55.1, 390],
  [55.1, 56.0, 54.8, 55.6, 406],
  [55.6, 56.2, 54.9, 55.9, 422],
  [55.9, 56.1, 54.8, 55.2, 401],
  [55.2, 55.5, 54.0, 54.6, 384],
  [54.6, 55.0, 53.5, 54.1, 362],
  [54.1, 54.5, 52.9, 53.6, 348],
  [53.6, 53.9, 52.6, 53.2, 333],
  [53.2, 53.8, 52.8, 53.0, 321],
  [53.0, 53.4, 52.5, 52.8, 316],
  [52.8, 53.1, 52.0, 52.4, 305],
  [52.4, 52.8, 51.7, 52.1, 299],
  [52.1, 52.7, 51.6, 52.3, 292],
  [52.3, 52.9, 51.9, 52.5, 310],
  [52.5, 52.8, 51.8, 52.2, 304],
  [52.2, 52.7, 51.7, 52.3, 318],
] as const;

const BASE_SPOT_CANDLES = [
  [82_640, 82_880, 82_440, 82_760, 220],
  [82_760, 83_040, 82_620, 82_980, 245],
  [82_980, 83_220, 82_810, 83_140, 260],
  [83_140, 83_420, 82_980, 83_260, 272],
  [83_260, 83_510, 83_040, 83_120, 255],
  [83_120, 83_400, 82_930, 83_300, 249],
  [83_300, 83_690, 83_150, 83_560, 281],
  [83_560, 83_920, 83_340, 83_740, 296],
  [83_740, 84_080, 83_520, 83_960, 308],
  [83_960, 84_310, 83_700, 84_180, 325],
  [84_180, 84_520, 83_940, 84_360, 356],
  [84_360, 84_740, 84_120, 84_540, 372],
  [84_540, 84_960, 84_260, 84_720, 390],
  [84_720, 85_030, 84_480, 84_860, 406],
  [84_860, 85_240, 84_620, 85_060, 422],
  [85_060, 85_280, 84_740, 84_940, 401],
  [84_940, 85_160, 84_520, 84_760, 384],
  [84_760, 84_980, 84_310, 84_520, 362],
  [84_520, 84_760, 84_050, 84_280, 348],
  [84_280, 84_510, 83_980, 84_160, 333],
  [84_160, 84_420, 83_940, 84_240, 321],
  [84_240, 84_460, 84_020, 84_110, 316],
  [84_110, 84_350, 83_860, 83_980, 305],
  [83_980, 84_240, 83_720, 83_910, 299],
  [83_910, 84_180, 83_680, 84_040, 292],
  [84_040, 84_360, 83_860, 84_220, 310],
  [84_220, 84_470, 84_010, 84_180, 304],
  [84_180, 84_520, 83_960, 84_260, 318],
] as const;

const BTC_CONTRACT_META = {
  PERP: {
    basis: "+1.15 pts",
    id: "PERP",
    indexVariance: volPercentToVariance(51.08),
    markVariance: volPercentToVariance(52.23),
    openInterest: "$148.3M vega",
    volume: "$36.2M vega",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    indexVariance: number;
    markVariance: number;
    openInterest: string;
    volume: string;
  }
>;

export const CONTRACT_LABELS = ["PERP"] as const;

const BTC_CONVEX_POSITION_NOTIONAL_USD = 182_500;
const BTC_CONVEX_ORDER_NOTIONAL_USD = 64_000;
const BTC_CONVEX_RISK_INPUT = {
  baseTopLevelSize: 0.85,
  convexityRisk: 0.78,
  fundingRateBps: 1,
  inventorySkew: 0.32,
  levels: 7,
  realizedVol: 0.038,
} as const;

export const CONTRACT_TABS = CONTRACT_LABELS.map((label) => ({
  active: label === "PERP",
  label,
})) satisfies ContractTab[];

const FUTURES_DISPLAY_SYMBOL = {
  "BTC/USD": "BTCVAR30-PERP",
} as const satisfies Record<"BTC/USD", string>;

export const MARKET_OPTIONS = [
  {
    contractLabel: "PERP",
    displayName: "BTC 30D Implied Volatility Perpetual",
    frontMonth: "PERP",
    id: "btc-var-30-perp",
    lastPrice: "52.23%",
    marketType: "Futures",
    region: "Crypto",
    semantics: getBtcVar30Semantics(),
    subtitle: "30D Implied Vol",
    symbol: "BTCVAR30",
  },
] satisfies MarketOption[];

function buildCandles(
  baseCandles: readonly (readonly [number, number, number, number, number])[],
  offset: number,
  digits: number,
) {
  return baseCandles.map(([open, high, low, close, volume], index) => ({
    close: Number((close + offset).toFixed(digits)),
    high: Number((high + offset).toFixed(digits)),
    low: Number((low + offset).toFixed(digits)),
    open: Number((open + offset).toFixed(digits)),
    time: `${String((index + 8) % 24).padStart(2, "0")}:00`,
    volume: volume + Math.round(offset * 8),
  })) satisfies Candle[];
}

function buildBtcTrades(markVariance: number) {
  const markVol = varianceToVolPercent(markVariance);

  return [
    { price: volPercentToVariance(markVol + 0.08), side: "buy", size: 3, time: "10:08:14" },
    { price: volPercentToVariance(markVol), side: "sell", size: 2, time: "10:08:06" },
    { price: volPercentToVariance(markVol - 0.12), side: "sell", size: 4, time: "10:07:53" },
    { price: volPercentToVariance(markVol + 0.19), side: "buy", size: 2, time: "10:07:41" },
    { price: volPercentToVariance(markVol + 0.03), side: "buy", size: 1, time: "10:07:17" },
  ] satisfies TradePrint[];
}

function buildBtcContractMarket(
  symbol: "BTC/USD",
  label: keyof typeof BTC_CONTRACT_META,
  offset: number,
  _sizeMultiplier: number,
) {
  const meta = BTC_CONTRACT_META[label];
  const semantics = getBtcVar30Semantics();
  const contractSymbol = FUTURES_DISPLAY_SYMBOL[symbol];
  const display = getBtcVar30DisplayFields({
    indexValue: meta.indexVariance,
    indexValueSource: "variance",
    markValue: meta.markVariance,
    markValueSource: "variance",
  });
  const markVariance = meta.markVariance;
  const referenceVariance = meta.indexVariance;
  const convexPosition = buildConvexExposureMetrics({
    entryReferencePrice: volPercentToVariance(display.indexVolPercent - 1.8),
    inputValue: BTC_CONVEX_POSITION_NOTIONAL_USD,
    markPrice: markVariance,
    referencePrice: referenceVariance,
    side: "buy",
    sizingMode: "notional",
  });
  const convexBook = generateNonlinearConvexOrderBook({
    ...BTC_CONVEX_RISK_INPUT,
    midPrice: markVariance + offset,
    referencePrice: referenceVariance,
  });

  return {
    basis: meta.basis,
    candles: buildCandles(BASE_VOL_CANDLES, offset, 2),
    contractDetails: [
      { label: "Contract", value: contractSymbol },
      { label: "Display Name", value: semantics.displayName },
      { label: "Contract Type", value: "30D Implied Volatility Perpetual" },
      { label: "Sizing", value: "Notional / Variance / Spot Sensitivity" },
      { label: "Displayed In", value: "30D implied volatility %" },
      { label: "Settlement", value: "Internally settled in implied variance" },
      { label: "Funding Rate", value: "Variance-native, 1.00 bps / 8h" },
      { label: "Long receives", value: "Long BTC implied volatility" },
      { label: "Short receives", value: "Short BTC implied volatility" },
    ],
    id: label,
    index: formatVolPercentFromVariance(referenceVariance),
    infoBar: [
      { label: "Mark Vol", value: formatVolPercentFromVariance(markVariance) },
      { label: "Variance Mark", value: formatVariancePrice(markVariance) },
      { label: "24h Change", tone: "accent", value: "+2.84%" },
      { label: "24h Volume", value: meta.volume },
      { label: "Open Interest", value: meta.openInterest },
      { label: "Funding (variance)", tone: "accent", value: "1.00 bps" },
      { label: "Next Funding", value: "01:42:18" },
      { label: "Status", value: "Live" },
    ],
    mark: formatVolPercentFromVariance(markVariance),
    orderBookAsks: convexBook.asks,
    orderBookBids: convexBook.bids,
    presentation: {
      displayMode: "price",
      nonlinearLadderLabel: "Variance Ladder",
      riskModel: convexBook.riskModel,
      semantics,
      sizingModes: ["notional", "convex", "delta"],
      variant: "convex",
    },
    positionOverview: [
      { label: "Entry Vol", value: formatVolPercentFromVariance(convexPosition.entryReferencePrice) },
      { label: "Variance Entry", value: formatVariancePrice(convexPosition.entryReferencePrice) },
      {
        label: "Variance Notional",
        value: `$${Math.round(convexPosition.convexNotionalUsd).toLocaleString("en-US")}`,
      },
      { label: "Spot Sensitivity (BTC)", value: `${convexPosition.deltaEquivalentBtc.toFixed(2)} BTC` },
      {
        label: "Vol Exposure",
        value: `$${Math.round(convexPosition.volExposurePerPointUsd).toLocaleString("en-US")} / +1 vol pt`,
      },
      {
        label: "Variance Exposure",
        value: `$${Math.round(convexPosition.varianceExposurePerPoint01Usd).toLocaleString("en-US")} / +0.01 variance`,
      },
      { label: "Mark Vol", value: formatVolPercentFromVariance(markVariance) },
      {
        label: "Unrealized PnL",
        value: `${convexPosition.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(convexPosition.pnlUsd).toFixed(0)}`,
      },
    ],
    ticker: contractSymbol,
    timeToExpiry: "Perpetual",
    trades: buildBtcTrades(markVariance),
  } satisfies ContractMarket;
}

function buildInstrumentMarkets(symbol: "BTC/USD") {
  return {
    PERP: buildBtcContractMarket(symbol, "PERP", 0, 1),
  } satisfies Record<string, ContractMarket>;
}

export const INSTRUMENT_MARKETS = {
  "BTC/USD": buildInstrumentMarkets("BTC/USD"),
} satisfies Record<string, Record<string, ContractMarket>>;

export const DEFAULT_SYMBOL = "BTC/USD";
export const DEFAULT_CONTRACT = "PERP";
export const DEFAULT_TIMEFRAME = "1h";
export const DEFAULT_ORDER_TYPE = "Market";
export const DEFAULT_CHART_CONTEXT = "Vol";
export const DEFAULT_BOTTOM_TAB = "positions";
export const DEFAULT_FILTER = "All";

export const BOTTOM_TABS = [
  { id: "positions", label: "Positions" },
  { id: "open-orders", label: "Open Orders" },
  { id: "trade-history", label: "Trade History" },
] satisfies ActivityTab[];

export const ACTIVITY_VIEWS = {
  "open-orders": {
    columns: ["Instrument", "Bias", "Mode", "Variance Notional", "Entry Vol"],
    rows: [
      {
        cells: [
          "BTCVAR30-PERP",
          "Long Volatility",
          "Notional",
          `$${BTC_CONVEX_ORDER_NOTIONAL_USD.toLocaleString("en-US")}`,
          "51.08%",
        ],
      },
    ],
  },
  positions: {
    columns: ["Instrument", "Entry Vol", "Variance Notional", "Mark Vol", "PnL"],
    rows: [{ cells: ["BTCVAR30-PERP", "50.43%", "$182,500", "52.23%", "+$2,765"], positiveCellIndexes: [4] }],
  },
  "trade-history": {
    columns: ["Time", "Instrument", "Bias", "Price", "Spread"],
    rows: [
      { cells: ["10:08:14", "BTCVAR30-PERP", "Long Volatility", "52.31%", "0.08 pts"] },
      { cells: ["10:08:06", "BTCVAR30-PERP", "Short Volatility", "52.23%", "0.06 pts"] },
    ],
  },
} satisfies Record<string, ActivityView>;

export const FILTER_OPTIONS = ["All", "Active", "Filled"] as const;
export const FOOTER_LINKS = [
  { href: "#", label: "Docs" },
  { href: "#", label: "Support" },
  { href: "#", label: "Terms" },
  { href: "#", label: "Privacy Policy" },
] as const;

export const CHART_RANGE_BUTTONS = ["5y", "1y", "6m", "3m", "1m", "5d", "1d"] as const;
export const CHART_CONTEXT_TABS = ["Vol", "Variance", "BTC Spot"] as const satisfies readonly ChartDisplayMode[];
export const TIMEFRAME_OPTIONS = ["5m", "1h", "D"] as const;

export const CHART_TOOLS = [
  { id: "crosshair", label: "Crosshair" },
  { id: "cursor", label: "Select" },
  { id: "trend", label: "Trend Line" },
  { id: "horizontal", label: "Horizontal Line" },
  { id: "brush", label: "Brush" },
  { id: "highlighter", label: "Highlight" },
  { id: "measure", label: "Measure" },
  { id: "text", label: "Text" },
  { id: "compare", label: "Compare" },
  { id: "search", label: "Search" },
  { id: "erase", label: "Erase" },
  { id: "candles", label: "Candles" },
] satisfies ChartTool[];

export const CHART_TOOL_ICONS: Record<ChartTool["id"], LucideIcon> = {
  brush: Brush,
  candles: ChartCandlestick,
  compare: ArrowRightLeft,
  crosshair: Crosshair,
  cursor: SquareDashedMousePointer,
  erase: Eraser,
  highlighter: Highlighter,
  horizontal: Minus,
  measure: Ruler,
  search: Search,
  text: Type,
  trend: PenLine,
};

export function getBaseSpotCandles() {
  return BASE_SPOT_CANDLES;
}
