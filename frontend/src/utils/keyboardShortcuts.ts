function isEditableElement(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"], [contenteditable=""]')) return true;
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "file"].includes(
      type
    );
  }
  return false;
}

/** 焦点在 AI 聊天、搜索框等外部输入区时不触发复习全局快捷键 */
export function shouldIgnoreGlobalShortcut(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (!isEditableElement(target)) return false;
  if (target.closest("[data-review-shortcut-root]")) return false;
  return true;
}
