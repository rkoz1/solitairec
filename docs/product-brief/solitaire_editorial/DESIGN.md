# The Design System: Editorial Excellence for Global Luxury

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

This system is not a template; it is a curation. Moving away from the generic "e-commerce grid," we draw inspiration from the high-contrast layouts of *Vogue* and the sharp, architectural sensibilities of *Hypebeast*. We celebrate the craftsmanship of Japanese and Korean fashion by treating the browser as a high-end editorial canvas.

The "template" look is avoided through **intentional asymmetry**, where text overlaps imagery, and large-scale typography creates a rhythmic hierarchy. Whitespace is not "empty space"—it is a premium structural element used to give the products the breathing room of an art gallery.

---

## 2. Colors & Surface Philosophy
The palette is rooted in sophisticated neutrals, designed to let high-fashion photography take center stage.

*   **Primary (#000000):** Used for critical brand signals and high-contrast typography.
*   **Secondary (#96482d):** A muted, earthy champagne. This is our signature accent—used sparingly for moments of discovery or "Premium" status.
*   **Neutral Surfaces:** A range from `surface-container-lowest` (#ffffff) to `surface-dim` (#dadada) to create depth without visual noise.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. High-end design is defined by volume and tone, not outlines. Boundaries between sections must be achieved through:
1.  **Background Shifts:** Transitioning from `surface` (#f9f9f9) to `surface-container-low` (#f3f3f3).
2.  **Negative Space:** Using the Spacing Scale (specifically `16` or `20`) to create a cognitive break between content blocks.

### Glassmorphism & Signature Textures
To provide a modern, "global" feel, floating UI elements (like sticky headers or quick-shop overlays) should use a **frosted glass effect**. 
*   **Token:** `surface-container-lowest` at 80% opacity.
*   **Effect:** `backdrop-blur: 20px`. 
This allows the rich colors of product photography to bleed through the UI, softening the interface.

---

## 3. Typography: The Editorial Voice
Typography is the primary vehicle for brand authority. We use a high-contrast pairing to balance heritage and modernity.

*   **The Editorial Serif (notoSerif):** Used for `display` and `headline` levels. This font carries the "Vogue" aesthetic. Use `display-lg` (3.5rem) for hero statements and brand stories.
*   **The Modern Utility (inter):** Used for `body`, `title`, and `label` levels. To achieve the "Hypebeast" look, all `label` and `title` styles should utilize **wide tracking** (letter-spacing: 0.05em or higher) to evoke a sense of intentional, technical design.

---

## 4. Elevation & Depth
In this design system, depth is biological and ambient, not artificial.

*   **The Layering Principle:** Treat the UI as stacked sheets of fine paper. Place a `surface-container-highest` (#e2e2e2) element atop a `surface-container-low` (#f3f3f3) background to create a soft, natural lift.
*   **Ambient Shadows:** When an element must float (e.g., a cart drawer), use a shadow with a blur of 40px+ and an opacity of 4-6% using the `on-surface` color. It should feel like a soft glow of light, not a "drop shadow."
*   **The Ghost Border Fallback:** If a border is required for accessibility (e.g., in input fields), use the `outline-variant` (#cfc4c5) at **20% opacity**. This provides a "Ghost Border" that guides the eye without cluttering the layout.

---

## 5. Components

### Buttons
*   **Structure:** 0px border-radius (Sharp/Brutalist).
*   **Primary:** `primary` background with `on-primary` text. Use for "Add to Cart."
*   **Tertiary:** No background. Underlined with a `px` height stroke when hovered. Used for "View Collection."

### Cards & Product Grids
*   **Strict Rule:** No dividers or borders. 
*   **Layout:** Use `surface-container-low` as the background for product shots to create a "frame" effect without lines.
*   **Spacing:** Use `spacing-4` between image and text.

### Input Fields
*   **Style:** Minimalist. Only a bottom border using `outline` at 30% opacity.
*   **State:** On focus, the border transitions to 100% `primary` (#000000).

### Editorial Hero (Custom Component)
A signature component where a `display-lg` heading overlaps a `spacing-24` height image. The text should be `on-surface` and utilize a `surface-container-lowest` glassmorphism background when overlapping busy photographic areas.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Asymmetry:** Align some text to the left and some to the right within the same section to create a magazine-style rhythm.
*   **Use Massive Whitespace:** Use `spacing-20` (7rem) between major homepage sections.
*   **Focus on Imagery:** All UI should feel like a frame for the photography. If the UI is more "interesting" than the clothes, dial it back.

### Don't:
*   **No Rounded Corners:** The `roundedness` scale is `0px` across all tokens. Any rounding will break the "Modern Luxury" aesthetic.
*   **No Generic Grids:** Avoid perfectly even 4-column grids. Try a 2-column large/small split to create visual tension.
*   **No High-Contrast Borders:** Never use a 100% opaque border to separate content. Refer back to the "No-Line" Rule.

---

## 7. Spacing Scale Reference
Use these tokens to maintain architectural rigor:
*   **Micro (1-3):** For internal component padding (e.g., button labels).
*   **Standard (4-8):** For content grouping and card margins.
*   **Macro (10-24):** For section breaks and hero margins. **Luxury is defined by the space you "waste."** Use these values generously.