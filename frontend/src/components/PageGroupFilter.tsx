import GroupMultiFilter from "./GroupMultiFilter";
import type { GroupCategory } from "../types";
import type { GroupFilterSelection } from "../utils/groupFilter";

interface PageGroupFilterProps {
  selectedIds: GroupFilterSelection;
  onChange: (ids: GroupFilterSelection) => void;
  category?: GroupCategory | GroupCategory[];
}

export default function PageGroupFilter({
  selectedIds,
  onChange,
  category,
}: PageGroupFilterProps) {
  return (
    <div className="flex shrink-0 items-center">
      <GroupMultiFilter
        selectedIds={selectedIds}
        onChange={onChange}
        category={category}
      />
    </div>
  );
}
