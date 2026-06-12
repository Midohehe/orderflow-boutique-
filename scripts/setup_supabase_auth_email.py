#!/usr/bin/env python3
"""Configure Supabase auth email hook + edge function secrets from .env."""
from __future__ import annotations

import base64
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
SETUP_ENV_PATH = ROOT / "scripts" / ".setup-creds.tmp"
PROJECT_REF = "sukehkrhvasfnoheyvvx"
HOOK_URL = f"https://{PROJECT_REF}.supabase.co/functions/v1/auth-email-hook"
EMAIL_CRON_SECRET = "WaslaEmailCron2026_M3nP8kQ1vR5w"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def api_request(method: str, url: str, token: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def generate_hook_secret() -> str:
    return "v1,whsec_" + base64.b64encode(secrets.token_bytes(32)).decode("ascii")


def main() -> int:
    env = load_env(SETUP_ENV_PATH)
    if not env:
        env = load_env(ENV_PATH)
    access_token = os.environ.get("SUPABASE_ACCESS_TOKEN") or env.get("SUPABASE_ACCESS_TOKEN")
    resend_key = os.environ.get("RESEND_API_KEY") or env.get("RESEND_API_KEY")
    if not access_token:
        print("ERROR: SUPABASE_ACCESS_TOKEN missing in .env", file=sys.stderr)
        return 1
    if not resend_key:
        print("ERROR: RESEND_API_KEY missing in .env", file=sys.stderr)
        return 1

    auth_url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"
    try:
        current = api_request("GET", auth_url, access_token)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"WARN: failed to read auth config ({exc.code}): {body}", file=sys.stderr)
        current = {}

    hook_secret = current.get("hook_send_email_secrets") or env.get("AUTH_HOOK_SECRET") or generate_hook_secret()
    if not str(hook_secret).startswith("v1,whsec_"):
        hook_secret = generate_hook_secret()

    patch_body = {
        "external_email_enabled": True,
        "hook_send_email_enabled": True,
        "hook_send_email_uri": HOOK_URL,
        "hook_send_email_secrets": hook_secret,
        "rate_limit_email_sent": 100,
        "site_url": "https://www.was-la.com",
    }

    auth_configured = False
    try:
        updated = api_request("PATCH", auth_url, access_token, patch_body)
        auth_configured = True
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(
            f"WARN: Management API auth config update failed ({exc.code}): {body}",
            file=sys.stderr,
        )
        print(
            "WARN: Configure Send Email hook manually in Dashboard if not already enabled.",
            file=sys.stderr,
        )
        updated = {}

    if auth_configured:
        print("Auth hook configured:")
        print(f"  enabled={updated.get('hook_send_email_enabled')}")
        print(f"  uri={updated.get('hook_send_email_uri')}")
        print(f"  rate_limit_email_sent={updated.get('rate_limit_email_sent')}")
    else:
        print("Auth hook: skipped API update (set hook secret in Edge Functions + Dashboard).")
        print(f"  hook_url={HOOK_URL}")

    secrets_cmd = [
        "npx",
        "supabase",
        "secrets",
        "set",
        "--project-ref",
        PROJECT_REF,
        f"AUTH_HOOK_SECRET={hook_secret}",
        f"SEND_EMAIL_HOOK_SECRET={hook_secret}",
        f"RESEND_API_KEY={resend_key}",
        f"EMAIL_CRON_SECRET={EMAIL_CRON_SECRET}",
        "SITE_URL=https://www.was-la.com",
        "SITE_NAME=وصلة",
        "EMAIL_FROM_DOMAIN=was-la.com",
        "AUTH_HOOK_ALLOW_GOTRUE_UNSIGNED=true",
    ]
    proc_env = os.environ.copy()
    proc_env["SUPABASE_ACCESS_TOKEN"] = access_token
    result = subprocess.run(
        secrets_cmd,
        cwd=ROOT,
        env=proc_env,
        capture_output=True,
        text=True,
        shell=os.name == "nt",
    )
    if result.returncode != 0:
        print("ERROR: supabase secrets set failed:", file=sys.stderr)
        print(result.stderr or result.stdout, file=sys.stderr)
        return 1
    print("Edge function secrets updated.")

    try:
        SETUP_ENV_PATH.unlink(missing_ok=True)
    except OSError:
        pass

    for fn, no_jwt in [("auth-email-hook", True), ("process-email-queue", True)]:
        deploy_cmd = ["npx", "supabase", "functions", "deploy", fn, "--project-ref", PROJECT_REF]
        if no_jwt:
            deploy_cmd.append("--no-verify-jwt")
        deploy = subprocess.run(
            deploy_cmd,
            cwd=ROOT,
            env=proc_env,
            capture_output=True,
            text=True,
            shell=os.name == "nt",
        )
        if deploy.returncode != 0:
            print(f"ERROR: deploy {fn} failed:", file=sys.stderr)
            print(deploy.stderr or deploy.stdout, file=sys.stderr)
            return 1
        print(f"Deployed {fn}.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
