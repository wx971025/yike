import GroupSelector from "./GroupSelector";

export default function PageGroupFilter() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">分组筛选</span>
      <GroupSelector />
    </div>
  );
}
