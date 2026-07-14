import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "登录失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-lg"
      >
        <div className="mb-6 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-slate-800 dark:text-slate-100">欢迎回来</h1>
        <p className="mb-6 text-center text-sm text-slate-400 dark:text-slate-500">登录忆刻，继续你的复习计划</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          用户名
        </label>
        <input
          className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          密码
        </label>
        <input
          type="password"
          className="mb-6 w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "登录中..." : "登录"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          还没有账号？
          <Link to="/register" className="text-blue-600 hover:underline">
            立即注册
          </Link>
        </p>
      </form>
    </div>
  );
}
