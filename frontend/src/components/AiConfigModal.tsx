import { useCallback, useEffect, useState } from "react";
import { authApi } from "../api";
import type { AiConfigItem, AiConfigStatus } from "../types";
import {
  CloseIcon,
  DeleteIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  IconButton,
} from "./ItemIcons";

interface AiConfigModalProps {
  onClose: () => void;
}

type ViewMode = "list" | "form";

function dispatchStatusUpdate(status: AiConfigStatus) {
  window.dispatchEvent(
    new CustomEvent("ai-config-updated", { detail: status })
  );
}

async function fetchAndDispatchStatus() {
  const res = await authApi.getAiConfigStatus();
  dispatchStatusUpdate(res.data);
  return res.data;
}

export default function AiConfigModal({ onClose }: AiConfigModalProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [configs, setConfigs] = useState<AiConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<number, string>>({});
  const [revealingId, setRevealingId] = useState<number | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.listAiConfigs();
      setConfigs(res.data);
      await fetchAndDispatchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBaseUrl("");
    setApiKey("");
    setModel("");
    setApiKeySet(false);
    setError("");
    setMessage("");
  };

  const openCreateForm = () => {
    resetForm();
    setView("form");
  };

  const openEditForm = (item: AiConfigItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBaseUrl(item.base_url);
    setModel(item.model);
    setApiKey("");
    setApiKeySet(true);
    setError("");
    setMessage("");
    setView("form");
  };

  const canSubmit =
    title.trim() &&
    baseUrl.trim() &&
    model.trim() &&
    (apiKey.trim() || apiKeySet);

  const persistForm = async (): Promise<number> => {
    const payload = {
      title: title.trim(),
      base_url: baseUrl.trim(),
      model: model.trim(),
      ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
    };

    if (editingId) {
      const res = await authApi.updateAiConfig(editingId, payload);
      return res.data.id;
    }

    if (!apiKey.trim()) {
      throw new Error("请填写 API Key");
    }

    const res = await authApi.createAiConfig({
      title: payload.title,
      base_url: payload.base_url,
      api_key: apiKey.trim(),
      model: payload.model,
    });
    setEditingId(res.data.id);
    setApiKeySet(true);
    setApiKey("");
    return res.data.id;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    if (!baseUrl.trim()) {
      setError("请填写 Base URL");
      return;
    }
    if (!model.trim()) {
      setError("请填写 Model");
      return;
    }
    if (!apiKey.trim() && !apiKeySet) {
      setError("请填写 API Key");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await persistForm();
      await loadConfigs();
      setMessage("配置已保存");
      setView("list");
      resetForm();
    } catch (err: any) {
      setError(
        err.response?.data?.detail ?? err.message ?? "保存失败，请稍后再试"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canSubmit) {
      setError("请先填写完整配置");
      return;
    }

    setTesting(true);
    setError("");
    setMessage("");
    try {
      const configId = await persistForm();
      await authApi.testAiConfig(configId, {
        base_url: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      await loadConfigs();
      setMessage("连通测试通过");
      setView("list");
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "连通测试失败");
      await loadConfigs();
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async (id: number) => {
    setError("");
    try {
      await authApi.activateAiConfig(id);
      await loadConfigs();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "切换配置失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定删除这条 AI 配置吗？")) return;
    setError("");
    try {
      await authApi.deleteAiConfig(id);
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadConfigs();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "删除失败");
    }
  };

  const toggleRevealKey = async (item: AiConfigItem) => {
    if (revealedKeys[item.id]) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    setRevealingId(item.id);
    try {
      const res = await authApi.revealAiConfigApiKey(item.id);
      setRevealedKeys((prev) => ({ ...prev, [item.id]: res.data.api_key }));
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "获取 API Key 失败");
    } finally {
      setRevealingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              AI 配置管理
            </h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              可保存多条配置，选择启用的配置供 AI 使用
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {view === "list" ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  共 {configs.length} 条配置
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  新增配置
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-slate-400">加载中...</p>
              ) : configs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    还没有 AI 配置
                  </p>
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    新增配置
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border px-4 py-3 transition ${
                        item.is_active
                          ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/20"
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="active-ai-config"
                          checked={item.is_active}
                          onChange={() => void handleActivate(item.id)}
                          className="mt-1 h-4 w-4 accent-blue-600"
                          title="启用此配置"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {item.title || "未命名配置"}
                            </h3>
                            {item.is_active && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                                当前使用
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                item.verified
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                              }`}
                            >
                              {item.verified ? "已连通" : "未测试"}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <p className="truncate">
                              <span className="text-slate-400">Base URL：</span>
                              {item.base_url}
                            </p>
                            <p className="truncate">
                              <span className="text-slate-400">Model：</span>
                              {item.model}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-slate-400">
                                API Key：
                              </span>
                              <code className="truncate font-mono text-slate-600 dark:text-slate-300">
                                {revealedKeys[item.id] ?? item.api_key_masked}
                              </code>
                              <IconButton
                                title={
                                  revealedKeys[item.id] ? "隐藏 Key" : "查看 Key"
                                }
                                onClick={() => void toggleRevealKey(item)}
                                disabled={revealingId === item.id}
                                className="h-7 w-7 shrink-0 text-slate-500"
                              >
                                {revealedKeys[item.id] ? (
                                  <EyeOffIcon />
                                ) : (
                                  <EyeIcon />
                                )}
                              </IconButton>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            title="编辑"
                            onClick={() => openEditForm(item)}
                            className="text-slate-500"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            title="删除"
                            onClick={() => void handleDelete(item.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  resetForm();
                }}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-300"
              >
                ← 返回列表
              </button>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  标题
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：DeepSeek 主力"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Base URL
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    apiKeySet ? "已保存，留空则不修改" : "sk-..."
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Model
                </label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>
            </div>
          )}

          {message && (
            <p className="mt-4 text-sm text-blue-600 dark:text-blue-300">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}
        </div>

        {view === "form" && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setView("list");
                resetForm();
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || testing || !canSubmit}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || saving || !canSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? "测试中..." : "测试连通性"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
