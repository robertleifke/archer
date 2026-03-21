import { getBtcConvexOpenOrders } from "@/lib/matching-backend";

type Handler = (request: Request) => Promise<Response>;

export const GET: Handler = async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");

    if (!ownerAddress) {
      return Response.json(
        {
          error: "ownerAddress is required",
        },
        { status: 400 },
      );
    }

    return Response.json(await getBtcConvexOpenOrders(ownerAddress));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown convex perp open-orders error";
    console.error("BTC convex perp open-orders route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
