import { useGroups } from "../context/GroupContext";
import { groupTagStyle, normalizeGroupColor } from "../utils/groupColor";

interface GroupTagProps {
  groupId: number | null;
  name?: string;
  className?: string;
}

export default function GroupTag({ groupId, name, className = "" }: GroupTagProps) {
  const { groups } = useGroups();
  const group = groupId == null ? null : groups.find((g) => g.id === groupId);
  const label =
    name ??
    (groupId == null ? "无分组" : group?.name ?? "未知分组");

  if (groupId == null) {
    return (
      <span
        className={`inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={groupTagStyle(normalizeGroupColor(group?.color))}
    >
      {label}
    </span>
  );
}
