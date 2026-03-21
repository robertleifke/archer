import { getBtcConvexPerpSnapshot } from "@/lib/btc-convex-market";

type Handler = () => Promise<Response>;

export const GET: Handler = async function GET() {
  try {
    return Response.json(await getBtcConvexPerpSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BTC convex perp market error";
    console.error("BTC convex perp market route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
