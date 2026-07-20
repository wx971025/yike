type MentionBadgeVariant = "user" | "assistant" | "input";

const variantClasses: Record<MentionBadgeVariant, string> = {
  user: "mx-0.5 inline-block rounded border-l-2 border-white/50 bg-white/15 px-1.5 py-0.5 text-xs font-semibold not-italic text-blue-50 no-underline",
  assistant:
    "mx-0.5 inline-block rounded border-l-2 border-violet-400 bg-violet-50 px-1.5 py-0.5 text-xs font-semibold not-italic text-violet-700 no-underline dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200",
  input:
    "mx-0.5 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
};

export default function MentionBadge({
  name,
  variant,
}: {
  name: string;
  variant: MentionBadgeVariant;
}) {
  return (
    <span className={variantClasses[variant]} title={`引用分组：${name}`}>
      @{name}
    </span>
  );
}
