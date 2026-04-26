# Buena Design System & Style Guide

Extracted from buena.com on 2026-04-25.

---

## 1. Brand Assets

| Asset | File |
|-------|------|
| Logo (4-leaf clover icon) | `brandkit/logo.svg` |
| Wordmark ("buena" text) | `brandkit/wordmark.svg` |

The logo uses `currentColor` so it adapts to light/dark contexts.

---

## 2. Typography

### Font Families

| Role | Font | Fallback | Source |
|------|------|----------|--------|
| **Display / Headings** | `Inter Display` (homepage: `interDisplayMedium`) | `sans-serif` | Self-hosted / Google Fonts |
| **Body** | `Inter` | `sans-serif` | Google Fonts (variable, 100-900) |
| **Accent / Serif** | `Signifier` | `serif` | Self-hosted |
| **Secondary Sans** | `Inter Tight` | `sans-serif` | Google Fonts (variable, 100-900) |

### Type Scale

#### Homepage (Dark Theme)

| Element | Size | Weight | Line Height | Letter Spacing | Color |
|---------|------|--------|-------------|----------------|-------|
| H1 | 40px (2.5rem) | 500 (Medium) | 44px (1.1) | -0.8px | near-white `oklch(0.985 0.001 106.423)` |
| Body / P | 20px (1.25rem) | 500 | 28px (1.4) | normal | muted `oklch(0.709 0.01 56.259)` |
| Button text | 14px (0.875rem) | 500 | normal | normal | — |
| Nav links | 14px | 500 | normal | normal | — |

#### WEG Page (Light Theme)

| Element | Size | Weight | Line Height | Letter Spacing | Color |
|---------|------|--------|-------------|----------------|-------|
| H1 | 36px | 400 (Regular) | 43.2px (1.2) | -1px | near-black `rgb(10, 10, 10)` |
| H2 | 16px | 500 | 20px | normal | stone `rgb(87, 83, 78)` |
| Body | 11-14px | 400-500 | 1.4 | normal | black `rgb(0, 0, 0)` |

---

## 3. Color Palette

### Dark Theme (Homepage / Marketing)

| Role | Value | CSS |
|------|-------|-----|
| **Background** | Pure black | `rgb(0, 0, 0)` / `rgb(1, 1, 5)` |
| **Surface** | Dark stone | `rgb(28, 25, 23)` / `rgb(23, 23, 23)` |
| **Text Primary** | Near-white | `oklch(0.985 0.001 106.423)` / `rgb(250, 250, 249)` ≈ `#fafaf9` |
| **Text Secondary** | Warm gray | `oklch(0.709 0.01 56.259)` ≈ `#a8a29e` (stone-400) |
| **Text Muted** | Dark stone | `oklch(0.216 0.006 56.043)` ≈ `#292524` (stone-800) |
| **Border** | Subtle warm | `oklch(0.268 0.007 34.298)` |
| **Accent / CTA** | Green | `rgb(57, 137, 87)` ≈ `#398957` |
| **Surface Light** | Warm off-white | `oklch(0.923 0.003 48.717)` ≈ `#e7e5e4` (stone-200) |

### Light Theme (WEG / Product Pages)

| Role | Value | CSS |
|------|-------|-----|
| **Background** | White | `rgb(255, 255, 255)` |
| **Surface** | Stone-100 | `rgb(245, 245, 244)` ≈ `#f5f5f4` |
| **Surface Alt** | Stone-200 | `rgb(231, 229, 228)` ≈ `#e7e5e4` |
| **Text Primary** | Near-black | `rgb(10, 10, 10)` / `rgb(12, 10, 9)` |
| **Text Secondary** | Stone-500 | `rgb(87, 83, 78)` ≈ `#57534e` |
| **Text Muted** | Gray | `rgb(115, 115, 115)` / `rgb(168, 162, 158)` |
| **Accent Blue** | Blue-600 | `rgb(37, 99, 235)` ≈ `#2563eb` |
| **Dark Surface** | Stone-800 | `rgb(41, 37, 36)` / `rgb(12, 10, 9)` |

### Semantic Mapping (Tailwind Stone Palette)

The site heavily uses Tailwind's **stone** palette:
- `stone-50`: `#fafaf9` (light bg)
- `stone-100`: `#f5f5f4` (surface)
- `stone-200`: `#e7e5e4` (borders, subtle bg)
- `stone-400`: `#a8a29e` (muted text)
- `stone-500`: `#78716c` (secondary text)
- `stone-600`: `#57534e` (body text on light)
- `stone-800`: `#292524` (dark surface)
- `stone-900`: `#1c1917` (darkest surface)
- `stone-950`: `#0c0a09` (near-black)

---

## 4. Buttons & Interactive Elements

### Primary CTA (Green)
```css
background-color: rgb(57, 137, 87);  /* #398957 */
color: rgb(255, 255, 255);
border-radius: 12px;
padding: 12px;
font-size: 14px;
font-weight: 500;
font-family: Inter, sans-serif;
border: none;
```

### Secondary Button (Light)
```css
background-color: oklch(0.923 0.003 48.717);  /* ~stone-200 #e7e5e4 */
color: oklch(0.147 0.004 49.25);              /* ~stone-950 #0c0a09 */
border-radius: 12px;
padding: 12px;
font-size: 14px;
font-weight: 500;
```

### Nav Button (Pill)
```css
background-color: rgb(28, 25, 23);  /* stone-900 */
color: rgb(250, 250, 249);          /* stone-50 */
border-radius: 9999px;              /* full pill */
padding: 12px;
font-size: 14px;
font-weight: 500;
```

### Pill Buttons (WEG Page)
```css
background-color: rgb(245, 245, 244);  /* stone-100 */
border-radius: 999px;                   /* full pill */
padding: 12px;
font-size: 12px;
```

---

## 5. Layout & Spacing

| Property | Value |
|----------|-------|
| **Max width** | `1440px` |
| **Horizontal padding** | `16px` (mobile), `40px` (desktop) |
| **Section padding** | `80px` vertical |
| **Section padding (small)** | `40px` vertical |
| **Nav height** | `57px` |
| **Nav position** | `fixed` |
| **Nav border** | `1px solid oklch(0.268 0.007 34.298)` (dark theme) |

---

## 6. Border Radius

| Use Case | Value |
|----------|-------|
| Pills / Nav buttons | `9999px` (fully rounded) |
| Buttons / Cards | `12px` |
| Containers | `16px` |

---

## 7. Shadows

Minimal shadow usage. Primary shadow:
```css
box-shadow: rgba(0,0,0,0.1) 0px 1px 3px 0px, rgba(0,0,0,0.1) 0px 1px 2px -1px;
```
This is Tailwind's `shadow-sm`.

---

## 8. Design Patterns

### Dark/Light Dual Theme
- **Homepage & marketing pages**: Full dark theme (black bg, light text)
- **Product/service pages (WEG)**: Light theme (white bg, dark text)
- Both use the same stone-based warm palette, just inverted

### Card Pattern (CTA Section)
- Centered card on dark background
- Subtle border (no heavy box shadow)
- Logo icon centered above text
- Two action buttons side by side: secondary (light) + primary (green)

### Content Layout
- Left-aligned long-form text on homepage
- Bullet points with filled circle markers
- Large hero text with negative letter-spacing
- Photo-overlay feature cards on WEG page (full-bleed images with overlay text cards)

### Footer
- Simple stacked link groups with category labels in muted text
- Logo at bottom
- Horizontal rule separator above footer

### Navigation
- Fixed top nav with subtle bottom border
- Logo (icon) left, CTA button + hamburger right
- "Angebot anfragen" pill button is the persistent CTA

---

## 9. Image Style

- **Hero images**: Dark, moody architectural photography (homepage)
- **Team photos**: Warm, natural office/portrait photography (WEG page)
- **Full-bleed sections**: Images span full width with overlaid text cards
- Photos hosted on `framerusercontent.com` (site built with Framer)

---

## 10. Screenshots Reference

| Screenshot | Content |
|------------|---------|
| `brandkit/homepage-hero.png` | Dark hero with building image |
| `brandkit/homepage-cta-footer.png` | CTA card and footer |
| `brandkit/weg-hero.png` | Light WEG page hero with form |
| `brandkit/weg-features.png` | Feature cards with photo overlays |
| `brandkit/weg-testimonials.png` | Stats and testimonial cards |