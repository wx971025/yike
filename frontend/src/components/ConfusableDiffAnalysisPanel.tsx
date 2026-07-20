import type { ConfusableDiffAnalysis } from "../types";

interface ConfusableDiffAnalysisPanelProps {
  analysis: ConfusableDiffAnalysis;
  wordA: string;
  wordB: string;
}

export function isValidDiffAnalysis(
  analysis: ConfusableDiffAnalysis | null | undefined
): analysis is ConfusableDiffAnalysis {
  return Boolean(
    analysis?.sentence_a?.trim() &&
      analysis?.sentence_a_zh?.trim() &&
      analysis?.sentence_b?.trim() &&
      analysis?.sentence_b_zh?.trim() &&
      analysis?.difference?.trim()
  );
}

export default function ConfusableDiffAnalysisPanel({
  analysis,
  wordA,
  wordB,
}: ConfusableDiffAnalysisPanelProps) {
  return (
    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <h3 className="mb-3 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        AI 差异分析
      </h3>

      <div className="space-y-3 text-sm leading-relaxed">
        <div>
          <p>
            <span className="mr-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {wordA}
            </span>
            <span className="text-slate-700 dark:text-slate-200">{analysis.sentence_a}</span>
          </p>
          <p className="mt-1 pl-0 text-xs text-slate-500 dark:text-slate-400 sm:pl-1">
            {analysis.sentence_a_zh}
          </p>
        </div>
        <div>
          <p>
            <span className="mr-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              {wordB}
            </span>
            <span className="text-slate-700 dark:text-slate-200">{analysis.sentence_b}</span>
          </p>
          <p className="mt-1 pl-0 text-xs text-slate-500 dark:text-slate-400 sm:pl-1">
            {analysis.sentence_b_zh}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {analysis.difference}
      </p>
    </div>
  );
}
