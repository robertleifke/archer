import "server-only";

import type { Candle } from "@/lib/trading.types";

const API_VERSION = "v1";
const CDN_BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";
const API_PUBLICATION_LAG_DAYS = 1;
const SPOT_HISTORY_DAYS = 30;

export type SpotHistorySnapshot = {
  latestPrice: number;
  pair: "EUR/USD" | "NGN/USD";
  series: Candle[];
};

type ExchangeApiResponse = {
  date?: string;
} & Record<string, Record<string, number> | string | undefined>;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function fetchExchangeRate(date: string, base: string, quote: string) {
  const path = `${API_VERSION}/currencies/${base}.json`;
  const primaryUrl = `${CDN_BASE_URL}@${date}/${path}`;
  const fallbackUrl = `https://${date}.currency-api.pages.dev/${path}`;

  for (const url of [primaryUrl, fallbackUrl]) {
    try {
      const response = await fetch(url, {
        next: {
          revalidate: 86_400,
        },
      });

      if (!response.ok) {
        continue;
      }

      const json = (await response.json()) as ExchangeApiResponse;
      const rates = json[base] as Record<string, number> | undefined;
      const rate = rates?.[quote];

      if (typeof rate === "number" && Number.isFinite(rate)) {
        return { date: json.date ?? date, rate };
      }
    } catch {
      // Try the next mirrored exchange-api endpoint.
    }
  }

  return null;
}

function buildCandlesFromDailyRates(rates: { date: string; rate: number }[]) {
  return rates.map((entry, index) => {
    const previousRate = rates[index - 1]?.rate ?? entry.rate;
    const open = previousRate;
    const close = entry.rate;
    const high = Math.max(open, close) * 1.0025;
    const low = Math.min(open, close) * 0.9975;
    const volume = 180 + Math.round(Math.abs(close - open) * (close > 50 ? 14 : 120_000));

    return {
      close: Number(close.toFixed(close > 10 ? 2 : 4)),
      high: Number(high.toFixed(close > 10 ? 2 : 4)),
      low: Number(low.toFixed(close > 10 ? 2 : 4)),
      open: Number(open.toFixed(close > 10 ? 2 : 4)),
      time: entry.date.slice(5),
      volume,
    } satisfies Candle;
  });
}

async function getHistoricalSeries(pair: "EUR/USD" | "NGN/USD") {
  const config =
    pair === "NGN/USD"
      ? { base: "usd", quote: "ngn" }
      : { base: "eur", quote: "usd" };

  const latestPublishedDate = new Date();
  latestPublishedDate.setUTCDate(latestPublishedDate.getUTCDate() - API_PUBLICATION_LAG_DAYS);
  const dates = Array.from({ length: SPOT_HISTORY_DAYS }, (_, index) => {
    const date = new Date(latestPublishedDate);
    date.setUTCDate(
      latestPublishedDate.getUTCDate() - (SPOT_HISTORY_DAYS - 1 - index),
    );
    return formatDate(date);
  });

  const responses = await Promise.all(
    dates.map((date) => fetchExchangeRate(date, config.base, config.quote)),
  );
  const rates = responses.filter(
    (response): response is { date: string; rate: number } => response !== null,
  );

  if (!rates.length) {
    throw new Error(`No historical rates returned for ${pair}`);
  }

  return {
    latestPrice: rates.at(-1)?.rate ?? rates[0].rate,
    pair,
    series: buildCandlesFromDailyRates(rates),
  } satisfies SpotHistorySnapshot;
}

export async function getSpotHistorySnapshots() {
  const [eurUsd, ngnUsd] = await Promise.all([
    getHistoricalSeries("EUR/USD"),
    getHistoricalSeries("NGN/USD"),
  ]);

  return {
    "EUR/USD": eurUsd,
    "NGN/USD": ngnUsd,
  } satisfies Record<SpotHistorySnapshot["pair"], SpotHistorySnapshot>;
}
