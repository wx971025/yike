/** 发送/API 使用的 @ 分组引用格式：@[分组名](mention:group) */
const MARKDOWN_MENTION_SOURCE = /@\[([^\]]+)\]\(mention:group\)/;

/** 输入框内紧凑 mention 结尾标记（零宽空格，不占视觉宽度） */
export const MENTION_END = "\u200B";

function markdownMentionRegex(): RegExp {
  return new RegExp(MARKDOWN_MENTION_SOURCE.source, "g");
}

function inputMentionRegex(): RegExp {
  return new RegExp(`@([^\\s@\\[\\]${MENTION_END}]+)${MENTION_END}`, "g");
}

/** 输入框内插入的紧凑 mention */
export function formatInputGroupMention(groupName: string): string {
  return `@${groupName}${MENTION_END}`;
}

export function formatGroupMention(groupName: string): string {
  return `@[${groupName}](mention:group)`;
}

/** 将输入框内容转为发送用的 markdown mention */
export function expandMentionsForSend(content: string): string {
  return content.replace(inputMentionRegex(), (_, name: string) =>
    formatGroupMention(name)
  );
}

export function extractMentionGroupNames(content: string): string[] {
  const names: string[] = [];
  const expanded = expandMentionsForSend(content);
  for (const match of expanded.matchAll(markdownMentionRegex())) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export interface ActiveMention {
  start: number;
  query: string;
}

/** 光标处是否正在输入未完成的 @ 分组引用 */
export function getActiveMention(
  text: string,
  cursor: number
): ActiveMention | null {
  const before = text.slice(0, cursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;

  const segment = before.slice(atIndex + 1);
  if (segment.includes("]") || segment.includes("(")) return null;
  if (segment.includes(MENTION_END)) return null;

  return { start: atIndex, query: segment };
}

export function insertGroupMention(
  text: string,
  mention: ActiveMention,
  cursor: number,
  groupName: string
): { nextText: string; nextCursor: number } {
  const token = formatInputGroupMention(groupName);
  const before = text.slice(0, mention.start);
  const after = text.slice(cursor);
  const nextText = `${before}${token} ${after}`;
  const nextCursor = before.length + token.length + 1;
  return { nextText, nextCursor };
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; raw: string };

/** 将输入文本拆成普通文本与 @ 分组引用片段，供输入框富文本展示 */
export function parseMentionSegments(content: string): MentionSegment[] {
  if (!content) return [];

  const combined = new RegExp(
    `(?:${MARKDOWN_MENTION_SOURCE.source}|@([^\\s@\\[\\]${MENTION_END}]+)${MENTION_END})`,
    "g"
  );

  const segments: MentionSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(combined)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, start) });
    }
    const name = match[1] ?? match[2] ?? "";
    segments.push({ type: "mention", name, raw: match[0] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
