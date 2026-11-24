export interface CloudflareAuth {
  token: string;
  authEmail?: string | null;
}

// Cache zoneId and accountId per domain so we don't re-query /zones on every action
const zoneCache = new Map<string, { zoneId: string; accountId: string; cachedAt: number }>();

// Cooldown tracker if Cloudflare returns an auth lockout (429 / code 10000 / Too many authentication failures)
let authLockoutUntil = 0;

export function isCloudflareAuthLocked(): boolean {
  return Date.now() < authLockoutUntil;
}

export function clearCloudflareAuthLockout(): void {
  authLockoutUntil = 0;
}

function formatCloudflareError(rawMessage: string | undefined, fallbackArabic: string): string {
  if (!rawMessage) return fallbackArabic;
  const lower = rawMessage.toLowerCase();
  if (lower.includes("too many authentication failures")) {
    authLockoutUntil = Date.now() + 60_000;
    return "⏳ حظر مؤقت من Cloudflare لمدة دقائق بسبب محاولات مفتاح API سابقة غير صحيحة. انتظر 3 إلى 5 دقائق بدون الضغط، ثم افتح (إعدادات Cloudflare) وتأكد من لصق الـ Global API Key الصحيح.";
  }
  if (
    lower.includes("unable to authenticate") ||
    lower.includes("invalid x-auth-key") ||
    lower.includes("invalid api token") ||
    lower.includes("authentication error")
  ) {
    authLockoutUntil = Date.now() + 30_000;
    return "❌ مفتاح Cloudflare أو إيميل الحساب غير صحيح. افتح (إعدادات Cloudflare) وتأكد من نسخ Global API Key (من قسم API Keys -> Global API Key -> View) مع إيميل حسابك في Cloudflare.";
  }
  if (lower.includes("not verified") || lower.includes("destination address")) {
    return "⏳ هذا الإيميل لم يتم تفعيله في Cloudflare بعد! افتح صندوق البريد (Gmail) لهذا الإيميل واضغط على زر Verify email address في رسالة Cloudflare أولاً.";
  }
  return rawMessage;
}

async function cfFetch(url: string, auth: CloudflareAuth, init: RequestInit = {}) {
  const t = auth.token.trim().replace(/^Bearer\s+/i, "").trim();
  const email = (auth.authEmail || "mhmdsamy112233@gmail.com").trim();

  // Global API Key in Cloudflare is always a 32-40 char hexadecimal string.
  // API Tokens contain G-Z, _, or -. Never send the wrong header type, because
  // sending a Global Key as Bearer (or an API Token as X-Auth-Key) counts as a failed auth attempt in Cloudflare!
  const isHexGlobalKey = /^[a-f0-9]{32,40}$/i.test(t);

  const authHeaders: Record<string, string> = isHexGlobalKey
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
        "رفض Cloudflare تبديل الإيميل — تأكد من فتح Gmail للإيميل الجديد والضغط على رسالة التفعيل Verify من Cloudflare أولاً!"
      )
    );
  }
  return cleanDest;
}
