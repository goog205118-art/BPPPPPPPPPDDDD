const { timingSafeEqual } = require("crypto");
const { list, put } = require("@vercel/blob");
const ExcelJS = require("exceljs");

const STATE_BLOB = "resource-workbench/state.json";
const SETTINGS_BLOB = "resource-workbench/private-ai-settings.json";
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);

const defaultState = {
  meta: { version: 1, updatedAt: new Date().toISOString() },
  creators: [],
  resources: [],
  leads: [],
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
    cooperations,
    matches,
    importHistory: Array.isArray(state.importHistory) ? state.importHistory : [],
  };
}

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(payload, null, 2));
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

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("线上存储尚未连接。请在 Vercel Storage 中创建 Blob，并配置 BLOB_READ_WRITE_TOKEN。");
  }
}

async function findBlob(pathname) {
  requireBlobToken();
  const result = await list({ prefix: pathname, limit: 100 });
  return result.blobs.find((item) => item.pathname === pathname) || null;
}

async function readBlobJson(pathname, fallback) {
  const blob = await findBlob(pathname);
  if (!blob) return fallback;
  const response = await fetch(blob.url, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`无法读取线上数据（HTTP ${response.status}）。`);
  }
  return response.json();
}

async function writeBlobJson(pathname, data) {
  requireBlobToken();
  await put(pathname, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
}

async function loadState() {
  return normalizeBusinessState(await readBlobJson(STATE_BLOB, defaultState));
}

async function saveState(nextState) {
  const state = normalizeBusinessState({
    ...nextState,
    meta: { version: 1, updatedAt: new Date().toISOString() },
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
    },
  };
}

async function loadAiSettings() {
  return normalizeAiSettings(await readBlobJson(SETTINGS_BLOB, defaultAiSettings));
}

async function saveAiSettings(input) {
  const existing = await loadAiSettings();
  const next = normalizeAiSettings(input, existing);
  for (const key of ["creator", "lead"]) {
    const profile = next.profiles[key];
    const previous = existing.profiles[key] || {};
    if (!profile.apiKey || profile.apiKey === "********") profile.apiKey = previous.apiKey || "";
  }
  await writeBlobJson(SETTINGS_BLOB, next);
  return next;
}

function environmentKeyFor(profileKey) {
  return (
    (profileKey === "lead" ? process.env.RESOURCE_WORKBENCH_LEAD_AI_KEY || process.env.LEAD_AI_API_KEY : process.env.RESOURCE_WORKBENCH_CREATOR_AI_KEY || process.env.CREATOR_AI_API_KEY) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  );
}

function resolveAiSettings(saved, purpose = "creator") {
  const profileKey = purpose === "lead" ? "lead" : "creator";
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
  return { creator: build("creator"), lead: build("lead") };
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
  return JSON.parse(stripJsonFences(text));
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

function buildCreatorEnrichPrompt(sourceUrl, current) {
  return `你是一个达人资源录入助手。请基于公开网页、主页可见信息和搜索结果，尽量从达人主页链接中提取可验证信息；不能确定的文本字段留空，不要猜测。

达人主页链接：${sourceUrl}
当前表单已有信息：${JSON.stringify(current || {}, null, 2)}

只返回 JSON，不要返回解释文字。字段结构如下：
{
  "updates": {
    "name": "", "social_url": "", "email": "", "email_source": "", "email_evidence": "", "country": "", "language": "", "platform": "", "niche": "", "followers": 0, "avg_views": 0, "engagement": 0, "audience": "", "content_types": "", "tags": "", "notes": ""
  },
  "confidence": "low|medium|high",
  "sources": [],
  "warnings": []
}

要求：
1. 邮箱极严：只有当达人主页、about/profile 页面、公开视频简介、官网联系页或搜索结果摘要中明确出现完全相同邮箱时才填写；不能使用历史泄露数据、第三方代码示例、猜测邮箱、同名人物邮箱；查不到就必须留空。
   如果填写 email，必须同时填写 email_source（该邮箱所在公开页面的完整 http(s) URL）和 email_evidence（说明邮箱出现在哪个公开位置，且 evidence 文本里必须包含这个完整邮箱）。没有明确来源证据就把 email、email_source、email_evidence 都留空。
2. 粉丝量、近 30 条平均播放、互动率允许使用公开页面可见数字或搜索结果摘要做大致估算；可返回 81700、1.2M、81.7K、4.5% 等格式。估算时在 warnings 说明“数值为公开可见信息估算”。
3. 受众国家和年龄只能填写国家/地区 + 年龄段，例如 "US 18-34"、"美国 25-44"；不能填写兴趣人群、内容受众标签或职业描述。没有国家和年龄就留空。
4. country 必须积极从频道 About/简介、公开视频描述、官网联系页、公开搜索结果中的所在地、地址、语言或自我介绍识别。识别到 Spain、España、Madrid、Barcelona 或西班牙所在地时返回“西班牙”。没有足够公开依据时留空，不能把内容受众、语言或兴趣标签当作达人所在地。
5. tags 和 content_types 使用 | 分隔。
6. notes 必须使用简体中文，只写 1-2 句对人工复核有帮助、可从公开来源核验的事实摘要。`;
}

function buildLeadEnrichPrompt(sourceUrl, current) {
  return `你是一个快速达人线索整理助手。请基于达人公开主页、公开简介和公开搜索结果，只整理待开发阶段真正需要的核心信息；无法核验的字段必须留空，不能猜测。

达人主页链接：${sourceUrl}
当前已有信息：${JSON.stringify(current || {}, null, 2)}

只返回 JSON，不要返回解释文字。字段结构如下：
{
  "updates": {
    "name": "", "social_url": "", "platform": "", "country": "", "niche": "", "followers": 0, "avg_views": 0, "engagement": 0, "email": "", "email_source": "", "email_evidence": "", "notes": ""
  },
  "confidence": "low|medium|high",
  "sources": [],
  "warnings": []
}

规则：
1. 只提取以上字段。不要补充受众、语言、合作报价、标签、内容形式或任何推测性信息。
2. country 必须依据公开的所在地、地址、频道 About/简介、公开搜索结果或自我介绍识别；例如 Spain、España、Madrid、Barcelona 返回“西班牙”。无法确认时留空。
3. followers、avg_views、engagement 仅在公开可见或公开搜索结果有依据时填写；avg_views 指近 30 条内容的平均播放量，无法得到就留空。估算数字时在 warnings 标明“数值为公开可见信息估算”。
4. 邮箱极严：仅当公开主页、About/简介、官网联系页、公开视频简介或公开搜索结果摘要明确出现同一邮箱时填写。填写 email 时，email_source 必须是该邮箱所在公开页面完整 http(s) URL，email_evidence 必须包含该完整邮箱；否则 email、email_source、email_evidence 全部留空。
5. notes 必须为简体中文，只写 1 句可复核的事实摘要，不包含猜测的联系方式。`;
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
    return sanitizeCreatorEnrich(parseOpenAiJson(response.body), sourceUrl, purpose);
  }

  const endpoint = buildGeminiEndpoint(settings);
  const basePayload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };
  let response = await postJson(endpoint, { ...basePayload, tools: [{ googleSearch: {} }] });
  if (response.statusCode >= 400) response = await postJson(endpoint, basePayload);
  if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`);
  return sanitizeCreatorEnrich(parseGeminiJson(response.body), sourceUrl, purpose);
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
      chunks.push(chunk);
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

module.exports = async (req, res) => {
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

    if (req.method === "POST" && pathname === "/api/import-excel") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!String(body.contentBase64 || "")) throw new Error("缺少 Excel 文件内容");
      json(res, 200, await parseExcel(body.contentBase64));
      return;
    }

    json(res, 404, { ok: false, error: "接口不存在。" });
  } catch (error) {
    json(res, 400, { ok: false, error: formatError(error) });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
