import "server-only";

import type { Candle } from "@/lib/trading.types";

const SPOT_HISTORY_DAYS = 30;

export type SpotHistorySnapshot = {
  latestPrice: number;
  pair: "BTC/USD" | "ETH/USD";
  series: Candle[];
};

type CoinMarketChartResponse = {
  prices?: [number, number][];
};

function buildCandlesFromDailyPrices(prices: [number, number][]) {
  return prices.map(([timestamp, price], index) => {
    const previousPrice = prices[index - 1]?.[1] ?? price;
    const open = previousPrice;
    const close = price;
    const high = Math.max(open, close) * 1.004;
    const low = Math.min(open, close) * 0.996;
    const volume = 180 + Math.round(Math.abs(close - open) * 2);
    const date = new Date(timestamp);

    return {
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      open: Number(open.toFixed(2)),
      time: `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
      volume,
    } satisfies Candle;
  });
}

async function getHistoricalSeries(pair: SpotHistorySnapshot["pair"]) {
  const coinId = pair === "BTC/USD" ? "bitcoin" : "ethereum";
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${SPOT_HISTORY_DAYS}&interval=daily`,
    {
      next: {
        revalidate: 86_400,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`CoinGecko request failed for ${pair} with status ${response.status}`);
  }

  const json = (await response.json()) as CoinMarketChartResponse;
  const prices = json.prices?.slice(-SPOT_HISTORY_DAYS);

  if (!prices?.length) {
    throw new Error(`No historical prices returned for ${pair}`);
  }

  return {
    latestPrice: prices.at(-1)?.[1] ?? prices[0][1],
    pair,
    series: buildCandlesFromDailyPrices(prices),
  } satisfies SpotHistorySnapshot;
}

export async function getSpotHistorySnapshots() {
  const [btcUsd, ethUsd] = await Promise.all([
    getHistoricalSeries("BTC/USD"),
    getHistoricalSeries("ETH/USD"),
  ]);

  return {
    "BTC/USD": btcUsd,
    "ETH/USD": ethUsd,
  } satisfies Record<SpotHistorySnapshot["pair"], SpotHistorySnapshot>;
}
