import { Render } from "@measured/puck";
import { useMemo } from "react";
import { buildPuckConfig, type PuckContext } from "@/lib/puck/config";

export const PuckRender = ({ data, ctx }: { data: any; ctx: PuckContext }) => {
  const config = useMemo(() => buildPuckConfig(ctx), [ctx]);
  if (!data) return null;
  return <Render config={config as any} data={data} />;
};