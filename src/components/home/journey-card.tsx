import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface JourneyCardProps {
  id: string;
  title: string;
  hook: string;
  description: string;
  tags: string[];
  imageCaption?: string;
  imageSrc?: string;
}

export function JourneyCard({
  id,
  title,
  hook,
  description,
  tags,
  imageCaption,
  imageSrc,
}: JourneyCardProps) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted grain-overlay">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageCaption ?? title}
            fill
            className="img-archival object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : null}
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-4">
          {imageCaption && (
            <p className="font-mono text-xs italic text-white/80">
              {imageCaption}
            </p>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-lg leading-tight">{title}</CardTitle>
        <CardDescription className="text-sm font-medium italic text-foreground/70">
          &ldquo;{hook}&rdquo;
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>

      <CardFooter>
        <Button asChild variant="default" size="sm" className="w-full">
          <Link href={`/thread/${id}`}>
            Pull the thread
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
