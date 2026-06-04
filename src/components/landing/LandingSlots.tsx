import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

export type LandingSlotName =
  | "hero"
  | "productImages"
  | "orderForm"
  | "productDescription"
  | "productReviews"
  | "productFaq";

export type LandingSlots = Partial<Record<LandingSlotName, ReactNode>>;

type LandingSlotsContextValue = {
  getSlot: (name: LandingSlotName) => ReactNode | null;
};

const LandingSlotsContext = createContext<LandingSlotsContextValue | null>(null);

export const LandingSlotsProvider = ({
  value,
  children,
}: {
  value: LandingSlots;
  children: ReactNode;
}) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const ctx = useMemo(
    () => ({
      getSlot: (name: LandingSlotName) => valueRef.current[name] ?? null,
    }),
    []
  );
  return (
    <LandingSlotsContext.Provider value={ctx}>{children}</LandingSlotsContext.Provider>
  );
};

export const useLandingSlot = (name: LandingSlotName): ReactNode | null => {
  const ctx = useContext(LandingSlotsContext);
  return ctx?.getSlot(name) ?? null;
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