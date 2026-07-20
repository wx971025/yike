export const GROUP_COLOR_PRESETS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#a855f7",
] as const;

export const DEFAULT_GROUP_COLOR = GROUP_COLOR_PRESETS[0];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeGroupColor(color: string | null | undefined): string {
  if (!color || !HEX_COLOR_RE.test(color)) return DEFAULT_GROUP_COLOR;
  return color.toUpperCase();
}

export function presetColorForIndex(index: number): string {
  return GROUP_COLOR_PRESETS[index % GROUP_COLOR_PRESETS.length];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeGroupColor(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function groupTagTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1e293b" : "#ffffff";
}

export function groupTagStyle(color: string | null | undefined): {
  backgroundColor: string;
  color: string;
} {
  const bg = normalizeGroupColor(color);
  return {
    backgroundColor: bg,
    color: groupTagTextColor(bg),
  };
}
