"use server";

import { getNavCategories, type NavCategory } from "@/lib/collections";

export async function fetchNavCategories(): Promise<NavCategory[]> {
  return getNavCategories();
}
