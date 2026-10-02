export function tutorialSource(value: string): { kind: "youtube" | "video"; url: string } {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("استخدم رابط HTTPS صالحًا.");
  const host = url.hostname.toLowerCase();
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("رابط يوتيوب غير صحيح.");
    return { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (!/\.(mp4|webm)$/i.test(url.pathname)) throw new Error("أضف رابط يوتيوب أو رابط فيديو مباشر MP4 أو WebM.");
  return { kind: "video", url: url.href };
}
