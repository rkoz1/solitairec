"use client";

import { useState } from "react";
import AddToCartButton from "./AddToCartButton";
import WishlistButton from "@/components/WishlistButton";

interface ProductOption {
  name?: string | null;
  choices?: Array<{
    value?: string | null;
    description?: string | null;
  }> | null;
}

interface ProductInfoProps {
  productId: string;
  productOptions: ProductOption[];
}

export default function ProductInfo({
  productId,
  productOptions,
}: ProductInfoProps) {
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >(() => {
    const defaults: Record<string, string> = {};
    for (const option of productOptions) {
      if (option.name && option.choices?.[0]) {
        const c = option.choices[0];
        defaults[option.name] = c.description || c.value || "";
      }
    }
    return defaults;
  });

  return (
    <>
      {/* Variant/size selector */}
      {productOptions.length > 0 && (
        <div className="mt-10 space-y-6">
          {productOptions.map((option) => (
            <div key={option.name}>
              <label className="block text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-3">
                {option.name}
              </label>
              {option.choices?.[0]?.value && /^(#|rgb)/.test(option.choices[0].value) ? (
                /* Color option — swatch squares with selected name below */
                <div>
                  <div className="flex gap-2">
                    {option.choices?.map((choice) => {
                      const isSelected =
                        selectedOptions[option.name ?? ""] === (choice.description || choice.value);
                      return (
                        <button
                          key={choice.value}
                          onClick={() =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [option.name ?? ""]: choice.description || choice.value || "",
                            }))
                          }
                          className={`w-10 h-10 transition-colors ${
                            isSelected
                              ? "ring-2 ring-on-surface ring-offset-2 ring-offset-surface"
                              : "border border-outline-variant/20 hover:border-outline"
                          }`}
                          style={{ backgroundColor: choice.value ?? undefined }}
                          aria-label={choice.description || choice.value || ""}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
                    {selectedOptions[option.name ?? ""] ?? ""}
                  </p>
                </div>
              ) : (
                /* Non-color option (Size, etc.) — text chips */
                <div className="grid grid-cols-4 gap-2">
                  {option.choices?.map((choice) => {
                    const isSelected =
                      selectedOptions[option.name ?? ""] === (choice.description || choice.value);
                    return (
                      <button
                        key={choice.value}
                        onClick={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [option.name ?? ""]: choice.description || choice.value || "",
                          }))
                        }
                        className={`h-14 text-xs tracking-[0.15em] uppercase font-medium transition-colors border border-outline-variant/20 ${
                          isSelected
                            ? "bg-on-surface text-on-primary"
                            : "bg-transparent text-on-surface hover:bg-surface-container-low"
                        }`}
                      >
                        {choice.description || choice.value}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add to Bag */}
      <div className="mt-8">
        <AddToCartButton productId={productId} selectedOptions={selectedOptions} />
      </div>

      {/* Add to Wishlist */}
      <WishlistButton productId={productId} />
    </>
  );
}
