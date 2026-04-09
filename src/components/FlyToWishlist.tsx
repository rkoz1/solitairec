"use client";

import { useEffect, useState, useCallback } from "react";

interface FlyItem {
  id: number;
  imageUrl: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function FlyToWishlist() {
  const [items, setItems] = useState<FlyItem[]>([]);

  const handleAdd = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as {
      imageUrl: string;
      sourceX: number;
      sourceY: number;
    };

    const heartIcon = document.querySelector('[aria-label="Wishlist"]');
    if (!heartIcon) return;

    const rect = heartIcon.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    const item: FlyItem = {
      id: Date.now(),
      imageUrl: detail.imageUrl,
      startX: detail.sourceX,
      startY: detail.sourceY,
      endX,
      endY,
    };

    setItems((prev) => [...prev, item]);

    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      window.dispatchEvent(new Event("wishlist-badge-bounce"));
    }, 600);
  }, []);

  useEffect(() => {
    window.addEventListener("wishlist-item-added", handleAdd);
    return () => window.removeEventListener("wishlist-item-added", handleAdd);
  }, [handleAdd]);

  return (
    <>
      {items.map((item) => (
        <FlyingThumbnail key={item.id} item={item} />
      ))}
    </>
  );
}

function FlyingThumbnail({ item }: { item: FlyItem }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimated(true));
    });
  }, []);

  const dx = item.endX - item.startX;
  const dy = item.endY - item.startY;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: item.startX,
        top: item.startY,
        transition: animated ? "all 600ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        transform: animated
          ? `translate(${dx}px, ${dy}px) scale(0.3)`
          : "translate(0, 0) scale(1)",
        opacity: animated ? 0.6 : 1,
      }}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="w-12 h-16 object-cover shadow-lg"
        />
      ) : (
        <div className="w-12 h-16 bg-surface-container shadow-lg" />
      )}
    </div>
  );
}
