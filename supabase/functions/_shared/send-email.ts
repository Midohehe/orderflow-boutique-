export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailSendError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status = 500, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "EmailSendError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(Deno.env.get("RESEND_API_KEY") || Deno.env.get("EMAIL_SEND_URL"));
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const retryAfter = res.status === 429
        ? Number(res.headers.get("retry-after") || 60)
        : null;
      throw new EmailSendError(`Resend error ${res.status}: ${body}`, res.status, retryAfter);
    }
    return;
  }

  const sendUrl = Deno.env.get("EMAIL_SEND_URL");
  if (sendUrl) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiKey = Deno.env.get("EMAIL_SEND_API_KEY");
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(sendUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      const body = await res.text();
      const retryAfter = res.status === 429
        ? Number(res.headers.get("retry-after") || 60)
        : null;
      throw new EmailSendError(`Email API error ${res.status}: ${body}`, res.status, retryAfter);
    }
    return;
  }

  throw new EmailSendError(
    "No email provider configured. Set RESEND_API_KEY or EMAIL_SEND_URL.",
    503,
  );
}
