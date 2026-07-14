import { useEffect, useRef } from "react";
import { DeleteIcon, EditIcon, MoreIcon } from "./ItemIcons";

interface ItemActionsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MenuItem({
  label,
  icon,
  onClick,
  className = "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60",
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${className}`}
    >
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      {label}
    </button>
  );
}

export default function ItemActionsMenu({
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ItemActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onOpenChange]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative inline-flex justify-end">
      <button
        type="button"
        title="更多操作"
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-32 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-lg">
          <MenuItem
            label="编辑"
            icon={<EditIcon />}
            onClick={() => run(onEdit)}
            className="text-blue-700 hover:bg-blue-50"
          />
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <MenuItem
            label="删除"
            icon={<DeleteIcon />}
            onClick={() => run(onDelete)}
            className="text-red-600 hover:bg-red-50"
          />
        </div>
      )}
    </div>
  );
}
