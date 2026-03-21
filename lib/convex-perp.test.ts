import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVolPercentFromVariance } from "@/lib/btcvar30-display";
import {
  buildConvexExposureMetrics,
  generateNonlinearConvexOrderBook,
  getConvexPnlUsd,
} from "@/lib/convex-perp";

describe("btcvar30 pnl scaling", () => {
  it("uses normalized variance differences for pnl", () => {
    assert.ok(Math.abs(getConvexPnlUsd(10_000, 0.25, 0.2728, "buy") - 228) < 1e-10);
    assert.ok(Math.abs(getConvexPnlUsd(10_000, 0.25, 0.2728, "sell") + 228) < 1e-10);
  });

  it("keeps preview pnl and scenario pnl human-scale", () => {
    const metrics = buildConvexExposureMetrics({
      entryReferencePrice: 0.25,
      inputValue: 10_000,
      markPrice: 0.2728,
      referencePrice: 0.2728,
      side: "buy",
      sizingMode: "notional",
    });

    assert.ok(Math.abs(metrics.pnlUsd - 228) < 1e-10);
    assert.ok(Math.abs(metrics.markVariance - 0.2728) < 1e-10);
    assert.ok(Math.abs(metrics.markVolPercent - 52.23) < 0.01);
    assert.ok(metrics.scenarioPnl.every((scenario) => Math.abs(scenario.pnlUsd) < 100_000));
    assert.ok(metrics.scenarioPnl.every((scenario) => !scenario.displayValue?.includes("000000")));
    assert.deepEqual(
      metrics.scenarioPnl.slice(0, 4).map((scenario) => scenario.changeLabel),
      ["Vol +5 pts", "Vol -5 pts", "Vol +10 pts", "Vol -10 pts"],
    );
  });

  it("generates a non-degenerate visible vol ladder", () => {
    const book = generateNonlinearConvexOrderBook({
      baseTopLevelSize: 6.5,
      convexityRisk: 0.42,
      externalImbalance: 0.08,
      fundingRateBps: 1,
      inventorySkew: -0.12,
      levels: 8,
      midPrice: 0.2728,
      realizedVol: 0.48,
      referencePrice: 0.2609,
    });

    const askDisplayLevels = book.asks.map((level) => formatVolPercentFromVariance(level.price));
    const bidDisplayLevels = book.bids.map((level) => formatVolPercentFromVariance(level.price));

    assert.equal(new Set(askDisplayLevels).size, askDisplayLevels.length);
    assert.equal(new Set(bidDisplayLevels).size, bidDisplayLevels.length);
  });
});
