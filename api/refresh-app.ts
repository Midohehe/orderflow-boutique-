export const config = { runtime: "edge" };

export default function handler() {
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تحديث وصلة</title><style>body{font-family:system-ui;background:#10151e;color:#fff;display:grid;place-items:center;min-height:90vh;margin:0;padding:20px}main{max-width:500px;text-align:center}button{background:#f59e0b;border:0;border-radius:10px;padding:14px 25px;font-size:18px;cursor:pointer}p{line-height:1.9;color:#cbd5e1}</style><main><h1>تحديث نسخة وصلة</h1><p>إذا ظهرت صفحة قديمة أو رسالة 404، حدّث ملفات الواجهة المخزنة في هذا المتصفح. تبقى بياناتك وتسجيل دخولك محفوظة.</p><button id="refresh">تحديث وفتح بوابة المندوب</button><p id="status" role="status"></p></main><script>
  document.getElementById('refresh').onclick=async function(){
    this.disabled=true;document.getElementById('status').textContent='جاري تحديث ملفات الواجهة...';
    try {
      if('serviceWorker' in navigator){const registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.filter(r=>new URL(r.scope).origin===location.origin).map(r=>r.unregister()));}
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k==='html'||k.startsWith('workbox-precache')).map(k=>caches.delete(k)));}
      location.replace('/courier');
    }catch{this.disabled=false;document.getElementById('status').textContent='تعذّر التحديث. أعد المحاولة.';}
  };
  </script></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
