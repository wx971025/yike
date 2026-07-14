/** @ 分组引用格式：@[分组名](mention:group) */
export const MENTION_PATTERN = /@\[([^\]]+)\]\(mention:group\)/g;

export function formatGroupMention(groupName: string): string {
  return `@[${groupName}](mention:group)`;
}

export function extractMentionGroupNames(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(MENTION_PATTERN)) {
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

  return { start: atIndex, query: segment };
}

export function insertGroupMention(
  text: string,
  mention: ActiveMention,
  cursor: number,
  groupName: string
): { nextText: string; nextCursor: number } {
  const token = formatGroupMention(groupName);
  const before = text.slice(0, mention.start);
  const after = text.slice(cursor);
  const nextText = `${before}${token} ${after}`;
  const nextCursor = before.length + token.length + 1;
  return { nextText, nextCursor };
}