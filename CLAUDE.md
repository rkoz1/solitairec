# SolitaireC — Editorial Luxury Clothing Store

Next.js (App Router) + Wix Headless (BaaS) e-commerce frontend.

## Skill References

Read these before making changes in the relevant area:

| Skill File                   | When to Read                                                     |
| ---------------------------- | ---------------------------------------------------------------- |
| `docs/SKILL_WIX.md`          | Touching `src/lib/wix-*`, cart logic, checkout, product fetching |
| `docs/SKILL_DESIGN.md`       | Creating/modifying UI components, styling, layout                |
| `docs/SKILL_ARCHITECTURE.md` | Adding routes, components, or changing data flow                 |

## Design System

Full reference: `docs/product-brief/solitaire_editorial/DESIGN.md`
HTML mockups: `docs/product-brief/*/code.html` with corresponding `screen.png`

### Core Rules (always follow)

- **Fonts:** Noto Serif (headlines/display) + Inter (body/labels/UI)
- **Colors:** primary=#000000, secondary=#96482d, surfaces=#f9f9f9 to #dadada
- **Border-radius:** 0px everywhere — no rounded corners
- **No borders for sectioning** — use background color shifts + whitespace instead
- **Wide letter-spacing** on all labels (0.2em+)
- **Frosted glass header:** bg-white/80 backdrop-blur-xl, centered "SOLITAIREC" in Noto Serif bold with 0.3em tracking
- **Bottom nav:** Fixed, 3 items (Shop/Bag/Account) with Material Symbols Outlined icons
- **Icons:** Material Symbols Outlined (loaded via Google Fonts CDN)
- **Spacing:** Generous macro spacing (7rem+ between major sections)
- **Light-only:** No dark mode

### Coding Conventions

- Tailwind CSS v4 (uses `@theme inline` blocks, CSS custom properties)
- Next.js App Router with server components by default, `"use client"` only when needed
- Wix server client for data fetching, browser client for cart/checkout
- `next/font/google` for font loading

@AGENTS.md
