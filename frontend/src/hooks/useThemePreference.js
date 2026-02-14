import { useEffect, useMemo, useState } from "react";

const KEY = "dinova_theme_pref_v1";

const getInitial = () => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
};

export function useThemePreference() {
  const [pref, setPref] = useState(getInitial);

  const systemIsDark = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // ignore
    }
  }, [pref]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (isDark) => {
      const root = document.documentElement;
      if (isDark) root.classList.add("dark");
      else root.classList.remove("dark");
    };

    const resolve = () => {
      if (pref === "dark") return true;
      if (pref === "light") return false;
      return mq.matches;
    };

    apply(resolve());

    const onChange = (e) => {
      if (pref !== "system") return;
      apply(e.matches);
    };

    mq.addEventListener?.("change", onChange);
    mq.addListener?.(onChange);

    return () => {
      mq.removeEventListener?.("change", onChange);
      mq.removeListener?.(onChange);
    };
  }, [pref]);

  return { themePref: pref, setThemePref: setPref, systemIsDark };
}

