import re

GROUP_COLOR_PRESETS = [
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
]

DEFAULT_GROUP_COLOR = GROUP_COLOR_PRESETS[0]
_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalize_group_color(color: str | None) -> str:
    if color is None:
        return DEFAULT_GROUP_COLOR
    value = color.strip()
    if not _HEX_COLOR_RE.match(value):
        raise ValueError("无效的颜色格式，请使用 #RRGGBB")
    return value.upper()


def preset_color_for_index(index: int) -> str:
    return GROUP_COLOR_PRESETS[index % len(GROUP_COLOR_PRESETS)]
