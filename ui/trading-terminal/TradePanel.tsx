import { ChevronDown, Info } from "lucide-react";
import {
  formatExposureUsd,
  formatFundingVarianceBps,
  formatVariancePrice,
  formatVolPercentFromVariance,
} from "@/lib/btcvar30-display";
import type {
  BtcConvexAccountSnapshot,
  BtcConvexRiskSnapshot,
  ConvexExposureMetrics,
  ConvexSizingMode,
  DeliveryTerm,
} from "@/lib/trading.types";
import { cn } from "@/lib/cn";
import { ConvexityExposureCard } from "@/ui/trading-terminal/ConvexityExposureCard";
import { PositionShapeSparkline } from "@/ui/trading-terminal/PositionShapeSparkline";

function LabelValueRow({
  label,
  tooltip,
  value,
}: {
  label: string;
  tooltip?: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-start gap-x-3 text-[11px]">
      <span className="flex min-w-0 items-center gap-1 text-[#6B7280]">
        {label}
        {tooltip ? (
          <span title={tooltip}>
            <Info className="size-3" />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "wrap-break-word min-w-0 text-right font-medium text-[#D1D5DB] leading-snug",
          value.startsWith("+$") && "text-[#8CC9A3]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function getSizingModeLabel(mode: ConvexSizingMode) {
  if (mode === "convex") {
    return "Variance";
  }

  if (mode === "delta") {
    return "Spot Sens";
  }

  return "Notional";
}

function getInputSuffix(baseAsset: string, mode: ConvexSizingMode) {
  if (mode === "convex") {
    return "var";
  }

  if (mode === "delta") {
    return baseAsset;
  }

  return "USDC";
}

export function TradePanel({
  allocation,
  accountSnapshot,
  baseAsset,
  contractDetails,
  contractLabel,
  executionMode,
  exposureMetrics,
  lastAction,
  orderType,
  positionOverview,
  postOnly,
  quoteAsset,
  riskSnapshot,
  settlementWallet,
  size,
  sizingMode,
  submissionEnabled,
  submissionPending,
  submissionNotice,
  submitLabel,
  supportedSizingModes,
  tradeSide,
  onAllocationChange,
  onOrderTypeChange,
  onPostOnlyToggle,
  onSideChange,
  onSizeChange,
  onSizingModeChange,
  onSubmit,
}: {
  allocation: number;
  accountSnapshot: BtcConvexAccountSnapshot | null;
  baseAsset: string;
  contractDetails: DeliveryTerm[];
  contractLabel: string;
  executionMode: "disabled" | "ready";
  exposureMetrics: ConvexExposureMetrics;
  lastAction: string;
  orderType: "Limit" | "Market" | "Stop";
  positionOverview: DeliveryTerm[];
  postOnly: boolean;
  quoteAsset: string;
  riskSnapshot: BtcConvexRiskSnapshot | null;
  settlementWallet: string;
  size: string;
  sizingMode: ConvexSizingMode;
  submissionEnabled: boolean;
  submissionPending: boolean;
  submissionNotice: string;
  submitLabel: string;
  supportedSizingModes: ConvexSizingMode[];
  tradeSide: "buy" | "sell";
  onAllocationChange: (value: number) => void;
  onOrderTypeChange: (type: "Limit" | "Market" | "Stop") => void;
  onPostOnlyToggle: () => void;
  onSideChange: (side: "buy" | "sell") => void;
  onSizeChange: (value: string) => void;
  onSizingModeChange: (mode: ConvexSizingMode) => void;
  onSubmit: () => void;
}) {
  let freeCollateralValue = `-- ${quoteAsset}`;

  if (riskSnapshot) {
    freeCollateralValue = `${riskSnapshot.freeCollateralUsdDisplay} ${quoteAsset}`;
  } else if (accountSnapshot) {
    freeCollateralValue = `${accountSnapshot.cashBalanceUsdDisplay} ${quoteAsset}`;
  }

  return (
    <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-md border border-[#1B2430] bg-[#0F1720] xl:min-h-0">
      <div className="space-y-2 overflow-y-auto p-2.5 text-[11px]">
        <div className="grid grid-cols-3 gap-1 rounded-sm bg-[#11161D] p-1">
          {["Market", "Limit", "Stop"].map((tab) => (
            <button
              className={cn(
                "rounded-sm px-2 py-1.5 font-medium text-[11px] transition-colors",
                orderType === tab ? "bg-[#151B23] text-[#D1D5DB]" : "text-[#6B7280]",
              )}
              key={tab}
              onClick={() => onOrderTypeChange(tab as "Limit" | "Market" | "Stop")}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            className={cn(
              "rounded-sm px-3 py-2 text-left",
              tradeSide === "buy" ? "bg-[#123524]" : "bg-[#101820]",
            )}
            onClick={() => onSideChange("buy")}
            type="button"
          >
            <span className="block font-semibold text-[#D1FAE5] text-sm">Long Volatility</span>
            <span className="mt-0.5 block text-[#8CC9A3] text-[11px]">Benefits when implied volatility rises.</span>
          </button>
          <button
            className={cn(
              "rounded-sm px-3 py-2 text-left",
              tradeSide === "sell" ? "bg-[#4D1717]" : "bg-[#101820]",
            )}
            onClick={() => onSideChange("sell")}
            type="button"
          >
            <span className="block font-semibold text-[#FDE2E2] text-sm">Short Volatility</span>
            <span className="mt-0.5 block text-[#D59C9C] text-[11px]">Benefits when implied volatility falls.</span>
          </button>
        </div>

        <div
          className="rounded-sm border border-[#1F3C55] bg-[#0E2233]/70 px-2 py-1.5 text-[#BFDBFE] text-[11px]"
          title="Orders are matched using implied variance. The interface displays the equivalent 30-day implied volatility."
        >
          Submitted in variance, displayed in volatility
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <LabelValueRow label="Contract" value={contractLabel} />
          <LabelValueRow
            label="Cash Balance"
            value={accountSnapshot ? `${accountSnapshot.cashBalanceUsdDisplay} ${quoteAsset}` : `-- ${quoteAsset}`}
          />
          <LabelValueRow
            label="Free Collateral"
            value={freeCollateralValue}
          />
          <LabelValueRow
            label="Post-Trade IM"
            value={riskSnapshot ? `${riskSnapshot.postTradeInitialMarginUsdDisplay} ${quoteAsset}` : `-- ${quoteAsset}`}
          />
          <LabelValueRow
            label="Post-Trade Free"
            value={riskSnapshot ? `${riskSnapshot.postTradeFreeCollateralUsdDisplay} ${quoteAsset}` : `-- ${quoteAsset}`}
          />
          <LabelValueRow
            label="Matching Subaccount"
            value={accountSnapshot ? `#${accountSnapshot.subaccountId}` : "--"}
          />
          <LabelValueRow label="Settlement Wallet" value={settlementWallet} />
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1 rounded-sm bg-[#11161D] p-1">
            {supportedSizingModes.map((mode) => (
              <button
                className={cn(
                  "whitespace-nowrap rounded-sm px-2 py-1.5 font-medium text-[11px] transition-colors",
                  sizingMode === mode ? "bg-[#172554]/50 text-[#BFDBFE]" : "text-[#6B7280]",
                )}
                key={mode}
                onClick={() => onSizingModeChange(mode)}
                type="button"
              >
                {getSizingModeLabel(mode)}
              </button>
            ))}
          </div>

          <label className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]" htmlFor="trade-size">
            Order Input
          </label>
          <div className="flex items-center overflow-hidden rounded-sm border border-[#1B2430] bg-[#11161D]">
            <input
              className="h-10 flex-1 bg-transparent px-3 text-[#D1D5DB] text-sm outline-none placeholder:text-[#6B7280]"
              id="trade-size"
              onChange={(event) => onSizeChange(event.target.value.replace(/[^\d.]/g, ""))}
              placeholder="1.00"
              value={size}
            />
            <button
              className="flex h-10 items-center gap-1 border-[#1B2430] border-l px-3 text-[#D1D5DB] text-sm"
              type="button"
            >
              {getInputSuffix(baseAsset, sizingMode)}
              <ChevronDown className="size-4 text-[#6B7280]" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="h-1.5 flex-1 accent-[#3B82F6]"
              max="100"
              min="0"
              onChange={(event) => onAllocationChange(Number(event.target.value))}
              type="range"
              value={allocation}
            />
            <div className="rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1 text-[#D1D5DB] text-[11px]">
              {allocation} %
            </div>
          </div>
        </div>

        <ConvexityExposureCard metrics={exposureMetrics} />

        <div className="space-y-2 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="flex items-center justify-between">
            <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Position Shape</div>
            <span className="text-[#9CA3AF] text-[10px] uppercase tracking-[0.14em]">P&amp;L vs Vol</span>
          </div>
          <PositionShapeSparkline metrics={exposureMetrics} />
        </div>

        <div className="space-y-1.5 text-[11px]">
          <button
            className="flex w-full items-center justify-between rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1.5"
            onClick={onPostOnlyToggle}
            type="button"
          >
            <span className="text-[#D1D5DB]">Post Only</span>
            <span className={cn("text-[#6B7280]", postOnly && "text-[#BFDBFE]")}>
              {postOnly ? "On" : "Off"}
            </span>
          </button>
        </div>

        <div className="rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1.5 text-[#9CA3AF] text-[11px]">
          {lastAction}
        </div>

        <div className="space-y-2 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em]">
            <span className="text-[#6B7280]">Execution</span>
            <span className={cn("font-medium", executionMode === "ready" ? "text-[#8CC9A3]" : "text-[#FBBF24]")}>
              {executionMode === "ready" ? "Ready" : "Read Only"}
            </span>
          </div>

          <p className="text-[#9CA3AF] text-[11px] leading-relaxed">{submissionNotice}</p>

          <button
            className={cn(
              "w-full rounded-sm px-3 py-2 font-semibold text-sm transition-colors",
              tradeSide === "buy" && submissionEnabled && "bg-[#123524] text-[#D1FAE5]",
              tradeSide === "sell" && submissionEnabled && "bg-[#4D1717] text-[#FDE2E2]",
              (!submissionEnabled || submissionPending) &&
                "cursor-not-allowed bg-[#151B23] text-[#6B7280]",
            )}
            disabled={!submissionEnabled || submissionPending}
            onClick={onSubmit}
            type="button"
          >
            {submitLabel}
          </button>
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Position Summary</div>
          {positionOverview.map((item) => (
            <LabelValueRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Order Economics</div>
          <LabelValueRow label="Mark Vol" value={formatVolPercentFromVariance(exposureMetrics.markVariance)} />
          <LabelValueRow label="Variance Mark" value={formatVariancePrice(exposureMetrics.markVariance)} />
          <LabelValueRow label="Entry Vol" value={formatVolPercentFromVariance(exposureMetrics.entryReferencePrice)} />
          <LabelValueRow label="Entry Variance" value={formatVariancePrice(exposureMetrics.entryReferencePrice)} />
          <LabelValueRow label="Settlement" value={quoteAsset} />
          <LabelValueRow label="Vol Exposure" value={formatExposureUsd(exposureMetrics.volExposurePerPointUsd, "per +1 vol pt")} />
          <LabelValueRow label="Variance Exposure" value={formatExposureUsd(exposureMetrics.varianceExposurePerPoint01Usd, "per +0.01 variance")} />
          <LabelValueRow label="Funding Units" value={formatFundingVarianceBps(1)} />
          <LabelValueRow label="Break-even Move" value={`±${exposureMetrics.breakEvenMovePercent.toFixed(2)}%`} />
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-[#6B7280]">
              Gamma
              <span title="Advanced metric: displayed as delta change in BTC for a 1% move in BTC spot.">
                <Info className="size-3" />
              </span>
            </span>
            <span className="font-medium text-[#D1D5DB]">
              {exposureMetrics.gammaPer1PctMove >= 0 ? "+" : "-"}
              {Math.abs(exposureMetrics.gammaPer1PctMove).toFixed(3)} {baseAsset} / 1%
            </span>
          </div>
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Delivery Terms</div>
          {contractDetails.map((item) => (
            <LabelValueRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
