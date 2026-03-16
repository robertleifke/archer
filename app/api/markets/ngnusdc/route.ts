import { getNgnPerpSnapshot } from "@/lib/ngn-perp-market";

type Handler = () => Promise<Response>;

export const GET: Handler = async function GET() {
  try {
    return Response.json(await getNgnPerpSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown NGNUSDC-PERP market error";
    console.error("NGNUSDC-PERP market route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
