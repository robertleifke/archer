import { getBtcConvexOrderBook } from "@/lib/matching-backend";

type Handler = () => Promise<Response>;

export const GET: Handler = async function GET() {
  try {
    return Response.json(await getBtcConvexOrderBook());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown matching backend book error";
    console.error("BTC convex perp matching backend route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
