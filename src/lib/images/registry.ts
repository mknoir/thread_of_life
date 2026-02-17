import type { ImagePack, ImageAsset } from "@/lib/types/image-pack";

import threadPack from "./packs/indus-valley.json";
import evidencePack from "./packs/migration.json";
import historyPack from "./packs/ancient-dna.json";

const ALL_PACKS: ImagePack[] = [
  threadPack,
  evidencePack,
  historyPack,
];

/**
 * Get all image packs that contain a given tag.
 */
export function getPacksByTag(tag: string): ImagePack[] {
  return ALL_PACKS.filter((pack) =>
    pack.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
}

/**
 * Get a random image asset matching any of the provided tags.
 * Searches across all packs.
 */
export function getRandomAsset(tags: string[]): ImageAsset | null {
  const lowerTags = tags.map((t) => t.toLowerCase());
  const matchingPacks = ALL_PACKS.filter((pack) =>
    pack.tags.some((t) => lowerTags.includes(t.toLowerCase()))
  );

  const allAssets = matchingPacks.flatMap((pack) => pack.assets);
  if (allAssets.length === 0) return null;

  return allAssets[Math.floor(Math.random() * allAssets.length)]!;
}

/**
 * Get a specific asset by pack ID and asset ID.
 */
export function getAssetById(
  packId: string,
  assetId: string
): ImageAsset | null {
  const pack = ALL_PACKS.find((p) => p.id === packId);
  if (!pack) return null;
  return pack.assets.find((a) => a.id === assetId) ?? null;
}

/**
 * Get all packs.
 */
export function getAllPacks(): ImagePack[] {
  return ALL_PACKS;
}

/**
 * Get a pack by its ID.
 */
export function getPackById(packId: string): ImagePack | null {
  return ALL_PACKS.find((p) => p.id === packId) ?? null;
}
