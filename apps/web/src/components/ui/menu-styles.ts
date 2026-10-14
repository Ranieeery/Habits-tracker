// Classes shared by the dropdown menu and the context menu (night tokens),
// so a menu opened from a button and one opened with the right mouse button
// look the same. The item under the pointer or the keyboard is tinted with
// the accent (`surface-raised` is darker than the overlay, so it would not
// show), plus an inner ring when reached by the keyboard. The separator is
// `border-strong` (`border` vanishes on the overlay). Opening: a 150 ms fade
// and zoom, only with motion allowed.
export const MENU_CONTENT_CLASSES =
	"z-50 min-w-48 rounded-xl border border-night-border bg-night-surface-overlay p-1 text-night-foreground shadow-xl shadow-night-bg/70 outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95 motion-safe:data-[state=open]:duration-150";

export const MENU_ITEM_CLASSES =
	"flex min-h-touch cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-night-accent/15 focus-visible:ring-2 focus-visible:ring-night-accent-text focus-visible:ring-inset [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-night-muted";

export const MENU_LABEL_CLASSES =
	"px-3 pt-2 pb-1.5 text-xs font-semibold text-night-muted";

export const MENU_SEPARATOR_CLASSES = "-mx-1 my-1 h-px bg-night-border-strong";
