import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api";
import { clearToken, getToken, setToken } from "../api/client";
import type { User } from "../types";
import { applyReviewSettingsFromUser } from "../utils/reviewSettingsSync";

interface AuthState {
  user: User | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.data);
        applyReviewSettingsFromUser(res.data);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (u: string, p: string) => {
    const res = await authApi.login(u, p);
    setToken(res.data.access_token);
    const me = await authApi.me();
    setUser(me.data);
    applyReviewSettingsFromUser(me.data);
  };

  const register = async (u: string, p: string) => {
    const res = await authApi.register(u, p);
    setToken(res.data.access_token);
    const me = await authApi.me();
    setUser(me.data);
    applyReviewSettingsFromUser(me.data);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const updateUser = (next: User) => {
    setUser(next);
    applyReviewSettingsFromUser(next);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        username: user?.username ?? null,
        loading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
