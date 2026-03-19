import { ChevronDown, Info } from "lucide-react";
import type {
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
    return "Convex";
  }

  if (mode === "delta") {
    return "Delta Eq";
  }

  return "Notional";
}

function getInputSuffix(baseAsset: string, mode: ConvexSizingMode) {
  if (mode === "convex") {
    return "cvx";
  }

  if (mode === "delta") {
    return baseAsset;
  }

  return "USDC";
}

export function TradePanel({
  allocation,
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
  settlementWallet,
  size,
  sizingMode,
  submissionEnabled,
  submissionNotice,
  supportedSizingModes,
  tradeSide,
  onAllocationChange,
  onOrderTypeChange,
  onPostOnlyToggle,
  onSideChange,
  onSizeChange,
  onSizingModeChange,
}: {
  allocation: number;
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
  settlementWallet: string;
  size: string;
  sizingMode: ConvexSizingMode;
  submissionEnabled: boolean;
  submissionNotice: string;
  supportedSizingModes: ConvexSizingMode[];
  tradeSide: "buy" | "sell";
  onAllocationChange: (value: number) => void;
  onOrderTypeChange: (type: "Limit" | "Market" | "Stop") => void;
  onPostOnlyToggle: () => void;
  onSideChange: (side: "buy" | "sell") => void;
  onSizeChange: (value: string) => void;
  onSizingModeChange: (mode: ConvexSizingMode) => void;
}) {
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
            <span className="block font-semibold text-[#D1FAE5] text-sm">Long Convexity</span>
            <span className="mt-0.5 block text-[#8CC9A3] text-[11px]">Long gamma. Benefits from larger moves.</span>
          </button>
          <button
            className={cn(
              "rounded-sm px-3 py-2 text-left",
              tradeSide === "sell" ? "bg-[#4D1717]" : "bg-[#101820]",
            )}
            onClick={() => onSideChange("sell")}
            type="button"
          >
            <span className="block font-semibold text-[#FDE2E2] text-sm">Short Convexity</span>
            <span className="mt-0.5 block text-[#D59C9C] text-[11px]">Short gamma. Benefits from realized stability.</span>
          </button>
        </div>

        <div className="space-y-1 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <LabelValueRow label="Contract" value={contractLabel} />
          <LabelValueRow label="Available Margin" value={`250,000 ${quoteAsset}`} />
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

        <ConvexityExposureCard baseAsset={baseAsset} metrics={exposureMetrics} />

        <div className="space-y-2 rounded-sm border border-[#1B2430] bg-[#11161D] p-2">
          <div className="flex items-center justify-between">
            <div className="text-[#6B7280] text-[10px] uppercase tracking-[0.14em]">Position Shape</div>
            <span className="text-[#9CA3AF] text-[10px] uppercase tracking-[0.14em]">P&amp;L vs BTC</span>
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
              !submissionEnabled && "cursor-not-allowed bg-[#151B23] text-[#6B7280]",
            )}
            disabled={!submissionEnabled}
            type="button"
          >
            {submissionEnabled
              ? `${tradeSide === "buy" ? "Long" : "Short"} Convexity`
              : "Wallet Signing Required"}
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
          <LabelValueRow label="Mark" value={exposureMetrics.markPrice.toFixed(2)} />
          <LabelValueRow label="Entry Reference" value={exposureMetrics.entryReferencePrice.toFixed(2)} />
          <LabelValueRow label="Settlement" value={quoteAsset} />
          <LabelValueRow label="Delta Notional" value={`$${Math.round(exposureMetrics.deltaNotionalUsd).toLocaleString("en-US")}`} />
          <LabelValueRow label="Break-even Move" value={`±${exposureMetrics.breakEvenMovePercent.toFixed(2)}%`} />
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-[#6B7280]">
              Gamma
              <span title="Displayed as delta change in BTC for a 1% move in BTC spot.">
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
