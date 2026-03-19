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
import type {
  ActivityTab,
  ActivityView,
  Candle,
  ChartTool,
  ContractMarket,
  ContractTab,
  MarketOption,
  TradePrint,
} from "@/lib/trading.types";

const BASE_BTC_CANDLES = [
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

const BASE_ETH_CANDLES = [
  [4080, 4094, 4070, 4088, 180],
  [4088, 4106, 4080, 4101, 192],
  [4101, 4122, 4090, 4114, 201],
  [4114, 4135, 4102, 4126, 205],
  [4126, 4132, 4100, 4109, 188],
  [4109, 4126, 4098, 4118, 183],
  [4118, 4142, 4108, 4135, 208],
  [4135, 4158, 4124, 4149, 219],
  [4149, 4172, 4138, 4162, 224],
  [4162, 4188, 4152, 4176, 237],
  [4176, 4201, 4168, 4192, 249],
  [4192, 4218, 4180, 4205, 258],
  [4205, 4229, 4196, 4216, 267],
  [4216, 4242, 4204, 4228, 274],
  [4228, 4256, 4214, 4241, 283],
  [4241, 4250, 4220, 4232, 278],
  [4232, 4240, 4208, 4219, 270],
  [4219, 4228, 4194, 4207, 261],
  [4207, 4220, 4188, 4198, 255],
  [4198, 4214, 4186, 4205, 248],
  [4205, 4218, 4192, 4211, 242],
  [4211, 4227, 4199, 4203, 239],
  [4203, 4214, 4186, 4194, 233],
  [4194, 4208, 4176, 4187, 228],
  [4187, 4206, 4170, 4198, 225],
  [4198, 4220, 4188, 4210, 231],
  [4210, 4228, 4198, 4205, 229],
  [4205, 4224, 4192, 4214, 235],
] as const;

const BASE_BTC_ASKS = [
  { price: 84_280, size: 3, total: 81 },
  { price: 84_290, size: 4, total: 78 },
  { price: 84_300, size: 5, total: 74 },
  { price: 84_310, size: 6, total: 69 },
  { price: 84_320, size: 7, total: 63 },
  { price: 84_330, size: 8, total: 56 },
  { price: 84_340, size: 9, total: 48 },
] as const;

const BASE_BTC_BIDS = [
  { price: 84_250, size: 10, total: 10 },
  { price: 84_240, size: 9, total: 19 },
  { price: 84_230, size: 8, total: 27 },
  { price: 84_220, size: 7, total: 34 },
  { price: 84_210, size: 6, total: 40 },
  { price: 84_200, size: 5, total: 45 },
  { price: 84_190, size: 4, total: 49 },
] as const;

const BASE_ETH_ASKS = [
  { price: 4215, size: 18, total: 162 },
  { price: 4216, size: 22, total: 144 },
  { price: 4217, size: 26, total: 122 },
  { price: 4218, size: 30, total: 96 },
  { price: 4219, size: 34, total: 66 },
  { price: 4220, size: 40, total: 32 },
  { price: 4221, size: 44, total: 20 },
] as const;

const BASE_ETH_BIDS = [
  { price: 4214, size: 46, total: 46 },
  { price: 4213, size: 40, total: 86 },
  { price: 4212, size: 34, total: 120 },
  { price: 4211, size: 28, total: 148 },
  { price: 4210, size: 22, total: 170 },
  { price: 4209, size: 18, total: 188 },
  { price: 4208, size: 14, total: 202 },
] as const;

const BASE_NGN_CANDLES = [
  [1538.4, 1540.2, 1536.8, 1539.6, 520],
  [1539.6, 1542.1, 1538.5, 1541.4, 536],
  [1541.4, 1543.8, 1540.3, 1542.9, 548],
  [1542.9, 1545.2, 1541.7, 1544.6, 561],
  [1544.6, 1546.9, 1542.4, 1543.8, 552],
  [1543.8, 1547.1, 1542.9, 1545.7, 569],
  [1545.7, 1548.4, 1544.3, 1547.6, 583],
  [1547.6, 1550.1, 1546.2, 1549.2, 596],
  [1549.2, 1551.8, 1547.5, 1550.6, 612],
  [1550.6, 1553.4, 1549.1, 1552.3, 628],
  [1552.3, 1554.2, 1550.7, 1551.5, 619],
  [1551.5, 1553.1, 1548.9, 1549.8, 601],
  [1549.8, 1551.2, 1547.4, 1548.6, 587],
  [1548.6, 1550.8, 1546.9, 1547.9, 574],
  [1547.9, 1549.7, 1545.5, 1546.8, 562],
  [1546.8, 1548.9, 1544.7, 1547.2, 553],
  [1547.2, 1549.1, 1545.8, 1548.1, 545],
  [1548.1, 1550.3, 1546.6, 1549.4, 557],
  [1549.4, 1551.1, 1547.8, 1550.2, 568],
  [1550.2, 1552.5, 1548.9, 1551.7, 579],
  [1551.7, 1553.6, 1550.1, 1552.8, 591],
  [1552.8, 1554.4, 1550.9, 1551.9, 583],
  [1551.9, 1553.2, 1549.7, 1550.8, 571],
  [1550.8, 1552.6, 1548.8, 1549.9, 560],
  [1549.9, 1551.8, 1548.2, 1550.7, 567],
  [1550.7, 1552.9, 1549.4, 1551.6, 576],
  [1551.6, 1553.5, 1549.8, 1552.4, 588],
  [1552.4, 1554.1, 1550.6, 1553.2, 600],
] as const;

const BASE_NGN_ASKS = [
  { price: 1553.4, size: 140_000, total: 1_120_000 },
  { price: 1553.6, size: 160_000, total: 980_000 },
  { price: 1553.8, size: 180_000, total: 820_000 },
  { price: 1554.0, size: 200_000, total: 640_000 },
  { price: 1554.2, size: 220_000, total: 440_000 },
  { price: 1554.4, size: 240_000, total: 220_000 },
] as const;

const BASE_NGN_BIDS = [
  { price: 1553.0, size: 240_000, total: 240_000 },
  { price: 1552.8, size: 220_000, total: 460_000 },
  { price: 1552.6, size: 200_000, total: 660_000 },
  { price: 1552.4, size: 180_000, total: 840_000 },
  { price: 1552.2, size: 160_000, total: 1_000_000 },
  { price: 1552.0, size: 140_000, total: 1_140_000 },
] as const;

const BTC_CONTRACT_META = {
  PERP: {
    basis: "+70.00",
    id: "PERP",
    index: "84,180.00",
    mark: "84,250.00",
    openInterest: "$148.3M",
    volume: "$36.2M",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    index: string;
    mark: string;
    openInterest: string;
    volume: string;
  }
>;

const ETH_CONTRACT_META = {
  PERP: {
    basis: "+6.00",
    id: "PERP",
    index: "4,208.00",
    mark: "4,214.00",
    openInterest: "$128.7M",
    volume: "$24.9M",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    index: string;
    mark: string;
    openInterest: string;
    volume: string;
  }
>;

const NGN_CONTRACT_META = {
  PERP: {
    basis: "+1.80",
    id: "PERP",
    index: "1,551.40",
    mark: "1,553.20",
    openInterest: "$8.6M",
    volume: "$2.1M",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    index: string;
    mark: string;
    openInterest: string;
    volume: string;
  }
>;

export const CONTRACT_LABELS = ["PERP"] as const;

export const CONTRACT_TABS = CONTRACT_LABELS.map((label) => ({
  active: label === "PERP",
  label,
})) satisfies ContractTab[];

const FUTURES_DISPLAY_SYMBOL = {
  "BTC/USD": "BTCUSDC-CVXPERP",
  "ETH/USD": "ETHUSDC-SQPERP",
  "NGN/USD": "NGNUSDC-PERP",
} as const satisfies Record<"BTC/USD" | "ETH/USD" | "NGN/USD", string>;

export const MARKET_OPTIONS = [
  {
    frontMonth: "CVXPERP",
    id: "btc-usd-futures",
    lastPrice: "84,205.00",
    marketType: "Futures",
    region: "Crypto",
    symbol: "BTCUSDC-CVXPERP",
  },
  {
    frontMonth: "PERP",
    id: "btc-usdc-perp-futures",
    lastPrice: "84,205.00",
    marketType: "Futures",
    region: "Crypto",
    symbol: "BTCUSDC-PERP",
  },
  {
    frontMonth: "PERP",
    id: "ngn-usdc-perp-futures",
    lastPrice: "1,553.20",
    marketType: "Futures",
    region: "FX",
    symbol: "NGNUSDC-PERP",
  },
] satisfies MarketOption[];

function getPositionSize(_label: keyof typeof BTC_CONTRACT_META) {
  return "+5.00 BTC";
}

function getUnrealizedPnl(_label: keyof typeof BTC_CONTRACT_META) {
  return "+$3,150";
}

function parseNumber(value: string) {
  return Number(value.replaceAll(",", "").replaceAll("$", "").replaceAll("+", ""));
}

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

function buildBook(
  levels: readonly { price: number; size: number; total: number }[],
  priceOffset: number,
  sizeMultiplier: number,
  digits: number,
) {
  return levels.map((level) => ({
    price: Number((level.price + priceOffset).toFixed(digits)),
    size: Math.round(level.size * sizeMultiplier),
    total: Math.round(level.total * sizeMultiplier),
  }));
}

function buildBtcTrades(mark: string, basis: string) {
  const markNumber = parseNumber(mark);
  const basisNumber = parseNumber(basis);

  return [
    { price: markNumber + 15, side: "buy", size: 3, time: "10:08:14" },
    { price: markNumber, side: "sell", size: 2, time: "10:08:06" },
    { price: markNumber - 15, side: "sell", size: 4, time: "10:07:53" },
    { price: markNumber + basisNumber / 8, side: "buy", size: 2, time: "10:07:41" },
    { price: markNumber, side: "buy", size: 1, time: "10:07:17" },
  ] satisfies TradePrint[];
}

function buildEthTrades(mark: string, basis: string) {
  const markNumber = parseNumber(mark);
  const basisNumber = parseNumber(basis);

  return [
    { price: Number((markNumber + 1).toFixed(2)), side: "buy", size: 18, time: "10:08:14" },
    { price: Number(markNumber.toFixed(2)), side: "sell", size: 12, time: "10:08:06" },
    { price: Number((markNumber - 1).toFixed(2)), side: "sell", size: 16, time: "10:07:53" },
    { price: Number((markNumber + basisNumber / 6).toFixed(2)), side: "buy", size: 10, time: "10:07:41" },
    { price: Number(markNumber.toFixed(2)), side: "buy", size: 8, time: "10:07:17" },
  ] satisfies TradePrint[];
}

function buildNgnTrades(mark: string, basis: string) {
  const markNumber = parseNumber(mark);
  const basisNumber = parseNumber(basis);

  return [
    { price: Number((markNumber + 0.4).toFixed(2)), side: "buy", size: 120_000, time: "10:08:14" },
    { price: Number(markNumber.toFixed(2)), side: "sell", size: 90_000, time: "10:08:06" },
    { price: Number((markNumber - 0.3).toFixed(2)), side: "sell", size: 150_000, time: "10:07:53" },
    { price: Number((markNumber + basisNumber / 8).toFixed(2)), side: "buy", size: 110_000, time: "10:07:41" },
    { price: Number(markNumber.toFixed(2)), side: "buy", size: 80_000, time: "10:07:17" },
  ] satisfies TradePrint[];
}

function buildBtcContractMarket(
  symbol: "BTC/USD",
  label: keyof typeof BTC_CONTRACT_META,
  offset: number,
  sizeMultiplier: number,
) {
  const meta = BTC_CONTRACT_META[label];
  const contractSymbol = FUTURES_DISPLAY_SYMBOL[symbol];

  return {
    basis: meta.basis,
    candles: buildCandles(BASE_BTC_CANDLES, offset, 0),
    contractDetails: [
      { label: "Contract", value: contractSymbol },
      { label: "Contract Size", value: "1 BTC" },
      { label: "Tick Size", value: "$5.00" },
      { label: "Tick Value", value: "$5.00 / tick" },
      { label: "Settlement", value: "Cash-settled in USDC collateral" },
      { label: "Funding Rate", value: "+0.0100% / 8h" },
      { label: "Long receives", value: "BTC exposure" },
      { label: "Short receives", value: "USDC collateral" },
    ],
    id: label,
    index: meta.index,
    infoBar: [
      { label: "Contract Type", value: "Squared Perpetual" },
      { label: "Settlement", value: "USDC" },
      { label: "Mark Price", value: meta.mark },
      { label: "24h Change", tone: "accent", value: "+2.84%" },
      { label: "24h Volume", value: meta.volume },
      { label: "Open Interest", value: meta.openInterest },
      { label: "Status", value: "Live" },
      { label: "Funding Rate", tone: "accent", value: "+0.0100%" },
      { label: "Next Funding", value: "01:42:18" },
      { label: "Price Limits", value: "79,971.00 - 88,389.00" },
    ],
    mark: meta.mark,
    orderBookAsks: buildBook(BASE_BTC_ASKS, offset, sizeMultiplier, 2),
    orderBookBids: buildBook(BASE_BTC_BIDS, offset, sizeMultiplier, 2),
    positionOverview: [
      { label: "Position (BTC)", value: getPositionSize(label) },
      { label: "Entry Price", value: Number(parseNumber(meta.mark) - 630).toFixed(2) },
      { label: "Mark Price", value: Number(parseNumber(meta.mark)).toFixed(2) },
      { label: "Unrealized PnL", value: getUnrealizedPnl(label) },
    ],
    ticker: contractSymbol,
    timeToExpiry: "Perpetual",
    trades: buildBtcTrades(meta.mark, meta.basis),
  } satisfies ContractMarket;
}

function buildEthContractMarket(
  symbol: "ETH/USD",
  label: keyof typeof ETH_CONTRACT_META,
  offset: number,
  sizeMultiplier: number,
) {
  const meta = ETH_CONTRACT_META[label];
  const contractSymbol = FUTURES_DISPLAY_SYMBOL[symbol];

  return {
    basis: meta.basis,
    candles: buildCandles(BASE_ETH_CANDLES, offset, 2),
    contractDetails: [
      { label: "Contract", value: contractSymbol },
      { label: "Contract Size", value: "10 ETH" },
      { label: "Tick Size", value: "$0.50" },
      { label: "Tick Value", value: "$5.00 / tick" },
      { label: "Settlement", value: "Cash-settled in USDC collateral" },
      { label: "Funding Rate", value: "+0.0125% / 8h" },
      { label: "Long receives", value: "ETH exposure" },
      { label: "Short receives", value: "USDC collateral" },
    ],
    id: label,
    index: meta.index,
    infoBar: [
      { label: "Contract Type", value: "Squared Perpetual" },
      { label: "Settlement", value: "USDC" },
      { label: "Mark Price", value: meta.mark },
      { label: "24h Change", tone: "accent", value: "+1.92%" },
      { label: "24h Volume", value: meta.volume },
      { label: "Open Interest", value: meta.openInterest },
      { label: "Status", value: "Live" },
      { label: "Funding Rate", tone: "accent", value: "+0.0125%" },
      { label: "Next Funding", value: "01:42:18" },
      { label: "Price Limits", value: "3,997.60 - 4,418.40" },
    ],
    mark: meta.mark,
    orderBookAsks: buildBook(BASE_ETH_ASKS, offset, sizeMultiplier, 2),
    orderBookBids: buildBook(BASE_ETH_BIDS, offset, sizeMultiplier, 2),
    positionOverview: [
      { label: "Position (ETH)", value: "+30 ETH" },
      { label: "Entry Price", value: Number(parseNumber(meta.mark) - 26).toFixed(2) },
      { label: "Mark Price", value: Number(parseNumber(meta.mark)).toFixed(2) },
      { label: "Unrealized PnL", value: "+$1,125" },
    ],
    ticker: contractSymbol,
    timeToExpiry: "Perpetual",
    trades: buildEthTrades(meta.mark, meta.basis),
  } satisfies ContractMarket;
}

function buildNgnContractMarket(
  symbol: "NGN/USD",
  label: keyof typeof NGN_CONTRACT_META,
  offset: number,
  sizeMultiplier: number,
) {
  const meta = NGN_CONTRACT_META[label];
  const contractSymbol = FUTURES_DISPLAY_SYMBOL[symbol];

  return {
    basis: meta.basis,
    candles: buildCandles(BASE_NGN_CANDLES, offset, 2),
    contractDetails: [
      { label: "Contract", value: contractSymbol },
      { label: "Contract Size", value: "100,000 NGN" },
      { label: "Tick Size", value: "$0.10" },
      { label: "Tick Value", value: "$10.00 / tick" },
      { label: "Settlement", value: "Cash-settled in USDC collateral" },
      { label: "Funding Rate", value: "+0.0060% / 8h" },
      { label: "Long receives", value: "NGN exposure" },
      { label: "Short receives", value: "USDC collateral" },
    ],
    id: label,
    index: meta.index,
    infoBar: [
      { label: "Contract Type", value: "Squared Perpetual" },
      { label: "Settlement", value: "USDC" },
      { label: "Mark Price", value: meta.mark },
      { label: "24h Change", tone: "accent", value: "+0.74%" },
      { label: "24h Volume", value: meta.volume },
      { label: "Open Interest", value: meta.openInterest },
      { label: "Status", value: "Live" },
      { label: "Funding Rate", tone: "accent", value: "+0.0060%" },
      { label: "Next Funding", value: "03:12:44" },
      { label: "Price Limits", value: "1,473.83 - 1,628.97" },
    ],
    mark: meta.mark,
    orderBookAsks: buildBook(BASE_NGN_ASKS, offset, sizeMultiplier, 2),
    orderBookBids: buildBook(BASE_NGN_BIDS, offset, sizeMultiplier, 2),
    positionOverview: [
      { label: "Position (NGN)", value: "+250,000 NGN" },
      { label: "Entry Price", value: Number(parseNumber(meta.mark) - 7.8).toFixed(2) },
      { label: "Mark Price", value: Number(parseNumber(meta.mark)).toFixed(2) },
      { label: "Unrealized PnL", value: "+$412" },
    ],
    ticker: contractSymbol,
    timeToExpiry: "Perpetual",
    trades: buildNgnTrades(meta.mark, meta.basis),
  } satisfies ContractMarket;
}

function buildInstrumentMarkets(symbol: "BTC/USD" | "ETH/USD" | "NGN/USD") {
  if (symbol === "NGN/USD") {
    return {
      PERP: buildNgnContractMarket(symbol, "PERP", 0, 1),
    } satisfies Record<string, ContractMarket>;
  }

  if (symbol === "ETH/USD") {
    return {
      PERP: buildEthContractMarket(symbol, "PERP", 0, 1),
    } satisfies Record<string, ContractMarket>;
  }

  return {
    PERP: buildBtcContractMarket(symbol, "PERP", 0, 1),
  } satisfies Record<string, ContractMarket>;
}

export const INSTRUMENT_MARKETS = {
  "BTC/USD": buildInstrumentMarkets("BTC/USD"),
  "ETH/USD": buildInstrumentMarkets("ETH/USD"),
  "NGN/USD": buildInstrumentMarkets("NGN/USD"),
} satisfies Record<string, Record<string, ContractMarket>>;

export const DEFAULT_SYMBOL = "BTC/USD";
export const DEFAULT_CONTRACT = "PERP";
export const DEFAULT_TIMEFRAME = "1h";
export const DEFAULT_ORDER_TYPE = "Market";
export const DEFAULT_CHART_CONTEXT = "Futures";
export const DEFAULT_BOTTOM_TAB = "positions";
export const DEFAULT_FILTER = "All";

export const BOTTOM_TABS = [
  { id: "positions", label: "Positions" },
  { id: "open-orders", label: "Open Orders" },
  { id: "trade-history", label: "Trade History" },
] satisfies ActivityTab[];

export const ACTIVITY_VIEWS = {
  "open-orders": {
    columns: ["Instrument", "Side", "Type", "Size", "Price"],
    rows: [{ cells: ["BTCUSDC-CVXPERP", "Buy BTC", "Limit", "1.50", "84,180.00"] }],
  },
  positions: {
    columns: ["Instrument", "Position", "Entry Price", "Mark", "PnL"],
    rows: [{ cells: ["BTCUSDC-CVXPERP", "+5.00 BTC", "83,620.00", "84,250.00", "+$3,150"], positiveCellIndexes: [4] }],
  },
  "trade-history": {
    columns: ["Time", "Instrument", "Side", "Size", "Price"],
    rows: [
      { cells: ["10:08:14", "BTCUSDC-CVXPERP", "Buy BTC", "2.00", "84,265.00"] },
      { cells: ["10:08:06", "BTCUSDC-CVXPERP", "Sell BTC", "1.25", "84,250.00"] },
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
export const CHART_CONTEXT_TABS = ["Futures", "Basis"] as const;
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
