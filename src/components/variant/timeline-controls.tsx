"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface TimelineControlsProps {
  years: number[];
  onYearChange?: (year: number) => void;
  onModeChange?: (mode: string) => void;
}

export function TimelineControls({
  years,
  onYearChange,
  onModeChange,
}: TimelineControlsProps) {
  const [currentYearIndex, setCurrentYearIndex] = useState(years.length - 1);
  const [mode, setMode] = useState("now");

  const handleSlider = (value: number[]) => {
    const idx = value[0] ?? 0;
    setCurrentYearIndex(idx);
    onYearChange?.(years[idx] ?? years[years.length - 1]!);
  };

  const handleMode = (value: string) => {
    if (value) {
      setMode(value);
      onModeChange?.(value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground">Time travel</span>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleMode}
          size="sm"
        >
          <ToggleGroupItem value="now">Now</ToggleGroupItem>
          <ToggleGroupItem value="first">First seen</ToggleGroupItem>
          <ToggleGroupItem value="disputed">Most disputed</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {years.length > 1 && (
        <div className="space-y-1">
          <Slider
            min={0}
            max={years.length - 1}
            step={1}
            value={[currentYearIndex]}
            onValueChange={handleSlider}
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{years[0]}</span>
            <span className="font-semibold">
              {years[currentYearIndex]}
            </span>
            <span>{years[years.length - 1]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
