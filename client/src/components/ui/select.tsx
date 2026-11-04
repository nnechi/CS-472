import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "cn"

function Select<Value>({ ...props }: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({ className, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/40 bg-white px-3.5 py-2 text-sm font-medium text-brand shadow-sm outline-none transition-colors hover:bg-brand/10 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left data-placeholder:text-brand/60", className)}
      {...props}
    />
  )
}

function SelectIcon({ className, ...props }: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      data-slot="select-icon"
      className={cn("shrink-0 text-brand/60 transition-transform duration-200 data-popup-open:rotate-180", className)}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.Icon>
  )
}

function SelectContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  children,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-72 w-64 max-w-xs overflow-y-auto rounded-xl border border-brand/15 bg-white p-1.5 text-brand shadow-lg outline-none",
            "motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:zoom-in-95",
            "motion-safe:data-[side=bottom]:slide-in-from-top-2 motion-safe:data-[side=top]:slide-in-from-bottom-2",
            "motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0 motion-safe:data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none select-none",
        "data-highlighted:bg-brand/10 data-selected:font-semibold data-selected:text-brand",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex shrink-0 items-center text-brand">
        <Check className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectIcon, SelectContent, SelectItem }
