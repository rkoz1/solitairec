import { media } from "@wix/sdk";

/**
 * Convert a Wix media string (e.g. "wix:image://v1/...") to a usable URL.
 * Falls back to a placeholder if the media string is missing or invalid.
 */
export function getWixImageUrl(
  wixMediaIdentifier: string | undefined | null,
  width: number = 500,
  height: number = 500
): string {
  if (!wixMediaIdentifier) {
    return `https://placehold.co/${width}x${height}/e2e2e2/999?text=No+Image`;
  }

  try {
    const url = media.getScaledToFillImageUrl(wixMediaIdentifier, width, height, {});
    return url.replace(/q_\d+/, "q_80").replace("enc_auto", "enc_avif");
  } catch {
    return `https://placehold.co/${width}x${height}/e2e2e2/999?text=No+Image`;
  }
}
