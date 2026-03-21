import { getBtcConvexRiskSnapshot } from "@/lib/risk-service";

type Handler = (request: Request) => Promise<Response>;

export const GET: Handler = async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");
    const side = searchParams.get("side");
    const sizeBtc = searchParams.get("sizeBtc");

    if (
      !ownerAddress ||
      (side !== "buy" && side !== "sell") ||
      !sizeBtc
    ) {
      return Response.json(
        {
          error: "Invalid convex perp risk query",
        },
        { status: 400 },
      );
    }

    return Response.json(
      await getBtcConvexRiskSnapshot({
        ownerAddress,
        side,
        sizeBtc,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown convex perp risk error";
    console.error("BTC convex perp risk route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
