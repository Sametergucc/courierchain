"use client";
import { useTheme } from "@/lib/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`theme-toggle ${isDark ? "dark" : ""}`}
      aria-label="Toggle theme"
    >
      <span className="theme-toggle-thumb">
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
