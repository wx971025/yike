export function CardKindBadge({ kind }: { kind: "item" | "word" }) {
  if (kind === "word") {
    return (
      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
        单词卡片
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      普通卡片
    </span>
  );
}
