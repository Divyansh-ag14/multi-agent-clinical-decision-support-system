"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricInfoTooltipProps {
  label: string;
  description: string;
}

export function MetricInfoTooltip({
  label,
  description,
}: MetricInfoTooltipProps) {
  return (
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          aria-label={`About ${label}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-card/78 text-muted-foreground/72 transition-colors duration-200 hover:border-primary/30 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent
          className="max-w-[320px] rounded-[16px] border border-border/70 bg-popover px-4 py-3 text-left text-[13px] leading-6 text-popover-foreground shadow-xl"
          side="top"
          sideOffset={10}
        >
          <div className="font-semibold text-[13px] text-foreground">{label}</div>
          <div className="mt-1 text-[13px] leading-6 text-muted-foreground">
            {description}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
