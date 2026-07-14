import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
  variant: "user" | "assistant";
}

function MentionBadge({
  name,
  variant,
}: {
  name: string;
  variant: "user" | "assistant";
}) {
  const className =
    variant === "user"
      ? "mx-0.5 inline-block rounded border-l-2 border-white/50 bg-white/15 px-1.5 py-0.5 text-xs font-semibold not-italic text-blue-50 no-underline"
      : "mx-0.5 inline-block rounded border-l-2 border-violet-400 bg-violet-50 px-1.5 py-0.5 text-xs font-semibold not-italic text-violet-700 no-underline dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200";

  return (
    <span className={className} title={`引用分组：${name}`}>
      @{name}
    </span>
  );
}

const assistantClasses = [
  "break-words",
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold",
  "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
  "[&_h3]:mb-1 [&_h3]:mt-1.5 [&_h3]:text-sm [&_h3]:font-medium",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-blue-400",
  "[&_code]:rounded [&_code]:bg-slate-200/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-slate-700/80",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-800 [&_pre]:p-2.5 [&_pre]:text-xs",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 dark:[&_blockquote]:border-slate-600 dark:[&_blockquote]:text-slate-400",
  "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800/60",
  "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-slate-700",
  "[&_hr]:my-2 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-700",
].join(" ");

const userClasses = [
  "break-words",
  "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5",
  "[&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold",
  "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
  "[&_h3]:mb-1 [&_h3]:mt-1.5 [&_h3]:text-sm [&_h3]:font-medium",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_a]:text-white [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded [&_code]:bg-white/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white/15 [&_pre]:p-2.5 [&_pre]:text-xs",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-white/40 [&_blockquote]:pl-3 [&_blockquote]:text-white/80",
  "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-white/30 [&_th]:bg-white/10 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-white/30 [&_td]:px-2 [&_td]:py-1",
  "[&_hr]:my-2 [&_hr]:border-white/30",
].join(" ");

function buildComponents(variant: "user" | "assistant"): Components {
  return {
    a: ({ href, children }) => {
      if (href === "mention:group") {
        const name = String(children).replace(/^@/, "");
        return <MentionBadge name={name} variant={variant} />;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-lg p-2.5 text-xs">{children}</pre>
    ),
  };
}

export default function MarkdownMessage({ content, variant }: MarkdownMessageProps) {
  const className = variant === "user" ? userClasses : assistantClasses;

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(variant)}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
