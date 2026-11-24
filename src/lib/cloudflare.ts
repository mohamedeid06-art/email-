export interface CloudflareAuth {
  token: string;
  authEmail?: string | null;
}

const zoneCache = new Map<string, { zoneId: string; accountId: string; cachedAt: number }>();
let authLockoutUntil = 0;

export function isCloudflareAuthLocked(): boolean {
  return Date.now() < authLockoutUntil;
}

export function clearCloudflareAuthLockout(): void {
  authLockoutUntil = 0;
}

export function isCloudflareGlobalApiKey(token: string): boolean {
  const t = token.trim();
  return /^cfk_[A-Za-z0-9_-]{20,80}$/.test(t) || /^[a-f0-9]{32,40}$/i.test(t);
}

export function validateCloudflareKeyFormat(rawKey: string): string | null {
  const t = rawKey.trim().replace(/^Bearer\s+/i, "").trim();
  if (!t) return "يرجى لصق مفتاح Cloudflare Global API Key أولاً.";
  if (t.startsWith("vcp_")) {
    return "⚠️ المفتاح الذي لصقته يبدأ بـ (vcp_) وهو مفتاح منصة Vercel وليس مفتاح Cloudflare.";
  }
  if (t.startsWith("v1.0-")) {
    return "⚠️ المفتاح الذي لصقته يبدأ بـ (v1.0-) وهو مفتاح (Origin CA Key) وليس (Global API Key).";
  }
  return null;
}

function formatCloudflareError(rawMessage: string | undefined, rawToken: string, fallbackArabic: string): string {
  const formatWarning = validateCloudflareKeyFormat(rawToken);
  if (formatWarning) return formatWarning;

  if (!rawMessage) return fallbackArabic;
  const lower = rawMessage.toLowerCase();
  if (lower.includes("too many authentication failures")) {
    authLockoutUntil = Date.now() + 60_000;
    return "⏳ حظر مؤقت من Cloudflare لمدة دقائق بسبب محاولات سابقة. انتظر 3 دقائق ثم اضغط حفظ مرة أخرى.";
  }
  if (
    lower.includes("unable to authenticate") ||
    lower.includes("invalid x-auth-key") ||
    lower.includes("invalid api token") ||
    lower.includes("invalid access token") ||
    lower.includes("authentication error") ||
    lower.includes("invalid format for x-auth-key")
  ) {
    authLockoutUntil = Date.now() + 30_000;
    return "❌ مفتاح Cloudflare أو إيميل الحساب غير مطابقين. تأكد من كتابة نفس الإيميل المسجل به في Cloudflare ولصق الـ Global API Key الصحيح.";
  }
  if (lower.includes("not verified") || lower.includes("destination address")) {
    return "⏳ هذا الإيميل لم يتم تفعيله في Cloudflare بعد! افتح صندوق البريد (Gmail) لهذا الإيميل واضغط على زر Verify email address في رسالة Cloudflare أولاً.";
  }
  return rawMessage;
}

async function cfFetch(url: string, auth: CloudflareAuth, init: RequestInit = {}) {
  const t = auth.token.trim().replace(/^Bearer\s+/i, "").trim();
  const email = (auth.authEmail || "mhmdsamy112233@gmail.com").trim();

  const preCheckError = validateCloudflareKeyFormat(t);
  if (preCheckError) {
    return { ok: false, status: 400, data: {}, errorMessage: preCheckError };
  }

  // Cloudflare Global API Keys either start with `cfk_` (modern format) or are 37-char hex strings (legacy format).
  // Both MUST be authenticated using X-Auth-Email + X-Auth-Key headers!
  const useGlobalKeyHeader = isCloudflareGlobalApiKey(t);

  const authHeaders: Record<string, string> = useGlobalKeyHeader
    ? { "X-Auth-Email": email, "X-Auth-Key": t, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };

  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...((init.headers as Record<string, string>) || {}) },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok && data.success) {
    authLockoutUntil = 0;
    return { ok: true, status: res.status, data };
  }

  const errs = (data.errors as Array<{ message?: string; code?: number }>) || [];
  const firstMsg = errs[0]?.message || "";
  if (
    res.status === 401 ||
    res.status === 429 ||
    firstMsg.toLowerCase().includes("too many authentication failures") ||
    firstMsg.toLowerCase().includes("unable to authenticate")
  ) {
    authLockoutUntil = Date.now() + 60_000;
  }

  return { ok: false, status: res.status, data, errorMessage: firstMsg };
}

export async function findCloudflareZone(
  auth: CloudflareAuth,
  domain = "smsmraw.com"
): Promise<{ zoneId: string; accountId: string }> {
  const cleanDomain = domain.replace(/^@/, "").trim().toLowerCase();
  const preCheckError = validateCloudflareKeyFormat(auth.token);
  if (preCheckError) {
    throw new Error(preCheckError);
  }

  const cached = zoneCache.get(cleanDomain);
  if (cached && Date.now() - cached.cachedAt < 1000 * 60 * 30) {
    return { zoneId: cached.zoneId, accountId: cached.accountId };
  }

  const { ok, data, errorMessage } = await cfFetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(cleanDomain)}`,
    auth
  );
  const results = (data.result as Array<{ id: string; account: { id: string } }>) || [];
  if (!ok || !results.length) {
    throw new Error(
      formatCloudflareError(
        errorMessage,
        auth.token,
        `تعذر الوصول لدومين ${cleanDomain} في Cloudflare. تأكد من صحة الـ Global API Key وإيميل حساب Cloudflare.`
      )
    );
  }
  const entry = {
    zoneId: results[0].id,
    accountId: results[0].account.id,
    cachedAt: Date.now(),
  };
  zoneCache.set(cleanDomain, entry);
  return { zoneId: entry.zoneId, accountId: entry.accountId };
}

export async function listCloudflareDestinations(
  auth: CloudflareAuth,
  accountId: string
): Promise<{ email: string; verified: boolean }[]> {
  const { ok, data } = await cfFetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`,
    auth
  );
  if (!ok) return [];
  const results = (data.result as Array<Record<string, unknown>>) || [];
  return results.map((item) => ({
    email: String(item.email),
    verified: Boolean(item.verified),
  }));
}

export async function addCloudflareDestination(
  auth: CloudflareAuth,
  accountId: string,
  email: string
): Promise<{ email: string; verified: boolean }> {
  const existing = await listCloudflareDestinations(auth, accountId);
  const found = existing.find((e) => e.email.toLowerCase() === email.trim().toLowerCase());
  if (found) return found;

  const { ok, data, errorMessage } = await cfFetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`,
    auth,
    {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    }
  );
  if (!ok) {
    throw new Error(
      formatCloudflareError(
        errorMessage,
        auth.token,
        "تعذر إضافة الإيميل في Cloudflare Destination Addresses."
      )
    );
  }
  const resObj = (data.result as Record<string, unknown>) || {};
  return {
    email: String(resObj.email || email.trim()),
    verified: Boolean(resObj.verified),
  };
}

export async function getCloudflareCatchAll(
  auth: CloudflareAuth,
  zoneId: string
): Promise<string | null> {
  const { ok, data } = await cfFetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`,
    auth
  );
  if (!ok) return null;
  const resObj = (data.result as { actions?: Array<{ type: string; value?: string[] }> }) || {};
  const forwardAction = resObj.actions?.find((a) => a.type === "forward");
  return forwardAction?.value?.[0] || null;
}

export async function updateCloudflareCatchAll(
  auth: CloudflareAuth,
  zoneId: string,
  destinationEmail: string
): Promise<string> {
  const cleanDest = destinationEmail.trim();
  const { ok, errorMessage } = await cfFetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`,
    auth,
    {
      method: "PUT",
      body: JSON.stringify({
        actions: [{ type: "forward", value: [cleanDest] }],
        enabled: true,
        matchers: [{ type: "all" }],
        name: `Send all @smsmraw.com to ${cleanDest}`,
      }),
    }
  );
  if (!ok) {
    throw new Error(
      formatCloudflareError(
        errorMessage,
        auth.token,
        "رفض Cloudflare تبديل الإيميل — تأكد من فتح Gmail للإيميل الجديد والضغط على رسالة التفعيل Verify من Cloudflare أولاً!"
      )
    );
  }
  return cleanDest;
}
