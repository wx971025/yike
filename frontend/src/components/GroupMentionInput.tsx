import { useRef } from "react";
import { parseMentionSegments } from "../utils/mentions";

interface GroupMentionInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}

const sharedInputClasses =
  "w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none dark:border-slate-600 dark:bg-slate-900";

/** 仅改颜色/字重，不加 padding，保证与 textarea 逐字对齐 */
const mentionHighlightClass =
  "rounded-sm bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200";

export default function GroupMentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  rows = 2,
  inputRef,
}: GroupMentionInputProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const segments = parseMentionSegments(value);

  const syncScroll = (target: HTMLTextAreaElement) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = target.scrollTop;
      mirrorRef.current.scrollLeft = target.scrollLeft;
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={mirrorRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words ${sharedInputClasses} border-transparent bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100`}
      >
        {value ? (
          segments.map((segment, index) =>
            segment.type === "mention" ? (
              <span key={index} className={mentionHighlightClass}>
                {segment.raw}
              </span>
            ) : (
              <span key={index}>{segment.value}</span>
            )
          )
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
        )}
      </div>

      <textarea
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={(e) => syncScroll(e.currentTarget)}
        placeholder=""
        disabled={disabled}
        rows={rows}
        className={`relative text-transparent caret-slate-800 selection:bg-blue-200/40 focus:border-blue-500 disabled:opacity-60 dark:caret-slate-100 dark:focus:border-blue-400 dark:selection:bg-blue-500/30 ${sharedInputClasses} bg-transparent`}
        style={{ WebkitTextFillColor: "transparent" }}
      />
    </div>
  );
}
