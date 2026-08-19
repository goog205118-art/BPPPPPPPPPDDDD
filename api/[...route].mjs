import { timingSafeEqual } from "node:crypto";

const STATE_BLOB = "resource-workbench/state.json";
const SETTINGS_BLOB = "resource-workbench/private-ai-settings.json";
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);
let blobClientPromise;
let excelJsPromise;

const defaultState = {
  meta: { version: 1, updatedAt: new Date().toISOString() },
  creators: [],
  resources: [],
  leads: [],
  products: [],
  cooperations: [],
  matches: [],
  importHistory: [],
};

const defaultAiProfile = {
  protocol: "gemini",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
  keySource: "local",
  model: "gemini-2.5-flash",
  proxyUrl: "",
};

const defaultAiSettings = {
  profiles: {
    creator: { ...defaultAiProfile },
    lead: { ...defaultAiProfile },
    product: { ...defaultAiProfile },
    outreach: { ...defaultAiProfile },
  },
};

const countryAliases = new Map([
  ["美国", "美国"],
  ["unitedstates", "美国"],
  ["usa", "美国"],
  ["us", "美国"],
  ["u.s.", "美国"],
  ["u.s.a.", "美国"],
  ["英国", "英国"],
  ["unitedkingdom", "英国"],
  ["uk", "英国"],
  ["u.k.", "英国"],
  ["日本", "日本"],
  ["japan", "日本"],
  ["德国", "德国"],
  ["germany", "德国"],
  ["deutschland", "德国"],
  ["加拿大", "加拿大"],
  ["canada", "加拿大"],
  ["澳大利亚", "澳大利亚"],
  ["australia", "澳大利亚"],
  ["法国", "法国"],
  ["france", "法国"],
  ["意大利", "意大利"],
  ["italy", "意大利"],
  ["西班牙", "西班牙"],
  ["spain", "西班牙"],
  ["españa", "西班牙"],
  ["espana", "西班牙"],
  ["韩国", "韩国"],
  ["korea", "韩国"],
  ["southkorea", "韩国"],
]);

function normalizeCountry(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return countryAliases.get(raw.toLowerCase().replace(/\s+/g, "")) || raw;
}

function normalizeBusinessState(rawState) {
  const state = rawState && typeof rawState === "object" ? rawState : {};
  const creators = Array.isArray(state.creators) ? state.creators.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  const resources = Array.isArray(state.resources) ? state.resources.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  const leads = Array.isArray(state.leads) ? state.leads.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  const products = Array.isArray(state.products) ? state.products.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  const creatorByName = new Map(creators.map((row) => [String(row.name || "").trim(), row]));
  const resourceByName = new Map(resources.map((row) => [String(row.name || "").trim(), row]));
  const cooperations = Array.isArray(state.cooperations)
    ? state.cooperations.map((row) => {
        const creator = creators.find((item) => item.id === row.creator_id) || creatorByName.get(String(row.creator_name || "").trim());
        const resource = resources.find((item) => item.id === row.resource_id) || resourceByName.get(String(row.resource_name || "").trim());
        return {
          ...row,
          creator_id: creator ? creator.id : String(row.creator_id || "").trim(),
          resource_id: resource ? resource.id : String(row.resource_id || "").trim(),
          creator_name: creator ? creator.name : String(row.creator_name || "").trim(),
          resource_name: resource ? resource.name : String(row.resource_name || "").trim(),
        };
      })
    : [];
  const matches = Array.isArray(state.matches)
    ? state.matches.map((row) => ({
        ...row,
        country: normalizeCountry(row.country),
        selected_resource_ids: Array.isArray(row.selected_resource_ids) ? row.selected_resource_ids : [],
      }))
    : [];

  return {
    ...defaultState,
    ...state,
    meta: { version: 1, ...(state.meta || {}) },
    creators,
    resources,
    leads,
    products,
    cooperations,
    matches,
    importHistory: Array.isArray(state.importHistory) ? state.importHistory : [],
  };
}

function json(res, statusCode, payload) {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function constantTimeMatches(expected, supplied) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const suppliedBuffer = Buffer.from(String(supplied || ""), "utf8");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function requireAccess(req, res) {
  const password = String(process.env.WORKBENCH_ACCESS_PASSWORD || "");
  if (!password) {
    json(res, 503, { ok: false, error: "线上服务尚未设置访问密码。请在 Vercel 环境变量中设置 WORKBENCH_ACCESS_PASSWORD 后重新部署。" });
    return false;
  }
  if (!constantTimeMatches(password, req.headers["x-workbench-access"])) {
    json(res, 401, { ok: false, error: "访问密码不正确。" });
    return false;
  }
  return true;
}

function resolveBlobToken() {
  const standardToken = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (standardToken) return standardToken;

  const customToken = Object.entries(process.env).find(([key, value]) => {
    return /(?:^|_)READ_WRITE_TOKEN$/i.test(key) && Boolean(String(value || "").trim());
  });
  return customToken ? String(customToken[1]).trim() : "";
}

function requireBlobToken() {
  const token = resolveBlobToken();
  if (!token) {
    throw new Error("私有 Blob 已创建，但尚未连接读写令牌。请在 Vercel Blob 创建页勾选“Add a read-write token env var to this connection”，然后重新部署。");
  }
  return token;
}

async function getBlobClient() {
  if (!blobClientPromise) blobClientPromise = import("@vercel/blob");
  return blobClientPromise;
}

async function getExcelJs() {
  if (!excelJsPromise) excelJsPromise = import("exceljs");
  const module = await excelJsPromise;
  return module.default || module;
}

async function findBlob(pathname) {
  const token = requireBlobToken();
  const { list } = await getBlobClient();
  const result = await list({ prefix: pathname, limit: 100, token });
  return result.blobs.find((item) => item.pathname === pathname) || null;
}

async function readBlobJson(pathname, fallback) {
  const token = requireBlobToken();
  const blob = await findBlob(pathname);
  if (!blob) return fallback;
  const response = await fetch(blob.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`无法读取线上数据（HTTP ${response.status}）。`);
  }
  return response.json();
}

async function writeBlobJson(pathname, data) {
  const token = requireBlobToken();
  const { put } = await getBlobClient();
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    token,
  });
}

async function loadState() {
  return normalizeBusinessState(await readBlobJson(STATE_BLOB, defaultState));
}

async function saveState(nextState) {
  const state = normalizeBusinessState({
    ...nextState,
    meta: { ...(nextState?.meta || {}), version: 1, updatedAt: new Date().toISOString() },
  });
  await writeBlobJson(STATE_BLOB, state);
  return state;
}

function normalizeAiProfile(raw = {}, existing = {}) {
  const next = {
    protocol: String(raw.protocol || existing.protocol || defaultAiProfile.protocol).trim().toLowerCase(),
    apiBaseUrl: String(raw.apiBaseUrl || existing.apiBaseUrl || defaultAiProfile.apiBaseUrl).trim().replace(/\/+$/, ""),
    apiKey: String(raw.apiKey ?? "").trim(),
    keySource: String(raw.keySource || existing.keySource || defaultAiProfile.keySource).trim().toLowerCase(),
    model: String(raw.model || existing.model || defaultAiProfile.model).trim(),
    proxyUrl: "",
  };
  if (!["gemini", "openai"].includes(next.protocol)) next.protocol = defaultAiProfile.protocol;
  if (!["local", "environment"].includes(next.keySource)) next.keySource = defaultAiProfile.keySource;
  if (!next.apiBaseUrl) next.apiBaseUrl = defaultAiProfile.apiBaseUrl;
  if (!next.model) next.model = defaultAiProfile.model;
  return next;
}

function normalizeAiSettings(raw = {}, existing = {}) {
  const rawProfiles = raw?.profiles && typeof raw.profiles === "object" ? raw.profiles : {};
  const existingProfiles = existing?.profiles && typeof existing.profiles === "object" ? existing.profiles : {};
  const legacyRaw = rawProfiles.creator ? {} : raw;
  const legacyExisting = existingProfiles.creator ? {} : existing;
  return {
    profiles: {
      creator: normalizeAiProfile(rawProfiles.creator || legacyRaw, existingProfiles.creator || legacyExisting),
      lead: normalizeAiProfile(rawProfiles.lead || {}, existingProfiles.lead || existingProfiles.creator || legacyExisting),
      product: normalizeAiProfile(rawProfiles.product || {}, existingProfiles.product || existingProfiles.lead || existingProfiles.creator || legacyExisting),
      outreach: normalizeAiProfile(rawProfiles.outreach || {}, existingProfiles.outreach || existingProfiles.lead || existingProfiles.creator || legacyExisting),
    },
  };
}

async function loadAiSettings() {
  return normalizeAiSettings(await readBlobJson(SETTINGS_BLOB, defaultAiSettings));
}

async function saveAiSettings(input) {
  const existing = await loadAiSettings();
  const next = normalizeAiSettings(input, existing);
  for (const key of ["creator", "lead", "product", "outreach"]) {
    const profile = next.profiles[key];
    const previous = existing.profiles[key] || {};
    if (!profile.apiKey || profile.apiKey === "********") profile.apiKey = previous.apiKey || "";
  }
  await writeBlobJson(SETTINGS_BLOB, next);
  return next;
}

function environmentKeyFor(profileKey) {
  return (
    (profileKey === "lead"
      ? process.env.RESOURCE_WORKBENCH_LEAD_AI_KEY || process.env.LEAD_AI_API_KEY
      : profileKey === "product"
        ? process.env.RESOURCE_WORKBENCH_PRODUCT_AI_KEY || process.env.PRODUCT_AI_API_KEY
      : profileKey === "outreach"
        ? process.env.RESOURCE_WORKBENCH_OUTREACH_AI_KEY || process.env.OUTREACH_AI_API_KEY
        : process.env.RESOURCE_WORKBENCH_CREATOR_AI_KEY || process.env.CREATOR_AI_API_KEY) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  );
}

function resolveAiSettings(saved, purpose = "creator") {
  const profileKey = ["creator", "lead", "product", "outreach"].includes(purpose) ? purpose : "creator";
  const profile = saved.profiles[profileKey] || saved.profiles.creator || defaultAiProfile;
  const environmentKey = environmentKeyFor(profileKey);
  return {
    ...profile,
    apiKey: profile.keySource === "environment" ? environmentKey : profile.apiKey || environmentKey,
    model: profile.model || process.env.GEMINI_MODEL || defaultAiProfile.model,
  };
}

function publicAiProfile(settings, saved) {
  return {
    protocol: settings.protocol || defaultAiProfile.protocol,
    apiBaseUrl: settings.apiBaseUrl || defaultAiProfile.apiBaseUrl,
    model: settings.model || defaultAiProfile.model,
    proxyUrl: "",
    hasProxy: false,
    hasApiKey: Boolean(settings.apiKey),
    keySource: saved.keySource || defaultAiProfile.keySource,
    resolvedKeySource: settings.apiKey && !saved.apiKey ? "环境变量" : settings.apiKey ? "线上设置" : "",
  };
}

async function publicAiSettings() {
  const saved = await loadAiSettings();
  return {
    profiles: {
      creator: publicAiProfile(resolveAiSettings(saved, "creator"), saved.profiles.creator || {}),
      lead: publicAiProfile(resolveAiSettings(saved, "lead"), saved.profiles.lead || {}),
      product: publicAiProfile(resolveAiSettings(saved, "product"), saved.profiles.product || {}),
      outreach: publicAiProfile(resolveAiSettings(saved, "outreach"), saved.profiles.outreach || {}),
    },
  };
}

async function publicAiStatus() {
  const saved = await loadAiSettings();
  const build = (purpose) => {
    const settings = resolveAiSettings(saved, purpose);
    return {
      configured: Boolean(settings.apiKey),
      protocol: settings.protocol,
      apiBaseUrl: settings.apiBaseUrl,
      model: settings.model,
      network: { mode: "cloud", source: "Vercel 云端直连", automatic: true },
    };
  };
  return { creator: build("creator"), lead: build("lead"), product: build("product"), outreach: build("outreach") };
}

function withQueryParam(targetUrl, key, value) {
  const parsed = new URL(targetUrl);
  if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
  return parsed.toString();
}

function buildGeminiEndpoint(settings) {
  const model = settings.model || defaultAiProfile.model;
  const rawUrl = (settings.apiBaseUrl || defaultAiProfile.apiBaseUrl).replace(/\/+$/, "");
  if (/:(generateContent|streamGenerateContent)(\?|$)/.test(rawUrl)) return withQueryParam(rawUrl, "key", settings.apiKey);
  if (/\/models\/[^/]+$/.test(rawUrl)) return withQueryParam(`${rawUrl}:generateContent`, "key", settings.apiKey);
  return withQueryParam(`${rawUrl}/models/${encodeURIComponent(model)}:generateContent`, "key", settings.apiKey);
}

function buildOpenAiEndpoint(settings) {
  const rawUrl = (settings.apiBaseUrl || "").replace(/\/+$/, "");
  if (!rawUrl) throw new Error("OpenAI 兼容接口需要填写 API 地址。");
  return /\/chat\/completions$/i.test(rawUrl) ? rawUrl : `${rawUrl}/chat/completions`;
}

async function postJson(targetUrl, payload, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = { raw };
    }
    return { statusCode: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function stripJsonFences(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseGeminiJson(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini 没有返回可解析内容");
  const parsed = JSON.parse(stripJsonFences(text));
  const groundingSources = (payload?.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
    .map((chunk) => String(chunk?.web?.uri || "").trim())
    .filter(Boolean);
  return {
    ...parsed,
    sources: [...new Set([...(Array.isArray(parsed.sources) ? parsed.sources : []), ...groundingSources])],
  };
}

function parseOpenAiJson(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((part) => part?.text || "").join("\n").trim() : String(content || "").trim();
  if (!text) throw new Error("OpenAI 兼容接口没有返回可解析内容");
  return JSON.parse(stripJsonFences(text));
}

function parseMetricNumber(value, key) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  const raw = String(value).trim().toLowerCase().replace(/,/g, "");
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(k|m|b|千|万|百万|亿|%)?/i);
  if (!match) return 0;
  let number = Number(match[1]);
  const unit = match[2] || "";
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (unit === "k" || unit === "千") number *= 1000;
  if (unit === "m" || unit === "百万") number *= 1000000;
  if (unit === "b" || unit === "亿") number *= 100000000;
  if (unit === "万") number *= 10000;
  return key === "engagement" ? Math.round(number * 10) / 10 : Math.round(number);
}

function isLikelyPublicEmail(value) {
  const email = String(value || "").trim();
  return Boolean(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/(example|test|unknown|none|n\/a)/i.test(email);
}

function isPublicSourceUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function hasReliableEmailEvidence(raw, rawUpdates, email) {
  const emailSource = String(rawUpdates?.email_source || raw?.email_source || "").trim();
  const evidence = String(rawUpdates?.email_evidence || raw?.email_evidence || "").trim();
  return (
    isPublicSourceUrl(emailSource) &&
    Boolean(evidence) &&
    evidence.toLowerCase().includes(String(email || "").trim().toLowerCase()) &&
    !/(historical|dump|leak|sample|example|stackoverflow|stack overflow|json|api|猜测|推测|泄露|示例|历史)/i.test(evidence)
  );
}

function isSimplifiedChineseNote(value) {
  const note = String(value || "").trim();
  const chineseCount = (note.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (note.match(/[a-z]/gi) || []).length;
  return chineseCount >= 2 && chineseCount >= latinCount;
}

function isCountryAgeAudience(value) {
  const text = String(value || "").trim();
  const hasAge = /\b(1[3-9]|[2-6]\d)(\s*[-~至到]\s*(1[3-9]|[2-7]\d))?\b|age|ages|年龄|岁/i.test(text);
  const hasCountry =
    /\b(us|usa|u\.s\.|united states|uk|u\.k\.|canada|australia|germany|france|italy|spain|españa|japan|korea|europe|global)\b|美国|英国|加拿大|澳大利亚|德国|法国|意大利|西班牙|日本|韩国|欧洲|全球|东南亚/i.test(text);
  return Boolean(text) && hasAge && hasCountry;
}

function normalizeAiValue(value, key) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("|");
  if (typeof value === "object") return JSON.stringify(value);
  if (["followers", "avg_views", "engagement"].includes(key)) return parseMetricNumber(value, key);
  return String(value).trim();
}

function sanitizeCreatorEnrich(raw, sourceUrl, purpose = "creator") {
  const allowed =
    purpose === "lead"
      ? ["name", "social_url", "country", "platform", "niche", "followers", "avg_views", "engagement", "notes"]
      : ["name", "social_url", "country", "language", "platform", "niche", "followers", "avg_views", "engagement", "audience", "content_types", "tags", "notes"];
  const updates = {};
  const rawUpdates = raw?.updates || raw || {};

  for (const key of allowed) {
    const value = normalizeAiValue(rawUpdates[key], key);
    if (key === "audience" && !isCountryAgeAudience(value)) continue;
    if (key === "country") {
      const country = normalizeCountry(value);
      if (country) updates.country = country;
      continue;
    }
    if (key === "notes" && !isSimplifiedChineseNote(value)) continue;
    if (value) updates[key] = value;
  }

  const email = normalizeAiValue(rawUpdates.email, "email");
  const emailSource = String(rawUpdates.email_source || raw?.email_source || "").trim();
  if (isLikelyPublicEmail(email) && hasReliableEmailEvidence(raw, rawUpdates, email)) {
    updates.email = email;
    updates.email_source = emailSource;
  }
  if (sourceUrl && !updates.social_url) updates.social_url = sourceUrl;
  return {
    ok: true,
    updates,
    confidence: String(raw?.confidence || "medium").trim(),
    sources: Array.isArray(raw?.sources) ? raw.sources.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [],
  };
}

function sourceResearchChecklist(sourceUrl) {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return `- 直接检索并打开该公开链接：${sourceUrl}`;
  }

  const host = parsed.hostname.toLowerCase();
  const handle = parsed.pathname.match(/\/@([^/?#]+)/)?.[1];
  const checklist = [`- 直接检索并打开该公开链接：${sourceUrl}`];

  if (host.includes("youtube.com")) {
    const channelBase = handle ? `https://www.youtube.com/@${handle}` : sourceUrl;
    checklist.push(`- 检索频道 About / 简介页：${channelBase}/about`);
    checklist.push(`- 检索频道主页的公开订阅数（Subscribers / 订阅者），不能用视频播放量代替粉丝量。`);
    if (handle) {
      checklist.push(`- 执行公开搜索：site:youtube.com/@${handle} ("business inquiries" OR contact OR email OR "for business")`);
      checklist.push(`- 执行公开搜索：site:youtube.com/@${handle} ("@" OR gmail OR outlook OR "联系")`);
    }
    checklist.push(`- 检查最新 3 条公开视频描述中的商务联系信息；只有页面明确展示邮箱才可填写。`);
  } else if (host.includes("instagram.com") || host.includes("tiktok.com")) {
    checklist.push(`- 检查主页简介（bio）、公开链接页、官网 Contact 页面以及公开搜索摘要。`);
    checklist.push(`- 检索主页公开粉丝数；不能以点赞、播放或互动数替代粉丝量。`);
  } else {
    checklist.push(`- 检查公开主页简介、个人资料页、官网联系页和公开搜索结果。`);
  }

  return checklist.join("\n");
}

function buildCreatorEnrichPrompt(sourceUrl, current) {
  return `你是一个达人资源录入助手。请实际使用可用的网页搜索/网页读取能力，按下面“必做公开检索清单”逐项检索，不要只根据链接标题或一条搜索摘要作答。提取可验证信息；不能确定的字段留空，不要猜测。

达人主页链接：${sourceUrl}
当前表单已有信息：${JSON.stringify(current || {}, null, 2)}

必做公开检索清单：
${sourceResearchChecklist(sourceUrl)}

只返回 JSON，不要返回解释文字。字段结构如下：
{
  "updates": {
    "name": "", "social_url": "", "email": "", "email_source": "", "email_evidence": "", "country": "", "language": "", "platform": "", "niche": "", "followers": "", "avg_views": "", "engagement": "", "audience": "", "content_types": "", "tags": "", "notes": ""
  },
  "confidence": "low|medium|high",
  "sources": [],
  "warnings": []
}

要求：
1. 先完成邮箱专项检索：依次检查主页 bio/简介、About/Profile 页面、官网 Contact 页面、最新 3 条公开内容描述和公开搜索摘要。只有页面中明确出现完全相同邮箱时才填写；不能使用历史泄露数据、第三方代码示例、猜测邮箱、同名人物邮箱；查不到就必须留空。
   如果填写 email，必须同时填写 email_source（该邮箱所在公开页面的完整 http(s) URL）和 email_evidence（说明邮箱出现在哪个公开位置，且 evidence 文本里必须包含这个完整邮箱）。不能只写“Google 搜索”“YouTube 简介”等笼统来源。没有明确来源证据就把 email、email_source、email_evidence 都留空。
2. 粉丝量是高优先级字段：必须单独核查主页/频道页公开显示的 followers、subscribers、粉丝或订阅者数字；可返回 81700、1.2M、81.7K 等格式。公开显示数字可直接填写；不要用视频播放量、点赞数或搜索结果中其他账号的数据替代。确实找不到时返回空字符串，不要返回 0。
3. avg_views 指近 30 条内容的平均播放量，engagement 指公开可核验的互动率；无法可靠得到就返回空字符串，不要把缺失写成 0。仅使用公开可见数字或公开搜索结果摘要做大致估算时，在 warnings 标明“数值为公开可见信息估算”。
4. 受众国家和年龄只能填写国家/地区 + 年龄段，例如 "US 18-34"、"美国 25-44"；不能填写兴趣人群、内容受众标签或职业描述。没有国家和年龄就留空。
5. country 必须积极从频道 About/简介、公开视频描述、官网联系页、公开搜索结果中的所在地、地址、语言或自我介绍识别。只有公开信息能支持时才填写国家/地区；例如识别到 Spain、España、Madrid、Barcelona 或西班牙所在地时，country 返回“西班牙”。没有足够公开依据时留空，不能把内容受众、语言或兴趣标签当作达人所在地。niche 填内容垂类；audience 不要和 niche/tags 混用。
6. tags 和 content_types 使用 | 分隔。
7. sources 至少列出实际用于判断的公开 URL；notes 必须使用简体中文，只写 1-2 句对人工复核有帮助、可从公开来源核验的事实摘要。不要写英文，不要写无法核验的联系人信息。`;
}

function buildLeadEnrichPrompt(sourceUrl, current) {
  return `你是一个快速达人线索整理助手。请实际使用可用的网页搜索/网页读取能力，按下面“必做公开检索清单”逐项检索，不要只根据链接标题或一条搜索摘要作答。只整理待开发阶段真正需要的核心信息；无法核验的字段必须留空，不能猜测。

达人主页链接：${sourceUrl}
当前已有信息：${JSON.stringify(current || {}, null, 2)}

必做公开检索清单：
${sourceResearchChecklist(sourceUrl)}

只返回 JSON，不要返回解释文字。字段结构如下：
{
  "updates": {
    "name": "", "social_url": "", "platform": "", "country": "", "niche": "", "followers": "", "avg_views": "", "engagement": "", "email": "", "email_source": "", "email_evidence": "", "notes": ""
  },
  "confidence": "low|medium|high",
  "sources": [],
  "warnings": []
}

规则：
1. 只提取以上字段。不要补充受众、语言、合作报价、标签、内容形式或任何推测性信息。
2. country 必须依据公开的所在地、地址、频道 About/简介、公开搜索结果或自我介绍识别；例如 Spain、España、Madrid、Barcelona 返回“西班牙”。无法确认时留空。
3. 粉丝量是高优先级字段：必须单独核查主页/频道页公开显示的 followers、subscribers、粉丝或订阅者数字。公开显示数字可直接填写；不要用播放量、点赞数或其他账号数据替代。确实找不到时返回空字符串，不要返回 0。
4. avg_views 指近 30 条内容的平均播放量，engagement 指公开可核验的互动率；无法可靠得到就返回空字符串，不要把缺失写成 0。估算数字时在 warnings 标明“数值为公开可见信息估算”。
5. 邮箱必须专项检索：依次检查主页 bio/简介、About/Profile 页面、官网 Contact 页面、最新 3 条公开内容描述和公开搜索摘要。仅当上述公开页面明确出现同一邮箱时填写。填写 email 时，email_source 必须是该邮箱所在公开页面完整 http(s) URL，email_evidence 必须包含该完整邮箱；否则 email、email_source、email_evidence 全部留空。
6. sources 至少列出实际用于判断的公开 URL；notes 必须为简体中文，只写 1 句可复核的事实摘要，不包含猜测的联系方式。`;
}

function buildMissingFieldFollowupPrompt(sourceUrl, current, purpose, missingFields) {
  const fields =
    purpose === "lead"
      ? ["name", "social_url", "platform", "country", "niche", "followers", "avg_views", "engagement", "email", "email_source", "email_evidence", "notes"]
      : ["name", "social_url", "country", "language", "platform", "niche", "followers", "avg_views", "engagement", "email", "email_source", "email_evidence", "audience", "content_types", "tags", "notes"];
  const blankUpdates = Object.fromEntries(fields.map((field) => [field, ""]));

  return `你正在为达人资料做第二次专项补查。必须使用网页搜索能力，且只补查以下仍缺失的字段：${missingFields.join("、")}。

达人主页链接：${sourceUrl}
第一次整理后已有信息：${JSON.stringify(current || {}, null, 2)}

必须执行以下公开检索：
${sourceResearchChecklist(sourceUrl)}

只返回 JSON：
{
  "updates": ${JSON.stringify(blankUpdates)},
  "confidence": "low|medium|high",
  "sources": [],
  "warnings": []
}

规则：
1. followers 必须来自该账号/频道公开显示的粉丝或订阅者数；找不到就为空，绝不能返回 0 或用播放量代替。
2. email 必须在公开页面原文中出现；填写时 email_source 为出现邮箱的完整 URL，email_evidence 必须包含该邮箱；否则三个邮箱字段全部为空。
3. 不要覆盖已有信息，不要猜测，sources 只列实际使用的公开 URL，notes 使用简体中文。`;
}

function mergeEnrichmentResults(primary, recovery) {
  if (!recovery) return primary;
  const updates = { ...(primary?.updates || {}) };
  for (const [key, value] of Object.entries(recovery.updates || {})) {
    if (!String(updates[key] || "").trim() && String(value || "").trim()) updates[key] = value;
  }
  return {
    ...primary,
    updates,
    confidence: primary?.confidence === "high" || recovery.confidence === "high" ? "high" : primary?.confidence || recovery.confidence || "medium",
    sources: [...new Set([...(primary?.sources || []), ...(recovery.sources || [])])].slice(0, 8),
    warnings: [...new Set([...(primary?.warnings || []), ...(recovery.warnings || [])])].slice(0, 8),
  };
}

async function enrichCreatorWithAi(sourceUrl, current, purpose = "creator") {
  const saved = await loadAiSettings();
  const settings = resolveAiSettings(saved, purpose);
  if (!settings.apiKey) throw new Error("未配置 AI API Key。请先在设置页保存 API Key。");
  const prompt = purpose === "lead" ? buildLeadEnrichPrompt(sourceUrl, current) : buildCreatorEnrichPrompt(sourceUrl, current);

  if (settings.protocol === "openai") {
    const response = await postJson(
      buildOpenAiEndpoint(settings),
      {
        model: settings.model,
        messages: [
          { role: "system", content: "你是严谨的达人资料录入助手。必须只输出有效 JSON。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      { Authorization: `Bearer ${settings.apiKey}` },
    );
    if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `OpenAI 兼容接口请求失败：HTTP ${response.statusCode}`);
    const result = sanitizeCreatorEnrich(parseOpenAiJson(response.body), sourceUrl, purpose);
    const missingFields = ["followers", "email"].filter((key) => !String(result.updates[key] || "").trim());
    if (missingFields.length) {
      result.warnings = [
        ...new Set([
          ...(result.warnings || []),
          "当前 OpenAI 兼容协议未启用标准网页搜索，关键公开信息可能无法稳定补全；建议为此功能使用 Gemini 协议并开启联网检索。",
        ]),
      ];
    }
    return result;
  }

  const endpoint = buildGeminiEndpoint(settings);
  const basePayload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };
  let response = await postJson(endpoint, { ...basePayload, tools: [{ googleSearch: {} }] });
  if (response.statusCode >= 400) response = await postJson(endpoint, basePayload);
  if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`);
  const primary = sanitizeCreatorEnrich(parseGeminiJson(response.body), sourceUrl, purpose);
  const missingFields = ["followers", "email"].filter((key) => !String(primary.updates[key] || "").trim());
  if (!missingFields.length) return primary;

  const recoveryResponse = await postJson(endpoint, {
    ...basePayload,
    contents: [{ role: "user", parts: [{ text: buildMissingFieldFollowupPrompt(sourceUrl, { ...current, ...primary.updates }, purpose, missingFields) }] }],
    tools: [{ googleSearch: {} }],
  });
  if (recoveryResponse.statusCode >= 400) {
    primary.warnings = [...new Set([...(primary.warnings || []), "关键字段补查未完成，已保留首次检索结果。"])];
    return primary;
  }
  return mergeEnrichmentResults(primary, sanitizeCreatorEnrich(parseGeminiJson(recoveryResponse.body), sourceUrl, purpose));
}

function sanitizeProductEnrich(raw, productUrl) {
  const updates = raw?.updates || raw || {};
  const name = usableProductTitle(updates.name || "", productUrl).slice(0, 300);
  const imageUrl = String(updates.image_url || "").trim();
  const description = stripHtml(updates.description || "").slice(0, 700);
  return {
    ok: true,
    updates: {
      ...(name ? { name } : {}),
      ...(isPublicSourceUrl(imageUrl) ? { image_url: imageUrl } : {}),
      ...(description ? { description } : {}),
    },
    sources: Array.isArray(raw?.sources) ? raw.sources.map((item) => String(item).trim()).filter(isPublicSourceUrl).slice(0, 8) : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [],
  };
}

function buildProductEnrichPrompt(productUrl, current) {
  return `你是严谨的跨境商品资料录入助手。请检索并核验以下公开商品链接，只补充可以确认的商品资料。

商品链接：${productUrl}
网页读取到的已有资料：${JSON.stringify(current || {}, null, 2)}

只返回有效 JSON，不要 Markdown：
{
  "updates": {
    "name": "",
    "image_url": "",
    "description": ""
  },
  "sources": [],
  "warnings": []
}

规则：
1. name 必须是该链接对应的公开商品名称，不可填写网站名、店铺名、品类名或页面标题中的无关营销语；无法确认则留空。
2. image_url 必须是可公开加载、与该商品对应的完整 http(s) 图片地址。不要返回搜索页、站点 logo、数据 URI、占位图或猜测的链接；无法确认则留空。
3. description 用简体中文简短总结已核验的卖点和适用场景，最多 220 个汉字。不得编造材质、规格、尺寸、兼容型号、认证、价格、折扣、评分或库存。
4. 不能覆盖已有资料。sources 只能列出实际使用的公开 URL；没有可靠资料时，updates 对应字段必须留空。`;
}

async function enrichProductWithAi(productUrl, current) {
  const saved = await loadAiSettings();
  const settings = resolveAiSettings(saved, "product");
  if (!settings.apiKey) throw new Error("未配置产品链接 AI 补全。");
  const prompt = buildProductEnrichPrompt(productUrl, current);

  if (settings.protocol === "openai") {
    const response = await postJson(
      buildOpenAiEndpoint(settings),
      {
        model: settings.model,
        messages: [
          { role: "system", content: "You extract only verifiable public product facts. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      { Authorization: `Bearer ${settings.apiKey}` },
    );
    if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `OpenAI 兼容接口请求失败：HTTP ${response.statusCode}`);
    const result = sanitizeProductEnrich(parseOpenAiJson(response.body), productUrl);
    result.warnings = [...new Set([...(result.warnings || []), "当前 OpenAI 兼容协议不保证联网检索，AI 补充结果请人工核对。"])];
    return result;
  }

  const endpoint = buildGeminiEndpoint(settings);
  const basePayload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };
  let response = await postJson(endpoint, { ...basePayload, tools: [{ googleSearch: {} }] });
  if (response.statusCode >= 400) response = await postJson(endpoint, basePayload);
  if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`);
  return sanitizeProductEnrich(parseGeminiJson(response.body), productUrl);
}

function outreachLeadPayload(lead) {
  return {
    id: String(lead?.id || "").trim(),
    name: String(lead?.name || "").trim(),
    social_url: String(lead?.social_url || "").trim(),
    platform: String(lead?.platform || "").trim(),
    country: String(lead?.country || "").trim(),
    niche: String(lead?.niche || "").trim(),
    followers: lead?.followers ?? "",
    avg_views: lead?.avg_views ?? "",
    engagement: lead?.engagement ?? "",
    email: String(lead?.email || "").trim(),
    notes: String(lead?.notes || "").trim(),
  };
}

function outreachProductPayload(product) {
  return {
    id: String(product?.id || "").trim(),
    name: String(product?.name || "").trim(),
    brand: String(product?.brand || "").trim(),
    country: String(product?.country || "").trim(),
    category: String(product?.category || "").trim(),
    store: String(product?.store || "").trim(),
    product_url: String(product?.product_url || "").trim(),
    description: String(product?.description || "").trim(),
    tags: String(product?.tags || "").trim(),
  };
}

function buildOutreachPrompt(leads, products, rules) {
  return `你是跨境品牌的达人合作开发专家。请只基于输入中给出的达人资料、产品资料和本次规则，为每位达人写一封自然、不模板化的英文开发邮件。

达人资料：
${JSON.stringify(leads.map(outreachLeadPayload), null, 2)}

本次可推荐产品：
${JSON.stringify(products.map(outreachProductPayload), null, 2)}

本次规则：
${JSON.stringify(rules || {}, null, 2)}

请只返回有效 JSON，不要 Markdown，不要说明文字：
{
  "drafts": [
    {
      "lead_id": "",
      "subject": "",
      "body": "",
      "recommended_cooperation": "",
      "reason": ""
    }
  ],
  "warnings": []
}

硬性规则：
1. 每位输入达人必须只生成一份草稿，lead_id 必须与输入完全一致。正文使用英文；不要写假签名、虚构公司地址、具体报价或未经提供的折扣。
2. 只能使用输入中提供的信息。不得声称看过某条视频、知道某个具体痛点、确认达人所在地、使用过竞品，除非输入资料明确写出。资料不足时，使用轻量且诚实的开场，例如欣赏其内容领域，而不是杜撰观看细节。
3. 只能提及本次提供的产品；若产品卖点为空，不要发明材料、功能、兼容型号或性能。产品名称和链接仅在规则允许时使用。
4. 合作方式要综合 followers、avg_views、engagement 判断：长尾或数据较小优先产品置换或置换 + CPS；中量级可建议置换 + CPS / 小预算可谈；头部或高播放可建议付费合作或先询价；数据不足时建议先询问合作偏好。必须尊重本次用户勾选的合作方式；不要承诺价格。
5. 若规则中不提及合作方式，则不要在正文写明合作模式，但仍填写 recommended_cooperation 供内部参考。若不附产品链接，则正文不要出现 URL。
6. 邮件控制在 110-180 英文词，语气遵循用户选择；不同达人使用不同的开场和产品匹配角度，避免完全相同的话术。
7. email 字段只是寄送地址提示，不可写入邮件正文，也不可声称其来源。`;
}

function sanitizeOutreachDrafts(raw, leads) {
  const allowedIds = new Set(leads.map((lead) => String(lead.id || "").trim()).filter(Boolean));
  const draftsById = new Map();
  for (const draft of Array.isArray(raw?.drafts) ? raw.drafts : []) {
    const leadId = String(draft?.lead_id || "").trim();
    if (!allowedIds.has(leadId) || draftsById.has(leadId)) continue;
    const subject = String(draft?.subject || "").trim().slice(0, 220);
    const body = String(draft?.body || "").trim().slice(0, 5000);
    if (!subject || !body) continue;
    draftsById.set(leadId, {
      lead_id: leadId,
      subject,
      body,
      recommended_cooperation: String(draft?.recommended_cooperation || "请人工确认合作方式").trim().slice(0, 180),
      reason: String(draft?.reason || "").trim().slice(0, 360),
    });
  }
  return {
    ok: true,
    drafts: leads.map((lead) => draftsById.get(String(lead.id || "").trim())).filter(Boolean),
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : [],
  };
}

async function generateOutreachWithAi(leads, products, rules) {
  if (!Array.isArray(leads) || !leads.length) throw new Error("请至少选择一位待开发达人。");
  if (!Array.isArray(products) || !products.length) throw new Error("请至少选择一个产品。");
  const saved = await loadAiSettings();
  const settings = resolveAiSettings(saved, "outreach");
  if (!settings.apiKey) throw new Error("未配置开发邮件 AI API Key。请先在设置页填写“达人开发邮件”参数。");
  const prompt = buildOutreachPrompt(leads, products, rules);

  if (settings.protocol === "openai") {
    const response = await postJson(
      buildOpenAiEndpoint(settings),
      {
        model: settings.model,
        messages: [
          { role: "system", content: "You write concise creator outreach emails. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.72,
        response_format: { type: "json_object" },
      },
      { Authorization: `Bearer ${settings.apiKey}` },
    );
    if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `OpenAI 兼容接口请求失败：HTTP ${response.statusCode}`);
    return sanitizeOutreachDrafts(parseOpenAiJson(response.body), leads);
  }

  const response = await postJson(buildGeminiEndpoint(settings), {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.72, responseMimeType: "application/json" },
  });
  if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`);
  return sanitizeOutreachDrafts(parseGeminiJson(response.body), leads);
}

function isSafePublicUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return false;
  if (/^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
  if (/^(fc|fd|fe8|fe9|fea|feb)/i.test(host)) return false;
  return true;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractHtmlMeta(html, attribute, key) {
  const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]*${attribute}\\s*=\\s*["']${escapedKey}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>|<meta[^>]*content\\s*=\\s*["']([^"']+)["'][^>]*${attribute}\\s*=\\s*["']${escapedKey}["'][^>]*>`, "i");
  const match = String(html || "").match(pattern);
  return decodeHtml(match?.[1] || match?.[2] || "").trim();
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function attributeValue(tag, attribute) {
  const escaped = String(attribute || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag || "").match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] || match?.[2] || match?.[3] || "").trim();
}

function tagById(html, id) {
  const escaped = String(id || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tags = String(html || "").match(/<[^>]+>/g) || [];
  return tags.find((tag) => new RegExp(`\\bid\\s*=\\s*(?:"${escaped}"|'${escaped}')`, "i").test(tag)) || "";
}

function elementTextById(html, id) {
  const escaped = String(id || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html || "").match(new RegExp(`<[^>]*\\bid\\s*=\\s*(?:"${escaped}"|'${escaped}')[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return stripHtml(match?.[1] || "");
}

function firstImageValue(value) {
  if (Array.isArray(value)) return firstImageValue(value[0]);
  if (value && typeof value === "object") return String(value.url || value.contentUrl || "").trim();
  return String(value || "").trim();
}

function extractStructuredProductData(html) {
  const scripts = String(html || "").match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  const products = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => String(type || "").toLowerCase() === "product")) products.push(value);
    if (value["@graph"]) visit(value["@graph"]);
  };
  for (const script of scripts) {
    if (!/type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')/i.test(script)) continue;
    const body = script.replace(/^<script\b[^>]*>|<\/script>$/gi, "").trim();
    try {
      visit(JSON.parse(body));
    } catch {
      // A malformed JSON-LD block should not prevent reading ordinary meta tags.
    }
  }
  const product = products.find((entry) => entry.name || entry.image || entry.description) || {};
  return {
    name: stripHtml(product.name || ""),
    image_url: firstImageValue(product.image),
    description: stripHtml(product.description || ""),
  };
}

function extractAmazonProductData(html) {
  const imageTag = tagById(html, "landingImage") || tagById(html, "imgTagWrapperId");
  let imageUrl = attributeValue(imageTag, "data-old-hires") || attributeValue(imageTag, "src");
  const dynamicImage = attributeValue(imageTag, "data-a-dynamic-image");
  if (!imageUrl && dynamicImage) {
    try {
      const images = Object.keys(JSON.parse(dynamicImage));
      imageUrl = images[0] || "";
    } catch {
      imageUrl = "";
    }
  }
  return {
    name: elementTextById(html, "productTitle"),
    image_url: imageUrl,
    description: elementTextById(html, "feature-bullets") || elementTextById(html, "productDescription"),
  };
}

function usableProductTitle(value, pageUrl) {
  const title = stripHtml(value);
  if (!title) return "";
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    host = "";
  }
  const normalized = title.toLowerCase().replace(/^www\./, "").trim();
  if (normalized === host || normalized === host.replace(/^m\./, "") || /^amazon(?:\.[a-z]{2,3})?$/.test(normalized)) return "";
  return title;
}

async function fetchProductPage(targetUrl) {
  let currentUrl = targetUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    for (let hop = 0; hop < 5; hop += 1) {
      if (!isSafePublicUrl(currentUrl)) throw new Error(hop ? "跳转后的产品链接不安全，无法读取。" : "产品链接必须是可公开访问的 http(s) 地址，且不能是本机或内网地址。");
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("产品页面跳转地址缺失，无法读取。");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) throw new Error(`产品页面无法读取（HTTP ${response.status}）。`);
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType && !/text\/html|application\/xhtml\+xml/.test(contentType)) throw new Error("该链接未返回可读取的产品网页。");
      const html = (await response.text()).slice(0, 2 * 1024 * 1024);
      return { html, finalUrl: currentUrl };
    }
    throw new Error("产品页面跳转次数过多，无法读取。");
  } finally {
    clearTimeout(timer);
  }
}

async function previewProductFromUrl(productUrl) {
  if (!isSafePublicUrl(productUrl)) throw new Error("产品链接必须是可公开访问的 http(s) 地址，且不能是本机或内网地址。");
  const result = { name: "", image_url: "", description: "" };
  const webFields = [];
  const aiFields = [];
  const warnings = [];
  const sources = [];

  try {
    const { html, finalUrl } = await fetchProductPage(productUrl);
    const structured = extractStructuredProductData(html);
    const amazon = /(^|\.)amazon\./i.test(new URL(finalUrl).hostname) ? extractAmazonProductData(html) : {};
    const title = usableProductTitle(
      amazon.name ||
        structured.name ||
        extractHtmlMeta(html, "property", "og:title") ||
        extractHtmlMeta(html, "name", "twitter:title") ||
        decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim(),
      finalUrl,
    );
    const image = amazon.image_url || structured.image_url || extractHtmlMeta(html, "property", "og:image") || extractHtmlMeta(html, "name", "twitter:image");
    const description = structured.description || amazon.description || extractHtmlMeta(html, "property", "og:description") || extractHtmlMeta(html, "name", "description");
    let imageUrl = "";
    try {
      imageUrl = image ? new URL(image, finalUrl).toString() : "";
    } catch {
      imageUrl = "";
    }
    Object.assign(result, { name: title.slice(0, 300), image_url: imageUrl, description: stripHtml(description).slice(0, 700) });
    for (const key of ["name", "image_url", "description"]) {
      if (result[key]) webFields.push(key);
    }
    if (isPublicSourceUrl(finalUrl)) sources.push(finalUrl);
  } catch (error) {
    warnings.push(`网页读取未完成：${formatProductPreviewError(error)}`);
  }

  const missing = ["name", "image_url", "description"].filter((key) => !result[key]);
  if (missing.length) {
    const saved = await loadAiSettings();
    const settings = resolveAiSettings(saved, "product");
    if (settings.apiKey) {
      try {
        const enriched = await enrichProductWithAi(productUrl, result);
        for (const key of missing) {
          if (enriched.updates[key]) {
            result[key] = enriched.updates[key];
            aiFields.push(key);
          }
        }
        sources.push(...(enriched.sources || []));
        warnings.push(...(enriched.warnings || []));
      } catch (error) {
        warnings.push(`AI 补充未完成：${formatError(error)}`);
      }
    } else {
      warnings.push("产品链接 AI 补全未配置，未读取到的字段已保留为空。");
    }
  }

  if (!webFields.length && !aiFields.length && !warnings.length) {
    warnings.push("没有读取到可核验的公开商品资料，字段已保留为空。");
  } else if (["name", "image_url", "description"].some((key) => !result[key])) {
    warnings.push("未能核验的字段已保留为空，请人工补充或核对。");
  }
  return {
    ok: true,
    ...result,
    web_fields: webFields,
    ai_fields: aiFields,
    sources: [...new Set(sources)].slice(0, 8),
    warning: [...new Set(warnings.filter(Boolean))].join(" "),
  };
}

function formatProductPreviewError(error) {
  const message = String(error?.message || error || "");
  if (/EACCES|ENETUNREACH|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|timeout|超时/i.test(message)) {
    return "当前网络无法连接该商品站点，请稍后重试；也可以先手动填写产品名称、主图和卖点。";
  }
  if (/HTTP (401|403|429)/i.test(message)) {
    return "该商品站点限制自动读取，请手动填写产品资料，或改用品牌官网的商品页。";
  }
  return message || "读取产品信息失败";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("上传内容过大。线上版单次 XLSX 建议控制在 3 MB 以内。"));
        req.destroy();
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function formatError(error) {
  const message = String(error?.message || error || "");
  if (/AbortError|timeout|超时/i.test(message)) return "AI API 请求超时，请稍后重试或换用更快的模型。";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) return `AI API 连接失败：${message}。请检查 API 地址和模型服务状态。`;
  return message || "请求失败";
}

function excelCellText(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text.trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
  }
  return String(cell.text || value).trim();
}

async function parseExcel(contentBase64) {
  const ExcelJS = await getExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(contentBase64, "base64"));
  const rows = [];
  for (const sheet of workbook.worksheets) {
    const headers = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      headers[columnNumber] = excelCellText(cell);
    });
    if (!headers.some(Boolean)) continue;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const item = {};
      let hasValue = false;
      for (let columnNumber = 1; columnNumber < headers.length; columnNumber += 1) {
        const value = excelCellText(row.getCell(columnNumber));
        if (!value) continue;
        item[headers[columnNumber] || `列${columnNumber}`] = value;
        hasValue = true;
      }
      if (hasValue) rows.push({ ...item, 来源工作表: sheet.name });
    });
  }
  return rows;
}

export default async function handler(req, res) {
  if (!requireAccess(req, res)) return;
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  try {
    if (req.method === "GET" && pathname === "/api/state") {
      json(res, 200, await loadState());
      return;
    }

    if (req.method === "POST" && pathname === "/api/state") {
      const body = JSON.parse((await readBody(req)) || "{}");
      await saveState(body);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/ai/settings") {
      json(res, 200, { ok: true, ...(await publicAiSettings()) });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/settings") {
      const body = JSON.parse((await readBody(req)) || "{}");
      await saveAiSettings(body);
      json(res, 200, { ok: true, settings: await publicAiSettings() });
      return;
    }

    if (req.method === "GET" && pathname === "/api/ai/status") {
      json(res, 200, { ok: true, profiles: await publicAiStatus() });
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/creator-enrich") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const sourceUrl = String(body.url || "").trim();
      if (!sourceUrl) throw new Error("缺少达人主页链接");
      json(res, 200, await enrichCreatorWithAi(sourceUrl, body.current || {}, body.purpose === "lead" ? "lead" : "creator"));
      return;
    }

    if (req.method === "POST" && pathname === "/api/ai/outreach-generate") {
      const body = JSON.parse((await readBody(req)) || "{}");
      json(res, 200, await generateOutreachWithAi(body.leads || [], body.products || [], body.rules || {}));
      return;
    }

    if (req.method === "POST" && pathname === "/api/products/preview") {
      const body = JSON.parse((await readBody(req)) || "{}");
      try {
        json(res, 200, await previewProductFromUrl(String(body.url || "").trim()));
      } catch (error) {
        json(res, 400, { ok: false, error: formatProductPreviewError(error) });
      }
      return;
    }

    if (req.method === "POST" && pathname === "/api/import-excel") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!String(body.contentBase64 || "")) throw new Error("缺少 Excel 文件内容");
      json(res, 200, await parseExcel(body.contentBase64));
      return;
    }

    json(res, 404, { ok: false, error: "接口不存在。" });
  } catch (error) {
    console.error("Resource Workbench API error:", error);
    json(res, 400, { ok: false, error: formatError(error) });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
