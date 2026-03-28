"use client";

import { useState, useMemo } from "react";
import type { ColorOption } from "@/app/collections/actions";

export interface FilterState {
  sizes: string[];
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

interface CollectionFiltersProps {
  availableSizes: string[];
  availableColors: ColorOption[];
  priceRange: { min: number; max: number };
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
}

export const EMPTY_FILTERS: FilterState = {
  sizes: [],
  colors: [],
  minPrice: null,
  maxPrice: null,
};

/* ------------------------------------------------------------------ */
/*  Color family grouping by name keywords                            */
/* ------------------------------------------------------------------ */

interface ColorFamily {
  name: string;
  representative: string;
  colors: ColorOption[];
}

// Map color names to families using keyword matching.
// Built from actual Wix product color inventory (66 colors).
// Order matters — more specific matches before generic ones.
const FAMILY_KEYWORDS: [string, string[]][] = [
  ["Whites", ["white", "ivory", "cream", "pearl", "champagne", "houndstooth", "sora"]],
  ["Blacks", ["black", "togo", "shiny black"]],
  ["Greys", ["grey", "gray", "silver", "charcoal"]],
  ["Beiges", ["beige", "etoupe", "taupe", "sand", "suede beige", "khaki", "bronze"]],
  ["Browns", ["brown", "mocha", "coffee", "camel", "chestnut", "caramel", "dark brown", "taro"]],
  ["Reds", ["red", "burgundy", "bordeaux", "brick", "rust", "wine", "maroon"]],
  ["Pinks", ["pink", "rosy", "rose", "coral", "carol", "morandi"]],
  ["Oranges", ["orange", "apricot", "mustard"]],
  ["Yellows", ["yellow", "golden", "lime"]],
  ["Greens", ["green", "olive", "mint", "sage", "charcoal green"]],
  ["Blues", ["blue", "navy", "lake", "retro blue", "greyish blue", "light blue"]],
  ["Purples", ["purple", "violet", "lavender", "plum", "mauve", "lilac"]],
];


function getColorFamilyByName(name: string): string {
  const lower = name.toLowerCase();
  for (const [family, keywords] of FAMILY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return family;
  }
  return "Other";
}

function groupColors(colors: ColorOption[]): ColorFamily[] {
  const families = new Map<string, ColorOption[]>();

  for (const color of colors) {
    const family = getColorFamilyByName(color.name);
    if (!families.has(family)) families.set(family, []);
    families.get(family)!.push(color);
  }

  // Representative color: average of all colors in the family, or first one's hex
  const familyOrder = FAMILY_KEYWORDS.map(([name]) => name);
  familyOrder.push("Other");

  return familyOrder
    .filter((name) => families.has(name))
    .map((name) => {
      const cols = families.get(name)!;
      return {
        name,
        representative: cols[0].value,
        colors: cols,
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CollectionFilters({
  availableSizes,
  availableColors,
  priceRange,
  filters,
  onChange,
  sort,
  onSortChange,
  resultCount,
}: CollectionFiltersProps) {
  const [open, setOpen] = useState(false);

  const colorFamilies = useMemo(
    () => groupColors(availableColors),
    [availableColors]
  );

  const hasFilters = availableSizes.length > 0 || availableColors.length > 0;
  const activeCount =
    filters.sizes.length +
    filters.colors.length +
    (filters.minPrice !== null ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0);

  function toggleSize(size: string) {
    const next = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onChange({ ...filters, sizes: next });
  }

  function toggleFamily(family: ColorFamily) {
    const familyNames = family.colors.map((c) => c.name);
    const allSelected = familyNames.every((n) => filters.colors.includes(n));

    let next: string[];
    if (allSelected) {
      next = filters.colors.filter((c) => !familyNames.includes(c));
    } else {
      const existing = new Set(filters.colors);
      familyNames.forEach((n) => existing.add(n));
      next = [...existing];
    }
    onChange({ ...filters, colors: next });
  }

  // Which colors are currently selected, grouped by family for display
  const selectedColorNames = useMemo(() => {
    if (filters.colors.length === 0) return "";
    return filters.colors.join(", ");
  }, [filters.colors]);

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="flex items-center gap-3 shrink-0">
          {hasFilters && (
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">
                tune
              </span>
              Filters
              {activeCount > 0 && (
                <span className="bg-secondary text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center" style={{ borderRadius: "50%" }}>
                  {activeCount}
                </span>
              )}
            </button>
          )}
          <p className="text-[10px] tracking-widest text-on-surface-variant whitespace-nowrap">
            {resultCount}
          </p>
        </div>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="bg-transparent text-[10px] tracking-[0.1em] uppercase font-medium text-on-surface outline-none cursor-pointer shrink-0"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
        </select>
      </div>

      {/* Filter panel */}
      {open && (
        <div className="mb-8 pb-6 border-b border-outline-variant/20">
          {/* Sizes */}
          {availableSizes.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-3">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const active = filters.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                        active
                          ? "bg-on-surface text-on-primary"
                          : "bg-transparent text-on-surface hover:bg-surface-container-low"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color families */}
          {colorFamilies.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-3">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {colorFamilies.map((family) => {
                  const familyNames = family.colors.map((c) => c.name);
                  const allSelected = familyNames.every((n) =>
                    filters.colors.includes(n)
                  );
                  const someSelected = familyNames.some((n) =>
                    filters.colors.includes(n)
                  );
                  return (
                    <button
                      key={family.name}
                      onClick={() => toggleFamily(family)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors border ${
                        allSelected
                          ? "border-on-surface bg-surface-container-low"
                          : someSelected
                            ? "border-outline-variant/40 bg-surface-container-low/50"
                            : "border-outline-variant/20 bg-transparent hover:bg-surface-container-low"
                      }`}
                    >
                      {/* Show swatches for up to 3 colors in the family */}
                      <span className="flex -space-x-1">
                        {family.colors.slice(0, 3).map((c) => (
                          <span
                            key={c.name}
                            className="w-3 h-3 border border-white/50"
                            style={{ backgroundColor: /^(#|rgb)/.test(c.value) ? c.value : undefined }}
                          />
                        ))}
                      </span>
                      {family.name}
                    </button>
                  );
                })}
              </div>

              {/* Selected colors breakdown */}
              {selectedColorNames && (
                <p className="mt-3 text-[9px] tracking-widest text-on-surface-variant">
                  Showing: {selectedColorNames}
                </p>
              )}
            </div>
          )}

          {/* Price range */}
          {priceRange.max > 0 && (
            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-3">
                Price
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder={`${priceRange.min}`}
                  value={filters.minPrice ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      minPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-24 bg-surface-container-low px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
                />
                <span className="text-[10px] text-on-surface-variant">to</span>
                <input
                  type="number"
                  placeholder={`${priceRange.max}`}
                  value={filters.maxPrice ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      maxPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-24 bg-surface-container-low px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
                />
              </div>
            </div>
          )}

          {/* Clear all */}
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-[10px] tracking-[0.15em] uppercase text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
