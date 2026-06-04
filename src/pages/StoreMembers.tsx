import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, KeyRound, Users, Save } from "lucide-react";
import { parsePlanLimitError, planLimitMessage } from "@/lib/planLimits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Permission { key: string; label: string; category: string; }
interface Group { id: string; name: string; }
interface Member { id: string; member_user_id: string; group_id: string | null; display_name: string | null; email: string | null; extra_permissions: string[]; }

const StoreMembers = () => {
  const { isSubUser, loading: ctxLoading } = useUserContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", group_id: "", extra_permissions: new Set<string>() });
  const [editing, setEditing] = useState<Member | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [editGroup, setEditGroup] = useState<string>("");
  const [resetPwd, setResetPwd] = useState<{ id: string; password: string } | null>(null);

  const callApi = async (action: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("store-create-member", { body: { action, ...payload } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [m, { data: p }, { data: g }] = await Promise.all([
        callApi("list"),
        supabase.from("permissions").select("*").order("category").order("label"),
        supabase.from("permission_groups").select("id, name").order("name"),
      ]);
      setMembers(m.members || []);
      setPerms(p || []);
      setGroups(g || []);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (!ctxLoading && !isSubUser) refresh(); else if (!ctxLoading) setLoading(false); }, [ctxLoading, isSubUser]);

  const handleCreate = async () => {
    if (!form.email || !form.password) {
      toast({ title: "خطأ", description: "البريد وكلمة المرور مطلوبة", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await callApi("create", {
        email: form.email,
        password: form.password,
        display_name: form.display_name || null,
        group_id: form.group_id && form.group_id !== "__none__" ? form.group_id : null,
        extra_permissions: Array.from(form.extra_permissions),
      });
      toast({ title: "تم", description: "تم إنشاء المستخدم الفرعي" });
      setForm({ email: "", password: "", display_name: "", group_id: "", extra_permissions: new Set() });
      refresh();
    } catch (e: any) {
      const limit = parsePlanLimitError(e.message || "");
      toast({
        title: limit ? "حد الخطة" : "خطأ",
        description: limit ? planLimitMessage(limit.metric, limit.limit) : e.message,
        variant: "destructive",
      });
    } finally { setCreating(false); }
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    setEditGroup(m.group_id || "");
    setEditPerms(new Set(m.extra_permissions));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await callApi("update", { member_id: editing.id, group_id: editGroup || null, extra_permissions: Array.from(editPerms), display_name: editing.display_name });
      toast({ title: "تم" });
      setEditing(null);
      refresh();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
  };

  const handleReset = async () => {
    if (!resetPwd) return;
    try {
      await callApi("reset_password", { member_id: resetPwd.id, new_password: resetPwd.password });
      toast({ title: "تم", description: "تم تغيير كلمة المرور" });
      setResetPwd(null);
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await callApi("delete", { member_id: id });
      toast({ title: "تم", description: "تم حذف المستخدم" });
      refresh();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
  };

  if (ctxLoading || loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (isSubUser) return <div className="p-6 text-center text-muted-foreground">لا يمكن للمستخدمين الفرعيين الوصول لهذه الصفحة.</div>;

  const byCat: Record<string, Permission[]> = {};
  perms.forEach((p) => { if (!byCat[p.category]) byCat[p.category] = []; byCat[p.category].push(p); });

  const PermPicker = ({ value, onChange }: { value: Set<string>; onChange: (s: Set<string>) => void }) => (
    <div className="space-y-3 max-h-96 overflow-y-auto border rounded-lg p-3">
      {Object.keys(byCat).map((cat) => (
        <div key={cat}>
          <Label className="text-sm font-semibold">{cat}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
            {byCat[cat].map((p) => (
              <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={value.has(p.key)}
                  onCheckedChange={() => {
                    const next = new Set(value);
                    if (next.has(p.key)) next.delete(p.key); else next.add(p.key);
                    onChange(next);
                  }}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader icon={Users} title="المستخدمون الفرعيون" description="أنشئ حسابات إضافية تحت متجرك واختر صلاحياتها" iconGradient="from-emerald-600 to-teal-700" />

      <Card>
        <CardHeader><CardTitle>إضافة مستخدم فرعي</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>كلمة المرور</Label><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>الاسم (اختياري)</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
            <div>
              <Label>المجموعة</Label>
              <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                <SelectTrigger><SelectValue placeholder="بدون مجموعة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون مجموعة</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>صلاحيات إضافية (تضاف للمجموعة)</Label>
            <PermPicker value={form.extra_permissions} onChange={(s) => setForm({ ...form, extra_permissions: s })} />
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 ml-1" /> إنشاء</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المستخدمون ({members.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 && <p className="text-center text-muted-foreground py-6">لا يوجد مستخدمون فرعيون بعد</p>}
          {members.map((m) => {
            const groupName = groups.find((g) => g.id === m.group_id)?.name;
            return (
              <div key={m.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold">{m.display_name || m.email}</div>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                  <div className="flex flex-wrap gap-1">
                    {groupName && <Badge>{groupName}</Badge>}
                    {m.extra_permissions.length > 0 && <Badge variant="secondary">+{m.extra_permissions.length} صلاحية إضافية</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}>تعديل الصلاحيات</Button>
                  <Dialog open={resetPwd?.id === m.id} onOpenChange={(o) => !o && setResetPwd(null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setResetPwd({ id: m.id, password: "" })}><KeyRound className="w-4 h-4 ml-1" /> كلمة المرور</Button>
                    </DialogTrigger>
                    <DialogContent dir="rtl">
                      <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
                      <PasswordInput value={resetPwd?.password || ""} onChange={(e) => setResetPwd((p) => p ? { ...p, password: e.target.value } : null)} placeholder="كلمة مرور جديدة" />
                      <Button onClick={handleReset}>حفظ</Button>
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف المستخدم؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الحساب نهائياً.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(m.id)}>حذف</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>تعديل صلاحيات: {editing?.display_name || editing?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>المجموعة</Label>
              <Select value={editGroup || "__none__"} onValueChange={(v) => setEditGroup(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="بدون مجموعة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون مجموعة</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>صلاحيات إضافية</Label>
              <PermPicker value={editPerms} onChange={setEditPerms} />
            </div>
            <Button onClick={saveEdit} className="w-full"><Save className="w-4 h-4 ml-1" /> حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreMembers;