import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'تأكيد بريدك — وصلة',
  invite: 'دعوة للانضمام — وصلة',
  magiclink: 'رابط تسجيل الدخول — وصلة',
  recovery: 'إعادة تعيين كلمة المرور — وصلة',
  email_change: 'تأكيد البريد الجديد — وصلة',
  reauthentication: 'رمز التحقق — وصلة',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = Deno.env.get('SITE_NAME') || 'وصلة'
const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') || 'was-la.com'
const ROOT_DOMAIN = Deno.env.get('SITE_DOMAIN') || 'www.was-la.com'
const FROM_DOMAIN = Deno.env.get('EMAIL_FROM_DOMAIN') || 'was-la.com'
const SAMPLE_PROJECT_URL = Deno.env.get('SITE_URL') || `https://${ROOT_DOMAIN}`
const SAMPLE_EMAIL = 'user@example.test'

const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

interface SupabaseAuthEmailPayload {
  user?: { email?: string }
  email_data?: {
    token?: string
    token_hash?: string
    redirect_to?: string
    email_action_type?: string
    site_url?: string
    token_new?: string
    token_hash_new?: string
    old_email?: string
    email?: string
  }
}

function getHookSecret(): string | null {
  return Deno.env.get('AUTH_HOOK_SECRET') || Deno.env.get('SEND_EMAIL_HOOK_SECRET') || null
}

function getWebhookSecretBase64(secret: string): string {
  return secret.replace(/^v1,whsec_/, '')
}

function verifyPreviewSecret(req: Request): boolean {
  const secret = getHookSecret()
  if (!secret) return false
  const auth = req.headers.get('Authorization')
  return auth === `Bearer ${secret}` || auth === secret || auth === `Bearer ${getWebhookSecretBase64(secret)}`
}

type VerifyResult =
  | { ok: true; payload: SupabaseAuthEmailPayload; method: string }
  | { ok: false; response: Response }

function verifyHookPayload(req: Request, rawBody: string): VerifyResult {
  const secret = getHookSecret()
  if (!secret) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const headers = Object.fromEntries(req.headers.entries())
  const auth = req.headers.get('Authorization')

  try {
    const wh = new Webhook(getWebhookSecretBase64(secret))
    const payload = wh.verify(rawBody, headers) as SupabaseAuthEmailPayload
    return { ok: true, payload, method: 'standard-webhooks' }
  } catch {
    // Fall through to bearer / GoTrue workaround.
  }

  if (
    auth === `Bearer ${secret}` ||
    auth === secret ||
    auth === `Bearer ${getWebhookSecretBase64(secret)}`
  ) {
    try {
      return { ok: true, payload: JSON.parse(rawBody), method: 'bearer' }
    } catch {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }),
      }
    }
  }

  const userAgent = req.headers.get('user-agent') || ''
  const allowUnsignedGoTrue = Deno.env.get('AUTH_HOOK_ALLOW_GOTRUE_UNSIGNED') !== 'false'
  if (allowUnsignedGoTrue && userAgent.includes('Go-http-client') && !headers['webhook-signature']) {
    console.warn('Auth hook: accepting unsigned GoTrue request (Supabase send_email hook workaround)')
    try {
      return { ok: true, payload: JSON.parse(rawBody), method: 'gotrue-unsigned' }
    } catch {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }),
      }
    }
  }

  console.error('Auth hook unauthorized', {
    hasAuth: Boolean(auth),
    hasWebhookSignature: Boolean(headers['webhook-signature']),
    userAgent,
  })

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }),
  }
}

function resolveAppBaseUrl(emailData: NonNullable<SupabaseAuthEmailPayload['email_data']>): string {
  const configured = (Deno.env.get('SITE_URL') || SAMPLE_PROJECT_URL).replace(/\/$/, '')
  const fromPayload = String(emailData.site_url || '').replace(/\/$/, '')
  if (fromPayload && !/supabase\.co/i.test(fromPayload)) {
    return fromPayload
  }
  return configured
}

function buildConfirmationUrl(emailData: NonNullable<SupabaseAuthEmailPayload['email_data']>): string {
  const base = resolveAppBaseUrl(emailData)
  const emailType = String(emailData.email_action_type || 'signup')
  const redirectPath = emailType === 'recovery' ? '/reset-password' : '/dashboard'
  const params = new URLSearchParams()
  if (emailData.token_hash) params.set('token_hash', String(emailData.token_hash))
  params.set('type', emailType)
  params.set('redirect_to', `${base}${redirectPath}`)
  return `${base}/auth/confirm?${params.toString()}`
}

async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  if (!verifyPreviewSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function handleWebhook(req: Request): Promise<Response> {
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch (error) {
    console.error('Failed to read webhook body', { error })
    return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const verified = verifyHookPayload(req, rawBody)
  if (!verified.ok) {
    return verified.response
  }

  const { payload, method } = verified
  console.log('Auth hook verified', { method })

  const emailData = payload.email_data
  const recipient = payload.user?.email || emailData?.email
  const emailType = emailData?.email_action_type

  if (!emailType || !recipient) {
    console.error('Webhook payload missing email_action_type or recipient')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('Received auth event', { emailType, email: recipient })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: emailData?.site_url || `https://${ROOT_DOMAIN}`,
    recipient,
    confirmationUrl: buildConfirmationUrl(emailData),
    token: emailData?.token || emailData?.token_new,
    email: recipient,
    oldEmail: emailData?.old_email,
    newEmail: emailData?.email,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const messageId = crypto.randomUUID()

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: recipient })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
