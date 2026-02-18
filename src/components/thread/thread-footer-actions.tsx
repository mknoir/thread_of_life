"use client";

import { useMemo } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ThreadFooterActionsProps {
  title: string;
  sharePath?: string;
}

export function ThreadFooterActions({
  title,
  sharePath,
}: ThreadFooterActionsProps) {
  const permalink = useMemo(() => {
    if (typeof window === "undefined") return sharePath ?? "";
    if (!sharePath) return window.location.href;
    try {
      return new URL(sharePath, window.location.origin).toString();
    } catch {
      return window.location.href;
    }
  }, [sharePath]);

  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      toast.success("Permalink copied");
    } catch {
      toast.error("Failed to copy permalink");
    }
  };

  const shareThread = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Thread of Life: ${title}`,
          url: permalink,
        });
        return;
      } catch {
        // Fallback to copy when native share is dismissed/unavailable.
      }
    }

    await copyPermalink();
    toast.message("Share is not available here; link copied instead.");
  };

  return (
    <div className="flex justify-center gap-3">
      <Button variant="outline" size="sm" onClick={shareThread}>
        <Share2 className="mr-2 h-3.5 w-3.5" />
        Share this thread
      </Button>
      <Button variant="outline" size="sm" onClick={copyPermalink}>
        <Copy className="mr-2 h-3.5 w-3.5" />
        Copy permalink
      </Button>
    </div>
  );
}
