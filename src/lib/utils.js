import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// rounded-control (tailwind.config.js) is a radius step, so a component's
// own rounded-md gives way to it: without this both classes stayed on the
// shared Button, and .rounded-md, later in the stylesheet, won.
const twMerge = extendTailwindMerge({ extend: { theme: { radius: ['control'] } } })

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;
