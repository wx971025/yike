import GroupMultiFilter from "./GroupMultiFilter";
import type { GroupFilterSelection } from "../utils/groupFilter";

interface PageGroupFilterProps {
  selectedIds: GroupFilterSelection;
  onChange: (ids: GroupFilterSelection) => void;
}

export default function PageGroupFilter({
  selectedIds,
  onChange,
}: PageGroupFilterProps) {
  return (
    <div className="flex shrink-0 items-center">
      <GroupMultiFilter selectedIds={selectedIds} onChange={onChange} />
    </div>
  );
}
