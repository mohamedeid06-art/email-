export interface CloudflareAuth {
  token: string;
  authEmail?: string | null;
}

async function cfFetch(url: string, auth: CloudflareAuth, init: RequestInit = {}) {
  const t = auth.token.trim();
  const email = (auth.authEmail || "mhmdsamy112233@gmail.com").trim();
  const isHexGlobalKey = /^[a-f0-9]{32,40}$/i.test(t);

  const tryHeaders: Record<string, string>[] = isHexGlobalKey
    ? [
        { "X-Auth-Email": email, "X-Auth-Key": t, "Content-Type": "application/json" },
        { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      ]
    : [
        { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        { "X-Auth-Email": email, "X-Auth-Key": t, "Content-Type": "application/json" },
      ];

  let lastData: Record<string, unknown> = {};
  let lastRes: Response | null = null;

  for (const headers of tryHeaders) {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string>) || {}) },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { ok: true, data };
    }
    lastRes = res;
    lastData = data;
    if (res.status !== 401 && res.status !== 403 && res.status !== 400) break;
  }

  return { ok: false, status: lastRes?.status || 500, data: lastData };
}

export async function findCloudflareZone(auth: CloudflareAuth, domain = "smsmraw.com"): Promise<{ zoneId: string; accountId: string }> {
  const cleanDomain = domain.replace(/^@/, "").trim();
  const { ok, data } = await cfFetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(cleanDomain)}`, auth);
  const results = (data.result as Array<{ id: string; account: { id: string } }>) || [];
  if (!ok || !results.length) {
    const errs = (data.errors as Array<{ message: string }>) || [];
    throw new Error(errs[0]?.message || `تعذر الوصول لدومين ${cleanDomain} في Cloudflare. تأكد من صحة الـ Global API Key وإيميل حساب Cloudflare.`);
  }
  return {
    zoneId: results[0].id,
    accountId: results[0].account.id,
  };
}

export async function listCloudflareDestinations(auth: CloudflareAuth, accountId: string): Promise<{ email: string; verified: boolean }[]> {
  const { ok, data } = await cfFetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`, auth);
  if (!ok) return [];
  const results = (data.result as Array<Record<string, unknown>>) || [];
  return results.map((item) => ({
    email: String(item.email),
    verified: Boolean(item.verified),
  }));
}

export async function addCloudflareDestination(auth: CloudflareAuth, accountId: string, email: string): Promise<{ email: string; verified: boolean }> {
  const existing = await listCloudflareDestinations(auth, accountId);
  const found = existing.find((e) => e.email.toLowerCase() === email.trim().toLowerCase());
  if (found) return found;

  const { ok, data } = await cfFetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`, auth, {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!ok) {
    const errs = (data.errors as Array<{ message: string }>) || [];
    throw new Error(errs[0]?.message || "تعذر إضافة الإيميل في Cloudflare Destination Addresses.");
  }
  const resObj = (data.result as Record<string, unknown>) || {};
  return {
    email: String(resObj.email || email.trim()),
    verified: Boolean(resObj.verified),
  };
}

export async function getCloudflareCatchAll(auth: CloudflareAuth, zoneId: string): Promise<string | null> {
  const { ok, data } = await cfFetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`, auth);
  if (!ok) return null;
  const resObj = (data.result as { actions?: Array<{ type: string; value?: string[] }> }) || {};
  const forwardAction = resObj.actions?.find((a) => a.type === "forward");
  return forwardAction?.value?.[0] || null;
}

export async function updateCloudflareCatchAll(auth: CloudflareAuth, zoneId: string, destinationEmail: string): Promise<string> {
  const cleanDest = destinationEmail.trim();
  const { ok, data } = await cfFetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`, auth, {
    method: "PUT",
    body: JSON.stringify({
      actions: [{ type: "forward", value: [cleanDest] }],
      enabled: true,
      matchers: [{ type: "all" }],
      name: `Send all @smsmraw.com to ${cleanDest}`,
    }),
  });
  if (!ok) {
    const errs = (data.errors as Array<{ message: string }>) || [];
    throw new Error(errs[0]?.message || "رفض Cloudflare تبديل الإيميل — تأكد من فتح Gmail للإيميل الجديد والضغط على رسالة التفعيل Verify من Cloudflare أولاً!");
  }
  return cleanDest;
}
