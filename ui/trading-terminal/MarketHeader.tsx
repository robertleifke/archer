"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ChevronDown, Dot, Search, X } from "lucide-react";
import type { ContractTab, MarketOption, MarketStat } from "@/lib/trading.types";
import { cn } from "@/lib/cn";
import { SmartImage } from "@/ui/SmartImage";

function getMarketIcon(symbol: string) {
  if (symbol.includes("NGN")) {
    return "/flags/ng.svg";
  }

  if (symbol.includes("BTC")) {
    return "/btc.svg";
  }

  if (symbol.includes("ETH")) {
    return "/eth.svg";
  }

  return null;
}

function getMarketLabelParts(symbol: string) {
  const [baseSymbol, contractLabel] = symbol.split("-");

  return {
    baseSymbol: baseSymbol ?? symbol,
    contractLabel: contractLabel ?? "",
  };
}

function formatWalletLabel(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MarketHeader({
  contractTabs,
  currentContract,
  currentMarketId,
  currentSymbol,
  infoBar,
  marketOptions,
  onContractSelect,
  onMarketSelect,
}: {
  contractTabs: ContractTab[];
  currentContract: string;
  currentMarketId: string;
  currentSymbol: string;
  infoBar: MarketStat[];
  marketOptions: MarketOption[];
  onContractSelect: (contract: string) => void;
  onMarketSelect: (marketId: string) => void;
}) {
  const primaryTabs = ["All", "Crypto", "FX"] as const;
  const [marketSearchOpen, setMarketSearchOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedPrimaryTab, setSelectedPrimaryTab] =
    useState<(typeof primaryTabs)[number]>("All");
  const { authenticated, login, logout, ready } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const normalizedSearch = marketSearch.trim().toLowerCase();
  const currentMarketIcon = getMarketIcon(currentSymbol);
  const connectedWalletAddress = wallets[0]?.address ?? null;
  const filteredMarkets = marketOptions.filter((market) => {
    const matchesPrimary =
      selectedPrimaryTab === "All" ||
      (selectedPrimaryTab === "Crypto" && market.region === "Crypto") ||
      (selectedPrimaryTab === "FX" && market.region === "FX");

    if (!matchesPrimary) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      market.symbol.toLowerCase().includes(normalizedSearch) ||
      market.frontMonth.toLowerCase().includes(normalizedSearch) ||
      market.lastPrice.toLowerCase().includes(normalizedSearch)
    );
  });

  function handleMarketPick(marketId: string) {
    onMarketSelect(marketId);
    setMarketSearchOpen(false);
    setMarketSearch("");
  }

  return (
    <header className="rounded-md border border-[#1B2430] bg-[#0F1720]">
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <SmartImage<string>
              alt="Archer"
              className="ml-3 h-6 w-24 shrink-0 sm:h-7 sm:w-28"
              imgClassName="object-left"
              priority
              src="/archer_transparent.png"
            />

            <div className="relative">
              <button
                aria-expanded={marketSearchOpen}
                aria-haspopup="dialog"
                className="flex items-center gap-2 rounded-sm border border-[#1B2430] bg-[#11161D] px-3 py-2 text-left"
                onClick={() => setMarketSearchOpen((current) => !current)}
                type="button"
              >
                {currentMarketIcon ? (
                  <span className="flex size-5 items-center justify-center overflow-hidden">
                    <SmartImage<string>
                      alt=""
                      aria-hidden="true"
                      className="size-4"
                      imgClassName="object-contain"
                      src={currentMarketIcon}
                    />
                  </span>
                ) : null}
                <span className="font-semibold text-[#E5E7EB] text-sm">{currentSymbol}</span>
                <ChevronDown className="size-4 text-[#6B7280]" />
              </button>

              {marketSearchOpen ? (
                <div className="absolute top-[calc(100%+8px)] left-0 z-30 w-[min(420px,calc(100vw-32px))] rounded-md border border-[#1B2430] bg-[#101720] shadow-2xl shadow-black/30">
                  <div className="border-[#1B2430] border-b p-3">
                    <div className="flex h-10 items-center gap-2 rounded-sm border border-[#324051] bg-[#11161D] px-3">
                      <Search className="size-4 text-[#6B7280]" />
                      <input
                        autoFocus
                        className="flex-1 bg-transparent text-[#E5E7EB] text-sm outline-none placeholder:text-[#6B7280]"
                        onChange={(event) => setMarketSearch(event.target.value)}
                        placeholder="Search markets"
                        value={marketSearch}
                      />
                      {marketSearch ? (
                        <button
                          className="text-[#6B7280] transition-colors hover:text-[#D1D5DB]"
                          onClick={() => setMarketSearch("")}
                          type="button"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-[#1B2430] border-b px-3">
                    <div className="flex items-center gap-5 overflow-x-auto py-2 text-sm">
                      {primaryTabs.map((tab) => (
                        <button
                          className={cn(
                            "border-transparent border-b pb-1 text-[#9CA3AF] transition-colors hover:text-[#E5E7EB]",
                            selectedPrimaryTab === tab && "border-[#60A5FA] text-[#E5E7EB]",
                          )}
                          key={tab}
                          onClick={() => setSelectedPrimaryTab(tab)}
                          type="button"
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_78px_96px] gap-3 border-[#1B2430] border-b px-3 py-2 text-[#9CA3AF] text-[11px] uppercase tracking-[0.12em]">
                    <span>Symbol</span>
                    <span>Contract</span>
                    <span className="text-right">Last Price</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {filteredMarkets.length ? (
                      filteredMarkets.map((market) => {
                        const { baseSymbol, contractLabel } = getMarketLabelParts(market.symbol);

                        return (
                          <button
                          className={cn(
                            "grid w-full grid-cols-[minmax(0,1fr)_78px_96px] items-center gap-3 border-[#1B2430] border-b px-3 py-2.5 text-left transition-colors hover:bg-[#151B23]/40",
                            currentMarketId === market.id && "bg-[#172554]/20",
                          )}
                          key={market.id}
                          onClick={() => handleMarketPick(market.id)}
                          type="button"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-semibold text-[#E5E7EB] text-sm">
                            {getMarketIcon(market.symbol) ? (
                              <SmartImage<string>
                                alt=""
                                aria-hidden="true"
                                className="size-4 shrink-0"
                                imgClassName="object-contain"
                                src={getMarketIcon(market.symbol) ?? ""}
                              />
                            ) : null}
                            <span className="truncate">{baseSymbol}</span>
                          </span>

                          <div
                            className={cn(
                              "font-medium text-[11px]",
                              currentMarketId === market.id ? "text-[#BFDBFE]" : "text-[#9CA3AF]",
                            )}
                          >
                            {contractLabel || market.frontMonth}
                          </div>

                          <span className="text-right font-semibold text-[#D1D5DB] text-[11px]">
                            {market.lastPrice}
                          </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-8 text-center text-[#6B7280] text-sm">
                        No markets match &quot;{marketSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {contractTabs.length > 1 ? (
            <div className="flex items-center gap-1">
              {contractTabs.map((tab) => (
                <button
                  className={cn(
                    "rounded-sm border border-[#1B2430] bg-[#11161D] px-2 py-1 font-medium text-[#6B7280] text-[11px] transition-colors hover:border-[#2B3543] hover:text-[#D1D5DB]",
                    currentContract === tab.label && "border-[#2563EB] bg-[#172554]/40 text-[#BFDBFE]",
                  )}
                  key={tab.label}
                  onClick={() => onContractSelect(tab.label)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2 self-start">
            {ready && walletsReady && authenticated && connectedWalletAddress ? (
              <>
                <div className="rounded-sm border border-[#1B2430] bg-[#11161D] px-3 py-2 font-medium text-[#BFDBFE] text-xs">
                  {formatWalletLabel(connectedWalletAddress)}
                </div>
                <button
                  className="rounded-sm border border-[#1B2430] bg-[#11161D] px-3 py-2 font-medium text-[#9CA3AF] text-xs transition-colors hover:text-[#E5E7EB]"
                  onClick={() => void logout()}
                  type="button"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                className="rounded-sm border border-[#2563EB] bg-[#172554]/50 px-3 py-2 font-semibold text-[#BFDBFE] text-xs transition-colors hover:bg-[#1D4ED8]/20 disabled:cursor-wait disabled:opacity-70"
                disabled={!ready}
                onClick={() => login()}
                type="button"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        <div className="flex min-h-9 items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-sm border border-[#1B2430] bg-[#11161D] px-3 py-2 text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {infoBar.map((stat, index) => (
            <div className="flex shrink-0 items-center gap-2" key={stat.label}>
              {index > 0 ? <Dot className="size-3 text-[#374151]" /> : null}
              <span className="font-medium text-[#9CA3AF]">{stat.label}</span>
              <span
                className={cn(
                  "font-semibold text-[#D1D5DB]",
                  stat.tone === "accent" && "text-[#60A5FA]",
                )}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
