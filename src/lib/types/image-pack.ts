export interface ImageAsset {
  id: string;
  /** Relative path from public/: /images/packs/indus-valley/mohenjo-daro-ruins.webp */
  src: string;
  alt: string;
  /** Poetic one-liner: "Frequencies move with people." */
  caption: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  attribution: string;
}

export interface ImagePack {
  id: string;
  name: string;
  tags: string[];
  description: string;
  assets: ImageAsset[];
}
