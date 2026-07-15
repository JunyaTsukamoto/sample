import type { InteractionType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { INTERACTION_WEIGHTS, updateAffinities } from "@/lib/affinity";

export const dynamic = "force-dynamic";

const VALID_TYPES: InteractionType[] = ["VIEW", "CLICK", "LIKE", "DISMISS"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const articleId = body?.articleId;
  const type = body?.type;

  if (typeof articleId !== "string" || !VALID_TYPES.includes(type)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const weight = INTERACTION_WEIGHTS[type as InteractionType];
  await prisma.interaction.create({
    data: { articleId, type, weight },
  });
  await updateAffinities(article, weight);

  return Response.json({ ok: true });
}
