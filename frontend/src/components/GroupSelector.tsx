import { useGroups } from "../context/GroupContext";

export default function GroupSelector() {
  const { groups, selectedGroupId, setSelectedGroupId } = useGroups();

  return (
    <select
      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
      value={selectedGroupId ?? ""}
      onChange={(e) =>
        setSelectedGroupId(e.target.value === "" ? null : Number(e.target.value))
      }
    >
      <option value="">全部分组</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}
