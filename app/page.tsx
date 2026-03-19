import { getBtcSquaredPerpSnapshot } from "@/lib/btc-squared-market";
import { getBtcSquaredOrderBook } from "@/lib/matching-backend";
import { getNgnPerpSnapshot } from "@/lib/ngn-perp-market";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  const [initialBtcSnapshot, initialBtcOrderBook, initialNgnSnapshot] = await Promise.all([
    getBtcSquaredPerpSnapshot().catch(() => null),
    getBtcSquaredOrderBook().catch(() => null),
    getNgnPerpSnapshot().catch(() => null),
  ]);

  return (
    <TradingTerminal
      initialBtcOrderBook={initialBtcOrderBook}
      initialBtcSnapshot={initialBtcSnapshot}
      initialNgnSnapshot={initialNgnSnapshot}
    />
  );
}
