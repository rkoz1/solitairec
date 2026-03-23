"use client";

import { useState } from "react";
import AddToCartButton from "./AddToCartButton";

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
      if (option.name && option.choices?.[0]?.value) {
        defaults[option.name] = option.choices[0].value;
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
              <div className="grid grid-cols-4 gap-2">
                {option.choices?.map((choice) => {
                  const isSelected =
                    selectedOptions[option.name ?? ""] === choice.value;
                  return (
                    <button
                      key={choice.value}
                      onClick={() =>
                        setSelectedOptions((prev) => ({
                          ...prev,
                          [option.name ?? ""]: choice.value ?? "",
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
            </div>
          ))}
        </div>
      )}

      {/* Add to Bag */}
      <div className="mt-8">
        <AddToCartButton productId={productId} selectedOptions={selectedOptions} />
      </div>
    </>
  );
}
