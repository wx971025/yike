export function CardKindBadge({
  kind,
}: {
  kind:
    | "item"
    | "word"
    | "word_spell"
    | "word_recognize"
    | "confusable_pair";
}) {
  if (kind === "word" || kind === "word_spell" || kind === "word_recognize") {
    const suffix =
      kind === "word_spell" ? " · 拼写" : kind === "word_recognize" ? " · 认知" : "";
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        单词卡片{suffix}
      </span>
    );
  }
  if (kind === "confusable_pair") {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
        易混词对
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      记忆卡片
    </span>
  );
}
