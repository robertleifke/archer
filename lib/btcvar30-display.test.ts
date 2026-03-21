import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayedVolSpread,
  formatDisplayedVolSpread,
  formatExposureUsd,
  formatFundingVarianceBps,
  formatVariancePrice,
  formatVolPercentFromVariance,
  getBtcVar30ExposureDisplay,
  getBtcVar30DisplayFields,
  getDisplaySpotSensitivityBtc,
  normalizeEnginePriceToVariance,
  ticksToVariance,
  ticksToVolPercent,
  varianceToVolPercent,
} from "@/lib/btcvar30-display";

describe("btcvar30 display conversions", () => {
  it("normalizes ticks before converting to displayed vol", () => {
    assert.ok(Math.abs(ticksToVariance(2728) - 0.2728) < 1e-10);
    assert.ok(Math.abs(ticksToVolPercent(2728) - 52.23) < 0.01);
  });

  it("auto-normalizes raw engine prices for header formatting", () => {
    const display = getBtcVar30DisplayFields({
      indexValue: 2600,
      indexValueSource: "ticks",
      markValue: 2728,
      markValueSource: "ticks",
    });

    assert.ok(Math.abs(display.indexVariance - 0.26) < 1e-10);
    assert.ok(Math.abs(display.markVariance - 0.2728) < 1e-10);
    assert.equal(display.displayMarkVol, "52.23%");
    assert.equal(formatVariancePrice(display.markVariance), "0.2728");
    assert.ok(display.markVolPercent < 500);
  });

  it("formats realistic BTCVAR30 order book prices from normalized variance", () => {
    const variance = normalizeEnginePriceToVariance(2728, "ticks");

    assert.equal(formatVolPercentFromVariance(variance), "52.23%");
    assert.ok(varianceToVolPercent(variance) < 500);
  });

  it("computes spread in displayed vol points from variance-native best bid and ask", () => {
    const bestBidVariance = 0.2704;
    const bestAskVariance = 0.2728;

    assert.ok(displayedVolSpread(bestBidVariance, bestAskVariance) > 0);
    assert.equal(formatDisplayedVolSpread(bestBidVariance, bestAskVariance), "0.23 pts");
  });

  it("keeps vol and variance exposure displays mathematically consistent", () => {
    const exposure = getBtcVar30ExposureDisplay({
      markVariance: 0.2728,
      varianceExposurePerPoint01Usd: 12_800,
    });

    assert.ok(Math.abs(exposure.volExposurePerPointUsd - 13_370.9464) < 0.01);
    assert.equal(formatExposureUsd(exposure.varianceExposurePerPoint01Usd, "per +0.01 variance"), "+$12,800 per +0.01 variance");
    assert.equal(formatExposureUsd(exposure.volExposurePerPointUsd, "per +1 vol pt"), "+$13,371 per +1 vol pt");
  });

  it("guards spot sensitivity and funding display labels", () => {
    assert.equal(getDisplaySpotSensitivityBtc(12.34), 12.34);
    assert.equal(getDisplaySpotSensitivityBtc(999_999), null);
    assert.equal(formatFundingVarianceBps(1), "Funding (variance): 1.00 bps");
  });

  it("would fail loudly if sqrt were applied directly to ticks", () => {
    const wrongVolPercent = Math.sqrt(2728) * 100;
    const correctVolPercent = ticksToVolPercent(2728);

    assert.ok(wrongVolPercent > 500);
    assert.ok(Math.abs(correctVolPercent - 52.23) < 0.01);
    assert.ok(wrongVolPercent > correctVolPercent * 10);
  });
});
