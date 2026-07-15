"use client";

import type { Category } from "@/generated/prisma/client";
import { CATEGORY_LABELS } from "@/lib/types";

interface CategoryChipsProps {
  selected: Category | undefined;
  onSelect: (category: Category | undefined) => void;
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Chip label="すべて" active={selected === undefined} onClick={() => onSelect(undefined)} />
      {CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={CATEGORY_LABELS[c]}
          active={selected === c}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </button>
  );
}
