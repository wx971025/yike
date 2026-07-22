import { useCallback, useEffect, useState } from "react";
import { aiApi, confusablePairApi } from "../api";
import {
  DeleteIcon,
  IconButton,
  JoinPlanIcon,
  LeavePlanIcon,
  SparkleIcon,
} from "./ItemIcons";
import SearchBox from "./SearchBox";
import { useGroups } from "../context/GroupContext";
import type { ConfusablePair } from "../types";
import { getPlanCardStatusMeta } from "../utils/reviewSchedule";

function GenerateExampleButton({
  onClick,
  disabled,
  generating,
}: {
  onClick: () => void;
  disabled?: boolean;
  generating?: boolean;
}) {
  return (
    <div className="group absolute right-2 top-2 z-10">
      <button
        type="button"
        title="生成例句"
        onClick={onClick}
        disabled={disabled || generating}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-500 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
      >
        {generating ? (
          <span className="text-xs font-medium">…</span>
        ) : (
          <SparkleIcon />
        )}
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-20 mt-1 scale-95 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] text-white opacity-0 shadow transition group-hover:scale-100 group-hover:opacity-100 dark:bg-slate-700">
        生成例句
      </span>
    </div>
  );
}

function PairSide({
  word,
  phonetic,
  pos,
  meaning,
  exampleEn,
  exampleZh,
  generatingExample,
  generateExampleError,
  onGenerateExample,
}: {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
  exampleEn: string;
  exampleZh: string;
  generatingExample: boolean;
  generateExampleError: string;
  onGenerateExample: () => void;
}) {
  const hasExample = Boolean(exampleEn.trim() || exampleZh.trim());

  return (
    <div className="relative min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 pt-8 dark:border-slate-700 dark:bg-slate-900">
      {!hasExample && (
        <GenerateExampleButton
          onClick={onGenerateExample}
          generating={generatingExample}
        />
      )}

      <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{word}</p>
      {phonetic && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{phonetic}</p>
      )}
      {pos && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{pos}</p>
      )}
      {meaning && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {meaning}
        </p>
      )}

      {hasExample && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          {exampleEn.trim() && (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {exampleEn}
            </p>
          )}
          {exampleZh.trim() && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              {exampleZh}
            </p>
          )}
        </div>
      )}

      {!hasExample && generateExampleError && (
        <p className="mt-3 text-xs text-red-500">{generateExampleError}</p>
      )}
    </div>
  );
}

export default function ConfusablePairsPanel() {
  const { totalStagesForGroupId } = useGroups();
  const [pairs, setPairs] = useState<ConfusablePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await confusablePairApi.list(null, debouncedSearch || undefined);
      setPairs(res.data);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load({ silent: true });
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleJoinPlan = async (id: number) => {
    const res = await confusablePairApi.joinPlan(id);
    setPairs((prev) => prev.map((pair) => (pair.id === id ? res.data : pair)));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    const res = await confusablePairApi.leavePlan(id);
    setPairs((prev) => prev.map((pair) => (pair.id === id ? res.data : pair)));
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleDelete = async (pair: ConfusablePair) => {
    if (
      !confirm(
        `确定删除易混词对「${pair.word_a} ↔ ${pair.word_b}」？删除后无法恢复。`
      )
    ) {
      return;
    }
    await confusablePairApi.remove(pair.id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleJoinAll = async () => {
    setBulkLoading(true);
    try {
      const res = await confusablePairApi.joinPlanAll(debouncedSearch || undefined);
      if (res.data.count > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLeaveAll = async () => {
    setBulkLoading(true);
    try {
      const res = await confusablePairApi.leavePlanAll(debouncedSearch || undefined);
      if (res.data.count > 0) {
        await load({ silent: true });
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const handleGenerateExample = async (pair: ConfusablePair, side: "a" | "b") => {
    const key = `${pair.id}_${side}`;
    const exampleEn = side === "a" ? pair.example_a : pair.example_b;
    const exampleZh =
      side === "a" ? pair.example_a_translation : pair.example_b_translation;
    if (exampleEn.trim() || exampleZh.trim()) {
      return;
    }

    setGeneratingKey(key);
    setGenerateErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      const res = await aiApi.generateWordExample({
        word: side === "a" ? pair.word_a : pair.word_b,
        meaning: side === "a" ? pair.meaning_a : pair.meaning_b,
        pos: side === "a" ? pair.pos_a : pair.pos_b,
        phonetic: side === "a" ? pair.phonetic_a : pair.phonetic_b,
        existing_examples: [],
      });
      const updated = await confusablePairApi.updateExample(pair.id, {
        side,
        example: res.data.en,
        example_translation: res.data.zh,
      });
      setPairs((prev) =>
        prev.map((item) => (item.id === pair.id ? updated.data : item))
      );
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "生成例句失败";
      setGenerateErrors((prev) => ({
        ...prev,
        [key]: typeof detail === "string" ? detail : "生成例句失败",
      }));
    } finally {
      setGeneratingKey(null);
    }
  };

  const inPlanCount = pairs.filter((pair) => pair.in_plan).length;
  const notInPlanCount = pairs.length - inPlanCount;
  const totalStages = totalStagesForGroupId(null);
  const emptyMessage = debouncedSearch
    ? "没有匹配的易混词对"
    : "还没有易混词对。点击右上角「增加易混词卡片」手动添加，或在复习单词拼错时选择添加";

  return (
    <div>
      <div className="mb-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="按单词或释义搜索..."
        />
      </div>

      {loading ? (
        <p className="text-slate-400 dark:text-slate-500">加载中...</p>
      ) : pairs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              总共 {pairs.length} 对，{inPlanCount} 对加入计划
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={() => void handleJoinAll()}
                disabled={bulkLoading || notInPlanCount === 0}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {bulkLoading ? "处理中..." : "全部加入计划"}
              </button>
              <button
                onClick={() => void handleLeaveAll()}
                disabled={bulkLoading || inPlanCount === 0}
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
              >
                全部移出计划
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {pairs.map((pair) => {
              const statusMeta = getPlanCardStatusMeta(pair, undefined, "ebbinghaus");
              return (
                <div
                  key={pair.id}
                  className="relative rounded-2xl border border-slate-200 p-4 pr-14 dark:border-slate-700"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                      易混词对
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      无分组
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                    {pair.in_plan && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                        第 {pair.stage_index + 1}/{totalStages} 轮
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <PairSide
                      word={pair.word_a}
                      phonetic={pair.phonetic_a}
                      pos={pair.pos_a}
                      meaning={pair.meaning_a}
                      exampleEn={pair.example_a}
                      exampleZh={pair.example_a_translation}
                      generatingExample={generatingKey === `${pair.id}_a`}
                      generateExampleError={generateErrors[`${pair.id}_a`] ?? ""}
                      onGenerateExample={() => void handleGenerateExample(pair, "a")}
                    />
                    <div className="flex shrink-0 items-center justify-center px-1 text-slate-300 dark:text-slate-600">
                      ↔
                    </div>
                    <PairSide
                      word={pair.word_b}
                      phonetic={pair.phonetic_b}
                      pos={pair.pos_b}
                      meaning={pair.meaning_b}
                      exampleEn={pair.example_b}
                      exampleZh={pair.example_b_translation}
                      generatingExample={generatingKey === `${pair.id}_b`}
                      generateExampleError={generateErrors[`${pair.id}_b`] ?? ""}
                      onGenerateExample={() => void handleGenerateExample(pair, "b")}
                    />
                  </div>

                  <div className="absolute right-2 top-2 flex flex-col gap-1">
                    {pair.in_plan ? (
                      <IconButton
                        title="移出计划"
                        onClick={() => void handleLeavePlan(pair.id)}
                        className="text-orange-600 hover:bg-orange-50"
                      >
                        <LeavePlanIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        title="加入计划"
                        onClick={() => void handleJoinPlan(pair.id)}
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        <JoinPlanIcon />
                      </IconButton>
                    )}
                    <IconButton
                      title="删除易混词对"
                      onClick={() => void handleDelete(pair)}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
