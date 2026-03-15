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

const BTC_CONTRACT_META = {
  "DEC 2026": {
    basis: "+220.00",
    id: "DEC 2026",
    index: "84,380.00",
    mark: "84,600.00",
    openInterest: "$134.1M",
    timeToExpiry: "284d",
    volume: "$28.9M",
  },
  "JUN 2026": {
    basis: "+70.00",
    id: "JUN 2026",
    index: "84,180.00",
    mark: "84,250.00",
    openInterest: "$148.3M",
    timeToExpiry: "101d",
    volume: "$36.2M",
  },
  "MAR 2026": {
    basis: "+25.00",
    id: "MAR 2026",
    index: "84,180.00",
    mark: "84,205.00",
    openInterest: "$112.4M",
    timeToExpiry: "11d",
    volume: "$19.8M",
  },
  "SEP 2026": {
    basis: "+130.00",
    id: "SEP 2026",
    index: "84,180.00",
    mark: "84,310.00",
    openInterest: "$129.7M",
    timeToExpiry: "193d",
    volume: "$24.7M",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    index: string;
    mark: string;
    openInterest: string;
    timeToExpiry: string;
    volume: string;
  }
>;

const ETH_CONTRACT_META = {
  "DEC 2026": {
    basis: "+18.00",
    id: "DEC 2026",
    index: "4,208.00",
    mark: "4,226.00",
    openInterest: "$91.4M",
    timeToExpiry: "284d",
    volume: "$18.6M",
  },
  "JUN 2026": {
    basis: "+6.00",
    id: "JUN 2026",
    index: "4,208.00",
    mark: "4,214.00",
    openInterest: "$128.7M",
    timeToExpiry: "101d",
    volume: "$24.9M",
  },
  "MAR 2026": {
    basis: "+3.00",
    id: "MAR 2026",
    index: "4,208.00",
    mark: "4,211.00",
    openInterest: "$74.5M",
    timeToExpiry: "11d",
    volume: "$15.2M",
  },
  "SEP 2026": {
    basis: "+11.00",
    id: "SEP 2026",
    index: "4,208.00",
    mark: "4,219.00",
    openInterest: "$109.2M",
    timeToExpiry: "193d",
    volume: "$21.1M",
  },
} as const satisfies Record<
  string,
  {
    basis: string;
    id: string;
    index: string;
    mark: string;
    openInterest: string;
    timeToExpiry: string;
    volume: string;
  }
>;

export const CONTRACT_LABELS = ["MAR 2026", "JUN 2026", "SEP 2026", "DEC 2026"] as const;

export const CONTRACT_TABS = CONTRACT_LABELS.map((label) => ({
  active: label === "JUN 2026",
  label,
})) satisfies ContractTab[];

const FUTURES_DISPLAY_SYMBOL = {
  "BTC/USD": "BTCUSD-SQPERP",
  "ETH/USD": "ETHUSD-SQPERP",
} as const satisfies Record<"BTC/USD" | "ETH/USD", string>;

export const MARKET_OPTIONS = [
  {
    frontMonth: "MAR26",
    id: "btc-usd-futures",
    lastPrice: "84,205.00",
    marketType: "Futures",
    region: "Crypto",
    symbol: "BTCUSD-SQPERP",
  },
  {
    frontMonth: "SPOT",
    id: "btc-usd-spot",
    lastPrice: "84,180.00",
    marketType: "Spot",
    region: "Crypto",
    symbol: "BTC/USD",
  },
  {
    frontMonth: "JUN26",
    id: "eth-usd-futures",
    lastPrice: "4,214.00",
    marketType: "Futures",
    region: "Crypto",
    symbol: "ETHUSD-SQPERP",
  },
  {
    frontMonth: "SPOT",
    id: "eth-usd-spot",
    lastPrice: "4,208.00",
    marketType: "Spot",
    region: "Crypto",
    symbol: "ETH/USD",
  },
] satisfies MarketOption[];

function getExpiryLabel(label: keyof typeof BTC_CONTRACT_META) {
  if (label === "MAR 2026") {
    return "March 18";
  }

  if (label === "JUN 2026") {
    return "June 17";
  }

  if (label === "SEP 2026") {
    return "September 16";
  }

  return "December 16";
}

function getPositionSize(label: keyof typeof BTC_CONTRACT_META) {
  if (label === "MAR 2026") {
    return "+2.00 BTC";
  }

  if (label === "DEC 2026") {
    return "+1.00 BTC";
  }

  return "+5.00 BTC";
}

function getUnrealizedPnl(label: keyof typeof BTC_CONTRACT_META) {
  if (label === "DEC 2026") {
    return "+$1,840";
  }

  if (label === "MAR 2026") {
    return "+$620";
  }

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
      { label: "Contract", value: `${contractSymbol} ${label}` },
      { label: "Contract Size", value: "1 BTC" },
      { label: "Tick Size", value: "$5.00" },
      { label: "Tick Value", value: "$5.00 / tick" },
      { label: "Expiry", value: `${getExpiryLabel(label)}, 2026, 16:00 UTC` },
      { label: "Settlement", value: "Cash-settled in USD collateral" },
      { label: "Long receives", value: "BTC exposure" },
      { label: "Short receives", value: "USD collateral" },
    ],
    id: label,
    index: meta.index,
    infoBar: [
      { label: "Contract", value: `${contractSymbol} ${label}` },
      { label: "Mark", value: meta.mark },
      { label: "Index", value: meta.index },
      { label: "Basis", tone: "accent", value: meta.basis },
      { label: "Vol", value: meta.volume },
      { label: "OI", value: meta.openInterest },
      { label: "Time to Expiry", value: meta.timeToExpiry },
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
    ticker: `${contractSymbol} ${label}`,
    timeToExpiry: meta.timeToExpiry,
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
      { label: "Contract", value: `${contractSymbol} ${label}` },
      { label: "Contract Size", value: "10 ETH" },
      { label: "Tick Size", value: "$0.50" },
      { label: "Tick Value", value: "$5.00 / tick" },
      { label: "Expiry", value: `${getExpiryLabel(label)}, 2026, 16:00 UTC` },
      { label: "Settlement", value: "Cash-settled in USD collateral" },
      { label: "Long receives", value: "ETH exposure" },
      { label: "Short receives", value: "USD collateral" },
    ],
    id: label,
    index: meta.index,
    infoBar: [
      { label: "Contract", value: `${contractSymbol} ${label}` },
      { label: "Mark", value: meta.mark },
      { label: "Index", value: meta.index },
      { label: "Basis", tone: "accent", value: meta.basis },
      { label: "Vol", value: meta.volume },
      { label: "OI", value: meta.openInterest },
      { label: "Time to Expiry", value: meta.timeToExpiry },
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
    ticker: `${contractSymbol} ${label}`,
    timeToExpiry: meta.timeToExpiry,
    trades: buildEthTrades(meta.mark, meta.basis),
  } satisfies ContractMarket;
}

function buildInstrumentMarkets(symbol: "BTC/USD" | "ETH/USD") {
  if (symbol === "ETH/USD") {
    return {
      "DEC 2026": buildEthContractMarket(symbol, "DEC 2026", 18, 0.92),
      "JUN 2026": buildEthContractMarket(symbol, "JUN 2026", 0, 1),
      "MAR 2026": buildEthContractMarket(symbol, "MAR 2026", -9, 0.86),
      "SEP 2026": buildEthContractMarket(symbol, "SEP 2026", 11, 0.95),
    } satisfies Record<string, ContractMarket>;
  }

  return {
    "DEC 2026": buildBtcContractMarket(symbol, "DEC 2026", 350, 0.72),
    "JUN 2026": buildBtcContractMarket(symbol, "JUN 2026", 0, 1),
    "MAR 2026": buildBtcContractMarket(symbol, "MAR 2026", -75, 0.78),
    "SEP 2026": buildBtcContractMarket(symbol, "SEP 2026", 145, 0.88),
  } satisfies Record<string, ContractMarket>;
}

export const INSTRUMENT_MARKETS = {
  "BTC/USD": buildInstrumentMarkets("BTC/USD"),
  "ETH/USD": buildInstrumentMarkets("ETH/USD"),
} satisfies Record<string, Record<string, ContractMarket>>;

export const DEFAULT_SYMBOL = "BTC/USD";
export const DEFAULT_CONTRACT = "JUN 2026";
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
    rows: [{ cells: ["BTCUSD-SQPERP JUN 2026", "Buy BTC", "Limit", "1.50", "84,180.00"] }],
  },
  positions: {
    columns: ["Instrument", "Position", "Entry Price", "Mark", "PnL"],
    rows: [{ cells: ["BTCUSD-SQPERP JUN 2026", "+5.00 BTC", "83,620.00", "84,250.00", "+$3,150"], positiveCellIndexes: [4] }],
  },
  "trade-history": {
    columns: ["Time", "Instrument", "Side", "Size", "Price"],
    rows: [
      { cells: ["10:08:14", "BTCUSD-SQPERP JUN 2026", "Buy BTC", "2.00", "84,265.00"] },
      { cells: ["10:08:06", "BTCUSD-SQPERP JUN 2026", "Sell BTC", "1.25", "84,250.00"] },
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
export const CHART_CONTEXT_TABS = ["Futures", "Spot", "Basis"] as const;
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
