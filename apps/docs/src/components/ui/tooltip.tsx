import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"
import { useCallback, useSyncExternalStore, type ReactElement, type ReactNode } from "react"

/*
 * One delay group for the whole site. Base UI's Provider groups the tooltips
 * under it, but every Astro island is its own React root, so a Provider can't
 * reach from the header into a demo. This module is shared by all islands
 * instead: hovering a trigger waits DELAY ms, and while any tooltip is open,
 * or for TIMEOUT ms after the last one closed, the next opens at once.
 */
const DELAY = 500
const TIMEOUT = 400

let openCount = 0
let warm = false
let cooling: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function setWarm(next: boolean) {
  if (warm === next) return
  warm = next
  for (const listener of listeners) listener()
}

function opened() {
  openCount += 1
  clearTimeout(cooling)
  setWarm(true)
}

function closed() {
  openCount = Math.max(0, openCount - 1)
  if (openCount > 0) return
  clearTimeout(cooling)
  cooling = setTimeout(() => setWarm(false), TIMEOUT)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const useWarm = () =>
  useSyncExternalStore(
    subscribe,
    () => warm,
    () => false
  )

/** Base UI's Provider, for a group narrower than the site's. Most code needs none. */
interface TooltipProviderProps extends TooltipPrimitive.Provider.Props {}

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

interface TooltipProps extends TooltipPrimitive.Root.Props {}

function Tooltip({ onOpenChange, ...props }: TooltipProps) {
  const report = useCallback<NonNullable<TooltipProps["onOpenChange"]>>(
    (open, details) => {
      if (open) opened()
      else closed()
      onOpenChange?.(open, details)
    },
    [onOpenChange]
  )
  return <TooltipPrimitive.Root data-slot="tooltip" onOpenChange={report} {...props} />
}

interface TooltipTriggerProps extends TooltipPrimitive.Trigger.Props {}

function TooltipTrigger({ delay, ...props }: TooltipTriggerProps) {
  const instant = useWarm()
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      delay={delay ?? (instant ? 0 : DELAY)}
      {...props}
    />
  )
}

interface TooltipContentProps
  extends TooltipPrimitive.Popup.Props,
    Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> {}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-devtools px-3 py-1.5 text-xs text-devtools-foreground dark:ring-1 dark:ring-devtools-border has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-instant:animate-none",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-devtools fill-devtools data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/**
 * The tooltip for an icon-only control: `children` is the trigger element and
 * `label` its tooltip. The label is also the accessible name unless the
 * trigger sets its own `aria-label`.
 *
 *   <Hint label="GitHub"><a href={url}><GitHubIcon /></a></Hint>
 */
interface HintProps extends Pick<TooltipProps, "open" | "onOpenChange"> {
  /** The tooltip, and the accessible name when it is a string. */
  label: ReactNode
  /** The trigger element. */
  children: ReactElement<Record<string, unknown>>
  side?: TooltipContentProps["side"]
}

function Hint({ label, children, side = "bottom", open, onOpenChange }: HintProps) {
  const named = typeof label === "string" && children.props["aria-label"] === undefined
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger {...(named ? { "aria-label": label } : {})} render={children} />
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export { Hint, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export type { HintProps, TooltipProps, TooltipTriggerProps, TooltipContentProps, TooltipProviderProps }
