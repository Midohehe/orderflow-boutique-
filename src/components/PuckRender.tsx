import { Render } from "@measured/puck";
import { useMemo } from "react";
import { buildPuckConfig, type PuckContext } from "@/lib/puck/config";
import { LandingSlotsProvider, type LandingSlots } from "@/components/landing/LandingSlots";

export const PuckRender = ({
  data,
  ctx,
  slots,
}: {
  data: any;
  ctx: PuckContext;
  slots?: LandingSlots;
}) => {
  const config = useMemo(() => buildPuckConfig(ctx), [ctx]);
  if (!data) return null;
  const rendered = <Render config={config as any} data={data} />;
  if (slots) return <LandingSlotsProvider value={slots}>{rendered}</LandingSlotsProvider>;
  return rendered;
};