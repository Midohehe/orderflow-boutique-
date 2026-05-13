import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Send, Settings as SettingsIcon, MessageCircle, Check, CheckCheck, Clock, Search, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

type Conversation = {
  id: string;
  phone: string;
  customer_name: string | null;
  order_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_mime: string | null;
  status: string;
  created_at: string;
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "read") return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (status === "delivered") return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "sent") return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
  if (status === "failed") return <span className="text-[10px] text-destructive">فشل</span>;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
};

export default function WhatsAppPage() {
  const { profile } = useUserContext();
  const ownerId = profile?.user_id;
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  useEffect(() => {
    if (!ownerId) return;
    loadConversations();
    loadSettings();

    const ch = supabase
      .channel("wa-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `owner_id=eq.${ownerId}` }, () => loadConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `owner_id=eq.${ownerId}` }, (payload) => {
        const m = (payload.new || payload.old) as Message;
        if (m && activeIdRef.current && m.conversation_id === activeIdRef.current) {
          loadMessages(activeIdRef.current);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ownerId]);

  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      // mark read
      supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", activeId).then(() => {});
    }
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    setConversations((data as any) || []);
  }
  async function loadMessages(convId: string) {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((data as any) || []);
  }
  async function loadSettings() {
    const { data } = await supabase.from("whatsapp_settings").select("*").maybeSingle();
    if (data) setSettings(data);
    else {
      // create default row
      const { data: created } = await supabase.from("whatsapp_settings").insert({ owner_id: ownerId! }).select("*").single();
      setSettings(created);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    const { error } = await supabase.from("whatsapp_settings").update({
      enabled: settings.enabled,
      instance_id: settings.instance_id,
      api_token: settings.api_token,
      api_url: settings.api_url,
      auto_confirm_enabled: settings.auto_confirm_enabled,
      confirm_template: settings.confirm_template,
      welcome_template: settings.welcome_template,
    }).eq("id", settings.id);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم الحفظ" }); setSettingsOpen(false); }
  }

  async function sendMessage() {
    if (!input.trim() || !active) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          phone: active.phone,
          text: input.trim(),
          order_id: active.order_id,
          customer_name: active.customer_name,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setInput("");
      loadMessages(active.id);
    } catch (e: any) {
      toast({ title: "فشل الإرسال", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  const filtered = conversations.filter((c) =>
    !search || c.phone.includes(search) || (c.customer_name || "").includes(search) || (c.last_message_preview || "").includes(search)
  );

  const webhookUrl = settings?.webhook_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook?token=${settings.webhook_token}`
    : "";

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6" /> WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">إدارة المحادثات وتأكيد الطلبات تلقائياً</p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><SettingsIcon className="w-4 h-4 ml-2" /> الإعدادات</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إعدادات WhatsApp (Green API)</DialogTitle></DialogHeader>
            {settings && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="wa-enabled">تفعيل WhatsApp</Label>
                  <Switch id="wa-enabled" checked={!!settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
                </div>
                <div>
                  <Label>Instance ID</Label>
                  <Input value={settings.instance_id || ""} onChange={(e) => setSettings({ ...settings, instance_id: e.target.value })} placeholder="1101xxxxxx" />
                </div>
                <div>
                  <Label>API Token</Label>
                  <Input type="password" value={settings.api_token || ""} onChange={(e) => setSettings({ ...settings, api_token: e.target.value })} />
                </div>
                <div>
                  <Label>API URL</Label>
                  <Input value={settings.api_url || ""} onChange={(e) => setSettings({ ...settings, api_url: e.target.value })} />
                </div>
                <div className="p-3 bg-muted/40 rounded-md space-y-2">
                  <Label className="text-sm">Webhook URL (انسخه إلى لوحة Green API):</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: "تم النسخ" }); }}>
                      <Link2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">في Green API: Settings → Notifications → فعّل incomingMessageReceived و outgoingMessageStatus</p>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="wa-auto">تأكيد تلقائي للطلبات</Label>
                  <Switch id="wa-auto" checked={!!settings.auto_confirm_enabled} onCheckedChange={(v) => setSettings({ ...settings, auto_confirm_enabled: v })} />
                </div>
                <div>
                  <Label>قالب رسالة التأكيد</Label>
                  <Textarea rows={8} value={settings.confirm_template || ""} onChange={(e) => setSettings({ ...settings, confirm_template: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">المتغيرات: {`{customer_name} {order_id} {products} {total} {currency}`}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={saveSettings}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100dvh-220px)] min-h-[500px] overflow-hidden">
        {/* Conversations list */}
        <div className="border-l flex flex-col min-h-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات بعد</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-right p-3 border-b hover:bg-muted/50 transition ${activeId === c.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{c.customer_name || c.phone}</div>
                  {c.unread_count > 0 && <Badge className="bg-green-600 hover:bg-green-600">{c.unread_count}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-1">{c.last_message_preview || "—"}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleString("ar")}</span>
                  {c.order_id && <span className="text-[10px] text-primary">طلب مرتبط</span>}
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex flex-col min-h-0">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              اختر محادثة للبدء
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <div className="font-medium">{active.customer_name || active.phone}</div>
                  <div className="text-xs text-muted-foreground">{active.phone}</div>
                </div>
                {active.order_id && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/orders?open=${active.order_id}`)}>
                    فتح الطلب
                  </Button>
                )}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--muted)/0.4),transparent)]">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "out" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] rounded-lg p-2 px-3 shadow-sm ${m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                      {m.media_url && m.message_type === "image" && (
                        <img src={m.media_url} alt="" className="rounded mb-1 max-h-64" />
                      )}
                      {m.media_url && m.message_type === "audio" && (
                        <audio controls src={m.media_url} className="mb-1" />
                      )}
                      {m.media_url && (m.message_type === "file" || m.message_type === "video") && (
                        <a href={m.media_url} target="_blank" rel="noopener" className="underline block mb-1">📎 تحميل الملف</a>
                      )}
                      {m.content && <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>}
                      <div className="flex items-center gap-1 justify-end mt-1 opacity-80">
                        <span className="text-[10px]">{new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.direction === "out" && <StatusIcon status={m.status} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="اكتب رسالة..."
                  rows={1}
                  className="resize-none min-h-10"
                />
                <Button onClick={sendMessage} disabled={sending || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}