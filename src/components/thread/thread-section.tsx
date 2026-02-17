import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { ImageAsset } from "@/lib/types/image-pack";
import { ThreadImage } from "./thread-image";

interface ThreadSectionProps {
  title: string;
  prose: string;
  imageAsset?: ImageAsset;
  /** Whether this is the first section (priority image loading) */
  isHero?: boolean;
  children?: React.ReactNode;
}

/**
 * A single section in the scroll-story thread.
 * Each section: optional B&W hero image + narrative prose + evidence hooks.
 */
export function ThreadSection({
  title,
  prose,
  imageAsset,
  isHero = false,
  children,
}: ThreadSectionProps) {
  return (
    <section className="space-y-6">
      {imageAsset && (
        <ThreadImage asset={imageAsset} priority={isHero} />
      )}

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {prose}
        </p>
      </div>

      {children && <div className="flex flex-wrap gap-2">{children}</div>}

      <Separator className="mt-8" />
    </section>
  );
}
