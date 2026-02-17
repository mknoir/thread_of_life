import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import type { ImageAsset } from "@/lib/types/image-pack";

interface ThreadImageProps {
  asset: ImageAsset;
  /** Aspect ratio, defaults to 16/9 */
  ratio?: number;
  /** Whether to use priority loading */
  priority?: boolean;
}

/**
 * Renders a B&W archival-mood image with grain overlay and poetic caption.
 *
 * GOLDEN RULE: This component renders MOOD only.
 * Source links and attribution live in the evidence Sheet, never here.
 */
export function ThreadImage({
  asset,
  ratio = 16 / 9,
  priority = false,
}: ThreadImageProps) {
  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-lg grain-overlay">
        <AspectRatio ratio={ratio}>
          <Image
            src={asset.src}
            alt={asset.alt}
            fill
            className="img-archival object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
            priority={priority}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </AspectRatio>
      </div>
      {asset.caption && (
        <figcaption className="px-1 font-mono text-xs italic text-muted-foreground">
          {asset.caption}
        </figcaption>
      )}
    </figure>
  );
}
