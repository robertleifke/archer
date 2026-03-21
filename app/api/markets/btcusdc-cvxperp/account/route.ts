import { getBtcConvexAccountSnapshot } from "@/lib/convex-account";

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

    return Response.json(await getBtcConvexAccountSnapshot(ownerAddress));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown convex perp account error";
    console.error("BTC convex perp account route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
