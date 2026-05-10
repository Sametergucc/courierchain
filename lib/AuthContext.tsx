"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { db, DBUser, UserRole } from "./db";

interface AuthContextValue {
  user: DBUser | null;
  loading: boolean;
  login: (name: string, role: UserRole, wallet?: string, priceSOL?: number) => Promise<DBUser>;
  logout: () => void;
  updateUser: (patch: Partial<DBUser>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true,
  login: async () => ({} as DBUser), logout: () => {}, updateUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DBUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session'ı localStorage'dan oku
    const saved = localStorage.getItem("cc_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (name: string, role: UserRole, wallet?: string, priceSOL?: number) => {
    const u = await db.users.register(name, role, wallet, priceSOL);
    localStorage.setItem("cc_session", JSON.stringify(u));
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem("cc_session");
    setUser(null);
  };

  const updateUser = async (patch: Partial<DBUser>) => {
    if (!user) return;
    try {
      const updated = await db.users.updateCourier(user.id, patch);
      const merged = { ...user, ...updated };
      localStorage.setItem("cc_session", JSON.stringify(merged));
      setUser(merged);
    } catch {
      // fallback: sadece local güncelle
      const merged = { ...user, ...patch };
      localStorage.setItem("cc_session", JSON.stringify(merged));
      setUser(merged);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
