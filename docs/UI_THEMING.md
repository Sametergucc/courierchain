# 🎨 UI & Theming Guide — CourierChain

## Theme System Overview

CourierChain uses a **CSS Custom Property** (CSS Variables) based theming system.
No runtime JS is needed to switch themes — only the `data-theme` attribute on `.theme-root` changes.

```
ThemeContext (React) → toggles data-theme attribute
↓
globals.css [data-theme="dark"] / [data-theme="light"] → CSS vars update
↓
All components inherit → zero re-renders needed for color changes
```

---

## CSS Variable Tokens

### Background Scale
```css
--bg-base        /* page background   → #07070f / #f0eeff */
--bg-surface     /* slightly elevated  → #0f0f1a / #f8f6ff */
--bg-elevated    /* cards, modals      → #161625 / #ffffff */
--bg-card        /* glassmorphism card → rgba(22,22,37,.85) / rgba(255,255,255,.9) */
--bg-glass       /* topbar floating    → rgba(15,15,26,.75) / rgba(255,255,255,.75) */
--bg-input       /* form fields, wells → rgba(255,255,255,.04) / rgba(0,0,0,.04) */
--bg-hover       /* hover state        → rgba(153,69,255,.09) */
--bg-selected    /* selected state     → rgba(153,69,255,.14) */
```

### Text Scale
```css
--text-primary    /* headings, body content */
--text-secondary  /* labels, descriptions   */
--text-muted      /* hints, timestamps      */
--text-inverse    /* text on accent buttons */
```

### Border Scale
```css
--border-subtle   /* dividers, subtle containers */
--border-default  /* cards, inputs              */
--border-accent   /* focused, selected, active  */
```

### Accent Colors
```css
--accent          /* #9945FF (dark) / #7c28ff (light) */
--accent-dim      /* 10-15% alpha tint */
--accent-glow     /* 40% alpha for box-shadow */

--green           /* #14F195 (dark) / #059669 (light) */
--green-dim       /* 12% green background */
--amber           /* #f59e0b (both themes) */
--red             /* #ff6b6b (dark) / #dc2626 (light) */
```

### Shadow Scale
```css
--shadow-sm       /* subtle elevation */
--shadow-md       /* card depth       */
--shadow-lg       /* modals, panels   */
--shadow-glow     /* purple glow effect */
```

### Map
```css
--map-filter      /* dark: brightness(0.82) saturate(0.75) hue-rotate(205deg) */
                  /* light: brightness(1.02) saturate(0.9)                    */
/* Applied to .leaflet-tile-pane → map tiles theme-aware */
```

---

## Component CSS Classes

### Glass / Surface
```css
.glass          /* bg-glass + blur(16px) + subtle border */
.glass-card     /* bg-card + blur(20px) + border-default + shadow */
                /* hover: border-accent + shadow-glow              */
```

### Buttons
```css
.btn-primary    /* gradient purple → glow on hover, lift on hover */
.btn-ghost      /* bg-input + border → hover: bg-hover            */
```

### Courier Cards
```css
.courier-card            /* bg-input + border-subtle */
.courier-card:hover      /* bg-hover + translateX(3px) */
.courier-card.selected   /* bg-selected + border-accent + shadow-glow */
.courier-card::before    /* left accent stripe (visible when selected) */
```

### Badges
```css
.badge-available    /* green-dim bg + green text */
.badge-busy         /* red tint bg + red text    */
```

### Tabs
```css
.tab-group          /* pill container: bg-input + border-radius */
.tab-btn            /* individual tab: transparent, text-muted   */
.tab-btn.active     /* bg-elevated + color-accent + shadow-sm    */
```

### Utilities
```css
.gradient-text      /* purple → pink → green background-clip text */
.address-bar        /* monospace truncated hash display            */
.divider            /* 1px border-subtle horizontal line           */
.stat-box           /* bordered metric box                         */
```

---

## Animations

### Keyframes
```css
@keyframes fadeUp     /* opacity 0→1, translateY 14px→0 */
@keyframes slideRight /* opacity 0→1, translateX -16px→0 */
@keyframes glow-pulse /* box-shadow pulse on btn-primary */
@keyframes ping       /* Leaflet marker ring expansion   */
@keyframes spin       /* loading spinner                 */
@keyframes shimmer    /* shimmer loading skeleton        */
```

### Animation Classes
```css
.anim-fade-up    /* animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both */
.anim-slide-r    /* animation: slideRight 0.3s */
.anim-spin       /* animation: spin 0.9s linear infinite */
.anim-glow       /* animation: glow-pulse 2.4s ease-in-out infinite */
.anim-shimmer    /* shimmer skeleton background */
```

### Usage Examples
```tsx
// Courier cards stagger on load
<div className="courier-card anim-fade-up" style={{ animationDelay:`${i*0.07}s` }}>

// Button permanent glow
<button className="btn-primary anim-glow">

// Loading spinner
<span className="anim-spin" style={{ width:16, height:16, border:"2.5px solid ...", borderRadius:"50%" }}>

// Panel entrance
<div className="anim-fade-up">
```

---

## Typography

```css
/* Primary font — Inter (Google Fonts, loaded in layout.tsx) */
font-family: 'Inter', system-ui, sans-serif;

/* Monospace — Space Grotesk (for addresses, hashes) */
font-family: 'Space Grotesk', monospace;
/* Used via: className="address-bar" */

/* Sizing scale used in project */
0.62rem   → badges, timeline labels
0.65rem   → secondary labels, section headers (uppercase)
0.7rem    → hints, sub-text
0.72rem   → small body text, toast sub
0.75rem   → body small
0.78rem   → normal body
0.82rem   → default body
0.85rem   → slightly larger body
0.9rem    → subheadings
1.0rem    → headings
1.05rem   → price totals
1.5rem    → page titles
```

---

## Leaflet Overrides

OpenStreetMap tiles are visually adapted per theme via CSS filter:

```css
.leaflet-tile-pane {
  filter: var(--map-filter);  /* changes with theme */
  transition: filter 0.4s;
}

/* Dark: hue-rotate(205deg) makes tiles take on a blue-grey look */
/* Light: slight brightness boost for contrast */
```

Custom popup styling:
```css
.leaflet-popup-content-wrapper {
  background: var(--bg-elevated) !important;
  border: 1px solid var(--border-default) !important;
  border-radius: 14px !important;
  color: var(--text-primary) !important;
}
```

Zoom controls:
```css
.leaflet-control-zoom a {
  background: var(--bg-elevated) !important;
  color: var(--accent) !important;
}
```

---

## ThemeToggle Implementation

```tsx
// components/ThemeToggle.tsx
const { theme, toggle } = useTheme();
const isDark = theme === "dark";

return (
  <button
    onClick={toggle}
    className={`theme-toggle ${isDark ? "dark" : ""}`}
  >
    <span className="theme-toggle-thumb">
      {isDark ? "🌙" : "☀️"}
    </span>
  </button>
);
```

CSS:
```css
.theme-toggle {
  width: 44px; height: 24px; border-radius: 12px;
}
.theme-toggle-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  position: absolute; left: 2px;
  transition: transform 0.3s cubic-bezier(.22,1,.36,1);
}
.theme-toggle.dark .theme-toggle-thumb {
  transform: translateX(20px);   /* slides right in dark mode */
}
```

---

## Adding a New Theme

To add a 3rd theme (e.g., "sepia"):

**1. Add to ThemeContext.tsx:**
```typescript
type Theme = "dark" | "light" | "sepia";
```

**2. Add CSS block to globals.css:**
```css
[data-theme="sepia"] {
  --bg-base:      #f5e6c8;
  --bg-surface:   #ede0c4;
  --accent:       #c07830;
  /* ... all other tokens */
}
```

**3. Update ThemeToggle cycle:**
```typescript
const next = { dark:"light", light:"sepia", sepia:"dark" }[t];
```
