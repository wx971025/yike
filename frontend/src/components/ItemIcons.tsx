export function IconButton({
  title,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}

export const CurveIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M2 14 L6 10 L10 12 L18 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 4 H18 V8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EditIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12.5 3.5 L16.5 7.5 L7 17 H3 V13 Z" strokeLinejoin="round" />
  </svg>
);

export const DeleteIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 6 H16" strokeLinecap="round" />
    <path d="M8 6 V4.5 H12 V6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 6 L7.2 15 H12.8 L13.5 6" strokeLinejoin="round" />
  </svg>
);

export const StarIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
    <path d="M10 1.6l2.2 4.5 4.9.7-3.55 3.46.84 4.88L10 12.9l-4.39 2.31.84-4.88L2.9 6.8l4.9-.7L10 1.6z" />
  </svg>
);

export const SparkleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.5 2.5 10.5 6.5 14.5 7.5 10.5 8.5 9.5 12.5 8.5 8.5 4.5 7.5 8.5 6.5 9.5 2.5Z" />
    <path d="M17.5 14.5 18.1 16.5 20.1 17.1 18.1 17.7 17.5 19.7 16.9 17.7 14.9 17.1 16.9 16.5 17.5 14.5Z" />
  </svg>
);

export const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14" strokeLinecap="round" />
    <path d="M5 12h14" strokeLinecap="round" />
  </svg>
);

export const MoreIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
    <circle cx="10" cy="4" r="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="10" cy="16" r="1.5" />
  </svg>
);

export const CloseIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 5l10 10" strokeLinecap="round" />
    <path d="M15 5L5 15" strokeLinecap="round" />
  </svg>
);

export const ChevronRightIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronLeftIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronDownIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const JoinPlanIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path
      d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"
      strokeLinejoin="round"
    />
    <path d="M3.5 8.5h13" strokeLinecap="round" />
    <path d="M7 3.5v3" strokeLinecap="round" />
    <path d="M13 3.5v3" strokeLinecap="round" />
    <path d="M7.2 12.8l1.5 1.5 3.8-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LeavePlanIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path
      d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"
      strokeLinejoin="round"
    />
    <path d="M3.5 8.5h13" strokeLinecap="round" />
    <path d="M7 3.5v3" strokeLinecap="round" />
    <path d="M13 3.5v3" strokeLinecap="round" />
    <path d="M8.5 12l3 3" strokeLinecap="round" />
    <path d="M11.5 12l-3 3" strokeLinecap="round" />
  </svg>
);

export const GearIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ClearContextIcon = () => (
  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10a6 6 0 1 0 1.2-3.6" />
    <path d="M4 6v4h4" />
  </svg>
);
