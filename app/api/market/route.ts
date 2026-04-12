/**
 * Lightweight market snapshot for the dashboard banner.
 * Replace with live feeds (DEX / CEX) when ready.
 */
export async function GET() {
  return Response.json({
    solPrice: 142.3,
    solChangePct: 3.2,
  });
}
