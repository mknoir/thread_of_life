import {
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  ShieldQuestion,
  Info,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ConfidenceLevel } from "@/lib/types/claim";

interface EpistemicAlertProps {
  title: string;
  description: string;
  confidenceLevel: ConfidenceLevel;
  /** 0-100 uncertainty index: 0 = very certain, 100 = very uncertain */
  uncertaintyIndex?: number;
}

const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  {
    icon: React.ElementType;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
    label: string;
  }
> = {
  high: { icon: Info, badgeVariant: "default", label: "High confidence" },
  moderate: {
    icon: ShieldAlert,
    badgeVariant: "secondary",
    label: "Moderate confidence",
  },
  low: {
    icon: ShieldQuestion,
    badgeVariant: "outline",
    label: "Low confidence",
  },
  contested: {
    icon: AlertTriangle,
    badgeVariant: "destructive",
    label: "Contested",
  },
  insufficient: {
    icon: HelpCircle,
    badgeVariant: "outline",
    label: "Insufficient evidence",
  },
};

export function EpistemicAlert({
  title,
  description,
  confidenceLevel,
  uncertaintyIndex,
}: EpistemicAlertProps) {
  const config = CONFIDENCE_CONFIG[confidenceLevel];
  const Icon = config.icon;

  return (
    <Alert>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {title}
        <Badge variant={config.badgeVariant} className="text-[10px]">
          {config.label}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-1 space-y-2">
        <p className="text-sm">{description}</p>
        {uncertaintyIndex !== undefined && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Uncertainty</span>
            <Progress value={uncertaintyIndex} className="h-1.5 flex-1" />
            <span className="font-mono text-xs text-muted-foreground">
              {uncertaintyIndex}%
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
