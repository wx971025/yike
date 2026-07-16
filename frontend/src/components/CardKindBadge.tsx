export function CardKindBadge({
  kind,
}: {
  kind: "item" | "word" | "reminder" | "confusable_pair";
}) {
  if (kind === "word") {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        单词卡片
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
  if (kind === "reminder") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        事项卡片
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      记忆卡片
    </span>
  );
}
