import { verifyCronSecret } from "@/lib/auth-cron";
import { runIngestion } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const result = await runIngestion();
  return Response.json(result);
}
