import { getBtcConvexPerpSnapshot } from "@/lib/btc-convex-market";
import { getBtcConvexOrderBook } from "@/lib/matching-backend";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  const [initialBtcSnapshot, initialBtcOrderBook] = await Promise.all([
    getBtcConvexPerpSnapshot().catch(() => null),
    getBtcConvexOrderBook().catch(() => null),
  ]);

  return (
    <TradingTerminal
      initialBtcOrderBook={initialBtcOrderBook}
      initialBtcSnapshot={initialBtcSnapshot}
    />
  );
}
