import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type LandingSlotName =
  | "hero"
  | "productImages"
  | "orderForm"
  | "productDescription"
  | "productReviews"
  | "productFaq";

export type LandingSlots = Partial<Record<LandingSlotName, ReactNode>>;

const LandingSlotsContext = createContext<LandingSlots | null>(null);

export const LandingSlotsProvider = ({
  value,
  children,
}: {
  value: LandingSlots;
  children: ReactNode;
}) => (
  <LandingSlotsContext.Provider value={value}>{children}</LandingSlotsContext.Provider>
);

export const useLandingSlot = (name: LandingSlotName): ReactNode | null => {
  const ctx = useContext(LandingSlotsContext);
  return (ctx && ctx[name]) || null;
};

/**
 * DOM-portal-based slot. The legacy LandingPage renders its sections normally,
 * but wraps each one in `<div data-landing-slot="X" hidden>...</div>`. When a
 * Puck block calls `<PortalSlot name="X" />` it grabs that hidden node by id
 * (registered via a tiny global registry) and re-renders it in place via a
 * portal. This avoids a massive JSX refactor of the landing page.
 */
const slotRegistry: Map<string, HTMLElement> = new Map();
const listeners: Set<() => void> = new Set();

export const registerSlotNode = (name: LandingSlotName, node: HTMLElement | null) => {
  if (node) slotRegistry.set(name, node);
  else slotRegistry.delete(name);
  listeners.forEach((l) => l());
};

export const PortalSlot = ({ name }: { name: LandingSlotName }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const node = slotRegistry.get(name);
  if (!node) return null;
  // Reveal the source node so children render, then portal them.
  if (node.hasAttribute("hidden")) node.removeAttribute("hidden");
  return createPortal(<div ref={(el) => {
    if (el && node && el !== node.parentElement) {
      // Move the original DOM children into our portal container.
      while (node.firstChild) el.appendChild(node.firstChild);
    }
  }} />, document.body) as any;
};

/** Placeholder shown in the Puck editor when no real slot is provided. */
export const SlotPlaceholder = ({ label, height = 200 }: { label: string; height?: number }) => (
  <div
    className="border-2 border-dashed border-amber-400/60 bg-amber-50/40 rounded-2xl flex items-center justify-center text-amber-700 font-bold text-sm text-center p-4"
    style={{ minHeight: height }}
    dir="rtl"
  >
    {label}
    <div className="text-xs text-amber-600/70 mt-1 font-normal">
      (سيظهر المحتوى الفعلي للمنتج هنا في الصفحة)
    </div>
  </div>
);