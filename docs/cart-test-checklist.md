# Add-to-Cart Test Checklist

Run through these test cases after any change to cart logic.
Check the browser console for structured logs on failures.

## Product Types

| Type | Example Product | `manageVariants` | Expected AppId |
|---|---|---|---|
| No options | Silver necklace (no size/color) | `false` | V1 |
| Standalone per-color | Loafers with Color option but each color = separate product | `false` | V1 |
| Real variants | Pants/bags with Size or Color that have real variant UUIDs | `true` | V3 |
| Gift card | Credits for More | N/A | Gift Card |

## Test Cases

### PDP (Product Detail Page)

- [ ] **1. No options product** — Visit a necklace/earring with no options. Click "Add to Bag". Item added, fly animation plays.
- [ ] **2. Standalone product (manageVariants:false)** — Visit loafers with Color option. Select a color. Click "Add to Bag". Item added with V1 (check Network tab: appId should be `1380b703-...`, no options in payload).
- [ ] **3. Real variant product** — Visit pants with Size option (e.g. `lace-trim-tencel-cotton-denim-dark-navy-elasticated-pants`). Select Size S. Click "Add to Bag". Item added with V3 (check Network tab: appId `215238eb-...`, options with real variantId).
- [ ] **4. OOS variant** — On the same pants, XS should show as crossed out / dimmed. Select XS. Should show "Sold Out" + Notify Me form.
- [ ] **5. Low stock** — Visit a product with `trackInventory: true` and quantity 1-5 (e.g. `lambskin-drape-zipper-shoulder-crossbody-bag-1`). Should show "Only X left in stock" above Add to Bag.
- [ ] **6. Fully out of stock product** — Visit a product where `inventoryStatus: OUT_OF_STOCK`. Should show Notify Me form.

### Quick-Add (Product Card Bottom Sheet)

- [ ] **7. No options product** — Click bag icon on a necklace card. Item added immediately (no sheet opens).
- [ ] **8. Product with options** — Click bag icon on a product with Size/Color. Sheet opens. Button shows "Loading..." until variant data loads. After loading, select option and click "Add to Bag".
- [ ] **9. OOS in quick-add** — Open sheet on a product with OOS variants. OOS options should be dimmed/crossed out.
- [ ] **10. Verify on silent rejection** — If add fails, error toast appears. Cart badge does NOT update.

### Wishlist

- [ ] **11. Add from wishlist** — Add a product to wishlist. Go to Bag → Wishlist tab. Click "Add to Bag". Expand selector, pick option. Item added.
- [ ] **12. OOS in wishlist** — Wishlist item with OOS variants should show options dimmed. Default selection should skip OOS.
- [ ] **13. Sold out wishlist item** — Wishlist item that's entirely OOS shows "Sold Out" label, dimmed, no Add to Bag button.

### Gift Card

- [ ] **14. Gift card add** — Go to /gift-cards. Select amount, fill details. Click "Add to Bag". Item added with gift card appId.

### Edge Cases

- [ ] **15. Quantity change in bag** — Add item, go to bag, increase quantity. If stock limit hit, toast shows "Only X items left in stock".
- [ ] **16. Multiple items** — Add items of different types (no options + variant product + gift card). All appear in bag correctly.
