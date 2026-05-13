"use client";

import type { CSSProperties } from "react";
import { useLang } from "@/lib/LangContext";

type Size = "sm" | "md" | "lg";

const fontSize: Record<Size, string> = {
  sm: "0.78rem",
  md: "1.05rem",
  lg: "1.65rem",
};

type Props = {
  size?: Size;
  muted?: boolean;
  as?: "span" | "h1";
  style?: CSSProperties;
  className?: string;
};

/** Metin wordmark — CourierChain / KuryeZinciri (dil ile). */
export default function BrandMark({
  size = "md",
  muted = false,
  as: Tag = "span",
  style,
  className,
}: Props) {
  const { t } = useLang();
  return (
    <Tag
      className={`brand-mark${className ? ` ${className}` : ""}`}
      style={{
        fontSize: fontSize[size],
        opacity: muted ? 0.55 : 1,
        ...style,
      }}
    >
      {t.appName}
    </Tag>
  );
}
