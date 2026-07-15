import { prisma } from "@/lib/prisma";
import { runIngestion } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOLDOWN_MS = 10 * 60 * 1000;

export async function POST() {
  const latest = await prisma.article.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  if (latest && Date.now() - latest.fetchedAt.getTime() < COOLDOWN_MS) {
    return Response.json(
      { error: "cooldown", retryAfterMs: COOLDOWN_MS - (Date.now() - latest.fetchedAt.getTime()) },
      { status: 429 }
    );
  }

  const result = await runIngestion();
  return Response.json(result);
}
