import { useEffect, useRef, useState } from "react";
import { aiApi } from "../api";
import { ClearContextIcon, IconButton } from "./ItemIcons";
import MarkdownMessage from "./MarkdownMessage";
import { useGroups } from "../context/GroupContext";
import type { Group } from "../types";
import {
  extractMentionGroupNames,
  getActiveMention,
  insertGroupMention,
  type ActiveMention,
} from "../utils/mentions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "你好！我是忆刻 AI 助手，可以帮你管理分组、卡片、单词和复习计划，还能通过 Skill 记住你的工作方式。输入 @ 可引用分组。有什么需要？",
};

const SUGGESTIONS = [
  "今天有哪些要复习的？",
  "帮我添加单词 apple",
  "帮我新建一个叫英语的分组",
  "把 apple 加入复习计划",
  "帮我创建一个 skill：批量添加单词时自动查词填音标",
];

interface AiAssistantProps {
  collapsed: boolean;
  onToggle: () => void;
}

function AiFabButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "关闭 AI 助手" : "打开 AI 助手"}
      title={open ? "关闭 AI 助手" : "打开 AI 助手"}
      className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/35 active:scale-95 ${
        open ? "ring-2 ring-white/80 dark:ring-slate-900/80" : ""
      }`}
    >
      {open ? (
        <span className="text-xl leading-none" aria-hidden>
          ✕
        </span>
      ) : (
        <span className="text-2xl leading-none" aria-hidden>
          🤖
        </span>
      )}
    </button>
  );
}

export default function AiAssistant({ collapsed, onToggle }: AiAssistantProps) {
  const { groups, refreshGroups } = useGroups();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const filteredGroups = groups.filter((group) => {
    if (!activeMention) return false;
    const query = activeMention.query.trim().toLowerCase();
    if (!query) return true;
    return group.name.toLowerCase().includes(query);
  });

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, activeMention?.start]);

  const updateInput = (next: string, cursor?: number) => {
    setInput(next);
    const pos = cursor ?? next.length;
    setActiveMention(getActiveMention(next, pos));
    requestAnimationFrame(() => {
      if (inputRef.current && cursor != null) {
        inputRef.current.selectionStart = cursor;
        inputRef.current.selectionEnd = cursor;
      }
    });
  };

  const selectGroup = (group: Group) => {
    if (!activeMention || !inputRef.current) return;
    const cursor = inputRef.current.selectionStart ?? input.length;
    const { nextText, nextCursor } = insertGroupMention(
      input,
      activeMention,
      cursor,
      group.name
    );
    setActiveMention(null);
    updateInput(nextText, nextCursor);
    inputRef.current.focus();
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const groupNames = extractMentionGroupNames(content);
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setActiveMention(null);
    setLoading(true);

    try {
      const res = await aiApi.chat(
        nextMessages.map((m) => ({ role: m.role, content: m.content })),
        groupNames.length > 0 ? { group_names: groupNames } : null
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply },
      ]);

      if (res.data.effects.length > 0) {
        if (res.data.effects.includes("groups")) await refreshGroups();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } catch (err: any) {
      const detail =
        err.response?.data?.detail ?? "AI 助手暂时不可用，请稍后再试";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: typeof detail === "string" ? detail : "请求失败",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearContext = () => {
    if (loading) return;
    setMessages([INITIAL_MESSAGE]);
    setInput("");
    setActiveMention(null);
    setClearConfirmOpen(false);
  };

  const canClearContext = messages.length > 1;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const cursor = e.target.selectionStart ?? next.length;
    setInput(next);
    setActiveMention(getActiveMention(next, cursor));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeMention && filteredGroups.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredGroups.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + filteredGroups.length) % filteredGroups.length
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectGroup(filteredGroups[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveMention(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (collapsed) {
    return <AiFabButton open={false} onClick={onToggle} />;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40"
        onClick={onToggle}
        aria-hidden
      />

      <div
        className="fixed bottom-24 right-6 z-40 flex h-[min(32rem,calc(100vh-8rem))] w-[min(22rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              AI 助手
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              输入 @ 引用分组，告知 Agent 提问范围
            </div>
          </div>
        </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <MarkdownMessage content={msg.content} variant={msg.role} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-100 px-3 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500 dark:border-slate-600"
                aria-hidden
              />
              <span>思考中...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="relative shrink-0 border-t border-slate-100 dark:border-slate-800">
        {activeMention && (
          <div className="absolute bottom-full left-3 right-3 z-10 mb-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {filteredGroups.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                没有匹配的分组
              </p>
            ) : (
              filteredGroups.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectGroup(group);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    index === mentionIndex
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-slate-400 dark:text-slate-500">@</span>
                  <span className="truncate">{group.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (activeMention) return;
            send(input);
          }}
          className="px-3 py-3"
        >
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder="输入问题，@ 引用分组..."
              disabled={loading}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || activeMention != null}
              className="self-end rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </form>
        <div className="flex justify-center px-3 pb-2">
          <IconButton
            title="清除上下文"
            onClick={() => setClearConfirmOpen(true)}
            disabled={loading || !canClearContext}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ClearContextIcon />
          </IconButton>
        </div>
      </div>
      </div>

      {clearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setClearConfirmOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              清除上下文
            </h3>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
              将清空当前对话记录。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={clearContext}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      <AiFabButton open onClick={onToggle} />
    </>
  );
}
