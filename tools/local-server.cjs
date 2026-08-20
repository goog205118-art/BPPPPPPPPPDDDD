const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tls = require("tls");
const url = require("url");
const net = require("net");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const appDir = path.join(rootDir, "app");
const dataDir = path.join(rootDir, "data");
const stateFile = path.join(dataDir, "state.json");
const legacyStorageDir = path.join(dataDir, "storage");
const defaultStorageDir = path.join(os.tmpdir(), "ResourceWorkbench");
const storageDir = path.resolve(process.env.RESOURCE_WORKBENCH_STORAGE_DIR || defaultStorageDir);
const storageStateFile = path.join(storageDir, "state.json");
const dbFile = path.join(storageDir, "resource-workbench.sqlite3");
const aiSettingsFile = path.join(storageDir, "ai-settings.json");
const excelReader = path.join(rootDir, "tools", "excel_to_json.py");
const sqliteBridge = path.join(rootDir, "tools", "sqlite_store.py");
const port = Number(process.env.PORT || 4173);
const pythonEnv = { ...process.env, PYTHONIOENCODING: "utf-8" };
const aiRequestTimeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);
const localProxyPorts = [7890, 7891, 7892, 7893, 7897, 7899, 1080, 10808, 10809, 20171];
const localProxyProbeTimeoutMs = Number(process.env.LOCAL_PROXY_PROBE_TIMEOUT_MS || 350);
const defaultAiProfile = {
  protocol: "gemini",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
  keySource: "local",
  model: "gemini-2.5-flash",
  proxyUrl: "",
};
const aiProfileKeys = ["standard", "advanced", "special"];
const aiFeatureKeys = ["creator", "lead", "product", "outreach"];
const defaultAiSettings = {
  profiles: {
    standard: { ...defaultAiProfile },
    advanced: { ...defaultAiProfile },
    special: { ...defaultAiProfile },
  },
  assignments: {
    creator: "advanced",
    lead: "standard",
    product: "standard",
    outreach: "special",
  },
};

const defaultState = {
  meta: {
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  creators: [],
  resources: [],
  leads: [],
  products: [],
  cooperations: [],
  matches: [],
  importHistory: [],
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

  return { ...defaultState, ...state, creators, resources, leads, products, cooperations, matches, importHistory: Array.isArray(state.importHistory) ? state.importHistory : [] };
}

let pythonCommand;

function resolvePythonCommand() {
  if (pythonCommand) return pythonCommand;

  const candidates = [];
  const configured = String(process.env.PYTHON_EXECUTABLE || process.env.PYTHON || "").trim();
  if (configured) candidates.push({ command: configured, args: [] });
  candidates.push({ command: "python", args: [] }, { command: "py", args: ["-3"] });

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], {
      cwd: rootDir,
      encoding: "utf8",
      env: pythonEnv,
    });
    if (result.status === 0) {
      pythonCommand = candidate;
      return pythonCommand;
    }
  }

  throw new Error("未找到 Python 3。请安装 Python 3，或设置 PYTHON_EXECUTABLE 后重新启动。");
}

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // Older versions stored data beside the project. Copy it once when moving
  // to the user data directory so security software cannot block writes.
  if (path.resolve(storageDir) !== path.resolve(legacyStorageDir)) {
    copyIfMissing(path.join(legacyStorageDir, "resource-workbench.sqlite3"), dbFile);
    copyIfMissing(path.join(legacyStorageDir, "resource-workbench.sqlite3-wal"), `${dbFile}-wal`);
    copyIfMissing(path.join(legacyStorageDir, "resource-workbench.sqlite3-shm"), `${dbFile}-shm`);
    copyIfMissing(path.join(legacyStorageDir, "state.json"), storageStateFile);
    copyIfMissing(path.join(legacyStorageDir, "ai-settings.json"), aiSettingsFile);
  }

  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2), "utf8");
  }
  if (!fs.existsSync(storageStateFile)) {
    fs.copyFileSync(stateFile, storageStateFile);
  }
}

function copyIfMissing(sourcePath, targetPath) {
  if (fs.existsSync(targetPath) || !fs.existsSync(sourcePath)) return;
  try {
    fs.copyFileSync(sourcePath, targetPath);
  } catch (error) {
    console.warn(`无法迁移旧数据文件 ${path.basename(sourcePath)}：${error.message}`);
  }
}

function loadState() {
  ensureDataFile();
  const state = runSqliteBridge("load_state");
  if (state) {
    return normalizeBusinessState(state);
  }
  try {
    return normalizeBusinessState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return defaultState;
  }
}

function saveState(nextState) {
  ensureDataFile();
  const payload = normalizeBusinessState({
    ...nextState,
    meta: {
      ...(nextState?.meta || {}),
      version: 1,
      updatedAt: new Date().toISOString(),
    },
  });
  const bridgeResult = runSqliteBridge("save_state", payload);
  const committedState = bridgeResult ? runSqliteBridge("load_state") || payload : payload;
  try {
    fs.writeFileSync(stateFile, JSON.stringify(committedState, null, 2), "utf8");
  } catch {
    // The project-side JSON mirror is best effort; SQLite remains the source of truth.
  }
}

function runSqliteBridge(command, payload = null) {
  ensureDataFile();
  const python = resolvePythonCommand();
  const input = payload ? JSON.stringify(payload) : "";
  const result = spawnSync(python.command, [...python.args, sqliteBridge, command, dbFile, storageStateFile], {
    cwd: rootDir,
    input,
    encoding: "utf8",
    env: pythonEnv,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0) {
    console.error(String(result.stderr || result.stdout || "SQLite bridge failed").trim());
    return null;
  }

  const text = String(result.stdout || "").trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function send(res, statusCode, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".csv":
      return "text/csv; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) {
    return null;
  }
  return targetPath;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function jsonResponse(res, statusCode, payload) {
  send(res, statusCode, JSON.stringify(payload, null, 2));
}

function normalizeAiProfile(raw = {}, existing = {}) {
  const next = {
    protocol: String(raw.protocol || existing.protocol || defaultAiProfile.protocol).trim().toLowerCase(),
    apiBaseUrl: String(raw.apiBaseUrl || existing.apiBaseUrl || defaultAiProfile.apiBaseUrl).trim().replace(/\/+$/, ""),
    apiKey: String(raw.apiKey ?? "").trim(),
    keySource: String(raw.keySource || existing.keySource || defaultAiProfile.keySource).trim().toLowerCase(),
    model: String(raw.model || existing.model || defaultAiProfile.model).trim(),
    proxyUrl: String(raw.proxyUrl ?? existing.proxyUrl ?? "").trim().replace(/\/+$/, ""),
  };

  if (!["gemini", "openai"].includes(next.protocol)) {
    next.protocol = defaultAiProfile.protocol;
  }
  if (!["local", "environment"].includes(next.keySource)) {
    next.keySource = defaultAiProfile.keySource;
  }
  if (!next.apiBaseUrl) next.apiBaseUrl = defaultAiProfile.apiBaseUrl;
  if (!next.model) next.model = defaultAiProfile.model;
  return next;
}

function normalizeAiSettings(raw = {}, existing = {}) {
  const rawProfiles = raw?.profiles && typeof raw.profiles === "object" ? raw.profiles : {};
  const existingProfiles = existing?.profiles && typeof existing.profiles === "object" ? existing.profiles : {};
  const legacyRaw = Object.keys(rawProfiles).length ? {} : raw;
  const legacyExisting = Object.keys(existingProfiles).length ? {} : existing;
  const pickProfile = (profiles, candidates, fallback) => {
    return candidates.map((key) => profiles[key]).find((profile) => profile && typeof profile === "object") || fallback;
  };
  const assignment = (key) => {
    const selected = String(raw?.assignments?.[key] || existing?.assignments?.[key] || defaultAiSettings.assignments[key]).trim();
    return aiProfileKeys.includes(selected) ? selected : defaultAiSettings.assignments[key];
  };
  return {
    profiles: {
      standard: normalizeAiProfile(
        pickProfile(rawProfiles, ["standard", "lead", "product", "creator"], legacyRaw),
        pickProfile(existingProfiles, ["standard", "lead", "product", "creator"], legacyExisting),
      ),
      advanced: normalizeAiProfile(
        pickProfile(rawProfiles, ["advanced", "creator", "lead"], legacyRaw),
        pickProfile(existingProfiles, ["advanced", "creator", "lead"], legacyExisting),
      ),
      special: normalizeAiProfile(
        pickProfile(rawProfiles, ["special", "outreach", "lead", "creator"], legacyRaw),
        pickProfile(existingProfiles, ["special", "outreach", "lead", "creator"], legacyExisting),
      ),
    },
    assignments: {
      creator: assignment("creator"),
      lead: assignment("lead"),
      product: assignment("product"),
      outreach: assignment("outreach"),
    },
  };
}

function loadAiSettings() {
  ensureDataFile();
  const stored = runSqliteBridge("load_ai_settings");
  if (stored && typeof stored === "object" && Object.keys(stored).length) {
    return normalizeAiSettings(stored);
  }
  try {
    const saved = JSON.parse(fs.readFileSync(aiSettingsFile, "utf8"));
    return normalizeAiSettings(saved);
  } catch {
    return { ...defaultAiSettings };
  }
}

function saveAiSettings(input) {
  ensureDataFile();
  const existing = loadAiSettings();
  const next = normalizeAiSettings(input, existing);
  for (const key of aiProfileKeys) {
    const profile = next.profiles[key];
    const previous = existing.profiles[key] || {};
    if (!profile.apiKey || profile.apiKey === "********") {
      profile.apiKey = previous.apiKey || "";
    }
  }
  const result = runSqliteBridge("save_ai_settings", next);
  if (!result?.ok) {
    throw new Error("无法保存 AI 设置到本地数据库，请确认本地服务有写入权限。");
  }
  return next;
}

function environmentKeyFor(profileKey, purpose = "") {
  const sharedKey =
    profileKey === "standard"
      ? process.env.RESOURCE_WORKBENCH_STANDARD_AI_KEY || process.env.STANDARD_AI_API_KEY
      : profileKey === "advanced"
        ? process.env.RESOURCE_WORKBENCH_ADVANCED_AI_KEY || process.env.ADVANCED_AI_API_KEY
        : process.env.RESOURCE_WORKBENCH_SPECIAL_AI_KEY || process.env.SPECIAL_AI_API_KEY;
  const purposeKey =
    purpose === "lead"
      ? process.env.RESOURCE_WORKBENCH_LEAD_AI_KEY || process.env.LEAD_AI_API_KEY
      : purpose === "product"
        ? process.env.RESOURCE_WORKBENCH_PRODUCT_AI_KEY || process.env.PRODUCT_AI_API_KEY
        : purpose === "outreach"
          ? process.env.RESOURCE_WORKBENCH_OUTREACH_AI_KEY || process.env.OUTREACH_AI_API_KEY
          : purpose === "creator"
            ? process.env.RESOURCE_WORKBENCH_CREATOR_AI_KEY || process.env.CREATOR_AI_API_KEY
            : "";
  const environmentKey =
    sharedKey ||
    purposeKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  return environmentKey;
}

function resolveAiProfile(saved, profileKey, purpose = "") {
  const profile = saved.profiles[profileKey] || defaultAiProfile;
  const environmentKey = environmentKeyFor(profileKey, purpose);
  return {
    ...profile,
    apiKey: profile.keySource === "environment" ? environmentKey : profile.apiKey || environmentKey,
    model: profile.model || process.env.GEMINI_MODEL || defaultAiProfile.model,
    proxyUrl: profile.proxyUrl,
  };
}

function resolveAiSettings(purpose = "creator") {
  const saved = loadAiSettings();
  const featureKey = aiFeatureKeys.includes(purpose) ? purpose : "creator";
  const selectedProfile = saved.assignments?.[featureKey];
  const profileKey = aiProfileKeys.includes(selectedProfile) ? selectedProfile : defaultAiSettings.assignments[featureKey];
  return resolveAiProfile(saved, profileKey, featureKey);
}

function purposeForProfile(saved, profileKey) {
  return aiFeatureKeys.find((key) => saved.assignments?.[key] === profileKey) || "";
}

function publicAiProfile(settings, saved) {
  return {
    protocol: settings.protocol || defaultAiProfile.protocol,
    apiBaseUrl: settings.apiBaseUrl || defaultAiProfile.apiBaseUrl,
    model: settings.model || defaultAiProfile.model,
    proxyUrl: saved.proxyUrl || "",
    hasProxy: Boolean(saved.proxyUrl),
    hasApiKey: Boolean(settings.apiKey),
    keySource: saved.keySource || defaultAiProfile.keySource,
    resolvedKeySource: settings.apiKey && !saved.apiKey ? "环境变量" : settings.apiKey ? "本地设置" : "",
  };
}

function normalizeProxyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function readWindowsSystemProxy() {
  if (process.platform !== "win32") return "";
  const registryKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
  const enabled = spawnSync("reg.exe", ["query", registryKey, "/v", "ProxyEnable"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (enabled.status !== 0 || !/\b0x1\b/i.test(String(enabled.stdout || ""))) return "";

  const server = spawnSync("reg.exe", ["query", registryKey, "/v", "ProxyServer"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (server.status !== 0) return "";
  const match = String(server.stdout || "").match(/ProxyServer\s+REG_\w+\s+(.+)$/im);
  const raw = String(match?.[1] || "").trim();
  if (!raw) return "";

  const protocolEntries = raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("=");
      return separator > 0 ? [entry.slice(0, separator).trim().toLowerCase(), entry.slice(separator + 1).trim()] : ["", entry];
    });
  const preferred = protocolEntries.find(([protocol]) => protocol === "https") || protocolEntries.find(([protocol]) => protocol === "http") || protocolEntries[0];
  return normalizeProxyUrl(preferred?.[1] || "");
}

function isLocalPortOpen(port) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(localProxyProbeTimeoutMs, () => finish(false));
  });
}

async function detectLocalProxy() {
  for (const port of localProxyPorts) {
    if (await isLocalPortOpen(port)) return `http://127.0.0.1:${port}`;
  }
  return "";
}

async function resolveAiNetwork(settings) {
  const manualProxy = normalizeProxyUrl(settings.proxyUrl);
  if (manualProxy) return { proxyUrl: manualProxy, source: "手动设置", automatic: false };

  const environmentProxy = normalizeProxyUrl(
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy || "",
  );
  if (environmentProxy) return { proxyUrl: environmentProxy, source: "环境变量", automatic: true };

  const systemProxy = readWindowsSystemProxy();
  if (systemProxy) return { proxyUrl: systemProxy, source: "Windows 系统代理", automatic: true };

  const localProxy = await detectLocalProxy();
  if (localProxy) return { proxyUrl: localProxy, source: "本地代理服务", automatic: true };
  return { proxyUrl: "", source: "未检测到代理，将直连", automatic: true };
}

async function publicAiStatus() {
  const saved = loadAiSettings();
  const statusFor = async (profileKey) => {
    const settings = resolveAiProfile(saved, profileKey, purposeForProfile(saved, profileKey));
    const network = await resolveAiNetwork(settings);
    return {
      configured: Boolean(settings.apiKey),
      protocol: settings.protocol,
      apiBaseUrl: settings.apiBaseUrl,
      model: settings.model,
      network: {
        mode: network.proxyUrl ? "proxy" : "direct",
        source: network.source,
        automatic: network.automatic,
      },
    };
  };
  return {
    standard: await statusFor("standard"),
    advanced: await statusFor("advanced"),
    special: await statusFor("special"),
  };
}

function publicAiSettings() {
  const saved = loadAiSettings();
  return {
    profiles: {
      standard: publicAiProfile(resolveAiProfile(saved, "standard", purposeForProfile(saved, "standard")), saved.profiles.standard || {}),
      advanced: publicAiProfile(resolveAiProfile(saved, "advanced", purposeForProfile(saved, "advanced")), saved.profiles.advanced || {}),
      special: publicAiProfile(resolveAiProfile(saved, "special", purposeForProfile(saved, "special")), saved.profiles.special || {}),
    },
    assignments: saved.assignments,
  };
}

function withQueryParam(targetUrl, key, value) {
  const parsed = new URL(targetUrl);
  if (!parsed.searchParams.has(key)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

function buildGeminiEndpoint(settings) {
  const model = settings.model || defaultAiProfile.model;
  const apiKey = settings.apiKey;
  const rawUrl = (settings.apiBaseUrl || defaultAiProfile.apiBaseUrl).replace(/\/+$/, "");

  if (/:(generateContent|streamGenerateContent)(\?|$)/.test(rawUrl)) {
    return withQueryParam(rawUrl, "key", apiKey);
  }

  if (/\/models\/[^/]+$/.test(rawUrl)) {
    return withQueryParam(`${rawUrl}:generateContent`, "key", apiKey);
  }

  return withQueryParam(`${rawUrl}/models/${encodeURIComponent(model)}:generateContent`, "key", apiKey);
}

function buildOpenAiEndpoint(settings) {
  const rawUrl = (settings.apiBaseUrl || "").replace(/\/+$/, "");
  if (!rawUrl) throw new Error("OpenAI 兼容接口需要填写 API 地址。");
  return /\/chat\/completions$/i.test(rawUrl) ? rawUrl : `${rawUrl}/chat/completions`;
}

function formatError(error) {
  const nested = Array.isArray(error?.errors)
    ? error.errors.map((item) => item?.message || item?.code || String(item)).filter(Boolean).join("; ")
    : "";
  const message = error?.message || nested || String(error || "");
  const combined = [message, nested].filter(Boolean).join("; ");
  if (/EACCES\s+198\.(18|19)\./i.test(combined)) {
    return "AI API 连接失败：检测到代理虚拟地址，但本地服务没有找到可用代理。请确认 FlClash 已启动并开启系统代理；本程序会自动识别系统代理和常用本地端口，无需手动填写端口。";
  }
  if (/(EACCES|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EHOSTUNREACH|network|fetch failed|connect|超时|timeout)/i.test(combined)) {
    return `AI API 连接失败：${combined || "网络不可达"}。请检查 API 地址、网络/代理/防火墙，或换用当前网络可访问的模型服务。`;
  }
  return message || "AI 请求失败";
}

function postJson(targetUrl, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  const parsed = new URL(targetUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("API 地址必须以 http:// 或 https:// 开头。");
  }
  return postJsonRequest(parsed, body, null, extraHeaders);
}

function responsePayload(response, resolve) {
  let data = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => {
    data += chunk;
  });
  response.on("end", () => {
    let parsedBody = {};
    try {
      parsedBody = JSON.parse(data || "{}");
    } catch {
      parsedBody = { raw: data };
    }
    resolve({ statusCode: response.statusCode || 0, body: parsedBody });
  });
}

function proxyHeaders(proxy) {
  if (!proxy.username && !proxy.password) return {};
  const credentials = `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`;
  return { "Proxy-Authorization": `Basic ${Buffer.from(credentials).toString("base64")}` };
}

function postJsonRequest(parsed, body, socket = null, extraHeaders = {}) {
  const transport = parsed.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        method: "POST",
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body),
          ...extraHeaders,
        },
        agent: socket ? false : undefined,
        createConnection: socket ? () => socket : undefined,
      },
      (response) => responsePayload(response, resolve),
    );

    request.on("error", reject);
    request.setTimeout(aiRequestTimeoutMs, () => {
      request.destroy(new Error(`AI API 请求超时（${Math.round(aiRequestTimeoutMs / 1000)} 秒）`));
    });
    request.write(body);
    request.end();
  });
}

function postJsonViaProxy(targetUrl, payload, proxyUrl, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  const target = new URL(targetUrl);
  const proxy = new URL(proxyUrl);
  if (!["http:", "https:"].includes(proxy.protocol)) {
    throw new Error("代理地址必须以 http:// 或 https:// 开头。");
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("API 地址必须以 http:// 或 https:// 开头。");
  }

  if (target.protocol === "http:") {
    const proxyTransport = proxy.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
      const request = proxyTransport.request(
        {
          method: "POST",
          hostname: proxy.hostname,
          port: proxy.port || (proxy.protocol === "https:" ? 443 : 80),
          path: target.toString(),
          headers: {
            Host: target.host,
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(body),
            ...proxyHeaders(proxy),
            ...extraHeaders,
          },
        },
        (response) => responsePayload(response, resolve),
      );
      request.on("error", reject);
      request.setTimeout(aiRequestTimeoutMs, () => {
        request.destroy(new Error(`AI API 请求超时（${Math.round(aiRequestTimeoutMs / 1000)} 秒）`));
      });
      request.write(body);
      request.end();
    });
  }

  const proxyTransport = proxy.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const connectRequest = proxyTransport.request({
      method: "CONNECT",
      hostname: proxy.hostname,
      port: proxy.port || (proxy.protocol === "https:" ? 443 : 80),
      path: `${target.hostname}:${target.port || 443}`,
      headers: {
        Host: `${target.hostname}:${target.port || 443}`,
        ...proxyHeaders(proxy),
      },
    });

    connectRequest.once("connect", (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`代理连接失败：HTTP ${response.statusCode || 0}`));
        return;
      }
      if (head?.length) socket.unshift(head);

      const secureSocket = tls.connect({
        socket,
        servername: target.hostname,
      });
      secureSocket.once("secureConnect", () => {
        postJsonRequest(target, body, secureSocket, extraHeaders).then(resolve, reject);
      });
      secureSocket.once("error", reject);
    });
    connectRequest.once("error", reject);
    connectRequest.setTimeout(aiRequestTimeoutMs, () => {
      connectRequest.destroy(new Error(`代理连接超时（${Math.round(aiRequestTimeoutMs / 1000)} 秒）`));
    });
    connectRequest.end();
  });
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

  if (key === "engagement") return Math.round(number * 10) / 10;
  return Math.round(number);
}

function isLikelyPublicEmail(value) {
  const email = String(value || "").trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/(example|test|unknown|none|n\/a)/i.test(email);
}

function isPublicSourceUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function hasReliableEmailEvidence(raw, rawUpdates, email) {
  const emailSource = String(rawUpdates?.email_source || raw?.email_source || "").trim();
  const evidence = String(rawUpdates?.email_evidence || raw?.email_evidence || "").trim();
  if (!isPublicSourceUrl(emailSource) || !evidence) return false;
  if (!evidence.toLowerCase().includes(String(email || "").trim().toLowerCase())) return false;
  return !/(historical|dump|leak|sample|example|stackoverflow|stack overflow|json|api|猜测|推测|泄露|示例|历史)/i.test(evidence);
}

function isSimplifiedChineseNote(value) {
  const note = String(value || "").trim();
  const chineseCount = (note.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (note.match(/[a-z]/gi) || []).length;
  return chineseCount >= 2 && chineseCount >= latinCount;
}

function isCountryAgeAudience(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const hasAge = /\b(1[3-9]|[2-6]\d)(\s*[-~至到]\s*(1[3-9]|[2-7]\d))?\b|age|ages|年龄|岁/i.test(text);
  const hasCountry =
    /\b(us|usa|u\.s\.|united states|uk|u\.k\.|canada|australia|germany|france|japan|korea|europe|global)\b|美国|英国|加拿大|澳大利亚|德国|法国|日本|韩国|欧洲|全球|东南亚/i.test(text);
  return hasAge && hasCountry;
}

function normalizeAiValue(value, key) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join("|");
  if (typeof value === "object") return JSON.stringify(value);
  if (["followers", "avg_views", "engagement"].includes(key)) {
    return parseMetricNumber(value, key);
  }
  return String(value).trim();
}

function sanitizeCreatorEnrich(raw, sourceUrl, purpose = "creator") {
  const allowed =
    purpose === "lead"
      ? ["name", "social_url", "country", "platform", "niche", "followers", "avg_views", "engagement", "notes"]
      : [
          "name",
          "social_url",
          "country",
          "language",
          "platform",
          "niche",
          "followers",
          "avg_views",
          "engagement",
          "audience",
          "content_types",
          "tags",
          "notes",
        ];
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
    "name": "",
    "social_url": "",
    "email": "",
    "email_source": "",
    "email_evidence": "",
    "country": "",
    "language": "",
    "platform": "",
    "niche": "",
    "followers": "",
    "avg_views": "",
    "engagement": "",
    "audience": "",
    "content_types": "",
    "tags": "",
    "notes": ""
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
    "name": "",
    "social_url": "",
    "platform": "",
    "country": "",
    "niche": "",
    "followers": "",
    "avg_views": "",
    "engagement": "",
    "email": "",
    "email_source": "",
    "email_evidence": "",
    "notes": ""
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
  const settings = resolveAiSettings(purpose);
  const apiKey = settings.apiKey;
  if (!apiKey) {
    throw new Error("未配置 AI API Key。请先在设置页保存 API Key。");
  }

  const prompt = purpose === "lead" ? buildLeadEnrichPrompt(sourceUrl, current) : buildCreatorEnrichPrompt(sourceUrl, current);
  const network = await resolveAiNetwork(settings);
  const post = (endpoint, payload, headers = {}) => (network.proxyUrl ? postJsonViaProxy(endpoint, payload, network.proxyUrl, headers) : postJson(endpoint, payload, headers));
  if (settings.protocol === "openai") {
    const endpoint = buildOpenAiEndpoint(settings);
    const payload = {
      model: settings.model,
      messages: [
        { role: "system", content: "你是严谨的达人资料录入助手。必须只输出有效 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    };
    const headers = { Authorization: `Bearer ${apiKey}` };
    const response = await post(endpoint, payload, headers);
    if (response.statusCode >= 400) {
      const message = response.body?.error?.message || response.body?.raw || `OpenAI 兼容接口请求失败：HTTP ${response.statusCode}`;
      throw new Error(message);
    }
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
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const requestPayload = {
    ...basePayload,
    tools: [{ googleSearch: {} }],
  };
  let response = await post(endpoint, requestPayload);

  if (response.statusCode >= 400) {
    response = await post(endpoint, basePayload);
  }

  if (response.statusCode >= 400) {
    const message = response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`;
    throw new Error(message);
  }

  const primary = sanitizeCreatorEnrich(parseGeminiJson(response.body), sourceUrl, purpose);
  const missingFields = ["followers", "email"].filter((key) => !String(primary.updates[key] || "").trim());
  if (!missingFields.length) return primary;

  const recoveryResponse = await post(endpoint, {
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
  const settings = resolveAiSettings("product");
  if (!settings.apiKey) throw new Error("未配置产品链接 AI 补全。");
  const prompt = buildProductEnrichPrompt(productUrl, current);
  const network = await resolveAiNetwork(settings);
  const post = (endpoint, payload, headers = {}) => (network.proxyUrl ? postJsonViaProxy(endpoint, payload, network.proxyUrl, headers) : postJson(endpoint, payload, headers));

  if (settings.protocol === "openai") {
    const response = await post(
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
  let response = await post(endpoint, { ...basePayload, tools: [{ googleSearch: {} }] });
  if (response.statusCode >= 400) response = await post(endpoint, basePayload);
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
  const includeProductLinks = Boolean(rules?.includeProductLinks);
  const targetWordLimit = Math.min(520, Math.max(190, 125 + products.length * 42));
  const productChecklist = products
    .map((product, index) => {
      const item = outreachProductPayload(product);
      return `${index + 1}. id=${item.id || "未提供"}；名称=${item.name || "未提供"}；链接=${item.product_url || "未提供"}`;
    })
    .join("\n");
  return `你是跨境品牌的达人合作开发专家。请只基于输入中给出的达人资料、产品资料和本次规则，为每位达人写一封自然、不模板化的英文开发邮件。

达人资料：
${JSON.stringify(leads.map(outreachLeadPayload), null, 2)}

本次可推荐产品：
${JSON.stringify(products.map(outreachProductPayload), null, 2)}

本次规则：
${JSON.stringify(rules || {}, null, 2)}

本次用户实际勾选了 ${products.length} 个产品。以下是必须完整写入每封邮件的产品清单：
${productChecklist}

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
3. 本次勾选的 ${products.length} 个产品必须全部在每封正文中出现，不能只挑其中 1-2 个代表产品，不能用“以及其他产品”替代。每个产品至少准确写出输入中的产品名称一次；若产品卖点为空，不要发明材料、功能、兼容型号或性能。
4. 合作方式要综合 followers、avg_views、engagement 判断：长尾或数据较小优先产品置换或置换 + CPS；中量级可建议置换 + CPS / 小预算可谈；头部或高播放可建议付费合作或先询价；数据不足时建议先询问合作偏好。必须尊重本次用户勾选的合作方式；不要承诺价格。
5. ${includeProductLinks ? "必须把每个已选产品提供的 product_url 原样写入正文各一次。" : "规则未要求附产品链接，正文中不要出现 URL。"} 若规则中不提及合作方式，则不要在正文写明合作模式，但仍填写 recommended_cooperation 供内部参考。
6. 邮件控制在 110-${targetWordLimit} 英文词，产品较多时优先用紧凑的产品清单或自然分句确保全部覆盖；语气遵循用户选择；不同达人使用不同的开场和产品匹配角度，避免完全相同的话术。
7. email 字段只是寄送地址提示，不可写入邮件正文，也不可声称其来源。`;
}

function insertBeforeEmailSignoff(body, addition) {
  const normalized = String(body || "").trim();
  const signoff = normalized.match(/(?:^|\n)\s*(?:best|kind|warm) regards,?[\s\S]*$/i);
  if (!signoff || signoff.index === undefined) return `${normalized}\n\n${addition}`.trim();
  const before = normalized.slice(0, signoff.index).trimEnd();
  const closing = normalized.slice(signoff.index).trimStart();
  return `${before}\n\n${addition}\n\n${closing}`.trim();
}

function completeSelectedProductsInDraft(body, products, rules) {
  const currentBody = String(body || "").trim();
  const includeProductLinks = Boolean(rules?.includeProductLinks);
  const missing = products.filter((product) => {
    const name = String(product?.name || "").trim();
    const url = String(product?.product_url || "").trim();
    const includesName = !name || currentBody.toLowerCase().includes(name.toLowerCase());
    const includesUrl = !includeProductLinks || !url || currentBody.includes(url);
    return !includesName || !includesUrl;
  });
  if (!missing.length) return { body: currentBody, appendedCount: 0 };

  const lines = missing.map((product) => {
    const name = String(product?.name || product?.product_url || "Selected product").trim();
    const url = String(product?.product_url || "").trim();
    return includeProductLinks && url ? `- ${name}: ${url}` : `- ${name}`;
  });
  const heading = includeProductLinks
    ? "For easy reference, here is the full selected product list:"
    : "For this collaboration, the full selected product selection includes:";
  return {
    body: insertBeforeEmailSignoff(currentBody, `${heading}\n${lines.join("\n")}`),
    appendedCount: missing.length,
  };
}

function sanitizeOutreachDrafts(raw, leads, products, rules) {
  const allowedIds = new Set(leads.map((lead) => String(lead.id || "").trim()).filter(Boolean));
  const draftsById = new Map();
  const completionWarnings = [];
  for (const draft of Array.isArray(raw?.drafts) ? raw.drafts : []) {
    const leadId = String(draft?.lead_id || "").trim();
    if (!allowedIds.has(leadId) || draftsById.has(leadId)) continue;
    const subject = String(draft?.subject || "").trim().slice(0, 220);
    const body = String(draft?.body || "").trim().slice(0, 5000);
    if (!subject || !body) continue;
    const completed = completeSelectedProductsInDraft(body, products, rules);
    if (completed.appendedCount) completionWarnings.push(`AI 漏写了 ${completed.appendedCount} 个已选产品，系统已在邮件落款前补全。`);
    draftsById.set(leadId, {
      lead_id: leadId,
      subject,
      body: completed.body.slice(0, 7000),
      recommended_cooperation: String(draft?.recommended_cooperation || "请人工确认合作方式").trim().slice(0, 180),
      reason: String(draft?.reason || "").trim().slice(0, 360),
    });
  }
  return {
    ok: true,
    drafts: leads.map((lead) => draftsById.get(String(lead.id || "").trim())).filter(Boolean),
    warnings: [...new Set([...(Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim()).filter(Boolean) : []), ...completionWarnings])].slice(0, 8),
  };
}

async function generateOutreachWithAi(leads, products, rules) {
  if (!Array.isArray(leads) || !leads.length) throw new Error("请至少选择一位待开发达人。");
  if (!Array.isArray(products) || !products.length) throw new Error("请至少选择一个产品。");
  const settings = resolveAiSettings("outreach");
  if (!settings.apiKey) throw new Error("未配置开发邮件 AI API Key。请先在设置页填写“达人开发邮件”参数。");
  const prompt = buildOutreachPrompt(leads, products, rules);
  const network = await resolveAiNetwork(settings);
  const post = (endpoint, payload, headers = {}) => (network.proxyUrl ? postJsonViaProxy(endpoint, payload, network.proxyUrl, headers) : postJson(endpoint, payload, headers));

  if (settings.protocol === "openai") {
    const response = await post(
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
    return sanitizeOutreachDrafts(parseOpenAiJson(response.body), leads, products, rules);
  }

  const response = await post(buildGeminiEndpoint(settings), {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.72, responseMimeType: "application/json" },
  });
  if (response.statusCode >= 400) throw new Error(response.body?.error?.message || response.body?.raw || `Gemini API 请求失败：HTTP ${response.statusCode}`);
  return sanitizeOutreachDrafts(parseGeminiJson(response.body), leads, products, rules);
}

function isSafePublicUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1") return false;
  if (/^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
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
  const pattern = new RegExp(`<meta[^>]*${attribute}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>|<meta[^>]*content\\s*=\\s*["']([^"']+)["'][^>]*${attribute}\\s*=\\s*["']${key}["'][^>]*>`, "i");
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

function decodePageHtml(buffer, encoding) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const normalized = String(encoding || "").toLowerCase();
  if (normalized.includes("br")) return zlib.brotliDecompressSync(source).toString("utf8");
  if (normalized.includes("gzip")) return zlib.gunzipSync(source).toString("utf8");
  if (normalized.includes("deflate")) return zlib.inflateSync(source).toString("utf8");
  return source.toString("utf8");
}

function getPagePreview(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === "https:" ? https : require("http");
    const request = transport.get(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirected = new URL(response.headers.location, targetUrl).toString();
          response.resume();
          if (!isSafePublicUrl(redirected)) return reject(new Error("跳转后的产品链接不安全，无法读取。"));
          return resolve(getPagePreview(redirected));
        }
        if ((response.statusCode || 0) >= 400) {
          response.resume();
          return reject(new Error(`产品页面无法读取（HTTP ${response.statusCode}）。`));
        }
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          if (size > 2 * 1024 * 1024) request.destroy(new Error("产品页面内容过大。"));
        });
        response.on("end", () => {
          try {
            resolve({ html: decodePageHtml(Buffer.concat(chunks), response.headers["content-encoding"]), finalUrl: targetUrl });
          } catch {
            reject(new Error("产品页面内容无法解析。"));
          }
        });
      },
    );
    request.setTimeout(10000, () => request.destroy(new Error("读取产品页面超时。")));
    request.on("error", reject);
  });
}

async function previewProductFromUrl(productUrl) {
  if (!isSafePublicUrl(productUrl)) throw new Error("产品链接必须是可公开访问的 http(s) 地址，且不能是本机或内网地址。");
  const result = { name: "", image_url: "", description: "" };
  const webFields = [];
  const aiFields = [];
  const warnings = [];
  const sources = [];

  try {
    const { html, finalUrl } = await getPagePreview(productUrl);
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
    const settings = resolveAiSettings("product");
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
  if (/EACCES|ENETUNREACH|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|超时/i.test(message)) {
    return "当前网络无法连接该商品站点，请稍后重试；也可以先手动填写产品名称、主图和卖点。";
  }
  if (/HTTP (401|403|429)/i.test(message)) {
    return "该商品站点限制自动读取，请手动填写产品资料，或改用品牌官网的商品页。";
  }
  return message || "读取产品信息失败";
}

function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/ai/settings") {
    jsonResponse(res, 200, {
      ok: true,
      ...publicAiSettings(),
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/ai/settings") {
    readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body || "{}");
        saveAiSettings(parsed);
        jsonResponse(res, 200, {
          ok: true,
          settings: publicAiSettings(),
        });
      })
      .catch((error) => {
        jsonResponse(res, 400, { ok: false, error: error.message || "AI 设置保存失败" });
      });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/ai/status") {
    publicAiStatus()
      .then((profiles) => jsonResponse(res, 200, { ok: true, profiles }))
      .catch((error) => jsonResponse(res, 400, { ok: false, error: formatError(error) }));
    return true;
  }

  if (req.method === "POST" && pathname === "/api/ai/creator-enrich") {
    readBody(req)
      .then(async (body) => {
        const parsed = JSON.parse(body || "{}");
        const sourceUrl = String(parsed.url || "").trim();
        if (!sourceUrl) throw new Error("缺少达人主页链接");
        const purpose = parsed.purpose === "lead" ? "lead" : "creator";
        const payload = await enrichCreatorWithAi(sourceUrl, parsed.current || {}, purpose);
        jsonResponse(res, 200, payload);
      })
      .catch((error) => {
        jsonResponse(res, 400, { ok: false, error: formatError(error) });
      });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/ai/outreach-generate") {
    readBody(req)
      .then(async (body) => {
        const parsed = JSON.parse(body || "{}");
        const payload = await generateOutreachWithAi(parsed.leads || [], parsed.products || [], parsed.rules || {});
        jsonResponse(res, 200, payload);
      })
      .catch((error) => {
        jsonResponse(res, 400, { ok: false, error: formatError(error) });
      });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/products/preview") {
    readBody(req)
      .then(async (body) => {
        const parsed = JSON.parse(body || "{}");
        jsonResponse(res, 200, await previewProductFromUrl(String(parsed.url || "").trim()));
      })
      .catch((error) => {
        jsonResponse(res, 400, { ok: false, error: formatProductPreviewError(error) });
      });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    const state = loadState();
    send(res, 200, JSON.stringify(state, null, 2));
    return true;
  }

  if (req.method === "GET" && pathname === "/api/db-info") {
    const state = loadState();
    send(
      res,
      200,
      JSON.stringify(
        {
          backend: fs.existsSync(dbFile) ? "sqlite" : "json",
          storageDir,
          dbFile,
          mirrorFile: storageStateFile,
          counts: {
            creators: state.creators.length,
            resources: state.resources.length,
            leads: Array.isArray(state.leads) ? state.leads.length : 0,
            products: Array.isArray(state.products) ? state.products.length : 0,
            cooperations: state.cooperations.length,
            matches: Array.isArray(state.matches) ? state.matches.length : 0,
            importHistory: Array.isArray(state.importHistory) ? state.importHistory.length : 0,
          },
          meta: state.meta,
        },
        null,
        2,
      ),
    );
    return true;
  }

  if (req.method === "POST" && pathname === "/api/state") {
    readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body || "{}");
        saveState(parsed);
        send(res, 200, JSON.stringify({ ok: true }));
      })
      .catch((error) => {
        send(res, 400, JSON.stringify({ ok: false, error: error.message }));
      });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/import-excel") {
    readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body || "{}");
        const contentBase64 = String(parsed.contentBase64 || "");
        const filename = String(parsed.filename || "upload.xlsx").replace(/[^\w.-]/g, "_");
        if (!contentBase64) {
          throw new Error("Missing Excel content");
        }

        ensureDataFile();
        const tempFile = path.join(storageDir, `import-${Date.now()}-${filename}`);
        fs.writeFileSync(tempFile, Buffer.from(contentBase64, "base64"));

        const python = resolvePythonCommand();
        const result = spawnSync(python.command, [...python.args, excelReader, tempFile], {
          cwd: rootDir,
          encoding: "utf8",
          env: pythonEnv,
          maxBuffer: 20 * 1024 * 1024,
        });

        try {
          fs.unlinkSync(tempFile);
        } catch {
          // Temporary file cleanup is best effort.
        }

        if (result.status !== 0) {
          throw new Error(result.stderr || result.stdout || "Excel parse failed");
        }

        send(res, 200, result.stdout || "[]");
      })
      .catch((error) => {
        send(res, 400, JSON.stringify({ ok: false, error: error.message }));
      });
    return true;
  }

  if (req.method === "GET" && pathname.startsWith("/api/export/")) {
    const key = pathname.replace("/api/export/", "").replace(/\.csv$/, "");
    const state = loadState();
    const rows = Array.isArray(state[key]) ? state[key] : [];
    const csv = exportCsv(rows);
    send(res, 200, csv, "text/csv; charset=utf-8");
    return true;
  }

  return false;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportCsv(rows) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\n");
}

function serveStatic(req, res, pathname) {
  const routeMap = {
    "/": path.join(appDir, "index.html"),
    "/index.html": path.join(appDir, "index.html"),
    "/styles.css": path.join(appDir, "styles.css"),
    "/app.js": path.join(appDir, "app.js"),
  };

  const filePath = routeMap[pathname];
  if (!filePath) {
    return false;
  }

  if (!fs.existsSync(filePath)) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return true;
  }

  const content = fs.readFileSync(filePath);
  send(res, 200, content, getMime(filePath));
  return true;
}

ensureDataFile();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || "", true);
  const pathname = decodeURIComponent(parsedUrl.pathname || "/");

  if (handleApi(req, res, pathname)) {
    return;
  }

  if (serveStatic(req, res, pathname)) {
    return;
  }

  send(res, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(port, () => {
  console.log(`Resource Workbench running at http://localhost:${port}`);
});
