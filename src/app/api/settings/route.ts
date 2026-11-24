import { NextRequest, NextResponse } from "next/server";
import {
  addCloudflareDestination,
  clearCloudflareAuthLockout,
  findCloudflareZone,
  getCloudflareCatchAll,
  isCloudflareAuthLocked,
  listCloudflareDestinations,
  updateCloudflareCatchAll,
} from "@/lib/cloudflare";
import { encryptApiKey, maskApiKey } from "@/lib/crypto";
import {
  dbQuery,
  DEFAULT_SANDBOX_SUFFIXES,
  getDashboardStats,
  mapBatchRow,
} from "@/lib/db";
import {
  getServerProviderSettings,
  serializeVaultCookie,
  VAULT_COOKIE_NAME,
} from "@/lib/settings";

let lastCfSyncAt = 0;

export async function GET(req: NextRequest) {
  try {
    const forceSync = req.nextUrl.searchParams.get("sync") === "1";
    const [
      { clientSettings, cloudflareKey, cloudflareEmail },
      stats,
      batchesRes,
    ] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
      dbQuery<Record<string, unknown>>(
        "SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT 8"
      ),
    ]);

    const shouldQueryCf =
      Boolean(cloudflareKey) &&
      (forceSync ||
        (!isCloudflareAuthLocked() && Date.now() - lastCfSyncAt > 45_000));

    if (cloudflareKey && shouldQueryCf) {
      try {
        lastCfSyncAt = Date.now();
        const { zoneId, accountId } = await findCloudflareZone(
          { token: cloudflareKey, authEmail: cloudflareEmail },
          "smsmraw.com"
        );
        const [liveCatchAll, cfDests] = await Promise.all([
          getCloudflareCatchAll(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            zoneId
          ),
          listCloudflareDestinations(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            accountId
          ),
        ]);
        clientSettings.cloudflareConnected = true;
        if (liveCatchAll) {
          clientSettings.cloudflareLiveCatchAll = liveCatchAll;
          clientSettings.primaryEmail = liveCatchAll;
        }
        if (cfDests.length > 0) {
          const merged = [...clientSettings.availableMailboxes];
          for (const d of cfDests) {
            const ex = merged.find(
              (m) => m.email.toLowerCase() === d.email.toLowerCase()
            );
            if (ex) {
              ex.verified = d.verified;
            } else {
              merged.push({
                id: merged.length + 10421,
                email: d.email,
                default: d.email === liveCatchAll,
                verified: d.verified,
              });
            }
          }
          clientSettings.availableMailboxes = merged;
        }
      } catch (err) {
        clientSettings.cloudflareConnected = false;
        clientSettings.cloudflareError =
          err instanceof Error ? err.message : "Cloudflare connection error";
      }
    }

    return NextResponse.json({
      settings: clientSettings,
      stats,
      recentBatches: batchesRes.rows.map(mapBatchRow),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load settings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apiKey,
      clearApiKey,
      cloudflareKey,
      cloudflareAuthEmail,
      clearCloudflareKey,
      apiBaseUrl,
      mode,
      primaryEmail,
      addReceiverEmail,
      removeReceiverEmail,
      switchActiveReceiver,
      updateExistingAliasesToReceiver,
      defaultSuffix,
    } = body;

    const current = await getServerProviderSettings();
    const resolvedBaseUrl =
      apiBaseUrl?.trim().replace(/\/+$/, "") ||
      current.clientSettings.apiBaseUrl;
    let resolvedMode: "live" | "sandbox" = mode || current.clientSettings.mode;
    let resolvedPrimaryEmail =
      switchActiveReceiver?.trim() ||
      (primaryEmail !== undefined
        ? primaryEmail.trim()
        : current.clientSettings.primaryEmail);

    let activeApiKey = current.apiKey;
    if (clearApiKey) {
      await dbQuery(
        "UPDATE provider_settings SET encrypted_api_key = NULL, api_key_preview = NULL, mode = 'sandbox', updated_at = NOW() WHERE id = 1"
      );
      activeApiKey = null;
      resolvedMode = "sandbox";
    } else if (apiKey && apiKey.trim()) {
      const t = apiKey.trim();
      await dbQuery(
        "UPDATE provider_settings SET encrypted_api_key = $1, api_key_preview = $2, updated_at = NOW() WHERE id = 1",
        [encryptApiKey(t), maskApiKey(t)]
      );
      activeApiKey = t;
    }

    let activeCfKey = current.cloudflareKey;
    const activeCfEmail =
      cloudflareAuthEmail !== undefined
        ? cloudflareAuthEmail.trim()
        : current.cloudflareEmail || "mhmdsamy112233@gmail.com";

    let mbs = [...current.clientSettings.availableMailboxes];
    let connectionMessage = "تم حفظ الإعدادات بنجاح.";
    let liveCatchAllEmail: string | null = null;

    if (clearCloudflareKey) {
      clearCloudflareAuthLockout();
      await dbQuery(
        "UPDATE provider_settings SET encrypted_cf_key = NULL, cf_key_preview = NULL, updated_at = NOW() WHERE id = 1"
      );
      activeCfKey = null;
      connectionMessage = "تم مسح مفتاح Cloudflare API.";
    } else if (cloudflareKey && cloudflareKey.trim()) {
      clearCloudflareAuthLockout();
      const t = cloudflareKey.trim();
      const { zoneId, accountId } = await findCloudflareZone(
        { token: t, authEmail: activeCfEmail },
        "smsmraw.com"
      );
      await dbQuery(
        "UPDATE provider_settings SET encrypted_cf_key = $1, cf_key_preview = $2, cf_auth_email = $3, updated_at = NOW() WHERE id = 1",
        [encryptApiKey(t), maskApiKey(t), activeCfEmail]
      );
      activeCfKey = t;
      const [cfDests, liveCatchAll] = await Promise.all([
        listCloudflareDestinations({ token: t, authEmail: activeCfEmail }, accountId),
        getCloudflareCatchAll({ token: t, authEmail: activeCfEmail }, zoneId),
      ]);
      lastCfSyncAt = Date.now();
      if (liveCatchAll) {
        resolvedPrimaryEmail = liveCatchAll;
        liveCatchAllEmail = liveCatchAll;
      }
      for (const d of cfDests) {
        const ex = mbs.find(
          (m) => m.email.toLowerCase() === d.email.toLowerCase()
        );
        if (ex) {
          ex.verified = d.verified;
        } else {
          mbs.push({
            id: mbs.length + 10421,
            email: d.email,
            default: d.email === liveCatchAll,
            verified: d.verified,
          });
        }
      }
      connectionMessage = `✅ تم ربط حساب Cloudflare بنجاح! الإيميل المستلم حالياً في Cloudflare هو: ${
        liveCatchAll || resolvedPrimaryEmail
      }`;
    }

    // Handle adding a new receiver email
    if (
      addReceiverEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addReceiverEmail.trim())
    ) {
      const newEmail = addReceiverEmail.trim();
      if (!activeCfKey) {
        return NextResponse.json(
          {
            error:
              "يرجى ربط مفتاح Cloudflare Global API Key أولاً من زر إعدادات Cloudflare حتى يضيف الموقع هذا الإيميل في حسابك على Cloudflare ويرسل له رابط التفعيل!",
            requireCloudflareKey: true,
          },
          { status: 400 }
        );
      }

      const { accountId, zoneId } = await findCloudflareZone(
        { token: activeCfKey, authEmail: activeCfEmail },
        "smsmraw.com"
      );
      const cfDest = await addCloudflareDestination(
        { token: activeCfKey, authEmail: activeCfEmail },
        accountId,
        newEmail
      );

      const existingIdx = mbs.findIndex(
        (m) => m.email.toLowerCase() === newEmail.toLowerCase()
      );
      if (existingIdx >= 0) {
        mbs[existingIdx].verified = cfDest.verified;
      } else {
        const nextId = mbs.reduce((max, m) => Math.max(max, m.id), 10420) + 1;
        mbs.push({
          id: nextId,
          email: newEmail,
          default: false,
          verified: cfDest.verified,
        });
      }

      if (cfDest.verified) {
        await updateCloudflareCatchAll(
          { token: activeCfKey, authEmail: activeCfEmail },
          zoneId,
          newEmail
        );
        resolvedPrimaryEmail = newEmail;
        liveCatchAllEmail = newEmail;
        connectionMessage = `✅ الإيميل ${newEmail} مفعّل وتم تحويل استقبال كل رسائل الـ OTP إليه داخل Cloudflare!`;
      } else {
        connectionMessage = `📩 أرسل Cloudflare الآن رسالة تفعيل إلى بريد (${newEmail})! افتح تطبيق Gmail لهذا الإيميل واضغط Verify email address، ثم اضغط على الإيميل هنا للتبديل إليه.`;
      }
    }

    // Handle removing a receiver email
    if (removeReceiverEmail) {
      mbs = mbs.filter(
        (m) => m.email.toLowerCase() !== removeReceiverEmail.trim().toLowerCase()
      );
      if (mbs.length === 0) {
        mbs = [
          {
            id: 10421,
            email: "mhmdsamy112233@gmail.com",
            default: true,
            verified: true,
          },
        ];
      }
      if (
        resolvedPrimaryEmail.toLowerCase() ===
        removeReceiverEmail.trim().toLowerCase()
      ) {
        resolvedPrimaryEmail = mbs[0].email;
      }
      connectionMessage = `تم حذف ${removeReceiverEmail} من القائمة.`;
    }

    // Handle switching active OTP receiver email
    if (switchActiveReceiver) {
      const targetReceiver = switchActiveReceiver.trim();
      if (!activeCfKey) {
        return NextResponse.json(
          {
            error:
              "لتبديل إيميل استقبال الـ OTP فعلياً داخل Cloudflare، يجب إدخال مفتاح Cloudflare Global API Key أولاً!",
            requireCloudflareKey: true,
          },
          { status: 400 }
        );
      }

      const { zoneId, accountId } = await findCloudflareZone(
        { token: activeCfKey, authEmail: activeCfEmail },
        "smsmraw.com"
      );

      // Direct switch attempt first (1 single Cloudflare request if destination is already verified)
      try {
        await updateCloudflareCatchAll(
          { token: activeCfKey, authEmail: activeCfEmail },
          zoneId,
          targetReceiver
        );
      } catch (switchErr) {
        // If direct switch failed, check whether destination needs to be added/verified
        const cfDests = await listCloudflareDestinations(
          { token: activeCfKey, authEmail: activeCfEmail },
          accountId
        );
        const matchedDest = cfDests.find(
          (d) => d.email.toLowerCase() === targetReceiver.toLowerCase()
        );
        if (!matchedDest && cfDests.length > 0) {
          const added = await addCloudflareDestination(
            { token: activeCfKey, authEmail: activeCfEmail },
            accountId,
            targetReceiver
          );
          if (!added.verified) {
            return NextResponse.json(
              {
                error: `تم تسجيل ${targetReceiver} في Cloudflare وإرسال رسالة التفعيل إليه! افتح تطبيق Gmail الخاص بـ ${targetReceiver} واضغط على زر Verify email address أولاً، ثم اضغط هنا للتبديل إليه.`,
              },
              { status: 400 }
            );
          }
        } else if (matchedDest && !matchedDest.verified) {
          return NextResponse.json(
            {
              error: `الإيميل (${targetReceiver}) لم يتم تفعيله بعد! افتح تطبيق Gmail الخاص بـ ${targetReceiver} وابحث عن رسالة Cloudflare واضغط Verify email address أولاً.`,
            },
            { status: 400 }
          );
        }
        throw switchErr;
      }

      resolvedPrimaryEmail = targetReceiver;
      liveCatchAllEmail = targetReceiver;
      lastCfSyncAt = Date.now();

      mbs = mbs.map((m) => ({
        ...m,
        default: m.email.toLowerCase() === targetReceiver.toLowerCase(),
        verified:
          m.email.toLowerCase() === targetReceiver.toLowerCase()
            ? true
            : m.verified,
      }));
      if (
        !mbs.some((m) => m.email.toLowerCase() === targetReceiver.toLowerCase())
      ) {
        const nextId = mbs.reduce((max, m) => Math.max(max, m.id), 10420) + 1;
        mbs.push({
          id: nextId,
          email: targetReceiver,
          default: true,
          verified: true,
        });
      }

      if (updateExistingAliasesToReceiver === true) {
        await dbQuery(
          "UPDATE aliases SET primary_email = $1, updated_at = NOW() WHERE domain = 'smsmraw.com'",
          [targetReceiver]
        );
      }
      connectionMessage =
        updateExistingAliasesToReceiver === true
          ? `✅ تم التبديل وتحويل جميع الإيميلات القديمة والجديدة لتستلم الـ OTP على: ${targetReceiver}`
          : `✅ تم تفعيل (${targetReceiver}) للدفعات الجديدة! (الدفعات السابقة المثبتة تظل تستلم الـ OTP على إيميلها الأصلي بشكل مستقل).`;
    }

    const matchedMb =
      mbs.find(
        (m) => m.email.toLowerCase() === resolvedPrimaryEmail.toLowerCase()
      ) || mbs[0];
    const suffixes = current.clientSettings.availableSuffixes.length
      ? current.clientSettings.availableSuffixes
      : DEFAULT_SANDBOX_SUFFIXES;
    const chosen =
      suffixes.find((s) => s.suffix === defaultSuffix) || suffixes[0];

    await dbQuery(
      `UPDATE provider_settings SET api_base_url=$1, mode=$2, primary_email=$3, default_mailbox_id=$4, default_suffix=$5, default_signed_suffix=$6, available_suffixes=$7::jsonb, available_mailboxes=$8::jsonb, updated_at=NOW() WHERE id=1`,
      [
        resolvedBaseUrl,
        resolvedMode,
        resolvedPrimaryEmail,
        matchedMb?.id ?? 10421,
        chosen.suffix,
        chosen.signed_suffix,
        JSON.stringify(suffixes),
        JSON.stringify(mbs),
      ]
    );

    const [updated, stats] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
    ]);
    updated.clientSettings.primaryEmail = resolvedPrimaryEmail;
    updated.clientSettings.cloudflareLiveCatchAll =
      liveCatchAllEmail || (activeCfKey ? resolvedPrimaryEmail : null);
    updated.clientSettings.cloudflareConnected = Boolean(activeCfKey);
    updated.clientSettings.availableMailboxes = mbs;
    updated.clientSettings.hasCloudflareKey = Boolean(activeCfKey);
    updated.clientSettings.cloudflareKeyPreview = activeCfKey
      ? maskApiKey(activeCfKey)
      : null;

    const res = NextResponse.json({
      settings: updated.clientSettings,
      stats,
      message: connectionMessage,
    });
    res.cookies.set(
      VAULT_COOKIE_NAME,
      serializeVaultCookie({
        cfKey: activeCfKey,
        cfEmail: activeCfEmail,
        slKey: activeApiKey,
        primaryEmail: resolvedPrimaryEmail,
        mailboxes: mbs,
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      }
    );
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}
