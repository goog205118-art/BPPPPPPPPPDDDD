const STORAGE_FALLBACK = "resource-workbench-fallback";
const STORAGE_DUPLICATE_IGNORES = "resource-workbench-duplicate-ignores";
const API_STATE = "/api/state";
const API_IMPORT_EXCEL = "/api/import-excel";
const API_CREATOR_ENRICH = "/api/ai/creator-enrich";
const API_AI_SETTINGS = "/api/ai/settings";
const API_AI_STATUS = "/api/ai/status";
const STORAGE_ACCESS_PASSWORD = "resource-workbench-access-password";
const SETTINGS_TAB = { key: "settings", title: "设置" };
const MATCHING_TAB = { key: "matches", title: "本周资源匹配" };
const defaultAiProfile = {
  protocol: "gemini",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
  keySource: "local",
  model: "gemini-2.5-flash",
  proxyUrl: "",
  hasProxy: false,
  hasApiKey: false,
};
const defaultAiSettings = {
  profiles: {
    creator: { ...defaultAiProfile },
    lead: { ...defaultAiProfile },
  },
};

const yesNoOptions = ["否", "是"];

const entityConfig = {
  creators: {
    title: "达人库",
    formTitle: "新增达人",
    hint: "沉淀达人画像、平台数据、合作状态和内容适配标签。",
    prefix: "CR",
    columns: [
      ["name", "达人名称"],
      ["brand", "品牌"],
      ["platform", "平台"],
      ["social_url", "社媒地址"],
      ["email", "达人邮箱"],
      ["country", "国家/地区"],
      ["niche", "内容垂类"],
      ["followers", "粉丝"],
      ["status", "状态"],
      ["tags", "标签"],
    ],
    filters: [
      { key: "brand", label: "品牌", options: ["全部"], dynamic: true },
      { key: "country", label: "国家", options: ["全部"], dynamic: true },
    ],
    fields: [
      { key: "brand", label: "所属品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "name", label: "达人名称", type: "text", required: true },
      { key: "social_url", label: "社媒地址", type: "text", placeholder: "主页链接 / 达人链接" },
      { key: "email", label: "达人邮箱", type: "text", placeholder: "公开邮箱或人工补充" },
      { key: "email_source", label: "邮箱公开来源", type: "text", placeholder: "公开页面链接；AI 补全时自动记录" },
      { key: "country", label: "国家和地区", type: "text" },
      { key: "language", label: "语言", type: "text" },
      { key: "platform", label: "平台", type: "text" },
      { key: "niche", label: "内容垂类", type: "text" },
      { key: "followers", label: "粉丝量", type: "number" },
      { key: "avg_views", label: "近 30 条平均播放", type: "number" },
      { key: "engagement", label: "互动率 (%)", type: "number", step: "0.1" },
      { key: "audience", label: "受众国家和年龄", type: "text" },
      { key: "competitor", label: "是否做过竞品", type: "select", options: yesNoOptions },
      { key: "exchange", label: "是否接受产品置换", type: "select", options: yesNoOptions },
      { key: "cps", label: "是否接受 CPS / 佣金", type: "select", options: yesNoOptions },
      { key: "price", label: "报价", type: "text" },
      { key: "status", label: "合作状态", type: "select", options: ["待联系", "沟通中", "已合作", "沉淀"] },
      { key: "longterm", label: "是否愿意长期合作", type: "select", options: yesNoOptions },
      { key: "content_types", label: "可提供内容类型", type: "text" },
      { key: "ad_auth", label: "是否允许广告授权二次使用", type: "select", options: ["否", "可谈", "是"] },
      { key: "tags", label: "标签", type: "text", placeholder: "用 | 分隔" },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      name: ["达人名称", "达人", "名称", "账号名", "博主", "KOL", "creator", "name"],
      social_url: ["社媒地址", "达人链接", "主页链接", "账号链接", "链接", "profile", "url", "social_url", "homepage"],
      email: ["达人邮箱", "邮箱", "邮件", "email", "e-mail", "mail"],
      email_source: ["邮箱公开来源", "邮箱来源", "邮箱出处", "email_source", "email source"],
      country: ["国家和地区", "国家", "地区", "覆盖国家", "country"],
      language: ["语言", "语种", "language"],
      platform: ["平台", "渠道", "platform"],
      niche: ["内容垂类", "领域", "品类", "niche"],
      followers: ["粉丝量", "粉丝", "followers"],
      avg_views: ["近30条平均播放", "平均播放", "均播", "avg_views"],
      engagement: ["互动率", "互动率(%)", "engagement"],
      audience: ["受众国家和年龄", "受众", "用户画像", "audience"],
      competitor: ["是否做过竞品", "竞品", "competitor"],
      exchange: ["是否接受产品置换", "产品置换", "置换", "exchange"],
      cps: ["是否接受CPS/佣金", "CPS", "佣金", "cps"],
      price: ["报价", "价格", "price"],
      status: ["合作状态", "状态", "status"],
      longterm: ["是否愿意长期合作", "长期合作", "longterm"],
      content_types: ["可提供内容类型", "内容类型", "content_types"],
      ad_auth: ["广告授权", "二次使用", "ad_auth"],
      tags: ["标签", "场景", "内容场景", "tags"],
      notes: ["备注", "说明", "notes"],
    },
  },
  resources: {
    title: "资源库",
    formTitle: "新增资源",
    hint: "沉淀 Deal 站、社群、联盟、媒体等可复用资源。",
    prefix: "RS",
    columns: [
      ["name", "资源名称"],
      ["brand", "品牌"],
      ["type", "类型"],
      ["country", "国家"],
      ["categories", "品类"],
      ["grade", "等级"],
      ["historical_orders", "历史订单"],
      ["cycle", "上线周期"],
      ["contact", "联系"],
    ],
    filters: [
      { key: "brand", label: "品牌", options: ["全部"], dynamic: true },
      { key: "country", label: "国家", options: ["全部"], dynamic: true },
    ],
    fields: [
      { key: "brand", label: "所属品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "name", label: "资源名称", type: "text", required: true },
      { key: "type", label: "资源类型", type: "select", options: ["Deal站", "社群", "联盟", "媒体", "其他"] },
      { key: "country", label: "覆盖国家", type: "text" },
      { key: "categories", label: "覆盖品类", type: "text" },
      { key: "users", label: "用户类型", type: "text" },
      { key: "fee", label: "是否收费", type: "select", options: yesNoOptions },
      { key: "fee_amount", label: "参考收费", type: "number" },
      { key: "exclusivity", label: "是否要求独家", type: "select", options: yesNoOptions },
      { key: "coupon", label: "是否接受优惠券", type: "select", options: yesNoOptions },
      { key: "cycle", label: "平均上线周期", type: "text" },
      { key: "historical_clicks", label: "历史点击", type: "number" },
      { key: "historical_orders", label: "历史订单", type: "number" },
      { key: "suitable_new", label: "是否适合新品", type: "select", options: yesNoOptions },
      { key: "suitable_clearance", label: "是否适合清库存", type: "select", options: yesNoOptions },
      { key: "grade", label: "分级", type: "select", options: ["A", "B", "C", "D"] },
      { key: "contact", label: "联系人和沟通记录", type: "text" },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      name: ["资源名称", "名称", "站点", "社群", "联盟", "name"],
      type: ["资源类型", "类型", "渠道类型", "type"],
      country: ["覆盖国家", "国家", "地区", "country"],
      categories: ["覆盖品类", "品类", "类目", "categories"],
      users: ["用户类型", "用户", "人群", "users"],
      fee: ["是否收费", "收费", "fee"],
      fee_amount: ["参考收费", "收费金额", "报价", "fee_amount"],
      exclusivity: ["是否要求独家", "独家", "exclusivity"],
      coupon: ["是否接受优惠券", "优惠券", "coupon"],
      cycle: ["平均上线周期", "上线周期", "周期", "cycle"],
      historical_clicks: ["历史点击", "点击", "historical_clicks"],
      historical_orders: ["历史订单", "订单", "historical_orders"],
      suitable_new: ["是否适合新品", "适合新品", "新品", "suitable_new"],
      suitable_clearance: ["是否适合清库存", "适合清库存", "清库存", "suitable_clearance"],
      grade: ["分级", "等级", "grade"],
      contact: ["联系人", "联系方式", "沟通记录", "contact"],
      notes: ["备注", "说明", "notes"],
    },
  },
  leads: {
    title: "待开发达人",
    formTitle: "快速录入达人",
    hint: "只需粘贴达人链接，AI 自动整理可验证的核心信息；确认后再转入达人库。",
    prefix: "LD",
    columns: [
      ["name", "达人名称"],
      ["brand", "品牌"],
      ["platform", "平台"],
      ["social_url", "社媒地址"],
      ["country", "国家/地区"],
      ["niche", "内容垂类"],
      ["followers", "粉丝"],
      ["status", "开发状态"],
    ],
    filters: [
      { key: "brand", label: "品牌", options: ["全部"], dynamic: true },
      { key: "platform", label: "平台", options: ["全部"], dynamic: true },
      { key: "email", label: "邮箱", options: ["全部", "有邮箱", "无邮箱"], mode: "email" },
    ],
    fields: [
      { key: "brand", label: "所属品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "social_url", label: "社媒地址", type: "text", required: true, placeholder: "粘贴主页链接后自动检索" },
      { key: "name", label: "达人名称", type: "text" },
      { key: "platform", label: "平台", type: "text" },
      { key: "country", label: "国家和地区", type: "text" },
      { key: "niche", label: "内容垂类", type: "text" },
      { key: "followers", label: "粉丝量", type: "number" },
      { key: "avg_views", label: "近 30 条平均播放", type: "number" },
      { key: "engagement", label: "互动率 (%)", type: "number", step: "0.1" },
      { key: "email", label: "达人邮箱", type: "text", placeholder: "仅保留可验证公开邮箱" },
      { key: "email_source", label: "邮箱公开来源", type: "text", placeholder: "公开页面链接" },
      { key: "status", label: "开发状态", type: "select", options: ["待开发", "已联系", "已转达人库", "不适合"] },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      social_url: ["社媒地址", "达人链接", "主页链接", "账号链接", "链接", "profile", "url", "social_url", "homepage"],
      name: ["达人名称", "达人", "名称", "账号名", "博主", "KOL", "creator", "name"],
      platform: ["平台", "渠道", "platform"],
      country: ["国家和地区", "国家", "地区", "country"],
      niche: ["内容垂类", "领域", "品类", "niche"],
      followers: ["粉丝量", "粉丝", "followers"],
      avg_views: ["近30条平均播放", "平均播放", "均播", "avg_views"],
      engagement: ["互动率", "互动率(%)", "engagement"],
      email: ["达人邮箱", "邮箱", "邮件", "email", "e-mail", "mail"],
      email_source: ["邮箱公开来源", "邮箱来源", "邮箱出处", "email_source", "email source"],
      status: ["开发状态", "状态", "status"],
      notes: ["备注", "说明", "notes"],
    },
  },
  cooperations: {
    title: "合作记录",
    formTitle: "新增合作",
    hint: "记录单次合作、复盘结论和下一次动作。",
    prefix: "CO",
    columns: [
      ["creator_name", "达人"],
      ["resource_name", "资源"],
      ["product", "产品"],
      ["model", "合作方式"],
      ["orders", "订单"],
      ["result", "结论"],
      ["post_date", "发布时间"],
    ],
    filters: [
      { key: "model", label: "合作方式", options: ["全部", "置换", "付费", "CPS", "混合"] },
      { key: "result", label: "结果", options: ["全部", "表现稳定，可复投", "一般", "效果差", "待观察"] },
    ],
    fields: [
      { key: "creator_id", label: "关联达人", type: "reference", reference: "creators" },
      { key: "resource_id", label: "关联资源", type: "reference", reference: "resources" },
      { key: "match_id", label: "关联匹配任务", type: "reference", reference: "matches" },
      { key: "creator_name", label: "达人名称", type: "text", required: true },
      { key: "resource_name", label: "资源名称", type: "text" },
      { key: "product", label: "合作产品", type: "text" },
      { key: "model", label: "合作方式", type: "select", options: ["置换", "付费", "CPS", "混合"] },
      { key: "budget", label: "预算 / 成本", type: "number" },
      { key: "post_date", label: "发布时间", type: "date" },
      { key: "link", label: "内容链接", type: "text" },
      { key: "clicks", label: "点击", type: "number" },
      { key: "orders", label: "订单", type: "number" },
      { key: "result", label: "复盘结论", type: "text" },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      creator_id: ["达人ID", "达人 id", "creator_id"],
      resource_id: ["资源ID", "资源 id", "resource_id"],
      match_id: ["匹配任务ID", "任务ID", "match_id"],
      creator_name: ["达人名称", "达人", "creator_name"],
      resource_name: ["资源名称", "资源", "resource_name"],
      product: ["合作产品", "产品", "product"],
      model: ["合作方式", "合作形式", "model"],
      budget: ["预算", "成本", "预算 / 成本", "budget"],
      post_date: ["发布时间", "日期", "post_date"],
      link: ["内容链接", "链接", "link"],
      clicks: ["点击", "clicks"],
      orders: ["订单", "orders"],
      result: ["复盘结论", "结果", "结论", "result"],
      notes: ["备注", "说明", "notes"],
    },
  },
};

const configurableOptionFields = {
  creators: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "niche", label: "内容垂类" },
    { key: "platform", label: "平台" },
    { key: "language", label: "语言" },
    { key: "content_types", label: "内容类型" },
  ],
  resources: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "categories", label: "覆盖品类" },
    { key: "type", label: "资源类型" },
    { key: "users", label: "用户类型" },
  ],
  leads: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "niche", label: "内容垂类" },
    { key: "platform", label: "平台" },
  ],
  cooperations: [
    { key: "product", label: "合作产品" },
    { key: "model", label: "合作方式" },
    { key: "result", label: "复盘结论" },
  ],
};

const filterDefinitions = {
  creators: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "platform", label: "平台" },
    { key: "niche", label: "内容垂类" },
    { key: "status", label: "合作状态" },
    { key: "competitor", label: "做过竞品" },
    { key: "exchange", label: "接受置换" },
    { key: "cps", label: "接受 CPS" },
    { key: "longterm", label: "长期合作" },
    { key: "ad_auth", label: "广告授权" },
  ],
  resources: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "type", label: "资源类型" },
    { key: "categories", label: "覆盖品类" },
    { key: "grade", label: "资源等级" },
    { key: "fee", label: "是否收费" },
    { key: "exclusivity", label: "要求独家" },
    { key: "coupon", label: "接受优惠券" },
    { key: "suitable_new", label: "适合新品" },
    { key: "suitable_clearance", label: "适合清库存" },
  ],
  leads: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "platform", label: "平台" },
    { key: "niche", label: "内容垂类" },
    { key: "status", label: "开发状态" },
    { key: "email", label: "邮箱", mode: "email" },
  ],
  cooperations: [
    { key: "model", label: "合作方式" },
    { key: "product", label: "合作产品" },
    { key: "result", label: "复盘结论" },
  ],
};

const defaultFilterPreferences = {
  creators: ["brand", "country"],
  resources: ["brand", "country"],
  leads: ["brand", "platform", "email"],
  cooperations: ["model", "result"],
};

const emptyState = {
  meta: { version: 1, updatedAt: new Date().toISOString() },
  creators: [],
  resources: [],
  leads: [],
  cooperations: [],
  matches: [],
  importHistory: [],
};

const state = {
  data: clone(emptyState),
  activeTab: "creators",
  editingId: null,
  editorDraft: null,
  editorBaseline: "",
  editorOpen: false,
  matchingEditingId: null,
  importDraft: null,
  duplicateIgnores: new Set(),
  filters: { query: "", activeKeys: [], values: {} },
  filterMenu: null,
  optionSettingsType: "creators",
  aiSettings: clone(defaultAiSettings),
};

const elements = {
  accessGate: document.getElementById("accessGate"),
  accessForm: document.getElementById("accessForm"),
  accessPassword: document.getElementById("accessPassword"),
  accessStatus: document.getElementById("accessStatus"),
  tabs: document.getElementById("tabs"),
  summary: document.getElementById("summary"),
  workspace: document.querySelector(".workspace"),
  settingsPage: document.getElementById("settingsPage"),
  matchingPage: document.getElementById("matchingPage"),
  matchForm: document.getElementById("matchForm"),
  matchFormTitle: document.getElementById("matchFormTitle"),
  matchingResults: document.getElementById("matchingResults"),
  matchingHistory: document.getElementById("matchingHistory"),
  matchingStatus: document.getElementById("matchingStatus"),
  resetMatchBtn: document.getElementById("resetMatchBtn"),
  aiSettingsForm: document.getElementById("aiSettingsForm"),
  aiApiBaseUrl: document.getElementById("aiApiBaseUrl"),
  aiProtocol: document.getElementById("aiProtocol"),
  aiApiKey: document.getElementById("aiApiKey"),
  aiKeySource: document.getElementById("aiKeySource"),
  aiModel: document.getElementById("aiModel"),
  aiProxyUrl: document.getElementById("aiProxyUrl"),
  leadAiApiBaseUrl: document.getElementById("leadAiApiBaseUrl"),
  leadAiProtocol: document.getElementById("leadAiProtocol"),
  leadAiApiKey: document.getElementById("leadAiApiKey"),
  leadAiKeySource: document.getElementById("leadAiKeySource"),
  leadAiModel: document.getElementById("leadAiModel"),
  leadAiProxyUrl: document.getElementById("leadAiProxyUrl"),
  aiSettingsStatus: document.getElementById("aiSettingsStatus"),
  aiSettingsStatusBtn: document.getElementById("aiSettingsStatusBtn"),
  aiSettingsReloadBtn: document.getElementById("aiSettingsReloadBtn"),
  formTitle: document.getElementById("formTitle"),
  formHint: document.getElementById("formHint"),
  form: document.getElementById("recordForm"),
  editorModal: document.getElementById("editorModal"),
  editorBackdrop: document.getElementById("editorBackdrop"),
  closeEditorBtn: document.getElementById("closeEditorBtn"),
  editorStatus: document.getElementById("editorStatus"),
  assistantPanel: document.querySelector(".assistant"),
  searchInput: document.getElementById("searchInput"),
  filterUi: document.getElementById("filterUi"),
  filterSetupBtn: document.getElementById("filterSetupBtn"),
  activeFilters: document.getElementById("activeFilters"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  filterPopover: document.getElementById("filterPopover"),
  optionEntitySelect: document.getElementById("optionEntitySelect"),
  optionFieldSelect: document.getElementById("optionFieldSelect"),
  optionValueInput: document.getElementById("optionValueInput"),
  addOptionBtn: document.getElementById("addOptionBtn"),
  optionTags: document.getElementById("optionTags"),
  optionSettingsStatus: document.getElementById("optionSettingsStatus"),
  tableHead: document.getElementById("tableHead"),
  tableBody: document.getElementById("tableBody"),
  assistantText: document.getElementById("assistantText"),
  applyAssistantBtn: document.getElementById("applyAssistantBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportStateBtn: document.getElementById("exportStateBtn"),
  importStateInput: document.getElementById("importStateInput"),
  importTableInput: document.getElementById("importTableInput"),
  importStatus: document.getElementById("importStatus"),
  importPreview: document.getElementById("importPreview"),
  importHistory: document.getElementById("importHistory"),
  duplicatePanel: document.getElementById("duplicatePanel"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  newRecordBtn: document.getElementById("newRecordBtn"),
  resetFormBtn: document.getElementById("resetFormBtn"),
};

const formSections = {
  creators: {
    brand: "基础身份",
    niche: "数据表现",
    competitor: "合作条件",
    content_types: "内容沉淀",
  },
};

const formWideFields = {
  creators: new Set(["social_url", "email", "email_source", "audience", "content_types", "tags", "notes"]),
  leads: new Set(["social_url", "email", "email_source", "notes"]),
};

const formFocusFields = {
  creators: new Set(["name", "social_url", "followers", "avg_views", "engagement"]),
  leads: new Set(["social_url", "name", "followers", "avg_views", "engagement"]),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isOnlineDeployment() {
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function showAccessGate(message = "") {
  document.body.classList.add("access-locked");
  elements.accessGate.classList.remove("hidden");
  elements.accessStatus.textContent = message;
  window.setTimeout(() => elements.accessPassword.focus(), 0);
}

function hideAccessGate() {
  document.body.classList.remove("access-locked");
  elements.accessGate.classList.add("hidden");
  elements.accessStatus.textContent = "";
  elements.accessPassword.value = "";
}

async function apiFetch(resource, options = {}) {
  const headers = new Headers(options.headers || {});
  const password = sessionStorage.getItem(STORAGE_ACCESS_PASSWORD);
  if (password) headers.set("x-workbench-access", password);
  const response = await fetch(resource, { ...options, headers });
  if (response.status === 401 && isOnlineDeployment()) {
    sessionStorage.removeItem(STORAGE_ACCESS_PASSWORD);
    showAccessGate("访问密码不正确，请重新输入。");
  }
  return response;
}

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHeader(value) {
  return text(value).toLowerCase().replace(/[\s_：:（）()/%/\\-]+/g, "");
}

function toNumber(value) {
  if (value === "" || value == null) return 0;
  const next = Number(String(value).replace(/[,%]/g, ""));
  return Number.isFinite(next) ? next : 0;
}

function splitTags(value) {
  return text(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitList(value) {
  return text(value)
    .split(/[|,，、/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTags(items) {
  return [...new Set(items.map(text).filter(Boolean))].join("|");
}

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
  const raw = text(value);
  if (!raw) return "";
  return countryAliases.get(raw.toLowerCase().replace(/\s+/g, "")) || raw;
}

function uid(prefix) {
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}${random}`;
}

function loadDuplicateIgnores() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_DUPLICATE_IGNORES) || "[]");
    state.duplicateIgnores = new Set(Array.isArray(saved) ? saved : []);
  } catch {
    state.duplicateIgnores = new Set();
  }
}

function saveDuplicateIgnores() {
  localStorage.setItem(STORAGE_DUPLICATE_IGNORES, JSON.stringify([...state.duplicateIgnores]));
}

function config() {
  return entityConfig[state.activeTab];
}

function rows(type = state.activeTab) {
  return state.data[type] || [];
}

function editableSnapshot(record, type = state.activeTab) {
  const output = {};
  for (const field of entityConfig[type].fields) {
    output[field.key] = record?.[field.key] ?? "";
  }
  return JSON.stringify(output);
}

function openEditor(id = null) {
  const existing = id ? rows().find((row) => row.id === id) : null;
  state.editingId = existing?.id || null;
  state.editorDraft = existing ? clone(existing) : defaultRecord(state.activeTab);
  state.editorBaseline = editableSnapshot(state.editorDraft);
  state.editorOpen = true;
  renderEditor();
}

function resetEditorState() {
  state.editingId = null;
  state.editorDraft = null;
  state.editorBaseline = "";
  state.editorOpen = false;
}

function optionSetKey(type, fieldKey) {
  return `${type}.${fieldKey}`;
}

function getConfigurableFields(type = state.activeTab) {
  return configurableOptionFields[type] || [];
}

function getConfigurableField(type, fieldKey) {
  return getConfigurableFields(type).find((field) => field.key === fieldKey);
}

function isConfigurableField(type, fieldKey) {
  return Boolean(getConfigurableField(type, fieldKey));
}

function getSavedOptionValues(type, fieldKey) {
  return state.data.meta.optionSets?.[optionSetKey(type, fieldKey)] || [];
}

function getOptionValues(type, fieldKey) {
  const configured = getSavedOptionValues(type, fieldKey);
  const actual = rows(type).map((row) => text(row[fieldKey])).filter(Boolean);
  return [...new Set([...configured, ...actual])]
    .sort((a, b) => a.localeCompare(b, "zh-CN", { sensitivity: "base" }));
}

function getFilterDefinitions(type = state.activeTab) {
  return filterDefinitions[type] || [];
}

function getFilterDefinition(filterKey, type = state.activeTab) {
  return getFilterDefinitions(type).find((filter) => filter.key === filterKey);
}

function getFilterPreferences(type = state.activeTab) {
  const allowed = new Set(getFilterDefinitions(type).map((filter) => filter.key));
  const saved = state.data.meta.filterPreferences?.[type];
  const preferences = Array.isArray(saved) ? saved : defaultFilterPreferences[type] || [];
  return [...new Set(preferences.filter((key) => allowed.has(key)))];
}

function createFilters(type = state.activeTab) {
  return { query: "", activeKeys: getFilterPreferences(type), values: {} };
}

function normalizeFilterPreferences(rawPreferences = {}) {
  const output = {};
  for (const type of Object.keys(entityConfig)) {
    const allowed = new Set(getFilterDefinitions(type).map((filter) => filter.key));
    const incoming = Array.isArray(rawPreferences[type]) ? rawPreferences[type] : defaultFilterPreferences[type] || [];
    output[type] = [...new Set(incoming.filter((key) => allowed.has(key)))];
  }
  return output;
}

function defaultRecord(type) {
  const item = {
    id: uid(entityConfig[type].prefix),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const field of entityConfig[type].fields) {
    if (field.type === "number") item[field.key] = "";
    else if (field.type === "select") item[field.key] = field.options[0] || "";
    else item[field.key] = "";
  }

  return item;
}

function ensureStateShape(nextState) {
  const shaped = { ...clone(emptyState), ...(nextState || {}) };
  shaped.meta = {
    version: 1,
    ...(nextState?.meta || {}),
    optionSets: { ...(nextState?.meta?.optionSets || {}) },
    filterPreferences: normalizeFilterPreferences(nextState?.meta?.filterPreferences),
  };
  shaped.creators = Array.isArray(nextState?.creators) ? nextState.creators.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  shaped.resources = Array.isArray(nextState?.resources) ? nextState.resources.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  shaped.leads = Array.isArray(nextState?.leads) ? nextState.leads.map((row) => ({ ...row, country: normalizeCountry(row.country) })) : [];
  shaped.cooperations = Array.isArray(nextState?.cooperations)
    ? nextState.cooperations.map((row) => resolveCooperationLinks({ ...row }, shaped.creators, shaped.resources))
    : [];
  shaped.matches = Array.isArray(nextState?.matches)
    ? nextState.matches.map((row) => ({
        ...row,
        country: normalizeCountry(row.country),
        selected_resource_ids: Array.isArray(row.selected_resource_ids) ? row.selected_resource_ids : [],
      }))
    : [];
  shaped.importHistory = Array.isArray(nextState?.importHistory) ? nextState.importHistory : [];
  return shaped;
}

async function loadState() {
  try {
    const response = await apiFetch(API_STATE);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "无法读取线上数据");
    }
    state.data = ensureStateShape(await response.json());
  } catch (error) {
    if (isOnlineDeployment()) throw error;
    const raw = localStorage.getItem(STORAGE_FALLBACK);
    state.data = raw ? ensureStateShape(JSON.parse(raw)) : clone(emptyState);
  }
}

async function persist() {
  state.data.meta = {
    ...state.data.meta,
    version: 1,
    updatedAt: new Date().toISOString(),
    optionSets: { ...(state.data.meta.optionSets || {}) },
    filterPreferences: normalizeFilterPreferences(state.data.meta.filterPreferences),
  };
  const payload = JSON.stringify(state.data, null, 2);
  localStorage.setItem(STORAGE_FALLBACK, payload);
  const response = await apiFetch(API_STATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "保存失败");
  }
}

async function loadAiSettings() {
  try {
    const response = await apiFetch(API_AI_SETTINGS);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "无法读取 AI 设置");
    }
    const payload = await response.json();
    const legacyProfile = payload.profiles?.creator ? {} : payload;
    state.aiSettings = {
      ...clone(defaultAiSettings),
      ...payload,
      profiles: {
        creator: { ...clone(defaultAiProfile), ...(payload.profiles?.creator || legacyProfile) },
        lead: { ...clone(defaultAiProfile), ...(payload.profiles?.lead || payload.profiles?.creator || legacyProfile) },
      },
    };
  } catch (error) {
    if (isOnlineDeployment()) throw error;
    state.aiSettings = clone(defaultAiSettings);
  }
}

function readAiSettingsForm() {
  const formData = new FormData(elements.aiSettingsForm);
  const profile = (key) => ({
    protocol: text(formData.get(`${key}.protocol`)) || defaultAiProfile.protocol,
    apiBaseUrl: text(formData.get(`${key}.apiBaseUrl`)) || defaultAiProfile.apiBaseUrl,
    apiKey: text(formData.get(`${key}.apiKey`)),
    keySource: text(formData.get(`${key}.keySource`)) || defaultAiProfile.keySource,
    model: text(formData.get(`${key}.model`)) || defaultAiProfile.model,
    proxyUrl: text(formData.get(`${key}.proxyUrl`)),
  });
  return {
    profiles: {
      creator: profile("creator"),
      lead: profile("lead"),
    },
  };
}

function renderAiSettings() {
  const profiles = state.aiSettings?.profiles || {};
  const bindProfile = (key, controls) => {
    const settings = { ...clone(defaultAiProfile), ...(profiles[key] || {}) };
    controls.protocol.value = settings.protocol || defaultAiProfile.protocol;
    controls.apiBaseUrl.value = settings.apiBaseUrl || defaultAiProfile.apiBaseUrl;
    controls.keySource.value = settings.keySource || defaultAiProfile.keySource;
    controls.apiKey.value = "";
    const useEnvironment = settings.keySource === "environment";
    controls.apiKey.disabled = useEnvironment;
    controls.apiKey.placeholder = useEnvironment ? "由环境变量读取" : settings.hasApiKey ? "已保存，可留空不改" : "请输入 API Key";
    controls.model.value = settings.model || defaultAiProfile.model;
    controls.proxyUrl.value = settings.proxyUrl || "";
    return settings;
  };

  const creator = bindProfile("creator", {
    protocol: elements.aiProtocol,
    apiBaseUrl: elements.aiApiBaseUrl,
    keySource: elements.aiKeySource,
    apiKey: elements.aiApiKey,
    model: elements.aiModel,
    proxyUrl: elements.aiProxyUrl,
  });
  const lead = bindProfile("lead", {
    protocol: elements.leadAiProtocol,
    apiBaseUrl: elements.leadAiApiBaseUrl,
    keySource: elements.leadAiKeySource,
    apiKey: elements.leadAiApiKey,
    model: elements.leadAiModel,
    proxyUrl: elements.leadAiProxyUrl,
  });
  const describe = (settings, label) => `${label}${settings.hasApiKey ? "已配置" : "未配置"}${settings.model ? `（${settings.model}）` : ""}`;
  elements.aiSettingsStatus.textContent = `${describe(creator, "完整补全")}; ${describe(lead, "快速录入")}。`;
}

async function saveAiSettings(event) {
  event.preventDefault();
  elements.aiSettingsStatus.textContent = "正在保存...";
  const response = await apiFetch(API_AI_SETTINGS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readAiSettingsForm()),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    elements.aiSettingsStatus.textContent = payload.error || "AI 设置保存失败";
    return;
  }
  state.aiSettings = {
    ...clone(defaultAiSettings),
    ...payload.settings,
    profiles: {
      creator: { ...clone(defaultAiProfile), ...(payload.settings?.profiles?.creator || payload.settings || {}) },
      lead: { ...clone(defaultAiProfile), ...(payload.settings?.profiles?.lead || payload.settings?.profiles?.creator || payload.settings || {}) },
    },
  };
  renderAiSettings();
  const profiles = state.aiSettings.profiles;
  const saved = (profile) => (profile?.hasApiKey ? "已配置" : "未配置");
  elements.aiSettingsStatus.textContent = `设置已保存：完整补全 ${saved(profiles.creator)}；快速录入 ${saved(profiles.lead)}。API Key 为安全起见不会回显。`;
}

async function checkAiStatus() {
  elements.aiSettingsStatus.textContent = "正在检查...";
  try {
    const response = await apiFetch(API_AI_STATUS);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "检查失败");
    const profiles = payload.profiles || {};
    const describe = (key, label) => {
      const profile = profiles[key] || {};
      const network = profile.network || {};
      const networkText = network.mode === "cloud" ? "网络：Vercel 云端直连" : network.mode === "proxy" ? `代理：${network.source || "已连接"}` : "网络：直连";
      return `${label}${profile.configured ? "已配置" : "未配置"}${profile.model ? `（${profile.model}）` : ""}，${networkText}`;
    };
    elements.aiSettingsStatus.textContent = `${describe("creator", "完整补全")}; ${describe("lead", "快速录入")}。`;
  } catch (error) {
    elements.aiSettingsStatus.textContent = error.message || "检查失败";
  }
}

function getMetrics(type, dataRows) {
  if (type === "creators") {
    return [
      ["达人总数", dataRows.length],
      ["可跟进", dataRows.filter((row) => row.status !== "沉淀").length],
      ["长期合作意向", dataRows.filter((row) => row.longterm === "是").length],
      ["接受置换/CPS", dataRows.filter((row) => row.exchange === "是" || row.cps === "是").length],
    ];
  }

  if (type === "resources") {
    return [
      ["资源总数", dataRows.length],
      ["A 级资源", dataRows.filter((row) => row.grade === "A").length],
      ["适合新品", dataRows.filter((row) => row.suitable_new === "是").length],
      ["适合清库存", dataRows.filter((row) => row.suitable_clearance === "是").length],
    ];
  }

  if (type === "leads") {
    return [
      ["待开发总数", dataRows.length],
      ["待联系", dataRows.filter((row) => row.status === "待开发").length],
      ["已联系", dataRows.filter((row) => row.status === "已联系").length],
      ["已转达人库", dataRows.filter((row) => row.status === "已转达人库").length],
    ];
  }

  return [
    ["合作记录", dataRows.length],
    ["累计订单", dataRows.reduce((sum, row) => sum + toNumber(row.orders), 0)],
    ["累计点击", dataRows.reduce((sum, row) => sum + toNumber(row.clicks), 0)],
    ["高效合作", dataRows.filter((row) => text(row.result).includes("复投") || text(row.result).includes("稳定")).length],
  ];
}

function filterRows(dataRows) {
  const query = text(state.filters.query).toLowerCase();

  return dataRows.filter((row) => {
    const haystack = Object.values(row).map((value) => text(value).toLowerCase()).join(" ");
    if (query && !haystack.includes(query)) return false;

    for (const filterKey of state.filters.activeKeys) {
      const selected = state.filters.values[filterKey] || [];
      if (!selected.length) continue;
      const filter = getFilterDefinition(filterKey);
      if (!filter) continue;
      const current = filter.mode === "email" ? (text(row.email) ? "有邮箱" : "无邮箱") : text(row[filter.key]);
      if (!selected.includes(current)) return false;
    }
    return true;
  });
}

function renderTabs() {
  const tabs = [...Object.entries(entityConfig).map(([key, item]) => ({ key, title: item.title })), MATCHING_TAB];
  elements.tabs.innerHTML = tabs
    .map((item) => `<button class="tab ${item.key === state.activeTab ? "active" : ""}" data-tab="${item.key}">${item.title}</button>`)
    .join("");

  elements.tabs.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      resetEditorState();
      state.matchingEditingId = null;
      state.importDraft = null;
      state.filters = createFilters(state.activeTab);
      state.filterMenu = null;
      elements.searchInput.value = "";
      elements.importStatus.textContent = "";
      render();
    });
  });
}

function renderSummary(visibleRows) {
  elements.summary.innerHTML = getMetrics(state.activeTab, visibleRows)
    .map(([label, value]) => `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div></div>`)
    .join("");
}

function renderFilters() {
  const activeKeys = new Set(getFilterPreferences());
  state.filters.activeKeys = state.filters.activeKeys.filter((key) => activeKeys.has(key));
  for (const key of activeKeys) {
    if (!state.filters.activeKeys.includes(key)) state.filters.activeKeys.push(key);
  }
  for (const key of Object.keys(state.filters.values)) {
    if (!activeKeys.has(key)) delete state.filters.values[key];
  }

  const hasSelections = Object.values(state.filters.values).some((values) => values?.length);
  elements.clearFiltersBtn.classList.toggle("hidden", !hasSelections);
  elements.activeFilters.innerHTML = state.filters.activeKeys
    .map((key) => {
      const filter = getFilterDefinition(key);
      if (!filter) return "";
      const count = state.filters.values[key]?.length || 0;
      const label = count ? `${filter.label}：${count}` : filter.label;
      return `<button type="button" class="ghost active-filter ${state.filterMenu?.mode === "drawer" && state.filterMenu.openSections?.includes(key) ? "active" : ""}" data-filter-control="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  elements.filterSetupBtn.classList.toggle("active", state.filterMenu?.mode === "drawer");
  renderFilterPopover();
}

function filterOptions(filter) {
  if (filter.mode === "email") return ["有邮箱", "无邮箱"];
  const field = config().fields.find((item) => item.key === filter.key);
  const fixed = field?.type === "select" ? field.options : [];
  const configured = isConfigurableField(state.activeTab, filter.key) ? getSavedOptionValues(state.activeTab, filter.key) : [];
  const actual = rows().map((row) => text(row[filter.key])).filter(Boolean);
  return [...new Set([...fixed, ...configured, ...actual])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-CN", { sensitivity: "base" }));
}

function renderFilterPopover() {
  if (state.filterMenu?.mode !== "drawer") {
    elements.filterPopover.innerHTML = "";
    elements.filterPopover.classList.add("hidden");
    return;
  }

  const openSections = new Set(state.filterMenu.openSections || []);
  const selectedFields = new Set(state.filters.activeKeys);
  const sections = getFilterDefinitions()
    .filter((filter) => selectedFields.has(filter.key))
    .map((filter) => {
      const selected = new Set(state.filters.values[filter.key] || []);
      const options = filterOptions(filter);
      const expanded = openSections.has(filter.key);
      return `
        <section class="filter-drawer-section">
          <button type="button" class="filter-section-toggle" data-filter-section="${escapeHtml(filter.key)}" aria-expanded="${expanded}">
            <span>${escapeHtml(filter.label)}${selected.size ? `<em>${selected.size}</em>` : ""}</span>
            <b>${expanded ? "-" : "+"}</b>
          </button>
          <div class="filter-section-body ${expanded ? "" : "hidden"}">
            <div class="filter-section-tools">
              <span>${options.length ? `可选 ${options.length} 项` : "暂无可选内容"}</span>
              ${selected.size ? `<button type="button" class="filter-reset" data-filter-reset="${escapeHtml(filter.key)}">清空</button>` : ""}
            </div>
            <div class="filter-option-list">
              ${
                options.length
                  ? options
                      .map(
                        (value) => `
                          <label class="filter-option">
                            <input type="checkbox" data-filter-value="${escapeHtml(filter.key)}" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""} />
                            <span>${escapeHtml(value)}</span>
                          </label>`,
                      )
                      .join("")
                  : `<p class="filter-empty">录入资料后会在这里出现可筛选项</p>`
              }
            </div>
          </div>
        </section>`;
    })
    .join("");

  const fieldsExpanded = openSections.has("__fields");
  elements.filterPopover.innerHTML = `
    <aside class="filter-drawer-sheet" role="dialog" aria-modal="true" aria-label="筛选">
      <header class="filter-drawer-head">
        <strong>筛选</strong>
        <button type="button" class="filter-drawer-close" data-filter-close aria-label="关闭筛选" title="关闭">×</button>
      </header>
      <div class="filter-drawer-content">
        <section class="filter-drawer-section filter-field-settings">
          <button type="button" class="filter-section-toggle" data-filter-section="__fields" aria-expanded="${fieldsExpanded}">
            <span>筛选字段<em>${state.filters.activeKeys.length}</em></span>
            <b>${fieldsExpanded ? "-" : "+"}</b>
          </button>
          <div class="filter-section-body ${fieldsExpanded ? "" : "hidden"}">
            <p class="filter-section-hint">勾选需要显示和使用的筛选条件</p>
            <div class="filter-option-list">
              ${getFilterDefinitions()
                .map(
                  (filter) => `
                    <label class="filter-option">
                      <input type="checkbox" data-filter-visibility="${escapeHtml(filter.key)}" ${selectedFields.has(filter.key) ? "checked" : ""} />
                      <span>${escapeHtml(filter.label)}</span>
                    </label>`,
                )
                .join("")}
            </div>
          </div>
        </section>
        ${sections || `<p class="filter-empty filter-drawer-empty">请先在“筛选字段”中选择至少一个条件</p>`}
      </div>
      <footer class="filter-drawer-foot">
        <button type="button" class="ghost" data-filter-clear-all ${Object.values(state.filters.values).some((values) => values?.length) ? "" : "disabled"}>清除条件</button>
        <button type="button" class="primary" data-filter-close>完成</button>
      </footer>
    </aside>`;
  elements.filterPopover.classList.remove("hidden");
}

function renderFilteredRows() {
  const visibleRows = filterRows(rows());
  renderFilters();
  renderSummary(visibleRows);
  renderTable(visibleRows);
}

function renderForm() {
  const item = config();
  const current = state.editorDraft || (state.editingId ? rows().find((row) => row.id === state.editingId) : defaultRecord(state.activeTab));

  elements.formTitle.textContent = state.editingId ? `编辑 ${item.title}` : item.formTitle;
  elements.formHint.textContent = item.hint;
  elements.editorStatus.textContent = "点击窗口外会自动保存并关闭。";

  elements.form.innerHTML = item.fields
    .flatMap((field) => {
      const value = current?.[field.key] ?? "";
      const required = field.required ? "required" : "";
      const mark = field.required ? " *" : "";
      const placeholder = field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "";
      const isWide = field.type === "textarea" || formWideFields[state.activeTab]?.has(field.key);
      const isFocus = formFocusFields[state.activeTab]?.has(field.key);
      const fieldClass = `field ${isWide ? "field-wide" : ""} ${isFocus ? "field-focus" : ""}`.trim();
      const sectionTitle = formSections[state.activeTab]?.[field.key];
      const section = sectionTitle ? [`<div class="form-section"><span>${sectionTitle}</span></div>`] : [];

      if (field.type === "textarea") {
        return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><textarea id="${field.key}" name="${field.key}" ${required} ${placeholder}>${escapeHtml(value)}</textarea></div>`];
      }

      if (field.type === "reference") {
        const sourceRows = rows(field.reference);
        const selectedValue = text(value);
        return [
          ...section,
          `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><select id="${field.key}" name="${field.key}" ${required}><option value="">不关联</option>${sourceRows
            .map((row) => `<option value="${escapeHtml(row.id)}" ${selectedValue === row.id ? "selected" : ""}>${escapeHtml(row.name || row.title || row.id)}</option>`)
            .join("")}</select></div>`,
        ];
      }

      if (isConfigurableField(state.activeTab, field.key)) {
        const listId = `option-list-${state.activeTab}-${field.key}`;
        const options = getOptionValues(state.activeTab, field.key).map((option) => `<option value="${escapeHtml(option)}"></option>`).join("");
        return [
          ...section,
          `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><input id="${field.key}" name="${field.key}" type="text" list="${listId}" value="${escapeHtml(value)}" ${required} ${placeholder} /><datalist id="${listId}">${options}</datalist></div>`,
        ];
      }

      if (field.type === "select") {
        return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><select id="${field.key}" name="${field.key}" ${required}>${field.options
          .map((option) => `<option value="${escapeHtml(option)}" ${text(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`)
          .join("")}</select></div>`];
      }

      if (["creators", "leads"].includes(state.activeTab) && field.key === "social_url") {
        const buttonText = state.activeTab === "leads" ? "自动检索" : "从链接补全";
        return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><div class="field-with-action"><input id="${field.key}" name="${field.key}" type="${field.type}" step="${field.step || "1"}" value="${escapeHtml(value)}" ${required} ${placeholder} /><button type="button" id="creatorAiBtn" class="ghost">${buttonText}</button></div><p class="field-status" id="creatorAiStatus"></p><p class="field-status identity-status" id="identityStatus"></p></div>`];
      }

      const identityStatus = ["creators", "leads"].includes(state.activeTab) && field.key === "email" ? `<p class="field-status identity-status" id="identityEmailStatus"></p>` : "";
      return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><input id="${field.key}" name="${field.key}" type="${field.type}" step="${field.step || "1"}" value="${escapeHtml(value)}" ${required} ${placeholder} />${identityStatus}</div>`];
    })
    .join("");

  const creatorAiBtn = document.getElementById("creatorAiBtn");
  if (creatorAiBtn) creatorAiBtn.addEventListener("click", handleCreatorAiEnrich);
  const creatorReference = elements.form.elements.creator_id;
  if (creatorReference) {
    creatorReference.addEventListener("change", () => syncCooperationName("creator"));
  }
  const resourceReference = elements.form.elements.resource_id;
  if (resourceReference) {
    resourceReference.addEventListener("change", () => syncCooperationName("resource"));
  }

  elements.form.querySelectorAll("input, select, textarea").forEach((control) => {
    control.addEventListener("input", renderAssistant);
    control.addEventListener("change", renderAssistant);
  });
  const identityFields = [elements.form.elements.social_url, elements.form.elements.email].filter(Boolean);
  identityFields.forEach((control) => {
    control.addEventListener("input", renderIdentityCheck);
    control.addEventListener("change", renderIdentityCheck);
  });
  if (state.activeTab === "leads" && elements.form.elements.social_url) {
    elements.form.elements.social_url.addEventListener("change", () => {
      const url = text(elements.form.elements.social_url.value);
      if (url && document.getElementById("creatorAiBtn")?.dataset.enrichedUrl !== url) handleCreatorAiEnrich();
    });
  }
  elements.assistantPanel.classList.toggle("hidden", state.activeTab === "leads");
  renderIdentityCheck();
  renderAssistant();
}

function renderEditor() {
  const visible = state.editorOpen && ![SETTINGS_TAB.key, MATCHING_TAB.key].includes(state.activeTab);
  elements.editorModal.classList.toggle("hidden", !visible);
  elements.editorModal.setAttribute("aria-hidden", String(!visible));
  if (!visible) {
    elements.form.innerHTML = "";
    return;
  }
  renderForm();
  window.setTimeout(() => {
    const first = elements.form.querySelector("input, select, textarea");
    first?.focus();
  }, 0);
}

function renderAssistant() {
  if (state.activeTab === "leads") return;
  const record = readFormRecord({ applyRecommendations: false });
  const recommendation = buildRecommendations(record, state.activeTab);
  const entries = Object.entries(recommendation.updates);
  const summary = recommendation.messages.map((message) => `• ${message}`).join("\n");

  elements.assistantText.textContent = summary;
  elements.applyAssistantBtn.disabled = entries.length === 0;
  elements.applyAssistantBtn.dataset.updates = JSON.stringify(recommendation.updates);
}

function applyAssistantUpdates() {
  const updates = JSON.parse(elements.applyAssistantBtn.dataset.updates || "{}");
  for (const [key, value] of Object.entries(updates)) {
    const control = elements.form.elements[key];
    if (control) control.value = value;
  }
  renderAssistant();
}

function normalizeSocialIdentity(value) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return `${hostname}${pathname}`;
  } catch {
    return normalizeHeader(raw);
  }
}

function findIdentityConflicts(record, types = ["creators", "leads"]) {
  if (!["creators", "leads"].includes(state.activeTab)) return [];
  const socialUrl = normalizeSocialIdentity(record.social_url);
  const email = normalizeHeader(record.email);
  if (!socialUrl && !email) return [];

  return types.flatMap((type) =>
    rows(type)
      .filter((row) => !(type === state.activeTab && row.id === record.id))
      .map((row) => {
        const matched = [];
        if (socialUrl && socialUrl === normalizeSocialIdentity(row.social_url)) matched.push("社媒地址");
        if (email && email === normalizeHeader(row.email)) matched.push("邮箱");
        return matched.length ? { row, type, matched } : null;
      })
      .filter(Boolean),
  );
}

function renderIdentityCheck() {
  if (!["creators", "leads"].includes(state.activeTab)) return;
  const record = readFormRecord({ applyRecommendations: false });
  const conflicts = findIdentityConflicts(record);
  const status = document.getElementById("identityStatus");
  const emailStatus = document.getElementById("identityEmailStatus");
  const message = conflicts.length
    ? `发现重复：${conflicts.map(({ row, type, matched }) => `${entityConfig[type].title}「${text(row.name) || text(row.social_url)}」的${matched.join("、")}`).join("；")}。保存将被阻止。`
    : text(record.social_url) || text(record.email)
      ? "已检查社媒地址和邮箱，未发现重复。"
      : "";
  if (status) status.textContent = message;
  if (emailStatus) emailStatus.textContent = conflicts.some((item) => item.matched.includes("邮箱")) ? message : "";
}

function applyCreatorAiUpdates(updates, sourceUrl) {
  let applied = 0;
  const fields = config().fields.map((field) => field.key);
  const numericAiFields = new Set(["followers", "avg_views", "engagement"]);
  const nextUpdates = { ...(updates || {}) };
  if (sourceUrl && !text(nextUpdates.social_url)) nextUpdates.social_url = sourceUrl;

  const emailControl = elements.form.elements.email;
  const emailSourceControl = elements.form.elements.email_source;
  const canApplyEmail =
    !text(emailControl?.value) &&
    !text(emailSourceControl?.value) &&
    text(nextUpdates.email) &&
    text(nextUpdates.email_source);

  for (const key of fields) {
    if (!(key in nextUpdates)) continue;
    if (["email", "email_source"].includes(key) && !canApplyEmail) continue;
    const control = elements.form.elements[key];
    const value = nextUpdates[key];
    const currentValue = text(control?.value);
    const canReplaceZero = numericAiFields.has(key) && currentValue === "0" && Number(value) > 0;
    if (!control || !text(value) || (currentValue && !canReplaceZero)) continue;
    control.value = value;
    applied += 1;
  }

  renderAssistant();
  return applied;
}

async function handleCreatorAiEnrich() {
  if (!["creators", "leads"].includes(state.activeTab)) return;
  const button = document.getElementById("creatorAiBtn");
  const status = document.getElementById("creatorAiStatus");
  const current = readFormRecord({ applyRecommendations: false });
  const sourceUrl = text(current.social_url);
  const profileKey = state.activeTab === "leads" ? "lead" : "creator";
  const profile = state.aiSettings?.profiles?.[profileKey];

  if (!sourceUrl) {
    if (status) status.textContent = "请先填写达人社媒地址。";
    return;
  }
  if (!profile?.hasApiKey) {
    if (status) status.textContent = `${state.activeTab === "leads" ? "快速录入" : "完整补全"} AI 尚未配置，请先在设置页填写该功能的 API Key。`;
    return;
  }

  if (button) button.disabled = true;
  if (status) status.textContent = state.activeTab === "leads" ? "快速 AI 正在整理核心信息..." : "AI 正在搜索并整理可验证信息...";

  try {
    const response = await apiFetch(API_CREATOR_ENRICH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, current, purpose: state.activeTab === "leads" ? "lead" : "creator" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || "AI 补全失败");
    }

    const applied = applyCreatorAiUpdates(payload.updates, sourceUrl);
    const confidenceText = payload.confidence ? `，可信度：${payload.confidence}` : "";
    const sourceText = Array.isArray(payload.sources) && payload.sources.length ? `，来源 ${payload.sources.length} 个` : "";
    const warningText = Array.isArray(payload.warnings) && payload.warnings.length ? `；提示：${payload.warnings.join("；")}` : "";
    if (status) status.textContent = `已补全 ${applied} 个空字段${confidenceText}${sourceText}${warningText}。请人工复核后保存。`;
    if (button) button.dataset.enrichedUrl = sourceUrl;
    renderIdentityCheck();
  } catch (error) {
    if (status) status.textContent = error.message || "AI 补全失败，请检查本地服务或 API 配置。";
  } finally {
    if (button) button.disabled = false;
  }
}

function safeExternalUrl(value) {
  try {
    const parsed = new URL(text(value));
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function renderTable(visibleRows) {
  const item = config();
  elements.tableHead.innerHTML = `<tr>${item.columns.map(([, label]) => `<th>${label}</th>`).join("")}<th>操作</th></tr>`;

  if (!visibleRows.length) {
    elements.tableBody.innerHTML = `<tr><td colspan="${item.columns.length + 1}" class="muted">暂无记录，先新增或导入表格。</td></tr>`;
    return;
  }

  elements.tableBody.innerHTML = visibleRows
    .map((row) => {
      const cells = item.columns
        .map(([key]) => {
          if (key === "tags") {
            const tags = splitTags(row[key]).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
            return `<td>${tags || escapeHtml(row[key])}</td>`;
          }
          const cls = key === "grade" && row[key] === "A" ? "status-good" : key === "status" && row[key] === "已合作" ? "status-good" : "";
          if (["social_url", "link"].includes(key) && safeExternalUrl(row[key])) {
            return `<td class="${cls} link-cell"><a href="${escapeHtml(safeExternalUrl(row[key]))}" target="_blank" rel="noopener noreferrer" title="打开链接">${escapeHtml(row[key])}</a></td>`;
          }
          return `<td class="${cls}">${escapeHtml(row[key])}</td>`;
        })
        .join("");

      const transferAction =
        state.activeTab === "leads" && row.status !== "已转达人库"
          ? `<button class="ghost" data-transfer-lead="${row.id}">转入达人库</button>`
          : "";
      const emailAction =
        state.activeTab === "leads" && text(row.email)
          ? `<a class="ghost mail-link" href="mailto:${encodeURIComponent(text(row.email))}" title="使用默认邮件软件联系此达人">写邮件</a>`
          : "";
      return `<tr data-open-editor="${escapeHtml(row.id)}" title="双击任意资料内容可编辑">${cells}<td><div class="row-actions">${emailAction}${transferAction}<button class="ghost" data-delete="${row.id}">删除</button></div></td></tr>`;
    })
    .join("");

  elements.tableBody.querySelectorAll("[data-open-editor]").forEach((tableRow) => {
    tableRow.addEventListener("dblclick", (event) => {
      if (event.target.closest("a, button")) return;
      openEditor(tableRow.dataset.openEditor);
    });
  });

  elements.tableBody.querySelectorAll("[data-transfer-lead]").forEach((button) => {
    button.addEventListener("click", () => transferLeadToCreator(button.dataset.transferLead));
  });

  elements.tableBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.data[state.activeTab] = rows().filter((row) => row.id !== button.dataset.delete);
      if (state.editingId === button.dataset.delete) state.editingId = null;
      await persist();
      render();
    });
  });
}

function setEntityUiVisible(isVisible) {
  elements.summary.classList.toggle("hidden", !isVisible);
  elements.workspace.classList.toggle("hidden", !isVisible);
  elements.settingsPage.classList.toggle("hidden", isVisible);
  elements.matchingPage.classList.toggle("hidden", isVisible);
}

function renderOptionSettings() {
  const availableTypes = Object.keys(configurableOptionFields).filter((type) => getConfigurableFields(type).length);
  if (!availableTypes.includes(state.optionSettingsType)) state.optionSettingsType = availableTypes[0] || "creators";
  elements.optionEntitySelect.innerHTML = availableTypes
    .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(entityConfig[type].title)}</option>`)
    .join("");
  elements.optionEntitySelect.value = state.optionSettingsType;

  const fields = getConfigurableFields(state.optionSettingsType);
  const currentField = fields.some((field) => field.key === elements.optionFieldSelect.value) ? elements.optionFieldSelect.value : fields[0]?.key || "";
  elements.optionFieldSelect.innerHTML = fields.map((field) => `<option value="${escapeHtml(field.key)}">${escapeHtml(field.label)}</option>`).join("");
  elements.optionFieldSelect.value = currentField;

  const configured = getSavedOptionValues(state.optionSettingsType, currentField);
  elements.optionTags.innerHTML = configured.length
    ? configured
        .map(
          (value) => `
            <span class="option-tag">
              <span>${escapeHtml(value)}</span>
              <button type="button" class="option-tag-remove" data-remove-option="${escapeHtml(currentField)}" data-option-value="${escapeHtml(value)}" aria-label="移除 ${escapeHtml(value)}" title="移除">×</button>
            </span>`,
        )
        .join("")
    : `<p class="option-empty">暂无自定义候选项</p>`;
  elements.optionSettingsStatus.textContent = "";
}

async function addCustomOption() {
  const type = state.optionSettingsType;
  const fieldKey = elements.optionFieldSelect.value;
  const field = getConfigurableField(type, fieldKey);
  let value = text(elements.optionValueInput.value);
  if (!field || !value) {
    elements.optionSettingsStatus.textContent = "请输入要添加的选项。";
    elements.optionValueInput.focus();
    return;
  }
  if (fieldKey === "country") value = normalizeCountry(value);

  const key = optionSetKey(type, fieldKey);
  const existing = getSavedOptionValues(type, fieldKey);
  if (existing.some((item) => normalizeHeader(item) === normalizeHeader(value))) {
    elements.optionSettingsStatus.textContent = "该选项已存在。";
    return;
  }
  state.data.meta.optionSets[key] = [...existing, value];
  try {
    await persist();
    elements.optionValueInput.value = "";
    renderOptionSettings();
    elements.optionSettingsStatus.textContent = "已加入候选项。";
  } catch (error) {
    elements.optionSettingsStatus.textContent = error.message || "保存选项失败。";
  }
}

async function removeCustomOption(fieldKey, value) {
  const type = state.optionSettingsType;
  const key = optionSetKey(type, fieldKey);
  const next = getSavedOptionValues(type, fieldKey).filter((item) => item !== value);
  state.data.meta.optionSets[key] = next;
  try {
    await persist();
    renderOptionSettings();
  } catch (error) {
    elements.optionSettingsStatus.textContent = error.message || "移除选项失败。";
  }
}

function renderSettingsPage() {
  setEntityUiVisible(false);
  elements.matchingPage.classList.add("hidden");
  renderAiSettings();
  renderOptionSettings();
}

function setMatchingUiVisible(isVisible) {
  elements.summary.classList.toggle("hidden", isVisible);
  elements.workspace.classList.toggle("hidden", isVisible);
  elements.settingsPage.classList.add("hidden");
  elements.matchingPage.classList.toggle("hidden", !isVisible);
}

function defaultMatchRecord() {
  const now = new Date().toISOString();
  return {
    id: uid("MT"),
    title: `本周资源匹配 ${now.slice(0, 10)}`,
    country: "",
    categories: "",
    goal: "新品",
    budget: 0,
    exclusivity: "不接受独家",
    max_cycle_days: 7,
    status: "进行中",
    selected_resource_ids: [],
    result: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

function parseCycleDays(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return 0;
  const numbers = [...raw.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  if (!numbers.length) return 0;
  const days = Math.max(...numbers);
  return /周|week|wk/.test(raw) ? Math.round(days * 7) : Math.round(days);
}

function resourceMatchesCategories(resource, categories) {
  const targets = splitList(categories).map((item) => normalizeHeader(item));
  if (!targets.length) return false;
  const resourceTokens = splitList([resource.categories, resource.type, resource.users, resource.notes].join("|")).map((item) => normalizeHeader(item));
  return targets.some((target) => resourceTokens.some((token) => token.includes(target) || target.includes(token)));
}

function recommendResources(match) {
  const targetCountry = normalizeCountry(match.country);
  const budget = toNumber(match.budget);
  const maxCycleDays = toNumber(match.max_cycle_days);

  return rows("resources")
    .map((resource) => {
      let score = 0;
      const reasons = [];
      const resourceCountry = normalizeCountry(resource.country);

      if (targetCountry) {
        if (resourceCountry === targetCountry) {
          score += 30;
          reasons.push("国家匹配");
        } else {
          score -= 35;
          reasons.push("国家不匹配");
        }
      }

      if (text(match.categories)) {
        if (resourceMatchesCategories(resource, match.categories)) {
          score += 25;
          reasons.push("品类匹配");
        } else {
          score -= 12;
        }
      }

      if (match.goal === "新品") {
        if (resource.suitable_new === "是") {
          score += 20;
          reasons.push("适合新品");
        } else {
          score -= 15;
        }
      }

      if (match.goal === "清库存") {
        if (resource.suitable_clearance === "是") {
          score += 20;
          reasons.push("适合清库存");
        } else {
          score -= 15;
        }
      }

      if (match.exclusivity === "不接受独家" && resource.exclusivity === "是") {
        score -= 35;
        reasons.push("要求独家");
      } else if (resource.exclusivity !== "是") {
        score += 8;
        reasons.push("无独家要求");
      }

      const feeAmount = toNumber(resource.fee_amount);
      if (budget <= 0 && resource.fee === "是") {
        score -= 20;
        reasons.push("需要付费");
      } else if (budget > 0 && feeAmount > 0) {
        if (feeAmount <= budget) {
          score += 12;
          reasons.push("收费在预算内");
        } else {
          score -= 25;
          reasons.push("收费超预算");
        }
      } else if (resource.fee === "否") {
        score += 8;
        reasons.push("可免收费");
      }

      const cycleDays = parseCycleDays(resource.cycle);
      if (maxCycleDays > 0 && cycleDays > 0) {
        if (cycleDays <= maxCycleDays) {
          score += 12;
          reasons.push("上线周期可控");
        } else {
          score -= 18;
          reasons.push("周期较长");
        }
      }

      const gradeScore = { A: 12, B: 8, C: 4, D: 1 }[text(resource.grade)] || 0;
      score += gradeScore;
      if (gradeScore) reasons.push(`${resource.grade} 级资源`);

      return { resource, score: Math.max(0, score), reasons, cycleDays };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || toNumber(b.resource.historical_orders) - toNumber(a.resource.historical_orders));
}

function readMatchForm() {
  const formData = new FormData(elements.matchForm);
  const current = state.matchingEditingId ? rows("matches").find((row) => row.id === state.matchingEditingId) : defaultMatchRecord();
  return {
    ...current,
    title: text(formData.get("title")) || current?.title || "本周资源匹配",
    country: normalizeCountry(formData.get("country")),
    categories: text(formData.get("categories")),
    goal: text(formData.get("goal")) || "新品",
    budget: toNumber(formData.get("budget")),
    exclusivity: text(formData.get("exclusivity")) || "不接受独家",
    max_cycle_days: toNumber(formData.get("max_cycle_days")),
    status: text(formData.get("status")) || "进行中",
    result: text(formData.get("result")),
    notes: text(formData.get("notes")),
    selected_resource_ids: Array.isArray(current?.selected_resource_ids) ? current.selected_resource_ids : [],
    updatedAt: new Date().toISOString(),
  };
}

function renderMatchForm() {
  const current = state.matchingEditingId ? rows("matches").find((row) => row.id === state.matchingEditingId) : defaultMatchRecord();
  const field = (key) => current?.[key] ?? "";
  elements.matchFormTitle.textContent = state.matchingEditingId ? "编辑匹配任务" : "新建本周匹配";
  elements.matchForm.innerHTML = `
    <div class="field"><label for="matchTitle">任务名称 *</label><input id="matchTitle" name="title" required value="${escapeHtml(field("title"))}" /></div>
    <div class="field"><label for="matchCountry">目标国家</label><input id="matchCountry" name="country" value="${escapeHtml(field("country"))}" placeholder="例如：美国" /></div>
    <div class="field field-wide"><label for="matchCategories">目标品类</label><input id="matchCategories" name="categories" value="${escapeHtml(field("categories"))}" placeholder="多个品类用 | 分隔" /></div>
    <div class="field"><label for="matchGoal">本次目标</label><select id="matchGoal" name="goal">${["新品", "清库存", "均可"].map((value) => `<option value="${value}" ${field("goal") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
    <div class="field"><label for="matchBudget">预算上限</label><input id="matchBudget" name="budget" type="number" min="0" value="${toNumber(field("budget"))}" /></div>
    <div class="field"><label for="matchExclusivity">独家条件</label><select id="matchExclusivity" name="exclusivity">${["不接受独家", "可接受独家", "不限制"].map((value) => `<option value="${value}" ${field("exclusivity") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
    <div class="field"><label for="matchCycle">最长上线周期（天）</label><input id="matchCycle" name="max_cycle_days" type="number" min="0" value="${toNumber(field("max_cycle_days"))}" /></div>
    <div class="field"><label for="matchStatus">任务状态</label><select id="matchStatus" name="status">${["进行中", "已完成", "已取消"].map((value) => `<option value="${value}" ${field("status") === value ? "selected" : ""}>${value}</option>`).join("")}</select></div>
    <div class="field field-wide"><label for="matchResult">执行结果</label><input id="matchResult" name="result" value="${escapeHtml(field("result"))}" placeholder="例如：已联系 3 个资源，确定 1 个档期" /></div>
    <div class="field field-wide"><label for="matchNotes">任务备注</label><textarea id="matchNotes" name="notes">${escapeHtml(field("notes"))}</textarea></div>
  `;
}

function renderMatchingResults(match) {
  const selected = new Set(match.selected_resource_ids || []);
  const recommendations = recommendResources(match);
  const criteria = [match.country, match.categories, match.goal, match.max_cycle_days ? `${match.max_cycle_days} 天内上线` : ""].filter(Boolean).join(" · ");
  elements.matchingResults.innerHTML = `
    <div class="matching-results-head">
      <div><h2>推荐资源</h2><p>${criteria || "填写任务条件后生成推荐"}${recommendations.length ? `，已按匹配度排序` : ""}</p></div>
      <button class="primary" type="button" id="saveMatchSelectionBtn" ${recommendations.length ? "" : "disabled"}>保存本周选择</button>
    </div>
    <div class="match-results-list">
      ${
        recommendations.length
          ? recommendations
              .map(
                ({ resource, score, reasons, cycleDays }) => `
                  <label class="match-result-row">
                    <input type="checkbox" data-match-resource="${escapeHtml(resource.id)}" ${selected.has(resource.id) ? "checked" : ""} />
                    <div class="match-score">${score}</div>
                    <div class="match-result-main">
                      <strong>${escapeHtml(resource.name)}</strong>
                      <span>${escapeHtml([resource.type, normalizeCountry(resource.country), resource.categories, resource.cycle ? `${resource.cycle}${cycleDays ? "" : ""}` : ""].filter(Boolean).join(" · "))}</span>
                      <small>${escapeHtml(reasons.slice(0, 5).join(" · "))}</small>
                    </div>
                    <div class="match-result-data"><span>${escapeHtml(resource.grade || "-")} 级</span><span>历史订单 ${toNumber(resource.historical_orders)}</span></div>
                  </label>
                `,
              )
              .join("")
          : `<p class="muted match-empty">暂未找到符合条件的资源。可放宽国家、品类、独家或周期条件后再次生成。</p>`
      }
    </div>
  `;

  elements.matchingResults.querySelector("#saveMatchSelectionBtn")?.addEventListener("click", async () => {
    const draft = readMatchForm();
    draft.selected_resource_ids = [...elements.matchingResults.querySelectorAll("[data-match-resource]:checked")].map((input) => input.dataset.matchResource);
    const index = state.data.matches.findIndex((row) => row.id === draft.id);
    if (index >= 0) state.data.matches[index] = draft;
    else state.data.matches.unshift(draft);
    state.matchingEditingId = draft.id;
    elements.matchingStatus.textContent = `已保存本周选择：${draft.selected_resource_ids.length} 个资源。`;
    await persist();
    renderMatchingPage();
  });
}

function renderMatchingHistory() {
  const items = rows("matches").slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  elements.matchingHistory.innerHTML = `
    <div class="matching-history-head"><h2>匹配任务</h2><span>最近 ${items.length} 条</span></div>
    <div class="matching-history-list">
      ${
        items.length
          ? items
              .map(
                (item) => `
                  <article class="match-history-item">
                    <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml([item.country, item.categories, item.goal].filter(Boolean).join(" · "))}</span></div>
                    <p>已选择 ${Array.isArray(item.selected_resource_ids) ? item.selected_resource_ids.length : 0} 个资源 · ${escapeHtml(item.status || "进行中")}${item.result ? ` · ${escapeHtml(item.result)}` : ""}</p>
                    <div class="match-history-actions"><button class="ghost" type="button" data-edit-match="${escapeHtml(item.id)}">查看 / 更新</button><button class="ghost" type="button" data-delete-match="${escapeHtml(item.id)}">删除</button></div>
                  </article>
                `,
              )
              .join("")
          : `<p class="muted match-empty">还没有保存匹配任务。</p>`
      }
    </div>
  `;
  elements.matchingHistory.querySelectorAll("[data-edit-match]").forEach((button) => {
    button.addEventListener("click", () => {
      state.matchingEditingId = button.dataset.editMatch;
      renderMatchingPage();
    });
  });
  elements.matchingHistory.querySelectorAll("[data-delete-match]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.data.matches = rows("matches").filter((item) => item.id !== button.dataset.deleteMatch);
      if (state.matchingEditingId === button.dataset.deleteMatch) state.matchingEditingId = null;
      await persist();
      renderMatchingPage();
    });
  });
}

function renderMatchingPage() {
  setMatchingUiVisible(true);
  renderMatchForm();
  renderMatchingResults(readMatchForm());
  renderMatchingHistory();
}

async function handleMatchSubmit(event) {
  event.preventDefault();
  const draft = readMatchForm();
  const selectedInputs = elements.matchingResults.querySelectorAll("[data-match-resource]:checked");
  draft.selected_resource_ids = [...selectedInputs].map((input) => input.dataset.matchResource);
  const index = state.data.matches.findIndex((row) => row.id === draft.id);
  if (index >= 0) state.data.matches[index] = draft;
  else state.data.matches.unshift(draft);
  state.matchingEditingId = draft.id;
  elements.matchingStatus.textContent = `已保存匹配任务，推荐 ${recommendResources(draft).length} 个资源。`;
  await persist();
  renderMatchingPage();
}

function renderEntityPage() {
  setEntityUiVisible(true);
  elements.newRecordBtn.textContent = `新增${config().title.replace("库", "")}`;
  renderFilters();
  const visibleRows = filterRows(rows());
  renderSummary(visibleRows);
  renderImportPreview();
  renderImportHistory();
  renderDuplicatePanel();
  renderTable(visibleRows);
  renderEditor();
}

function render() {
  renderTabs();
  if (state.activeTab === SETTINGS_TAB.key) {
    resetEditorState();
    renderEditor();
    renderSettingsPage();
    return;
  }
  if (state.activeTab === MATCHING_TAB.key) {
    resetEditorState();
    renderEditor();
    renderMatchingPage();
    return;
  }
  renderEntityPage();
}

function fieldValue(field, rawValue) {
  if (field.type === "number") return toNumber(rawValue);
  if (field.key === "country") return normalizeCountry(rawValue);
  return text(rawValue);
}

function resolveCooperationLinks(record, creators = rows("creators"), resources = rows("resources")) {
  const creatorById = creators.find((row) => row.id === text(record.creator_id));
  const resourceById = resources.find((row) => row.id === text(record.resource_id));
  const creatorByName = creators.find((row) => text(row.name) === text(record.creator_name));
  const resourceByName = resources.find((row) => text(row.name) === text(record.resource_name));
  const creator = creatorById || creatorByName;
  const resource = resourceById || resourceByName;

  if (creator) {
    record.creator_id = creator.id;
    record.creator_name = creator.name;
  } else {
    record.creator_id = text(record.creator_id);
    record.creator_name = text(record.creator_name);
  }
  if (resource) {
    record.resource_id = resource.id;
    record.resource_name = resource.name;
  } else {
    record.resource_id = text(record.resource_id);
    record.resource_name = text(record.resource_name);
  }
  return record;
}

function syncCooperationName(kind) {
  if (state.activeTab !== "cooperations") return;
  const idField = `${kind}_id`;
  const nameField = `${kind}_name`;
  const sourceType = kind === "creator" ? "creators" : "resources";
  const selected = rows(sourceType).find((row) => row.id === elements.form.elements[idField]?.value);
  if (selected && elements.form.elements[nameField]) elements.form.elements[nameField].value = selected.name || "";
}

function buildRecommendations(record, type) {
  const updates = {};
  const messages = [];

  if (type === "creators") {
    const followers = toNumber(record.followers);
    const avgViews = toNumber(record.avg_views);
    const engagement = toNumber(record.engagement);
    const inferredTags = splitTags(record.tags);

    [record.niche, record.country, record.platform].forEach((item) => {
      if (item) inferredTags.push(item);
    });

    if (followers >= 100000) inferredTags.push("头部达人");
    else if (followers >= 50000) inferredTags.push("腰部达人");
    else if (followers > 0) inferredTags.push("长尾达人");

    if (avgViews >= 20000) inferredTags.push("高播放");
    if (engagement >= 4) inferredTags.push("高互动");
    if (record.exchange === "是") inferredTags.push("可置换");
    if (record.cps === "是") inferredTags.push("可CPS");

    const nextTags = joinTags(inferredTags);
    if (nextTags && nextTags !== text(record.tags)) {
      updates.tags = nextTags;
      messages.push(`建议补充标签：${nextTags}`);
    }

    if (!record.content_types && /tiktok|reels|shorts|youtube/i.test(text(record.platform))) {
      updates.content_types = "短视频";
      messages.push("平台偏视频内容，建议内容类型先填短视频。");
    }

    if (record.longterm !== "是" && avgViews >= 10000 && engagement >= 3) {
      updates.longterm = "是";
      messages.push("播放和互动达到可跟进水平，建议标记长期合作意向。");
    }
  }

  if (type === "resources") {
    const orders = toNumber(record.historical_orders);
    const clicks = toNumber(record.historical_clicks);
    let grade = "";
    if (orders >= 200 || clicks >= 10000) grade = "A";
    else if (orders >= 50 || clicks >= 3000) grade = "B";
    else if (orders > 0 || clicks > 0) grade = "C";

    if (grade && grade !== text(record.grade)) {
      updates.grade = grade;
      messages.push(`按历史点击 / 订单建议分级为 ${grade}。`);
    }

    if (record.suitable_new !== "是" && text(record.cycle).includes("周")) {
      updates.suitable_new = "是";
      messages.push("上线周期偏稳定，建议标记适合新品测试。");
    }

    if (record.suitable_clearance !== "是" && record.coupon === "是") {
      updates.suitable_clearance = "是";
      messages.push("可用优惠券，建议标记适合清库存。");
    }
  }

  if (type === "cooperations") {
    const clicks = toNumber(record.clicks);
    const orders = toNumber(record.orders);
    const conversion = clicks > 0 ? orders / clicks : 0;

    if (!record.result) {
      if (orders >= 10 || conversion >= 0.03) {
        updates.result = "表现稳定，可复投";
        messages.push("订单或转化率达到复投观察线，建议标记可复投。");
      } else if (orders > 0) {
        updates.result = "待观察";
        messages.push("已有订单但样本偏少，建议继续观察。");
      } else {
        updates.result = "无订单";
        messages.push("暂无订单，建议复盘素材、渠道和产品匹配度。");
      }
    }
  }

  if (!messages.length) messages.push("暂无明显建议，当前记录可以直接保存。");
  return { updates, messages };
}

function applyRecommendations(record, type, mode = "emptyOnly") {
  const { updates } = buildRecommendations(record, type);
  for (const [key, value] of Object.entries(updates)) {
    if (mode === "force" || !text(record[key])) {
      record[key] = value;
    }
  }
  return record;
}

function readFormRecord(options = {}) {
  const shouldApply = options.applyRecommendations !== false;
  const formData = new FormData(elements.form);
  const record = clone(state.editorDraft || (state.editingId ? rows().find((row) => row.id === state.editingId) : defaultRecord(state.activeTab)));

  for (const field of config().fields) {
    record[field.key] = fieldValue(field, formData.get(field.key));
  }

  if (state.activeTab === "cooperations") resolveCooperationLinks(record);
  record.updatedAt = new Date().toISOString();
  if (shouldApply) applyRecommendations(record, state.activeTab);
  return record;
}

function hasMeaningfulRecordContent(record) {
  return config().fields.some((field) => {
    const value = record[field.key];
    if (field.type === "number") return toNumber(value) !== 0;
    if (field.type === "select") return false;
    return Boolean(text(value));
  });
}

function focusFirstMissingRequired(record) {
  const required = config().fields.find((field) => field.required && !text(record[field.key]));
  elements.form.elements[required?.key]?.focus();
}

async function commitEditor({ close = false, showError = false } = {}) {
  if (!state.editorOpen) return true;
  const record = readFormRecord();
  const changed = editableSnapshot(record) !== state.editorBaseline;

  if (!changed) {
    if (close) {
      resetEditorState();
      render();
    }
    return true;
  }

  if (!state.editingId && !hasMeaningfulRecordContent(record)) {
    if (close) {
      resetEditorState();
      render();
    }
    return true;
  }

  const missingRequired = config().fields.find((field) => field.required && !text(record[field.key]));
  if (missingRequired) {
    elements.editorStatus.textContent = `请填写必填项：${missingRequired.label}。`;
    focusFirstMissingRequired(record);
    return false;
  }

  const identityConflicts = findIdentityConflicts(record);
  if (identityConflicts.length) {
    renderIdentityCheck();
    const first = identityConflicts[0];
    const message = `无法保存：${first.matched.join("、")}已存在于${entityConfig[first.type].title}「${text(first.row.name) || text(first.row.social_url)}」。`;
    elements.editorStatus.textContent = message;
    if (showError) window.alert(message);
    return false;
  }

  const list = rows();
  const index = list.findIndex((row) => row.id === record.id);
  if (index >= 0) list[index] = record;
  else list.unshift(record);
  await persist();
  if (close) {
    resetEditorState();
    render();
  } else {
    state.editingId = record.id;
    state.editorDraft = clone(record);
    state.editorBaseline = editableSnapshot(record);
    elements.editorStatus.textContent = "已自动保存。";
  }
  return true;
}

async function handleSubmit(event) {
  event.preventDefault();
  await commitEditor({ close: true, showError: true });
}

async function closeEditor() {
  await commitEditor({ close: true });
}

async function handleEditorBackdropClick(event) {
  if (event.target !== elements.editorBackdrop) return;
  await closeEditor();
}

async function handleEditorEscape(event) {
  if (event.key === "Escape" && state.editorOpen) {
    event.preventDefault();
    await closeEditor();
  }
}

async function handleEditorCloseClick() {
  await closeEditor();
}

async function transferLeadToCreator(leadId) {
  const lead = rows("leads").find((row) => row.id === leadId);
  if (!lead) return;

  const creatorConflicts = findIdentityConflicts(lead, ["creators"]);
  if (creatorConflicts.length) {
    const conflict = creatorConflicts[0];
    window.alert(`无法转入：${conflict.matched.join("、")}已存在于达人库「${text(conflict.row.name) || text(conflict.row.social_url)}」。请编辑已有达人资料。`);
    return;
  }

  const now = new Date().toISOString();
  const creator = defaultRecord("creators");
  for (const key of ["brand", "name", "social_url", "email", "email_source", "country", "platform", "niche", "followers", "avg_views", "engagement"]) {
    creator[key] = lead[key] ?? creator[key];
  }
  creator.status = "待联系";
  creator.tags = joinTags([lead.niche, lead.country, lead.platform].filter(Boolean));
  creator.notes = combineTextValues([text(lead.notes), `来自待开发达人记录 ${lead.id}`]);
  creator.updatedAt = now;

  const leadIndex = state.data.leads.findIndex((row) => row.id === lead.id);
  if (leadIndex >= 0) {
    state.data.leads[leadIndex] = { ...lead, status: "已转达人库", updatedAt: now };
  }
  state.data.creators.unshift(creator);
  state.activeTab = "creators";
  resetEditorState();
  state.filters = createFilters("creators");
  state.filterMenu = null;
  await persist();
  render();
}

function parseCsv(textContent) {
  const parsedRows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < textContent.length; index += 1) {
    const char = textContent[index];
    const next = textContent[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => text(value))) parsedRows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => text(value))) parsedRows.push(row);
  if (!parsedRows.length) return [];

  const headers = parsedRows[0].map(text);
  return parsedRows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = text(cells[index]);
    });
    return record;
  });
}

function detectMapping(rawRows, type) {
  const headers = Object.keys(rawRows[0] || {});
  const mapping = {};

  for (const field of entityConfig[type].fields) {
    const aliases = [field.key, field.label, ...(entityConfig[type].aliases[field.key] || [])].map(normalizeHeader);
    mapping[field.key] = headers.find((header) => aliases.includes(normalizeHeader(header))) || "";
  }

  return mapping;
}

function normalizeSelect(rawValue, field) {
  const value = text(rawValue);
  if (!value) return field.options[0] || "";
  if (field.options.includes(value)) return value;
  if (["yes", "y", "true", "1", "接受", "可"].includes(value.toLowerCase())) return field.options.includes("是") ? "是" : field.options[0];
  if (["no", "n", "false", "0", "不接受"].includes(value.toLowerCase())) return field.options.includes("否") ? "否" : field.options[0];
  return field.options.find((option) => value.includes(option) || option.includes(value)) || field.options[0] || "";
}

function importRows(rawRows, type, mapping) {
  const imported = [];

  for (const rawRow of rawRows) {
    const record = defaultRecord(type);
    for (const field of entityConfig[type].fields) {
      const header = mapping?.[field.key];
      const rawValue = header ? rawRow[header] : "";
      if (field.type === "number") record[field.key] = toNumber(rawValue);
      else if (field.type === "select") record[field.key] = normalizeSelect(rawValue, field);
      else if (field.key === "country") record[field.key] = normalizeCountry(rawValue);
      else record[field.key] = text(rawValue);
    }

    if (type === "cooperations") resolveCooperationLinks(record);
    const requiredOk = entityConfig[type].fields.filter((field) => field.required).every((field) => text(record[field.key]));
    const hasAny = entityConfig[type].fields.some((field) => text(record[field.key]));
    if (requiredOk && hasAny) {
      applyRecommendations(record, type);
      imported.push(record);
    }
  }

  return imported;
}

function renderImportPreview() {
  const draft = state.importDraft;
  if (!draft) {
    elements.importPreview.classList.add("hidden");
    elements.importPreview.innerHTML = "";
    return;
  }

  const item = entityConfig[draft.type];
  const headers = Object.keys(draft.rawRows[0] || {});
  const importableRows = importRows(draft.rawRows, draft.type, draft.mapping);
  const previewFields = item.fields.slice(0, 8);
  const sheetCount = new Set(draft.rawRows.map((row) => row["来源工作表"]).filter(Boolean)).size;
  const sheetText = sheetCount > 1 ? `，来自 ${sheetCount} 个工作表` : "";
  const impact = getImportImpact(importableRows, draft.type);

  elements.importStatus.textContent = `已解析 ${draft.rawRows.length} 行${sheetText}，当前可导入 ${importableRows.length} 行。`;
  elements.importPreview.classList.remove("hidden");
  elements.importPreview.innerHTML = `
    <div class="import-preview-header">
      <div>
        <h3>导入预览：${item.title}</h3>
        <p>${escapeHtml(draft.filename)}，确认字段映射后再写入本地资料库。</p>
      </div>
      <p>已识别字段 ${Object.values(draft.mapping).filter(Boolean).length}/${item.fields.length}</p>
    </div>
    <div class="import-impact">
      <span>预计新增：<strong>${impact.created}</strong></span>
      <span>预计更新：<strong>${impact.updated}</strong></span>
      <span>文件内重复：<strong>${impact.duplicates}</strong></span>
      ${impact.identityDuplicates ? `<span>跨库重复：<strong>${impact.identityDuplicates}</strong></span>` : ""}
    </div>
    <div class="mapping-grid">
      ${item.fields
        .map(
          (field) => `<div class="mapping-item"><label>${field.label}${field.required ? " *" : ""}</label><select data-map-field="${field.key}"><option value="">不导入</option>${headers
            .map((header) => `<option value="${escapeHtml(header)}" ${draft.mapping[field.key] === header ? "selected" : ""}>${escapeHtml(header)}</option>`)
            .join("")}</select></div>`,
        )
        .join("")}
    </div>
    <div class="preview-table">
      <table>
        <thead><tr>${previewFields.map((field) => `<th>${field.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${
            importableRows.length
              ? importableRows
                  .slice(0, 3)
                  .map((row) => `<tr>${previewFields.map((field) => `<td>${escapeHtml(row[field.key])}</td>`).join("")}</tr>`)
                  .join("")
              : `<tr><td colspan="${previewFields.length}">没有可导入记录，请检查必填字段映射。</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <div class="preview-actions">
      <button class="ghost" type="button" id="cancelImportBtn">取消</button>
      <button class="primary" type="button" id="confirmImportBtn" ${importableRows.length ? "" : "disabled"}>确认导入</button>
    </div>
  `;

  elements.importPreview.querySelectorAll("[data-map-field]").forEach((select) => {
    select.addEventListener("change", () => {
      state.importDraft.mapping[select.dataset.mapField] = select.value;
      renderImportPreview();
    });
  });
  elements.importPreview.querySelector("#cancelImportBtn")?.addEventListener("click", () => {
    state.importDraft = null;
    elements.importStatus.textContent = "已取消导入。";
    renderImportPreview();
  });
  elements.importPreview.querySelector("#confirmImportBtn")?.addEventListener("click", confirmImport);
}

function renderImportHistory() {
  const history = (state.data.importHistory || []).slice(0, 5);
  if (!history.length) {
    elements.importHistory.innerHTML = "";
    return;
  }

  elements.importHistory.innerHTML = `
    <div class="import-history-header">
      <h3>导入历史</h3>
      <span>最近 ${history.length} 次</span>
    </div>
    <div class="history-list">
      ${history
        .map(
          (item) => `
            <div class="history-item">
              <div>
                <strong>${escapeHtml(entityConfig[item.type]?.title || item.type)}</strong>
                <span>${escapeHtml(item.filename || "未命名文件")}</span>
              </div>
              <p>新增 ${toNumber(item.createdCount)} / 更新 ${toNumber(item.updatedCount)} / 跳过 ${toNumber(item.skippedCount)} · ${formatDateTime(item.createdAt)}</p>
              <button class="ghost" type="button" data-rollback="${escapeHtml(item.id)}">回滚</button>
            </div>
          `,
        )
        .join("")}
    </div>
  `;

  elements.importHistory.querySelectorAll("[data-rollback]").forEach((button) => {
    button.addEventListener("click", () => rollbackImport(button.dataset.rollback));
  });
}

function duplicateIgnoreKey(type, ids) {
  return `${type}:${ids.slice().sort().join("|")}`;
}

function duplicateGroupKey(record, type, mode = "exact") {
  if (type === "creators" || type === "leads") {
    const socialUrl = normalizeSocialIdentity(record.social_url);
    const email = normalizeHeader(record.email);
    const name = normalizeHeader(record.name);
    const platform = normalizeHeader(record.platform);
    if (mode === "exact" && socialUrl) return `social:${socialUrl}`;
    if (mode === "exact" && email) return `email:${email}`;
    if (!name) return "";
    return mode === "exact" && platform ? `name-platform:${name}:${platform}` : `name:${name}`;
  }

  if (type === "resources") {
    const name = normalizeHeader(record.name);
    const resourceType = normalizeHeader(record.type);
    if (!name) return "";
    return mode === "exact" && resourceType ? `name-type:${name}:${resourceType}` : `name:${name}`;
  }

  const creator = normalizeHeader(record.creator_name);
  const product = normalizeHeader(record.product);
  const date = normalizeHeader(record.post_date);
  if (!creator || !product) return "";
  return date ? `creator-product-date:${creator}:${product}:${date}` : `creator-product:${creator}:${product}`;
}

function findDuplicateGroups(type = state.activeTab) {
  const groups = new Map();
  const addGroup = (key, reason, record) => {
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { key, reason, rows: [] });
    groups.get(key).rows.push(record);
  };

  for (const record of rows(type)) {
    addGroup(duplicateGroupKey(record, type, "exact"), "关键字段完全一致", record);
    if (type !== "cooperations") addGroup(duplicateGroupKey(record, type, "name"), "名称一致，建议人工确认", record);
  }

  const signatures = new Set();
  return [...groups.values()]
    .map((group) => {
      const uniqueRows = [...new Map(group.rows.map((row) => [row.id, row])).values()];
      return { ...group, rows: uniqueRows };
    })
    .filter((group) => group.rows.length > 1)
    .filter((group) => {
      const signature = group.rows.map((row) => row.id).sort().join("|");
      if (signatures.has(signature)) return false;
      signatures.add(signature);
      return !state.duplicateIgnores.has(duplicateIgnoreKey(type, group.rows.map((row) => row.id)));
    })
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 6);
}

function recordCompleteness(record, type = state.activeTab) {
  return entityConfig[type].fields.reduce((score, field) => {
    const value = record[field.key];
    if (field.type === "number") return score + (toNumber(value) > 0 ? 1 : 0);
    return score + (text(value) ? 1 : 0);
  }, 0);
}

function preferredRecord(group, type = state.activeTab) {
  return group.rows
    .slice()
    .sort((a, b) => {
      const scoreDiff = recordCompleteness(b, type) - recordCompleteness(a, type);
      if (scoreDiff) return scoreDiff;
      return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
    })[0];
}

function summarizeDuplicateRow(record, type = state.activeTab) {
  if (type === "creators" || type === "leads") {
    return [record.name, record.platform, record.email, record.country, record.status, record.tags].map(text).filter(Boolean).join(" · ");
  }
  if (type === "resources") {
    return [record.name, record.type, record.country, `等级 ${text(record.grade) || "-"}`, record.categories].map(text).filter(Boolean).join(" · ");
  }
  return [record.creator_name, record.product, record.post_date, record.model, record.result].map(text).filter(Boolean).join(" · ");
}

function renderDuplicatePanel() {
  const groups = findDuplicateGroups();
  if (!elements.duplicatePanel) return;
  if (!groups.length) {
    elements.duplicatePanel.innerHTML = "";
    return;
  }

  elements.duplicatePanel.innerHTML = `
    <div class="duplicate-header">
      <div>
        <h3>疑似重复</h3>
        <p>发现 ${groups.length} 组，可先合并信息更完整的记录，或暂时忽略。</p>
      </div>
      <span>${entityConfig[state.activeTab].title}</span>
    </div>
    <div class="duplicate-list">
      ${groups
        .map((group) => {
          const keeper = preferredRecord(group);
          const ids = group.rows.map((row) => row.id).join(",");
          return `
            <div class="duplicate-item">
              <div class="duplicate-main">
                <strong>${escapeHtml(group.reason)}</strong>
                <span>建议保留：${escapeHtml(summarizeDuplicateRow(keeper))}</span>
              </div>
              <div class="duplicate-rows">
                ${group.rows
                  .map(
                    (row) => `
                      <button class="duplicate-row" type="button" data-view-duplicate="${escapeHtml(row.id)}">
                        <span>${escapeHtml(summarizeDuplicateRow(row))}</span>
                        <em>${recordCompleteness(row)} 项信息</em>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
              <div class="duplicate-actions">
                <button class="ghost" type="button" data-ignore-duplicate="${escapeHtml(ids)}">忽略</button>
                <button class="primary" type="button" data-merge-duplicate="${escapeHtml(ids)}">合并到建议保留</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  elements.duplicatePanel.querySelectorAll("[data-view-duplicate]").forEach((button) => {
    button.addEventListener("click", () => {
      openEditor(button.dataset.viewDuplicate);
    });
  });

  elements.duplicatePanel.querySelectorAll("[data-ignore-duplicate]").forEach((button) => {
    button.addEventListener("click", () => {
      const ids = button.dataset.ignoreDuplicate.split(",").filter(Boolean);
      state.duplicateIgnores.add(duplicateIgnoreKey(state.activeTab, ids));
      saveDuplicateIgnores();
      renderDuplicatePanel();
    });
  });

  elements.duplicatePanel.querySelectorAll("[data-merge-duplicate]").forEach((button) => {
    button.addEventListener("click", () => mergeDuplicateGroup(button.dataset.mergeDuplicate.split(",").filter(Boolean)));
  });
}

function dedupeKey(record, type) {
  if (type === "creators" || type === "leads") {
    const socialUrl = normalizeSocialIdentity(record.social_url);
    const email = normalizeHeader(record.email);
    if (socialUrl) return `social::${socialUrl}`;
    if (email) return `email::${email}`;
    return `${normalizeHeader(record.name)}::${normalizeHeader(record.platform)}`;
  }
  if (type === "resources") return `${normalizeHeader(record.name)}::${normalizeHeader(record.type)}`;
  return `${normalizeHeader(record.creator_name)}::${normalizeHeader(record.product)}::${normalizeHeader(record.post_date)}`;
}

function snapshotBusinessState() {
  return {
    meta: clone(state.data.meta || { version: 1 }),
    creators: clone(state.data.creators || []),
    resources: clone(state.data.resources || []),
    leads: clone(state.data.leads || []),
    cooperations: clone(state.data.cooperations || []),
    matches: clone(state.data.matches || []),
  };
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function rollbackImport(historyId) {
  const history = state.data.importHistory || [];
  const item = history.find((entry) => entry.id === historyId);
  if (!item) return;

  if (!window.confirm(`确认回滚导入：${item.filename || "未命名文件"}？业务资料会恢复到该次导入前。`)) {
    return;
  }

  const snapshot = typeof item.snapshot === "string" ? JSON.parse(item.snapshot) : item.snapshot;
  state.data.creators = Array.isArray(snapshot?.creators) ? snapshot.creators : [];
  state.data.resources = Array.isArray(snapshot?.resources) ? snapshot.resources : [];
  state.data.leads = Array.isArray(snapshot?.leads) ? snapshot.leads : [];
  state.data.cooperations = Array.isArray(snapshot?.cooperations) ? snapshot.cooperations : [];
  state.data.matches = Array.isArray(snapshot?.matches) ? snapshot.matches : state.data.matches;
  state.data.meta = { version: 1, ...(snapshot?.meta || {}), updatedAt: new Date().toISOString() };
  state.data.importHistory = history.filter((entry) => entry.id !== historyId);
  resetEditorState();
  state.importDraft = null;
  elements.importStatus.textContent = `已回滚导入：${item.filename || "未命名文件"}。`;
  await persist();
  render();
}

function combineTextValues(values, separator = "\n") {
  return [...new Set(values.map(text).filter(Boolean))].join(separator);
}

function mergedRecordValue(field, keeper, duplicates) {
  const values = [keeper, ...duplicates].map((row) => row[field.key]);
  if (["tags", "content_types", "categories"].includes(field.key)) {
    return joinTags(values.flatMap(splitList));
  }
  if (["notes", "contact"].includes(field.key)) {
    return combineTextValues(values, "\n");
  }
  if (field.type === "number") {
    return Math.max(...values.map(toNumber));
  }

  return text(keeper[field.key]) || text(values.find((value) => text(value))) || "";
}

function mergeRecords(keeper, duplicates, type = state.activeTab) {
  const merged = { ...keeper };
  for (const field of entityConfig[type].fields) {
    merged[field.key] = mergedRecordValue(field, keeper, duplicates);
  }

  const createdValues = [keeper, ...duplicates].map((row) => row.createdAt).filter(Boolean).sort();
  merged.createdAt = createdValues[0] || keeper.createdAt || new Date().toISOString();
  merged.updatedAt = new Date().toISOString();
  return merged;
}

async function mergeDuplicateGroup(ids) {
  const selectedRows = rows().filter((row) => ids.includes(row.id));
  if (selectedRows.length < 2) return;

  const group = { rows: selectedRows };
  const keeper = preferredRecord(group);
  const duplicates = selectedRows.filter((row) => row.id !== keeper.id);
  const merged = mergeRecords(keeper, duplicates);
  const duplicateIds = new Set(duplicates.map((row) => row.id));
  const list = rows();
  const keeperIndex = list.findIndex((row) => row.id === keeper.id);
  if (keeperIndex < 0) return;

  state.data[state.activeTab] = list
    .map((row, index) => (index === keeperIndex ? merged : row))
    .filter((row) => !duplicateIds.has(row.id));
  resetEditorState();
  state.duplicateIgnores.delete(duplicateIgnoreKey(state.activeTab, ids));
  saveDuplicateIgnores();
  elements.importStatus.textContent = `已合并 ${duplicates.length + 1} 条疑似重复记录，保留 ${summarizeDuplicateRow(merged)}。`;
  await persist();
  render();
}

function getImportImpact(importableRows, type) {
  const existingKeys = new Set(rows(type).map((row) => dedupeKey(row, type)).filter((key) => key !== "::" && key !== "::::"));
  const seenKeys = new Set();
  let created = 0;
  let updated = 0;
  let duplicates = 0;
  let identityDuplicates = 0;

  for (const record of importableRows) {
    const key = dedupeKey(record, type);
    if (!key.replace(/:/g, "")) continue;
    if (seenKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    seenKeys.add(key);
    if (["creators", "leads"].includes(type)) {
      const identityConflicts = findIdentityConflicts(record);
      if (identityConflicts.some((item) => item.type !== type)) {
        identityDuplicates += 1;
        continue;
      }
      if (identityConflicts.some((item) => item.type === type)) {
        updated += 1;
        continue;
      }
    }
    if (existingKeys.has(key)) updated += 1;
    else created += 1;
  }

  return { created, updated, duplicates, identityDuplicates };
}

async function confirmImport() {
  const draft = state.importDraft;
  if (!draft) return;
  const list = state.data[draft.type];
  const beforeSnapshot = snapshotBusinessState();
  const beforeCounts = {
    creators: state.data.creators.length,
    resources: state.data.resources.length,
    leads: state.data.leads.length,
    cooperations: state.data.cooperations.length,
    matches: state.data.matches.length,
  };
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let identitySkipped = 0;
  const seenKeys = new Set();

  for (const record of importRows(draft.rawRows, draft.type, draft.mapping)) {
    const key = dedupeKey(record, draft.type);
    if (seenKeys.has(key)) {
      skipped += 1;
      continue;
    }
    seenKeys.add(key);
    let identityMatch;
    if (["creators", "leads"].includes(draft.type)) {
      const identityConflicts = findIdentityConflicts(record);
      if (identityConflicts.some((item) => item.type !== draft.type)) {
        identitySkipped += 1;
        continue;
      }
      identityMatch = identityConflicts.find((item) => item.type === draft.type);
    }
    const index = identityMatch ? list.findIndex((row) => row.id === identityMatch.row.id) : list.findIndex((row) => dedupeKey(row, draft.type) === key);
    if (index >= 0) {
      list[index] = { ...list[index], ...record, id: list[index].id, createdAt: list[index].createdAt, updatedAt: new Date().toISOString() };
      updated += 1;
    } else {
      list.unshift(record);
      created += 1;
    }
  }

  if (created || updated || skipped) {
    const now = new Date().toISOString();
    state.data.importHistory = [
      {
        id: uid("IM"),
        type: draft.type,
        filename: draft.filename,
        totalRows: draft.rawRows.length,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        beforeCounts,
        snapshot: beforeSnapshot,
        createdAt: now,
        updatedAt: now,
      },
      ...(state.data.importHistory || []),
    ].slice(0, 20);
  }

  state.importDraft = null;
  elements.importStatus.textContent = `导入完成：新增 ${created} 条，更新 ${updated} 条，跳过文件内重复 ${skipped} 条${identitySkipped ? `，跳过跨库重复 ${identitySkipped} 条` : ""}。`;
  await persist();
  render();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function parseTableFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (lowerName.endsWith(".xlsx")) {
    const response = await apiFetch(API_IMPORT_EXCEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentBase64: await readFileAsBase64(file) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Excel 导入失败");
    return Array.isArray(payload) ? payload : [];
  }
  throw new Error("仅支持 CSV 或 XLSX 文件");
}

async function handleTableImport(file) {
  elements.importStatus.textContent = "正在解析表格...";
  const rawRows = await parseTableFile(file);
  if (!rawRows.length) {
    elements.importStatus.textContent = "没有解析到表格记录，请检查文件内容。";
    return;
  }
  state.importDraft = {
    filename: file.name,
    type: state.activeTab,
    rawRows,
    mapping: detectMapping(rawRows, state.activeTab),
  };
  renderImportPreview();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `resource-workbench-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvEscape(value) {
  const output = text(value);
  return /[",\n\r]/.test(output) ? `"${output.replaceAll('"', '""')}"` : output;
}

function exportCsv() {
  const item = config();
  const headers = item.fields.map((field) => field.key);
  const lines = [headers.join(",")];
  for (const row of rows()) lines.push(headers.map((header) => csvEscape(row[header])).join(","));

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importJson(file) {
  const payload = JSON.parse(await file.text());
  state.data = ensureStateShape(payload);
  resetEditorState();
  await persist();
  render();
}

function resetForm() {
  state.editingId = null;
  state.editorDraft = defaultRecord(state.activeTab);
  state.editorBaseline = editableSnapshot(state.editorDraft);
  renderForm();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.matchForm.addEventListener("submit", handleMatchSubmit);
  elements.applyAssistantBtn.addEventListener("click", applyAssistantUpdates);
  elements.aiSettingsForm.addEventListener("submit", saveAiSettings);
  elements.aiSettingsStatusBtn.addEventListener("click", checkAiStatus);
  elements.aiSettingsReloadBtn.addEventListener("click", async () => {
    await loadAiSettings();
    renderAiSettings();
  });
  const bindKeySource = (source, keyInput) => {
    source.addEventListener("change", () => {
      const useEnvironment = source.value === "environment";
      keyInput.disabled = useEnvironment;
      keyInput.placeholder = useEnvironment ? "由环境变量读取" : "已保存时可留空不改";
    });
  };
  bindKeySource(elements.aiKeySource, elements.aiApiKey);
  bindKeySource(elements.leadAiKeySource, elements.leadAiApiKey);
  elements.resetFormBtn.addEventListener("click", resetForm);
  elements.newRecordBtn.addEventListener("click", () => openEditor());
  elements.editorBackdrop.addEventListener("click", handleEditorBackdropClick);
  elements.closeEditorBtn.addEventListener("click", handleEditorCloseClick);
  document.addEventListener("keydown", handleEditorEscape);
  elements.resetMatchBtn.addEventListener("click", () => {
    state.matchingEditingId = null;
    elements.matchingStatus.textContent = "";
    renderMatchingPage();
  });
  elements.refreshBtn.addEventListener("click", async () => {
    await loadState();
    await loadAiSettings();
    render();
  });
  elements.searchInput.addEventListener("input", () => {
    if (state.activeTab === SETTINGS_TAB.key || state.activeTab === MATCHING_TAB.key) return;
    state.filters.query = elements.searchInput.value;
    renderFilteredRows();
  });
  elements.filterSetupBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    state.filterMenu = state.filterMenu?.mode === "drawer" ? null : { mode: "drawer", openSections: ["__fields"] };
    renderFilters();
  });
  elements.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-control]");
    if (!button) return;
    event.stopPropagation();
    const key = button.dataset.filterControl;
    state.filterMenu = { mode: "drawer", openSections: [key] };
    renderFilters();
  });
  elements.filterPopover.addEventListener("change", async (event) => {
    const visibility = event.target.closest("[data-filter-visibility]");
    if (visibility) {
      const key = visibility.dataset.filterVisibility;
      const active = new Set(state.filters.activeKeys);
      if (visibility.checked) active.add(key);
      else {
        active.delete(key);
        delete state.filters.values[key];
      }
      state.filters.activeKeys = [...active];
      state.data.meta.filterPreferences[state.activeTab] = [...active];
      try {
        await persist();
      } catch (error) {
        elements.importStatus.textContent = error.message || "筛选设置保存失败";
      }
      renderFilteredRows();
      return;
    }

    const valueControl = event.target.closest("[data-filter-value]");
    if (!valueControl) return;
    const key = valueControl.dataset.filterValue;
    const values = new Set(state.filters.values[key] || []);
    if (valueControl.checked) values.add(valueControl.value);
    else values.delete(valueControl.value);
    state.filters.values[key] = [...values];
    renderFilteredRows();
  });
  elements.filterPopover.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === elements.filterPopover || event.target.closest("[data-filter-close]")) {
      state.filterMenu = null;
      renderFilters();
      return;
    }

    const section = event.target.closest("[data-filter-section]");
    if (section) {
      const key = section.dataset.filterSection;
      const openSections = new Set(state.filterMenu?.openSections || []);
      if (openSections.has(key)) openSections.delete(key);
      else openSections.add(key);
      state.filterMenu = { mode: "drawer", openSections: [...openSections] };
      renderFilterPopover();
      return;
    }

    if (event.target.closest("[data-filter-clear-all]")) {
      state.filters.values = {};
      renderFilteredRows();
      return;
    }

    const reset = event.target.closest("[data-filter-reset]");
    if (!reset) return;
    delete state.filters.values[reset.dataset.filterReset];
    renderFilteredRows();
  });
  elements.clearFiltersBtn.addEventListener("click", () => {
    state.filters.values = {};
    renderFilteredRows();
  });
  document.addEventListener("click", (event) => {
    if (!state.filterMenu || elements.filterUi.contains(event.target)) return;
    state.filterMenu = null;
    renderFilters();
  });
  elements.optionEntitySelect.addEventListener("change", () => {
    state.optionSettingsType = elements.optionEntitySelect.value;
    elements.optionValueInput.value = "";
    renderOptionSettings();
  });
  elements.optionFieldSelect.addEventListener("change", () => {
    elements.optionValueInput.value = "";
    renderOptionSettings();
  });
  elements.addOptionBtn.addEventListener("click", addCustomOption);
  elements.optionValueInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCustomOption();
  });
  elements.optionTags.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-option]");
    if (!button) return;
    await removeCustomOption(button.dataset.removeOption, button.dataset.optionValue);
  });
  elements.exportStateBtn.addEventListener("click", exportJson);
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.settingsBtn.addEventListener("click", () => {
    state.activeTab = SETTINGS_TAB.key;
    resetEditorState();
    state.matchingEditingId = null;
    render();
  });
  elements.importStateInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) await importJson(file);
    event.target.value = "";
  });
  elements.importTableInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    try {
      if (file) await handleTableImport(file);
    } catch (error) {
      elements.importStatus.textContent = error.message || "导入失败";
    } finally {
      event.target.value = "";
    }
  });
}

async function init() {
  bindEvents();
  loadDuplicateIgnores();
  await loadState();
  await loadAiSettings();
  render();
}

function bindAccessGate() {
  if (!isOnlineDeployment()) {
    hideAccessGate();
    return;
  }
  document.body.classList.add("online-deployment");
  elements.accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = text(elements.accessPassword.value);
    if (!password) return;
    elements.accessStatus.textContent = "正在验证...";
    sessionStorage.setItem(STORAGE_ACCESS_PASSWORD, password);
    try {
      const response = await apiFetch(API_STATE);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "访问密码不正确。");
      hideAccessGate();
      await init();
    } catch (error) {
      sessionStorage.removeItem(STORAGE_ACCESS_PASSWORD);
      showAccessGate(error.message || "无法连接线上服务。");
    }
  });
  showAccessGate();
}

async function start() {
  bindAccessGate();
  if (isOnlineDeployment()) {
    const password = sessionStorage.getItem(STORAGE_ACCESS_PASSWORD);
    if (!password) return;
    const response = await apiFetch(API_STATE);
    if (!response.ok) {
      sessionStorage.removeItem(STORAGE_ACCESS_PASSWORD);
      showAccessGate("访问密码不正确，请重新输入。");
      return;
    }
    hideAccessGate();
  }
  await init();
}

start().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><h1>启动失败</h1><p>${escapeHtml(error.message)}</p></main>`;
});
