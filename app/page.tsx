import { getSpotHistorySnapshots } from "@/lib/exchange-api-history";
import type { SpotHistorySnapshot } from "@/lib/exchange-api-history";
import { TradingTerminal } from "@/ui/trading-terminal/TradingTerminal";

export default async function Home() {
  let spotHistory: Record<SpotHistorySnapshot["pair"], SpotHistorySnapshot> | null = null;

  try {
    spotHistory = await getSpotHistorySnapshots();
  } catch {
    spotHistory = null;
  }

  return <TradingTerminal spotHistory={spotHistory} />;
}
