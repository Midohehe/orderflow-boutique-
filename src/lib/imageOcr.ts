/** Browser OCR — extracts Arabic/Latin text from order screenshots (lazy-loaded). */

let worker: import("tesseract.js").Worker | null = null;

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (worker) return worker;
  const { createWorker } = await import("tesseract.js");
  worker = await createWorker("ara+eng");
  return worker;
}

/** Run OCR on a data URL or File. */
export async function extractTextFromImage(source: string | File): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(source);
  return (data.text || "").trim();
}
