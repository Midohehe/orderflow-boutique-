import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Link2, EyeOff, Eye } from "lucide-react";
import type { FlowEdge, FlowNode, OfferRecord } from "@/lib/offers/types";

const NODE_COLORS: Record<FlowNode["type"], string> = {
  landing: "bg-sky-500",
  checkout: "bg-indigo-500",
  offer: "bg-emerald-500",
  accept: "bg-teal-500",
  decline: "bg-rose-500",
  thank_you: "bg-violet-500",
  downsell: "bg-amber-500",
};

export function OfferFlowCanvas({
  nodes,
  edges,
  offers,
  onChange,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  offers: OfferRecord[];
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selected) || null,
    [nodes, selected],
  );

  const addNode = (type: FlowNode["type"]) => {
    const id = `n_${Date.now()}`;
    const labels: Record<FlowNode["type"], string> = {
      landing: "صفحة الهبوط",
      checkout: "الدفع",
      offer: "عرض",
      accept: "قبل العرض",
      decline: "رفض العرض",
      thank_you: "صفحة الشكر",
      downsell: "Downsell",
    };
    onChange(
      [
        ...nodes,
        {
          id,
          type,
          label: labels[type],
          x: 40 + (nodes.length % 4) * 180,
          y: 40 + Math.floor(nodes.length / 4) * 110,
          offerId: type === "offer" ? offers[0]?.id || null : null,
        },
      ],
      edges,
    );
    setSelected(id);
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    onChange(
      nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      edges,
    );
  };

  const removeNode = (id: string) => {
    onChange(
      nodes.filter((n) => n.id !== id),
      edges.filter((e) => e.from !== id && e.to !== id),
    );
    if (selected === id) setSelected(null);
  };

  const connect = (toId: string) => {
    if (!linkFrom || linkFrom === toId) {
      setLinkFrom(null);
      return;
    }
    const id = `e_${linkFrom}_${toId}`;
    if (edges.some((e) => e.id === id)) {
      setLinkFrom(null);
      return;
    }
    onChange(nodes, [...edges, { id, from: linkFrom, to: toId, label: "" }]);
    setLinkFrom(null);
  };

  const onDrag = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const ox = node.x;
    const oy = node.y;

    const move = (ev: MouseEvent) => {
      updateNode(id, {
        x: Math.max(0, ox + ev.clientX - startX),
        y: Math.max(0, oy + ev.clientY - startY),
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["landing", "هبوط"],
            ["checkout", "دفع"],
            ["offer", "عرض"],
            ["accept", "قبول"],
            ["decline", "رفض"],
            ["downsell", "Downsell"],
            ["thank_you", "شكر"],
          ] as const
        ).map(([type, label]) => (
          <Button key={type} type="button" size="sm" variant="outline" onClick={() => addNode(type)}>
            <Plus className="w-3.5 h-3.5 ml-1" />
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={linkFrom ? "default" : "outline"}
          onClick={() => setLinkFrom(selected)}
          disabled={!selected}
        >
          <Link2 className="w-3.5 h-3.5 ml-1" />
          {linkFrom ? "اختر الوجهة…" : "ربط"}
        </Button>
      </div>

      <div className="relative h-[420px] rounded-xl border bg-muted/30 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((e) => {
            const a = nodes.find((n) => n.id === e.from);
            const b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const x1 = a.x + 70;
            const y1 = a.y + 28;
            const x2 = b.x + 70;
            const y2 = b.y + 28;
            return (
              <g key={e.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />
              </g>
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
            </marker>
          </defs>
        </svg>

        {nodes.map((n) => (
          <div
            key={n.id}
            onMouseDown={(e) => onDrag(n.id, e)}
            onClick={() => {
              if (linkFrom) connect(n.id);
              else setSelected(n.id);
            }}
            className={`absolute w-[140px] cursor-grab active:cursor-grabbing rounded-xl text-white shadow-lg border-2 select-none ${
              NODE_COLORS[n.type]
            } ${selected === n.id ? "border-white ring-2 ring-primary" : "border-transparent"} ${
              n.disabled ? "opacity-40" : ""
            }`}
            style={{ left: n.x, top: n.y }}
          >
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase opacity-80">{n.type}</div>
              <div className="text-sm font-bold truncate">{n.label}</div>
            </div>
          </div>
        ))}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            أضف عقداً لبناء رحلة الزبون
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="rounded-xl border p-3 space-y-2 bg-card">
          <div className="flex items-center justify-between gap-2">
            <Badge>{selectedNode.type}</Badge>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => updateNode(selectedNode.id, { disabled: !selectedNode.disabled })}
              >
                {selectedNode.disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeNode(selectedNode.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Input
            value={selectedNode.label}
            onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
            placeholder="اسم العقدة"
          />
          {selectedNode.type === "offer" && (
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={selectedNode.offerId || ""}
              onChange={(e) => updateNode(selectedNode.id, { offerId: e.target.value || null })}
            >
              <option value="">— اختر عرضاً —</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
