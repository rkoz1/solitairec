/**
 * Integration test for add-to-cart logic.
 * Queries real products from Wix, classifies them, and verifies
 * that buildCatalogReference produces the correct payload for each type.
 *
 * Run: npx tsx scripts/test-cart-integration.ts
 * Requires: .env.local with WIX_API_KEY and WIX_SITE_ID
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@wix/sdk";
import { ApiKeyStrategy } from "@wix/sdk/auth/api-key";
import { products } from "@wix/stores";
import {
  buildCatalogReference,
  buildStockKey,
  WIX_STORES_V1_APP_ID,
  WIX_STORES_V3_APP_ID,
} from "../src/lib/cart";

const wix = createClient({
  modules: { products },
  auth: ApiKeyStrategy({
    apiKey: process.env.WIX_API_KEY!,
    siteId: process.env.WIX_SITE_ID!,
  }),
});

interface TestResult {
  name: string;
  slug: string;
  type: string;
  manageVariants: boolean;
  optionNames: string[];
  variantCount: number;
  expectedAppId: string;
  actualAppId: string;
  hasOptions: boolean;
  hasVariantId: boolean;
  pass: boolean;
  notes: string;
}

async function run() {
  console.log("Fetching products from Wix...\n");

  const { items } = await wix.products.queryProducts().limit(100).find();

  const results: TestResult[] = [];

  // Classify and test each product
  for (const p of items) {
    const manage = p.manageVariants ?? false;
    const opts = (p.productOptions ?? []) as { name?: string; choices?: { value?: string; description?: string }[] }[];
    const variants = (p.variants ?? []) as { _id?: string; choices?: Record<string, string>; stock?: { inStock?: boolean } }[];
    const optionNames = opts.map((o) => o.name ?? "").filter(Boolean);
    const hasRealChoices = variants.some((v) => Object.keys(v.choices ?? {}).length > 0);

    // Determine product type
    let type: string;
    if (optionNames.length === 0) {
      type = "no-options";
    } else if (!manage) {
      type = "standalone (manageVariants:false)";
    } else if (hasRealChoices) {
      type = "real-variants (manageVariants:true)";
    } else {
      type = "edge-case (manageVariants:true, empty choices)";
    }

    // Build test options from first choices
    const testOptions: Record<string, string> = {};
    for (const opt of opts) {
      const c = opt.choices?.[0];
      if (c && opt.name) testOptions[opt.name] = c.description || c.value || "";
    }

    // Find variant ID for the test options
    let testVariantId: string | undefined;
    if (manage && hasRealChoices) {
      const key = buildStockKey(testOptions);
      const match = variants.find((v) => {
        const vKey = buildStockKey(v.choices ?? {});
        return vKey === key;
      });
      testVariantId = match?._id;
    }

    // Run buildCatalogReference
    const { reference } = buildCatalogReference({
      productId: p._id ?? "",
      manageVariants: manage,
      selectedOptions: optionNames.length > 0 ? testOptions : undefined,
      variantId: testVariantId,
    });

    // Determine expected appId
    let expectedAppId: string;
    if (!manage || optionNames.length === 0) {
      expectedAppId = WIX_STORES_V1_APP_ID;
    } else {
      expectedAppId = WIX_STORES_V3_APP_ID;
    }

    const pass = reference.appId === expectedAppId;

    results.push({
      name: (p.name ?? "").substring(0, 60),
      slug: p.slug ?? "",
      type,
      manageVariants: manage,
      optionNames,
      variantCount: variants.length,
      expectedAppId: expectedAppId === WIX_STORES_V1_APP_ID ? "V1" : "V3",
      actualAppId: reference.appId === WIX_STORES_V1_APP_ID ? "V1" : "V3",
      hasOptions: !!reference.options,
      hasVariantId: !!reference.options?.variantId && reference.options.variantId !== "00000000-0000-0000-0000-000000000000",
      pass,
      notes: !pass
        ? `MISMATCH: expected ${expectedAppId === WIX_STORES_V1_APP_ID ? "V1" : "V3"}, got ${reference.appId === WIX_STORES_V1_APP_ID ? "V1" : "V3"}`
        : "",
    });
  }

  // Print summary by type
  const types = [...new Set(results.map((r) => r.type))];
  for (const type of types) {
    const typeResults = results.filter((r) => r.type === type);
    const passed = typeResults.filter((r) => r.pass).length;
    const failed = typeResults.filter((r) => !r.pass).length;

    console.log(`\n=== ${type} (${typeResults.length} products) ===`);
    console.log(`  Passed: ${passed}  Failed: ${failed}`);

    if (failed > 0) {
      for (const r of typeResults.filter((r) => !r.pass)) {
        console.log(`  FAIL: ${r.name} (${r.slug}) — ${r.notes}`);
      }
    }

    // Show first product as example
    const example = typeResults[0];
    if (example) {
      console.log(`  Example: ${example.name}`);
      console.log(`    AppId: ${example.actualAppId}, Options: ${example.hasOptions}, RealVariantId: ${example.hasVariantId}`);
    }
  }

  // Overall
  const totalPassed = results.filter((r) => r.pass).length;
  const totalFailed = results.filter((r) => !r.pass).length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TOTAL: ${results.length} products | ${totalPassed} passed | ${totalFailed} failed`);
  console.log(`${"=".repeat(60)}`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
