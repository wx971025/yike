interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
}

const logoSizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export default function BrandMark({
  size = "md",
  showText = true,
  subtitle = "科学复习，刻进记忆",
}: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="忆刻"
        className={`${logoSizes[size]} shrink-0 rounded-xl shadow-sm`}
      />
      {showText && (
        <div>
          <div className="text-lg font-bold text-blue-600">忆刻</div>
          {subtitle && <div className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
