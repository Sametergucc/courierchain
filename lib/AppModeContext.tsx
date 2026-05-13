"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppMode = "test" | "live";

const STORAGE_KEY = "cc_app_mode";

type AppModeContextValue = {
  mode: AppMode;
  setMode: (next: AppMode) => void;
  /** localStorage okunduktan sonra true (ilk frame’de hazır sayılır) */
  ready: boolean;
};

const Ctx = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("test");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "live" || raw === "test") setModeState(raw);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode, ready }), [mode, setMode, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppMode must be used within AppModeProvider");
  return v;
}
