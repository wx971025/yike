import { useCallback, useEffect, useState } from "react";
import { confusablePairApi } from "../api";
import {
  DeleteIcon,
  IconButton,
  JoinPlanIcon,
  LeavePlanIcon,
} from "./ItemIcons";
import SearchBox from "./SearchBox";
import { useGroups } from "../context/GroupContext";
import type { ConfusablePair } from "../types";
import { getPlanCardStatusMeta } from "../utils/reviewSchedule";

function PairSide({
  word,
  phonetic,
  pos,
  meaning,
}: {
  word: string;
  phonetic: string;
  pos: string;
  meaning: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await confusablePairApi.list(null, debouncedSearch || undefined);
      setPairs(res.data);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    window.addEventListener("app-data-changed", handler);
    return () => window.removeEventListener("app-data-changed", handler);
  }, [load]);

  const handleJoinPlan = async (id: number) => {
    await confusablePairApi.joinPlan(id);
    await load();
    window.dispatchEvent(new CustomEvent("app-data-changed"));
  };

  const handleLeavePlan = async (id: number) => {
    await confusablePairApi.leavePlan(id);
    await load();
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
        await load();
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
        await load();
        window.dispatchEvent(new CustomEvent("app-data-changed"));
      }
    } finally {
      setBulkLoading(false);
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
                    />
                    <div className="flex shrink-0 items-center justify-center px-1 text-slate-300 dark:text-slate-600">
                      ↔
                    </div>
                    <PairSide
                      word={pair.word_b}
                      phonetic={pair.phonetic_b}
                      pos={pair.pos_b}
                      meaning={pair.meaning_b}
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
