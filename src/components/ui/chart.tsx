"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

const ChartContext = React.createContext<{
  config: ChartConfig
} | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used inside a <ChartContainer />")
  }
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
}: React.ComponentProps<"div"> & {
  config: ChartConfig
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-tooltip-wrapper]:outline-hidden [&_.recharts-label]:fill-foreground [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-text]:fill-foreground [&_.recharts-dot[stroke='#fff']]:stroke-transparent min-h-[12rem] w-full text-xs",
          className
        )}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children as React.ReactElement}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.color
  ) as [string, { color: string; label?: React.ReactNode }][]

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
${colorConfig
  .map(
    ([key, item]) => `[data-chart=${id}] {
  --color-${key}: ${item.color};
}`
  )
  .join("\n")}
`,
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  hideIndicator = false,
  labelFormatter,
  formatter,
  className,
}: React.ComponentProps<"div"> & {
  active?: boolean
  payload?: Array<{
    dataKey?: string
    name?: string
    value?: number | string
    color?: string
    payload?: Record<string, unknown>
  }>
  label?: string | number
  hideLabel?: boolean
  hideIndicator?: boolean
  labelFormatter?: (
    value: string | number,
    payload: Array<{
      dataKey?: string
      name?: string
      value?: number | string
      color?: string
      payload?: Record<string, unknown>
    }>
  ) => React.ReactNode
  formatter?: (
    value: number | string,
    name: string,
    item: {
      dataKey?: string
      name?: string
      value?: number | string
      color?: string
      payload?: Record<string, unknown>
    }
  ) => React.ReactNode
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!hideLabel && label !== undefined && (
        <div className="font-medium">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </div>
      )}
      <div className="grid gap-1">
        {payload.map((item) => {
          const key = (item.dataKey ?? item.name ?? "value") as string
          const itemConfig = config[key]
          const itemLabel = itemConfig?.label ?? item.name ?? key

          return (
            <div key={key} className="flex items-center gap-2">
              {!hideIndicator && (
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color ?? `var(--color-${key})`,
                  }}
                />
              )}
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-muted-foreground">{itemLabel}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {formatter
                    ? formatter(item.value ?? 0, key, item)
                    : (item.value ?? 0)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
