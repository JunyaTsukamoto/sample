import type { Category } from "@/generated/prisma/client";
import { getRankedFeed } from "@/lib/ranking";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: Category[] = [
  "AI_TECH",
  "GOV_POLICY",
  "SOCIAL_DATA_METHOD",
  "ACADEMIC_RESEARCH",
  "CORPORATE_BUSINESS",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const categoryParam = searchParams.get("category");
  const category =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as Category)
      ? (categoryParam as Category)
      : undefined;

  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? Number.parseInt(cursorParam, 10) : 0;

  const result = await getRankedFeed({ category, cursor: Number.isNaN(cursor) ? 0 : cursor });
  return Response.json(result);
}
