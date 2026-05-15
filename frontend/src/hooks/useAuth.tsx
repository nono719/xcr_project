import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../apis';

export type Role = 'student' | 'teacher' | 'admin';
export interface AuthUser {
  userId: number;
  username: string;
  email: string;
  role: Role;
}

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  login: (account: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('xcr_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('xcr_token');
    if (!token) { setReady(true); return; }
    authApi.me().then((r) => {
      if (r?.data) {
        const u = r.data as AuthUser;
        setUser(u);
        localStorage.setItem('xcr_user', JSON.stringify(u));
      }
    }).finally(() => setReady(true));
  }, []);

  const login = async (account: string, password: string) => {
    try {
      const r = await authApi.login(account, password);
      if (r?.code === 200 && r.data?.token) {
        localStorage.setItem('xcr_token', r.data.token);
        localStorage.setItem('xcr_user', JSON.stringify(r.data.user));
        setUser(r.data.user as AuthUser);
        return true;
      }
      return false;
    } catch { return false; }
  };

  const logout = () => {
    localStorage.removeItem('xcr_token');
    localStorage.removeItem('xcr_user');
    setUser(null);
  };

  return <ctx.Provider value={{ user, ready, login, logout }}>{children}</ctx.Provider>;
}

export const useAuth = () => useContext(ctx);
