import { useEffect, useState } from "react";
import { authApi } from "../api";
import type { AiConfig } from "../types";
import { CloseIcon } from "./ItemIcons";

interface AiConfigModalProps {
  onClose: () => void;
}

export default function AiConfigModal({ onClose }: AiConfigModalProps) {
  const [useCustom, setUseCustom] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authApi
      .getAiConfig()
      .then((res) => {
        applyConfig(res.data);
      })
      .catch((err: any) => {
        setError(err.response?.data?.detail ?? "加载配置失败");
      })
      .finally(() => setLoading(false));
  }, []);

  const applyConfig = (config: AiConfig) => {
    setUseCustom(config.use_custom);
    setBaseUrl(config.base_url);
    setModel(config.model);
    setApiKeySet(config.api_key_set);
    setApiKey("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await authApi.updateAiConfig({
        use_custom: useCustom,
        base_url: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      applyConfig(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "保存失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">AI 配置</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
            title="关闭"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">使用自定义配置</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">
                {useCustom ? "将使用下方填写的接口" : "将使用项目内置配置"}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useCustom}
              onClick={() => setUseCustom((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                useCustom ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow transition ${
                  useCustom ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">加载中...</p>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Base URL
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  disabled={!useCustom}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none disabled:bg-slate-50 dark:bg-slate-800/60 disabled:text-slate-400 dark:text-slate-500"
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
                  placeholder={apiKeySet ? "已配置，留空则不修改" : "sk-..."}
                  disabled={!useCustom}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none disabled:bg-slate-50 dark:bg-slate-800/60 disabled:text-slate-400 dark:text-slate-500"
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
                  disabled={!useCustom}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none disabled:bg-slate-50 dark:bg-slate-800/60 disabled:text-slate-400 dark:text-slate-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
