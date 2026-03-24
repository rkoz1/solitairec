# Design System Implementation — SolitaireC

For creative philosophy, the "No-Line" Rule, and Do's/Don'ts, see `docs/product-brief/solitaire_editorial/DESIGN.md`. This file covers **implementation specifics** — the exact Tailwind classes and patterns used in the codebase.

## Color Tokens

Defined as CSS custom properties in `src/app/globals.css`, re-exported via `@theme inline` for Tailwind.

| Token                     | Tailwind Class                      | Hex     | Usage                                                    |
| ------------------------- | ----------------------------------- | ------- | -------------------------------------------------------- |
| primary                   | `bg-primary` / `text-primary`       | #000000 | Brand signals, high-contrast type                        |
| on-primary                | `text-on-primary`                   | #ffffff | Text on primary backgrounds                              |
| secondary                 | `bg-secondary` / `text-secondary`   | #96482d | Accent — section underlines, brand labels, ribbon badges |
| on-secondary              | `text-on-secondary`                 | #ffffff | Text on secondary backgrounds                            |
| surface                   | `bg-surface`                        | #f9f9f9 | Page background (set on `body`)                          |
| surface-container-lowest  | `bg-surface-container-lowest`       | #ffffff | Glassmorphism base                                       |
| surface-container-low     | `bg-surface-container-low`          | #f3f3f3 | Image frames, cart item rows                             |
| surface-container         | `bg-surface-container`              | #ededed | —                                                        |
| surface-container-high    | `bg-surface-container-high`         | #e2e2e2 | Placeholder color scheme                                 |
| surface-container-highest | `bg-surface-container-highest`      | #dadada | —                                                        |
| surface-dim               | `bg-surface-dim`                    | #dadada | —                                                        |
| on-surface                | `text-on-surface` / `bg-on-surface` | #1a1c1c | Body text; also used as dark button background           |
| on-surface-variant        | `text-on-surface-variant`           | #4c4546 | Secondary text (prices, descriptions)                    |
| outline                   | `border-outline`                    | #7d7576 | Input focus borders                                      |
| outline-variant           | `border-outline-variant`            | #cfc4c5 | Ghost borders (at /20 or /30 opacity)                    |

**Two-layer system:** CSS custom properties in `:root` → re-exported in `@theme inline` block. This is Tailwind v4's replacement for `tailwind.config.js`. Never create a `tailwind.config.*` file.

## Typography

Fonts loaded in `src/app/layout.tsx` via `next/font/google`, exposed as CSS variables:

- `--font-noto-serif` → Tailwind `font-serif` (weights: 400, 700; styles: normal, italic)
- `--font-inter` → Tailwind `font-sans`

### Type Scale (exact classes from codebase)

| Element           | Classes                                                                        | Example                                |
| ----------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| Brand logo        | `font-serif font-bold text-lg tracking-[0.3em]`                                | "SOLITAIREC" in header                 |
| Section heading   | `font-serif italic text-2xl tracking-tight text-on-surface`                    | "New Arrivals", "Your Bag"             |
| Section underline | `mt-3 w-12 h-[2px] bg-secondary`                                               | Accent bar below every section heading |
| PDP product name  | `font-serif text-4xl tracking-tight text-on-surface`                           | Product title                          |
| PDP sub-heading   | `font-serif italic text-xl tracking-tight text-on-surface`                     | "The Narrative", "Design Details"      |
| Product card name | `text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface`          | Card label                             |
| Price / metadata  | `text-[10px] tracking-widest text-on-surface-variant`                          | Price on cards, cart qty               |
| Brand label       | `text-[10px] tracking-[0.25em] uppercase font-medium text-secondary`           | Collection/brand tag on PDP            |
| CTA button text   | `text-xs tracking-[0.25em] font-bold uppercase`                                | "Add to Bag", "Proceed to Checkout"    |
| Nav label         | `text-[10px] tracking-[0.15em] uppercase font-medium`                          | Bottom nav items                       |
| Tertiary link     | `text-xs tracking-[0.15em] uppercase font-medium underline underline-offset-4` | "Continue Shopping"                    |
| Body text         | `text-sm leading-relaxed text-on-surface-variant`                              | Product descriptions                   |

## Component Patterns

### Frosted glass header

```
bg-white/80 backdrop-blur-xl border-b border-surface-container-high/40
```

Fixed, z-50, h-14. Logo centered with `absolute left-1/2 -translate-x-1/2`.

### Bottom nav

```
bg-white/90 backdrop-blur-xl border-t border-surface-container-high/40
```

Fixed, z-50, h-16. Three items with Material Symbols icons at `text-[22px]`.

### Primary button (dark)

```
bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase
active:scale-[0.98] disabled:opacity-50
```

Note: uses `bg-on-surface` (dark) not `bg-primary`. Full width on PDP/cart.

### Product card image frame

```
aspect-[3/4] overflow-hidden bg-surface-container-low
```

Image with `object-cover`, `group-hover:scale-105`, `transition-transform duration-700`.

### Ghost border

```
border border-outline-variant/20    (default / variant selectors)
border-b border-outline-variant/30  (section dividers in PDP)
```

### Loading indicator

Single "S" character with `animate-brand-pulse` (0.4→1 opacity, 1→1.08 scale, 2s infinite).

### Material Symbols icons

Loaded via Google Fonts CDN in `layout.tsx`. Config in `globals.css`:

```css
font-variation-settings:
  "FILL" 0,
  "wght" 300,
  "GRAD" 0,
  "opsz" 24;
```

Usage: `<span className="material-symbols-outlined text-[22px]">icon_name</span>`

## Spacing Patterns

| Context                  | Class                     | Value                   |
| ------------------------ | ------------------------- | ----------------------- |
| Between major sections   | `pt-28`                   | 7rem                    |
| Staggered grid offset    | `mt-8` on odd-index items | 2rem                    |
| PDP description sections | `mt-16 space-y-10`        | 4rem / 2.5rem           |
| Cross-sell section       | `mt-28`                   | 7rem                    |
| Main content padding     | `pt-16 pb-24`             | Header/footer clearance |
| Card text from image     | `mt-4`                    | 1rem                    |

## Mockup Reference

| Screen          | Directory                                     | Key Patterns                                   |
| --------------- | --------------------------------------------- | ---------------------------------------------- |
| Home            | `docs/product-brief/modern_luxury_home_page/` | Hero layout, asymmetric grid, section headings |
| Product listing | `docs/product-brief/curated_product_listing/` | Category filtering, staggered 2-col grid       |
| PDP (variant 1) | `docs/product-brief/luxury_product_detail_1/` | Image carousel, sticky info panel              |
| PDP (variant 2) | `docs/product-brief/luxury_product_detail_2/` | Editorial description sections                 |
| Navigation      | `docs/product-brief/navigation_menu_mockup/`  | Full-screen drawer with serif links            |
| Checkout        | `docs/product-brief/secure_checkout/`         | Wix-hosted (redirect flow, not custom)         |

Each directory contains `code.html` (reference implementation) and `screen.png` (visual).

## Anti-Patterns (never use)

- `rounded-*` — border-radius is 0px everywhere
- `border` for sectioning — use background color shifts + whitespace (the "No-Line" Rule)
- `dark:` classes — light-only design
- Even symmetric grids — use asymmetric stagger (odd items offset by `mt-8`)
- `tailwind.config.js` / `tailwind.config.ts` — Tailwind v4 uses `@theme inline` in CSS
