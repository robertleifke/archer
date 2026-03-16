import { getNgnSquaredPerpSnapshot } from "@/lib/ngn-squared-market";

type Handler = () => Promise<Response>;

export const GET: Handler = async function GET() {
  try {
    return Response.json(await getNgnSquaredPerpSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown NGNUSDC-SQPERP market error";
    console.error("NGNUSDC-SQPERP market route failed:", error);

    return Response.json(
      {
        error: message,
      },
      { status: 502 },
    );
  }
};
