import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save, Shield } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface Permission { key: string; label: string; category: string; }
interface Group { id: string; name: string; description: string | null; }

const PermissionGroups = () => {
  const { isAdmin, loading: ctxLoading } = useUserContext();
  const [perms, setPerms] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Record<string, Set<string>>>({}); // group_id -> Set<perm_key>
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newPerm, setNewPerm] = useState({ key: "", label: "", category: "" });

  const refresh = async () => {
    setLoading(true);
    const [{ data: p }, { data: g }, { data: it }] = await Promise.all([
      supabase.from("permissions").select("*").order("category").order("label"),
      supabase.from("permission_groups").select("*").order("name"),
      supabase.from("permission_group_items").select("group_id, permission_key"),
    ]);
    setPerms(p || []);
    setGroups(g || []);
    const map: Record<string, Set<string>> = {};
    (it || []).forEach((r: any) => {
      if (!map[r.group_id]) map[r.group_id] = new Set();
      map[r.group_id].add(r.permission_key);
    });
    setItems(map);
    setLoading(false);
  };

  useEffect(() => { if (!ctxLoading && isAdmin) refresh(); }, [ctxLoading, isAdmin]);

  const togglePerm = (groupId: string, key: string) => {
    setItems((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupId] || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      next[groupId] = set;
      return next;
    });
  };

  const saveGroup = async (groupId: string) => {
    const keys = Array.from(items[groupId] || []);
    await supabase.from("permission_group_items").delete().eq("group_id", groupId);
    if (keys.length) {
      const { error } = await supabase.from("permission_group_items").insert(
        keys.map((k) => ({ group_id: groupId, permission_key: k }))
      );
      if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
    toast({ title: "تم", description: "تم حفظ الصلاحيات" });
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const { error } = await supabase.from("permission_groups").insert({ name: newGroupName.trim() });
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setNewGroupName("");
    refresh();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("حذف هذه المجموعة؟")) return;
    await supabase.from("permission_groups").delete().eq("id", id);
    refresh();
  };

  const addPermission = async () => {
    if (!newPerm.key || !newPerm.label || !newPerm.category) {
      toast({ title: "خطأ", description: "كل الحقول مطلوبة", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("permissions").insert(newPerm);
    if (error) return toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setNewPerm({ key: "", label: "", category: "" });
    refresh();
  };

  const deletePermission = async (key: string) => {
    if (!confirm(`حذف الصلاحية "${key}"؟`)) return;
    await supabase.from("permissions").delete().eq("key", key);
    refresh();
  };

  if (ctxLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <div className="p-6 text-center text-muted-foreground">للأدمن فقط.</div>;

  // group perms by category
  const byCat: Record<string, Permission[]> = {};
  perms.forEach((p) => { if (!byCat[p.category]) byCat[p.category] = []; byCat[p.category].push(p); });

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader icon={Shield} title="إدارة الصلاحيات والمجموعات" description="عرّف الصلاحيات وأنشئ مجموعات يستخدمها أصحاب المتاجر لمنحها لمستخدميهم الفرعيين" iconGradient="from-indigo-600 to-purple-700" />

      <Card>
        <CardHeader><CardTitle>كتالوج الصلاحيات ({perms.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="المفتاح (e.g. products.add)" value={newPerm.key} onChange={(e) => setNewPerm({ ...newPerm, key: e.target.value })} />
            <Input placeholder="الاسم المعروض" value={newPerm.label} onChange={(e) => setNewPerm({ ...newPerm, label: e.target.value })} />
            <Input placeholder="الفئة (e.g. المنتجات)" value={newPerm.category} onChange={(e) => setNewPerm({ ...newPerm, category: e.target.value })} />
            <Button onClick={addPermission}><Plus className="w-4 h-4 ml-1" /> إضافة</Button>
          </div>
          {Object.keys(byCat).map((cat) => (
            <div key={cat} className="border rounded-lg p-3">
              <div className="font-semibold mb-2">{cat}</div>
              <div className="flex flex-wrap gap-2">
                {byCat[cat].map((p) => (
                  <Badge key={p.key} variant="secondary" className="gap-2 py-1.5">
                    {p.label} <span className="text-xs opacity-60">{p.key}</span>
                    <button onClick={() => deletePermission(p.key)} className="hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مجموعات الصلاحيات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="اسم المجموعة (e.g. مدير محتوى)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            <Button onClick={createGroup}><Plus className="w-4 h-4 ml-1" /> إنشاء</Button>
          </div>

          {groups.map((g) => (
            <Card key={g.id} className="border-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{g.name}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveGroup(g.id)}><Save className="w-4 h-4 ml-1" /> حفظ</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteGroup(g.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(byCat).map((cat) => (
                  <div key={cat}>
                    <Label className="text-sm font-semibold">{cat}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      {byCat[cat].map((p) => (
                        <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox checked={items[g.id]?.has(p.key) || false} onCheckedChange={() => togglePerm(g.id, p.key)} />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PermissionGroups;