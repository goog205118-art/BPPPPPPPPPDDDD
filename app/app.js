const STORAGE_FALLBACK = "resource-workbench-fallback";
const STORAGE_DUPLICATE_IGNORES = "resource-workbench-duplicate-ignores";
const STORAGE_OUTREACH_OPTIONS = "resource-workbench.outreach-options.v1";
const API_STATE = "/api/state";
const API_IMPORT_EXCEL = "/api/import-excel";
const API_CREATOR_ENRICH = "/api/ai/creator-enrich";
const API_AI_SETTINGS = "/api/ai/settings";
const API_AI_STATUS = "/api/ai/status";
const API_OUTREACH_GENERATE = "/api/ai/outreach-generate";
const API_PRODUCT_PREVIEW = "/api/products/preview";
const API_MAIL_SETTINGS = "/api/mail/settings";
const API_MAIL_TEST = "/api/mail/test";
const API_MAIL_SYNC = "/api/mail/sync";
const API_MAIL_SMTP_TEST = "/api/mail/test-smtp";
const API_MAIL_SEND = "/api/mail/send";
const API_FOLLOWUP_ANALYZE = "/api/ai/followup-analyze";
const API_FOLLOWUP_DRAFT = "/api/ai/followup-draft";
const STORAGE_ACCESS_PASSWORD = "resource-workbench-access-password";
const SETTINGS_TAB = { key: "settings", title: "设置" };
const MATCHING_TAB = { key: "matches", title: "本周资源匹配" };
const FOLLOW_UP_STAGES = ["初步沟通", "已回复", "谈合作方式 / 报价", "条款确认", "待寄样", "运输中", "已签收", "待发布", "已发布", "数据回收", "已结案", "暂停跟进", "未谈妥"];
const FOLLOW_UP_TERMINAL_STAGES = new Set(["已结案", "暂停跟进", "未谈妥"]);
const FOLLOW_UP_BOARD_COLUMNS = [
  { title: "初步沟通", stages: ["初步沟通", "已回复"] },
  { title: "合作协商", stages: ["谈合作方式 / 报价", "条款确认"] },
  { title: "寄样", stages: ["待寄样"] },
  { title: "物流", stages: ["运输中", "已签收"] },
  { title: "待发布", stages: ["待发布"] },
  { title: "发布与回收", stages: ["已发布", "数据回收"] },
];
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
    standard: { ...defaultAiProfile },
    advanced: { ...defaultAiProfile },
    special: { ...defaultAiProfile },
  },
  assignments: {
    creator: "advanced",
    lead: "standard",
    product: "standard",
    outreach: "special",
    followup: "special",
  },
};
const defaultMailSettings = {
  accounts: [],
  contentPolicy: {
    cacheBodies: false,
    allowAiContext: false,
    retentionDays: 90,
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
      ["handle", "Handle"],
      ["brand", "品牌"],
      ["platform", "平台"],
      ["social_url", "社媒地址"],
      ["email", "达人邮箱"],
      ["country", "国家/地区"],
      ["niche", "内容垂类"],
      ["followers", "粉丝"],
      ["status", "状态"],
      ["priority", "优先级"],
      ["tags", "标签"],
    ],
    filters: [
      { key: "brand", label: "品牌", options: ["全部"], dynamic: true },
      { key: "country", label: "国家", options: ["全部"], dynamic: true },
    ],
    fields: [
      { key: "brand", label: "所属品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "name", label: "达人名称", type: "text", required: true },
      { key: "handle", label: "账号 Handle", type: "text", placeholder: "例如：@creator_name" },
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
      { key: "priority", label: "跟进优先级", type: "select", options: ["高", "中", "低"] },
      { key: "longterm", label: "是否愿意长期合作", type: "select", options: yesNoOptions },
      { key: "content_types", label: "可提供内容类型", type: "text" },
      { key: "ad_auth", label: "是否允许广告授权二次使用", type: "select", options: ["否", "可谈", "是"] },
      { key: "tags", label: "标签", type: "text", placeholder: "用 | 分隔" },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      name: ["达人名称", "达人", "名称", "账号名", "博主", "KOL", "creator", "name"],
      handle: ["账号handle", "handle", "用户名", "账号", "社媒账号"],
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
      priority: ["跟进优先级", "优先级", "priority"],
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
      ["handle", "Handle"],
      ["brand", "品牌"],
      ["platform", "平台"],
      ["social_url", "社媒地址"],
      ["country", "国家/地区"],
      ["niche", "内容垂类"],
      ["followers", "粉丝"],
      ["status", "开发状态"],
      ["priority", "优先级"],
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
      { key: "handle", label: "账号 Handle", type: "text", placeholder: "例如：@creator_name" },
      { key: "platform", label: "平台", type: "text" },
      { key: "country", label: "国家和地区", type: "text" },
      { key: "niche", label: "内容垂类", type: "text" },
      { key: "followers", label: "粉丝量", type: "number" },
      { key: "avg_views", label: "近 30 条平均播放", type: "number" },
      { key: "engagement", label: "互动率 (%)", type: "number", step: "0.1" },
      { key: "email", label: "达人邮箱", type: "text", placeholder: "仅保留可验证公开邮箱" },
      { key: "email_source", label: "邮箱公开来源", type: "text", placeholder: "公开页面链接" },
      { key: "status", label: "开发状态", type: "select", options: ["待开发", "已联系", "已转达人库", "不适合"] },
      { key: "priority", label: "跟进优先级", type: "select", options: ["高", "中", "低"] },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      social_url: ["社媒地址", "达人链接", "主页链接", "账号链接", "链接", "profile", "url", "social_url", "homepage"],
      name: ["达人名称", "达人", "名称", "账号名", "博主", "KOL", "creator", "name"],
      handle: ["账号handle", "handle", "用户名", "账号", "社媒账号"],
      platform: ["平台", "渠道", "platform"],
      country: ["国家和地区", "国家", "地区", "country"],
      niche: ["内容垂类", "领域", "品类", "niche"],
      followers: ["粉丝量", "粉丝", "followers"],
      avg_views: ["近30条平均播放", "平均播放", "均播", "avg_views"],
      engagement: ["互动率", "互动率(%)", "engagement"],
      email: ["达人邮箱", "邮箱", "邮件", "email", "e-mail", "mail"],
      email_source: ["邮箱公开来源", "邮箱来源", "邮箱出处", "email_source", "email source"],
      status: ["开发状态", "状态", "status"],
      priority: ["跟进优先级", "优先级", "priority"],
      notes: ["备注", "说明", "notes"],
    },
  },
  products: {
    title: "产品库",
    formTitle: "新增产品",
    hint: "按国家、类目和店铺沉淀可用于达人开发的产品。填写产品链接后可自动读取公开标题和主图，也可人工调整。",
    prefix: "PD",
    columns: [
      ["name", "产品名称"],
      ["brand", "品牌"],
      ["country", "国家/地区"],
      ["category", "产品类目"],
      ["store", "店铺"],
      ["product_url", "产品链接"],
    ],
    filters: [],
    fields: [
      { key: "brand", label: "所属品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "country", label: "国家和地区", type: "text", placeholder: "例如：美国" },
      { key: "category", label: "产品类目", type: "text", placeholder: "例如：运动相机配件" },
      { key: "store", label: "店铺", type: "text", placeholder: "例如：Amazon US / 品牌独立站" },
      { key: "name", label: "产品名称", type: "text", required: true, placeholder: "产品公开名称" },
      { key: "product_url", label: "产品链接", type: "text", required: true, placeholder: "官网 / Amazon 商品链接" },
      { key: "image_url", label: "产品主图链接", type: "text", placeholder: "自动读取失败时可人工粘贴图片链接" },
      { key: "description", label: "产品卖点和适配场景", type: "textarea", placeholder: "AI 写邮件时会作为参考，不填写则只使用公开产品名称和链接" },
      { key: "tags", label: "产品标签", type: "text", placeholder: "用 | 分隔，例如：骑行|POV|礼品" },
      { key: "notes", label: "内部备注", type: "textarea" },
    ],
    aliases: {
      brand: ["所属品牌", "品牌", "brand", "brand name"],
      country: ["国家和地区", "国家", "地区", "country"],
      category: ["产品类目", "类目", "品类", "category"],
      store: ["店铺", "站点", "store", "shop"],
      name: ["产品名称", "名称", "product", "product name", "name"],
      product_url: ["产品链接", "商品链接", "产品地址", "url", "product_url"],
      image_url: ["产品主图链接", "图片链接", "image", "image_url"],
      description: ["产品卖点和适配场景", "产品描述", "卖点", "description"],
      tags: ["产品标签", "标签", "tags"],
      notes: ["内部备注", "备注", "notes"],
    },
  },
  cooperations: {
    title: "合作记录",
    formTitle: "新增合作",
    hint: "记录单次合作、复盘结论和下一次动作。",
    prefix: "CO",
    columns: [
      ["cooperation_no", "合作单号"],
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
      { key: "cooperation_no", label: "合作单号", type: "text", placeholder: "内部合作单号 / PO 编号" },
      { key: "creator_id", label: "关联达人", type: "reference", reference: "creators" },
      { key: "resource_id", label: "关联资源", type: "reference", reference: "resources" },
      { key: "match_id", label: "关联匹配任务", type: "reference", reference: "matches" },
      { key: "creator_name", label: "达人名称", type: "text", required: true },
      { key: "resource_name", label: "资源名称", type: "text" },
      { key: "product", label: "合作产品", type: "text" },
      { key: "product_id", label: "关联产品库商品", type: "reference", reference: "products" },
      { key: "model", label: "合作方式", type: "select", options: ["置换", "付费", "CPS", "混合"] },
      { key: "budget", label: "预算 / 成本", type: "number" },
      { key: "tracking_no", label: "寄样物流单号", type: "text", placeholder: "可选，便于后续追踪" },
      { key: "shipping_status", label: "寄样物流状态", type: "select", options: ["未寄样", "待揽收", "运输中", "已送达", "异常"] },
      { key: "post_date", label: "发布时间", type: "date" },
      { key: "link", label: "内容链接", type: "text" },
      { key: "clicks", label: "点击", type: "number" },
      { key: "orders", label: "订单", type: "number" },
      { key: "result", label: "复盘结论", type: "text" },
      { key: "notes", label: "备注", type: "textarea" },
    ],
    aliases: {
      cooperation_no: ["合作单号", "合作编号", "订单号", "po编号", "po number", "cooperation_no"],
      creator_id: ["达人ID", "达人 id", "creator_id"],
      resource_id: ["资源ID", "资源 id", "resource_id"],
      match_id: ["匹配任务ID", "任务ID", "match_id"],
      creator_name: ["达人名称", "达人", "creator_name"],
      resource_name: ["资源名称", "资源", "resource_name"],
      product: ["合作产品", "产品", "product"],
      product_id: ["产品ID", "产品 id", "product_id"],
      model: ["合作方式", "合作形式", "model"],
      budget: ["预算", "成本", "预算 / 成本", "budget"],
      tracking_no: ["寄样物流单号", "物流单号", "快递单号", "tracking_no", "tracking number"],
      shipping_status: ["寄样物流状态", "物流状态", "寄样状态", "shipping_status"],
      post_date: ["发布时间", "日期", "post_date"],
      link: ["内容链接", "链接", "link"],
      clicks: ["点击", "clicks"],
      orders: ["订单", "orders"],
      result: ["复盘结论", "结果", "结论", "result"],
      notes: ["备注", "说明", "notes"],
    },
  },
  followups: {
    title: "合作跟进",
    formTitle: "新增合作跟进",
    hint: "将具体合作推进、下一步动作、物流和邮件往来沉淀在同一张跟进卡中。",
    prefix: "FU",
    columns: [],
    filters: [],
    fields: [
      { key: "creator_id", label: "关联达人", type: "reference", reference: "creators", required: true },
      { key: "cooperation_id", label: "关联合作记录", type: "reference", reference: "cooperations" },
      { key: "brand", label: "品牌", type: "brand", placeholder: "选择或输入品牌" },
      { key: "product_id", label: "关联产品", type: "reference", reference: "products" },
      { key: "stage", label: "当前阶段", type: "select", options: FOLLOW_UP_STAGES },
      { key: "priority", label: "优先级", type: "select", options: ["高", "中", "低"] },
      { key: "cooperation_mode", label: "合作方式", type: "select", options: ["待确认", "置换", "付费", "CPS", "混合"] },
      { key: "next_action", label: "下一步动作", type: "text", required: true, placeholder: "例如：确认收件地址并安排寄样" },
      { key: "next_follow_up_at", label: "下次跟进时间", type: "datetime-local" },
      { key: "shipping_status", label: "寄样状态", type: "select", options: ["未寄样", "待揽收", "运输中", "已送达", "异常"] },
      { key: "tracking_no", label: "物流单号", type: "text" },
      { key: "publish_due_at", label: "预计发布时间", type: "date" },
      { key: "publish_url", label: "发布链接", type: "text" },
      { key: "notes", label: "内部备注", type: "textarea" },
    ],
    aliases: {},
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
  products: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "category", label: "产品类目" },
    { key: "store", label: "店铺" },
    { key: "tags", label: "产品标签" },
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
    { key: "priority", label: "跟进优先级" },
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
    { key: "priority", label: "跟进优先级" },
    { key: "email", label: "邮箱", mode: "email" },
  ],
  products: [
    { key: "brand", label: "品牌" },
    { key: "country", label: "国家地区" },
    { key: "category", label: "产品类目" },
    { key: "store", label: "店铺" },
    { key: "tags", label: "产品标签" },
  ],
  cooperations: [
    { key: "model", label: "合作方式" },
    { key: "product", label: "合作产品" },
    { key: "result", label: "复盘结论" },
  ],
  followups: [
    { key: "stage", label: "当前阶段" },
    { key: "priority", label: "优先级" },
    { key: "brand", label: "品牌" },
  ],
};

const defaultFilterPreferences = {
  creators: ["brand", "country"],
  resources: ["brand", "country"],
  leads: ["brand", "country", "platform", "email"],
  products: ["brand", "country", "category", "store"],
  cooperations: ["model", "result"],
  followups: [],
};

const pinnedFilterPreferences = {
  creators: ["brand", "country"],
  resources: ["brand", "country"],
  leads: ["brand", "country"],
  products: ["brand", "country"],
  cooperations: [],
  followups: [],
};

const timeZoneOptions = [
  { value: "Asia/Shanghai", label: "中国 北京" },
  { value: "America/Los_Angeles", label: "美国 西岸" },
  { value: "America/New_York", label: "美国 东岸" },
  { value: "America/Chicago", label: "美国 中部" },
  { value: "America/Toronto", label: "加拿大 多伦多" },
  { value: "America/Vancouver", label: "加拿大 温哥华" },
  { value: "America/Mexico_City", label: "墨西哥城" },
  { value: "America/Sao_Paulo", label: "巴西 圣保罗" },
  { value: "Europe/London", label: "英国 伦敦" },
  { value: "Europe/Paris", label: "法国 巴黎" },
  { value: "Europe/Berlin", label: "德国 柏林" },
  { value: "Europe/Madrid", label: "西班牙 马德里" },
  { value: "Asia/Tokyo", label: "日本 东京" },
  { value: "Asia/Seoul", label: "韩国 首尔" },
  { value: "Asia/Singapore", label: "新加坡" },
  { value: "Asia/Dubai", label: "阿联酋 迪拜" },
  { value: "Australia/Sydney", label: "澳大利亚 悉尼" },
  { value: "UTC", label: "协调世界时 UTC" },
];

const defaultTimeZones = ["Asia/Shanghai", "America/Los_Angeles", "America/New_York"];

const emptyState = {
  meta: { version: 1, updatedAt: new Date().toISOString() },
  brands: [],
  creators: [],
  resources: [],
  leads: [],
  products: [],
  cooperations: [],
  matches: [],
  followUps: [],
  followUpEvents: [],
  mailInbox: [],
  importHistory: [],
};

const state = {
  data: clone(emptyState),
  activeTab: "creators",
  editingId: null,
  editorDraft: null,
  editorBaseline: "",
  editorOpen: false,
  editorSaving: false,
  matchingEditingId: null,
  importDraft: null,
  duplicateIgnores: new Set(),
  filters: { query: "", activeKeys: [], values: {} },
  filterMenu: null,
  optionSettingsType: "creators",
  aiSettings: clone(defaultAiSettings),
  mailSettings: clone(defaultMailSettings),
  mailAccountEditingId: null,
  brandEditingId: null,
  activeBrandId: "",
  followUpInboxNotice: { tone: "", text: "" },
  followUpInboxBusyId: "",
  selectedLeadIds: new Set(),
  productFilters: { query: "", brand: "", country: "", category: "", store: "" },
  outreach: { open: false, leadIds: [], result: null },
  globalSearch: { open: false, query: "" },
  creatorDrawer: { open: false, creatorId: null },
  mailImport: { open: false, followUpId: null, messages: [], status: "" },
  followUpBoardFilter: { query: "", stage: "", priority: "", overdueOnly: false },
  followUpDetail: { open: false, followUpId: null, analysis: null, draft: null },
};

let timeZoneTickerId = null;
let activityDepth = 0;
let productPickerAbortController = null;

const elements = {
  accessGate: document.getElementById("accessGate"),
  accessForm: document.getElementById("accessForm"),
  accessPassword: document.getElementById("accessPassword"),
  accessStatus: document.getElementById("accessStatus"),
  activityOverlay: document.getElementById("activityOverlay"),
  activityTitle: document.getElementById("activityTitle"),
  activityMessage: document.getElementById("activityMessage"),
  tabs: document.getElementById("tabs"),
  summary: document.getElementById("summary"),
  workspace: document.querySelector(".workspace"),
  settingsPage: document.getElementById("settingsPage"),
  matchingPage: document.getElementById("matchingPage"),
  productPage: document.getElementById("productPage"),
  followUpPage: document.getElementById("followUpPage"),
  matchForm: document.getElementById("matchForm"),
  matchFormTitle: document.getElementById("matchFormTitle"),
  matchingResults: document.getElementById("matchingResults"),
  matchingHistory: document.getElementById("matchingHistory"),
  matchingStatus: document.getElementById("matchingStatus"),
  resetMatchBtn: document.getElementById("resetMatchBtn"),
  aiSettingsForm: document.getElementById("aiSettingsForm"),
  standardAiApiBaseUrl: document.getElementById("standardAiApiBaseUrl"),
  standardAiProtocol: document.getElementById("standardAiProtocol"),
  standardAiApiKey: document.getElementById("standardAiApiKey"),
  standardAiKeySource: document.getElementById("standardAiKeySource"),
  standardAiModel: document.getElementById("standardAiModel"),
  standardAiProxyUrl: document.getElementById("standardAiProxyUrl"),
  advancedAiApiBaseUrl: document.getElementById("advancedAiApiBaseUrl"),
  advancedAiProtocol: document.getElementById("advancedAiProtocol"),
  advancedAiApiKey: document.getElementById("advancedAiApiKey"),
  advancedAiKeySource: document.getElementById("advancedAiKeySource"),
  advancedAiModel: document.getElementById("advancedAiModel"),
  advancedAiProxyUrl: document.getElementById("advancedAiProxyUrl"),
  specialAiApiBaseUrl: document.getElementById("specialAiApiBaseUrl"),
  specialAiProtocol: document.getElementById("specialAiProtocol"),
  specialAiApiKey: document.getElementById("specialAiApiKey"),
  specialAiKeySource: document.getElementById("specialAiKeySource"),
  specialAiModel: document.getElementById("specialAiModel"),
  specialAiProxyUrl: document.getElementById("specialAiProxyUrl"),
  creatorAiProfile: document.getElementById("creatorAiProfile"),
  leadAiProfile: document.getElementById("leadAiProfile"),
  productAiProfile: document.getElementById("productAiProfile"),
  outreachAiProfile: document.getElementById("outreachAiProfile"),
  followUpAiProfile: document.getElementById("followUpAiProfile"),
  aiSettingsStatus: document.getElementById("aiSettingsStatus"),
  aiSettingsStatusBtn: document.getElementById("aiSettingsStatusBtn"),
  aiSettingsReloadBtn: document.getElementById("aiSettingsReloadBtn"),
  mailSettingsForm: document.getElementById("mailSettingsForm"),
  mailAccountList: document.getElementById("mailAccountList"),
  mailNewAccountBtn: document.getElementById("mailNewAccountBtn"),
  mailCancelEditBtn: document.getElementById("mailCancelEditBtn"),
  mailEditorTitle: document.getElementById("mailEditorTitle"),
  mailAccountId: document.getElementById("mailAccountId"),
  mailBrandId: document.getElementById("mailBrandId"),
  mailEnabled: document.getElementById("mailEnabled"),
  mailLabel: document.getElementById("mailLabel"),
  mailFromName: document.getElementById("mailFromName"),
  mailHost: document.getElementById("mailHost"),
  mailPort: document.getElementById("mailPort"),
  mailSecure: document.getElementById("mailSecure"),
  mailUser: document.getElementById("mailUser"),
  mailPassword: document.getElementById("mailPassword"),
  mailInboxFolder: document.getElementById("mailInboxFolder"),
  mailSentFolder: document.getElementById("mailSentFolder"),
  mailSyncDays: document.getElementById("mailSyncDays"),
  mailTestBtn: document.getElementById("mailTestBtn"),
  mailSmtpEnabled: document.getElementById("mailSmtpEnabled"),
  mailSmtpUseImapPassword: document.getElementById("mailSmtpUseImapPassword"),
  mailSmtpHost: document.getElementById("mailSmtpHost"),
  mailSmtpPort: document.getElementById("mailSmtpPort"),
  mailSmtpSecure: document.getElementById("mailSmtpSecure"),
  mailSmtpUser: document.getElementById("mailSmtpUser"),
  mailSmtpPassword: document.getElementById("mailSmtpPassword"),
  mailSmtpTestBtn: document.getElementById("mailSmtpTestBtn"),
  mailSyncBtn: document.getElementById("mailSyncBtn"),
  mailCacheBodies: document.getElementById("mailCacheBodies"),
  mailAllowAiContext: document.getElementById("mailAllowAiContext"),
  mailBodyRetentionDays: document.getElementById("mailBodyRetentionDays"),
  mailSaveContentPolicyBtn: document.getElementById("mailSaveContentPolicyBtn"),
  mailSettingsStatus: document.getElementById("mailSettingsStatus"),
  timezoneBar: document.getElementById("timezoneBar"),
  brandWorkspaceSelect: document.getElementById("brandWorkspaceSelect"),
  brandManageBtn: document.getElementById("brandManageBtn"),
  brandNewBtn: document.getElementById("brandNewBtn"),
  brandList: document.getElementById("brandList"),
  brandForm: document.getElementById("brandForm"),
  brandEditorTitle: document.getElementById("brandEditorTitle"),
  brandCancelEditBtn: document.getElementById("brandCancelEditBtn"),
  brandId: document.getElementById("brandId"),
  brandName: document.getElementById("brandName"),
  brandCountry: document.getElementById("brandCountry"),
  brandLanguage: document.getElementById("brandLanguage"),
  brandCurrency: document.getElementById("brandCurrency"),
  brandTimezone: document.getElementById("brandTimezone"),
  brandSettingsStatus: document.getElementById("brandSettingsStatus"),
  timezoneSettingsFields: document.getElementById("timezoneSettingsFields"),
  saveTimezonesBtn: document.getElementById("saveTimezonesBtn"),
  timezoneSettingsStatus: document.getElementById("timezoneSettingsStatus"),
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
  outreachBtn: document.getElementById("outreachBtn"),
  newRecordBtn: document.getElementById("newRecordBtn"),
  resetFormBtn: document.getElementById("resetFormBtn"),
  outreachModal: document.getElementById("outreachModal"),
  outreachBackdrop: document.getElementById("outreachBackdrop"),
  closeOutreachBtn: document.getElementById("closeOutreachBtn"),
  outreachTitle: document.getElementById("outreachTitle"),
  outreachHint: document.getElementById("outreachHint"),
  outreachForm: document.getElementById("outreachForm"),
  outreachResult: document.getElementById("outreachResult"),
  globalSearchBtn: document.getElementById("globalSearchBtn"),
  globalSearchModal: document.getElementById("globalSearchModal"),
  globalSearchBackdrop: document.getElementById("globalSearchBackdrop"),
  closeGlobalSearchBtn: document.getElementById("closeGlobalSearchBtn"),
  globalSearchInput: document.getElementById("globalSearchInput"),
  globalSearchHint: document.getElementById("globalSearchHint"),
  globalSearchResults: document.getElementById("globalSearchResults"),
  creatorDrawer: document.getElementById("creatorDrawer"),
  creatorDrawerBackdrop: document.getElementById("creatorDrawerBackdrop"),
  creatorDrawerHead: document.getElementById("creatorDrawerHead"),
  creatorDrawerContent: document.getElementById("creatorDrawerContent"),
  mailImportModal: document.getElementById("mailImportModal"),
  mailImportBackdrop: document.getElementById("mailImportBackdrop"),
  closeMailImportBtn: document.getElementById("closeMailImportBtn"),
  mailImportTitle: document.getElementById("mailImportTitle"),
  mailImportHint: document.getElementById("mailImportHint"),
  mailImportInput: document.getElementById("mailImportInput"),
  mailImportPreview: document.getElementById("mailImportPreview"),
  mailImportStatus: document.getElementById("mailImportStatus"),
  mailImportConfirmBtn: document.getElementById("mailImportConfirmBtn"),
  followUpDetailModal: document.getElementById("followUpDetailModal"),
  followUpDetailBackdrop: document.getElementById("followUpDetailBackdrop"),
  closeFollowUpDetailBtn: document.getElementById("closeFollowUpDetailBtn"),
  followUpDetailTitle: document.getElementById("followUpDetailTitle"),
  followUpDetailHint: document.getElementById("followUpDetailHint"),
  followUpDetailBody: document.getElementById("followUpDetailBody"),
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
  products: new Set(["product_url", "image_url", "description", "tags", "notes"]),
  followups: new Set(["next_action", "publish_url", "notes"]),
};

const formFocusFields = {
  creators: new Set(["name", "social_url", "followers", "avg_views", "engagement"]),
  leads: new Set(["social_url", "name", "followers", "avg_views", "engagement"]),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTimeZones(raw = []) {
  const allowed = new Set(timeZoneOptions.map((item) => item.value));
  const selected = Array.isArray(raw) ? raw.map((item) => String(item)).filter((item) => allowed.has(item)) : [];
  const unique = [...new Set(selected)];
  for (const fallback of defaultTimeZones) {
    if (unique.length >= 3) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }
  return unique.slice(0, 3);
}

function isOnlineDeployment() {
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function showAccessGate(message = "") {
  document.body.classList.add("access-locked");
  elements.accessGate.classList.remove("is-leaving");
  elements.accessGate.classList.remove("hidden");
  elements.accessStatus.textContent = message;
  window.setTimeout(() => elements.accessPassword.focus(), 0);
}

function hideAccessGate() {
  document.body.classList.remove("access-locked");
  elements.accessGate.classList.add("is-leaving");
  elements.accessStatus.textContent = "";
  elements.accessPassword.value = "";
  window.setTimeout(() => {
    if (elements.accessGate.classList.contains("is-leaving")) {
      elements.accessGate.classList.add("hidden");
      elements.accessGate.classList.remove("is-leaving");
    }
  }, 220);
}

function showActivity(title = "正在处理", message = "请稍候...") {
  activityDepth += 1;
  elements.activityTitle.textContent = title;
  elements.activityMessage.textContent = message;
  elements.activityOverlay.classList.remove("hidden");
  window.requestAnimationFrame(() => elements.activityOverlay.classList.add("is-visible"));
}

function hideActivity() {
  activityDepth = Math.max(0, activityDepth - 1);
  if (activityDepth) return;
  elements.activityOverlay.classList.remove("is-visible");
  window.setTimeout(() => {
    if (!activityDepth) elements.activityOverlay.classList.add("hidden");
  }, 180);
}

async function withActivity(title, message, action) {
  showActivity(title, message);
  try {
    return await action();
  } finally {
    hideActivity();
  }
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

const defaultOutreachOptions = {
  productIds: [],
  language: "English",
  tone: "自然友好",
  cooperation: ["让 AI 根据量级建议"],
  mentionCooperation: true,
  includeProductLinks: true,
  mentionProductBenefits: true,
  allowSampleChoice: false,
  customRules: "",
};

function normalizeOutreachOptions(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaultOutreachOptions,
    productIds: Array.isArray(source.productIds) ? source.productIds.map(text).filter(Boolean) : [],
    language: ["English", "creator"].includes(source.language) ? source.language : defaultOutreachOptions.language,
    tone: ["自然友好", "专业简洁", "创作者同行"].includes(source.tone) ? source.tone : defaultOutreachOptions.tone,
    cooperation: Array.isArray(source.cooperation)
      ? source.cooperation.map(text).filter(Boolean)
      : [...defaultOutreachOptions.cooperation],
    mentionCooperation: source.mentionCooperation !== false,
    includeProductLinks: source.includeProductLinks !== false,
    mentionProductBenefits: source.mentionProductBenefits !== false,
    allowSampleChoice: source.allowSampleChoice === true,
    customRules: text(source.customRules),
  };
}

function loadOutreachOptions() {
  try {
    return normalizeOutreachOptions(JSON.parse(localStorage.getItem(STORAGE_OUTREACH_OPTIONS) || "{}"));
  } catch {
    return { ...defaultOutreachOptions, cooperation: [...defaultOutreachOptions.cooperation] };
  }
}

function saveOutreachOptions(options) {
  localStorage.setItem(STORAGE_OUTREACH_OPTIONS, JSON.stringify(normalizeOutreachOptions(options)));
}

function outreachOptionsFromForm(form) {
  const formData = new FormData(form);
  return normalizeOutreachOptions({
    productIds: formData.getAll("productIds"),
    language: text(formData.get("language")),
    tone: text(formData.get("tone")),
    cooperation: formData.getAll("cooperation"),
    mentionCooperation: formData.get("mentionCooperation") === "on",
    includeProductLinks: formData.get("includeProductLinks") === "on",
    mentionProductBenefits: formData.get("mentionProductBenefits") === "on",
    allowSampleChoice: formData.get("allowSampleChoice") === "on",
    customRules: text(formData.get("customRules")),
  });
}

function config() {
  return entityConfig[state.activeTab];
}

const BRANDED_TYPES = new Set(["creators", "resources", "leads", "products", "cooperations", "matches", "followups"]);

function brandKey(value) {
  return text(value).toLocaleLowerCase().replace(/\s+/g, " ");
}

function brandByName(name, data = state.data) {
  const key = brandKey(name);
  if (!key) return null;
  return (data.brands || []).find((brand) => brandKey(brand.name) === key) || null;
}

function brandByIdFromData(id, data = state.data) {
  const value = text(id);
  if (!value) return null;
  return (data.brands || []).find((brand) => text(brand.id) === value) || null;
}

function ensureBrand(data, name) {
  const normalized = text(name);
  if (!normalized) return null;
  const existing = brandByName(normalized, data);
  if (existing) return existing;
  const now = new Date().toISOString();
  const brand = {
    id: uid("BR"),
    name: normalized,
    default_country: "",
    default_language: "",
    timezone: "",
    currency: "",
    createdAt: now,
    updatedAt: now,
  };
  data.brands = [...(data.brands || []), brand].sort((a, b) => text(a.name).localeCompare(text(b.name), "zh-CN"));
  return brand;
}

function currentBrand() {
  return brandByIdFromData(state.activeBrandId);
}

function applyRecordBrand(record, data = state.data, inheritedBrand = null) {
  const linked = brandByIdFromData(record?.brand_id, data);
  // Prefer a stable brand_id. Old display text can be stale and must not create a new workspace.
  const named = !linked && text(record?.brand) ? ensureBrand(data, record.brand) : null;
  const inherited = !linked && !named && inheritedBrand
    ? (brandByIdFromData(inheritedBrand.id, data) || ensureBrand(data, inheritedBrand.name))
    : null;
  const brand = linked || named || inherited || null;
  if (brand) {
    record.brand_id = brand.id;
    record.brand = brand.name;
  } else {
    record.brand_id = text(record?.brand_id);
    record.brand = text(record?.brand);
  }
  return record;
}

function renderBrandWorkspace() {
  const brands = state.data.brands || [];
  if (state.activeBrandId && !brandByIdFromData(state.activeBrandId)) state.activeBrandId = "";
  elements.brandWorkspaceSelect.innerHTML = [
    `<option value="">全部品牌</option>`,
    ...brands.map((brand) => `<option value="${escapeHtml(brand.id)}">${escapeHtml(brand.name)}</option>`),
  ].join("");
  elements.brandWorkspaceSelect.value = state.activeBrandId;
  elements.brandWorkspaceSelect.title = state.activeBrandId
    ? `当前工作区：${currentBrand()?.name || "未命名品牌"}`
    : "当前查看全部品牌";
}

const BRAND_USAGE_COLLECTIONS = [
  ["creators", "达人"],
  ["leads", "待开发达人"],
  ["resources", "资源"],
  ["products", "产品"],
  ["cooperations", "合作记录"],
  ["matches", "资源匹配"],
  ["followUps", "合作跟进"],
  ["followUpEvents", "跟进事件"],
  ["mailInbox", "待归档邮件"],
];

function getBrandUsage(brandId) {
  const id = text(brandId);
  const records = BRAND_USAGE_COLLECTIONS.map(([key, label]) => {
    const count = (state.data[key] || []).filter((row) => text(row?.brand_id) === id).length;
    return { key, label, count };
  }).filter((item) => item.count);
  const accountCount = (state.mailSettings.accounts || []).filter((account) => text(account?.brand_id) === id).length;
  return {
    records,
    accountCount,
    total: records.reduce((sum, item) => sum + item.count, 0) + accountCount,
  };
}

function brandEditorValue() {
  const editing = (state.data.brands || []).find((brand) => text(brand.id) === text(state.brandEditingId));
  return editing ? clone(editing) : {
    id: "",
    name: "",
    default_country: "",
    default_language: "",
    currency: "",
    timezone: currentBrand()?.timezone || "",
  };
}

function renderBrandManager() {
  const brands = state.data.brands || [];
  const brand = brandEditorValue();
  if (state.brandEditingId && !brand.id) state.brandEditingId = null;
  const timeZoneOptionsMarkup = [
    `<option value="">不设置默认时区</option>`,
    ...timeZoneOptions.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
  ].join("");
  elements.brandList.innerHTML = brands.length
    ? brands
        .map((item) => {
          const usage = getBrandUsage(item.id);
          const usageText = [
            ...usage.records.map((record) => `${record.label} ${record.count}`),
            usage.accountCount ? `官方邮箱 ${usage.accountCount}` : "",
          ].filter(Boolean);
          const isActive = text(item.id) === text(state.activeBrandId);
          const deleteTitle = usage.total
            ? `该品牌仍关联 ${usageText.join("、")}，不能删除`
            : "删除空品牌工作区";
          return `
            <article class="brand-row ${isActive ? "is-active" : ""} ${text(item.id) === text(state.brandEditingId) ? "is-editing" : ""}">
              <div class="brand-row-main">
                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  ${isActive ? `<span class="brand-active-badge">当前工作区</span>` : ""}
                </div>
                <small>${escapeHtml([item.default_country || "未设置市场", item.default_language || "未设置语言", item.currency || "未设置币种", item.timezone ? getTimeZoneLabel(item.timezone) : "未设置时区"].join(" · "))}</small>
                <span>${escapeHtml(usageText.length ? usageText.join(" · ") : "暂无关联资料，可删除")}</span>
              </div>
              <div class="brand-row-actions">
                <button type="button" class="ghost" data-brand-action="switch" data-brand-id="${escapeHtml(item.id)}" ${isActive ? "disabled" : ""}>切换</button>
                <button type="button" class="ghost" data-brand-action="edit" data-brand-id="${escapeHtml(item.id)}">编辑</button>
                <button type="button" class="ghost danger-action" data-brand-action="delete" data-brand-id="${escapeHtml(item.id)}" title="${escapeHtml(deleteTitle)}" ${usage.total ? "disabled" : ""}>删除</button>
              </div>
            </article>`;
        })
        .join("")
    : `<p class="brand-empty">还没有品牌工作区。新增一个品牌后，资料、产品、跟进与官方邮箱都会独立归属到该品牌。</p>`;
  elements.brandEditorTitle.textContent = brand.id ? `编辑品牌：${brand.name}` : "新增品牌工作区";
  elements.brandCancelEditBtn.classList.toggle("hidden", !brand.id);
  elements.brandId.value = brand.id || "";
  elements.brandName.value = brand.name || "";
  elements.brandCountry.value = brand.default_country || "";
  elements.brandLanguage.value = brand.default_language || "";
  elements.brandCurrency.value = brand.currency || "";
  elements.brandTimezone.innerHTML = timeZoneOptionsMarkup;
  elements.brandTimezone.value = brand.timezone || "";
  if (!elements.brandSettingsStatus.textContent) {
    elements.brandSettingsStatus.textContent = brands.length
      ? "编辑默认参考信息不会覆盖已有资料。"
      : "请先创建第一个品牌工作区。";
  }
}

function setBrandSettingsStatus(message) {
  elements.brandSettingsStatus.textContent = message;
}

async function syncBrandNameToMailAccounts(brand) {
  const accounts = state.mailSettings.accounts || [];
  if (!accounts.some((account) => text(account.brand_id) === text(brand.id))) return;
  const nextAccounts = accounts.map((account) => {
    if (text(account.brand_id) !== text(brand.id)) return account;
    return { ...account, brand_name: brand.name };
  });
  const response = await apiFetch(API_MAIL_SETTINGS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accounts: nextAccounts, contentPolicy: normalizedMailContentPolicy() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || "官方邮箱显示名同步失败");
  state.mailSettings = normalizeMailSettingsPayload(payload);
}

function applyBrandNameToRecords(brandId, brandName) {
  for (const key of BRAND_USAGE_COLLECTIONS.map(([collection]) => collection)) {
    state.data[key] = (state.data[key] || []).map((row) => {
      if (text(row?.brand_id) !== text(brandId)) return row;
      return { ...row, brand: brandName, updatedAt: new Date().toISOString() };
    });
  }
}

async function saveBrand(event) {
  event.preventDefault();
  const form = new FormData(elements.brandForm);
  const id = text(form.get("id"));
  const name = text(form.get("name"));
  if (!name) {
    setBrandSettingsStatus("请填写品牌名称。");
    elements.brandName.focus();
    return;
  }
  const duplicate = (state.data.brands || []).find((brand) => brandKey(brand.name) === brandKey(name) && text(brand.id) !== id);
  if (duplicate) {
    setBrandSettingsStatus(`已存在同名品牌「${duplicate.name}」。`);
    elements.brandName.focus();
    return;
  }

  const previousData = clone(state.data);
  const previousActiveBrandId = state.activeBrandId;
  const existing = (state.data.brands || []).find((brand) => text(brand.id) === id);
  if (id && !existing) {
    setBrandSettingsStatus("未找到要编辑的品牌，请重新打开设置页后再试。");
    return;
  }
  const now = new Date().toISOString();
  const nextBrand = {
    id: existing?.id || uid("BR"),
    name,
    default_country: normalizeCountry(form.get("default_country")),
    default_language: text(form.get("default_language")),
    currency: text(form.get("currency")).toUpperCase(),
    timezone: text(form.get("timezone")),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  let stateSaved = false;
  try {
    await withActivity("正在保存品牌", "正在更新品牌工作区与关联资料...", async () => {
      state.data.brands = [
        ...(state.data.brands || []).filter((brand) => text(brand.id) !== nextBrand.id),
        nextBrand,
      ].sort((left, right) => text(left.name).localeCompare(text(right.name), "zh-CN"));
      if (existing && existing.name !== nextBrand.name) applyBrandNameToRecords(nextBrand.id, nextBrand.name);
      if (!existing) state.activeBrandId = nextBrand.id;
      await persist();
      stateSaved = true;
      if (existing && existing.name !== nextBrand.name) await syncBrandNameToMailAccounts(nextBrand);
    });
  } catch (error) {
    if (!stateSaved) {
      state.data = previousData;
      state.activeBrandId = previousActiveBrandId;
    }
    renderBrandWorkspace();
    renderBrandManager();
    renderMailSettings();
    setBrandSettingsStatus(
      stateSaved
        ? `品牌资料已保存；但官方邮箱显示名未同步：${error.message || "请稍后重试"}。`
        : error.message || "品牌保存失败。",
    );
    return;
  }

  state.brandEditingId = null;
  render();
  setBrandSettingsStatus(existing ? "品牌工作区已更新。" : `已新增品牌「${nextBrand.name}」，并切换到该工作区。`);
}

async function deleteBrand(brandId) {
  const brand = (state.data.brands || []).find((item) => text(item.id) === text(brandId));
  if (!brand) return;
  const usage = getBrandUsage(brand.id);
  if (usage.total) {
    setBrandSettingsStatus(`无法删除「${brand.name}」：仍关联 ${[...usage.records.map((item) => `${item.label} ${item.count}`), usage.accountCount ? `官方邮箱 ${usage.accountCount}` : ""].filter(Boolean).join("、")}。`);
    return;
  }
  if (!window.confirm(`确认删除空品牌「${brand.name}」？此操作不会影响其他品牌资料。`)) return;
  const snapshot = clone(state.data);
  const previousActiveBrandId = state.activeBrandId;
  try {
    await withActivity("正在删除品牌", "正在移除空品牌工作区...", async () => {
      state.data.brands = (state.data.brands || []).filter((item) => text(item.id) !== text(brand.id));
      if (text(state.activeBrandId) === text(brand.id)) state.activeBrandId = "";
      if (text(state.brandEditingId) === text(brand.id)) state.brandEditingId = null;
      await persist();
    });
  } catch (error) {
    state.data = snapshot;
    state.activeBrandId = previousActiveBrandId;
    renderBrandWorkspace();
    renderBrandManager();
    setBrandSettingsStatus(error.message || "删除品牌失败。");
    return;
  }
  render();
  setBrandSettingsStatus(`已删除空品牌「${brand.name}」。`);
}

function openBrandManager({ create = false } = {}) {
  state.activeTab = SETTINGS_TAB.key;
  state.matchingEditingId = null;
  if (create) state.brandEditingId = null;
  render();
  window.requestAnimationFrame(() => {
    elements.brandForm.scrollIntoView({ behavior: "smooth", block: "start" });
    if (create) elements.brandName.focus();
  });
}

function allRows(type = state.activeTab) {
  if (type === "followups") return state.data.followUps || [];
  return state.data[type] || [];
}

function rows(type = state.activeTab) {
  const source = allRows(type);
  if (!state.activeBrandId || !BRANDED_TYPES.has(type)) return source;
  return source.filter((row) => text(row.brand_id) === text(state.activeBrandId));
}

function belongsToActiveBrand(row) {
  return !state.activeBrandId || text(row?.brand_id) === text(state.activeBrandId);
}

function referenceLabel(type, row) {
  if (type === "cooperations") {
    return [row.cooperation_no || row.no || row.id, row.creator_name, row.product].filter(Boolean).join(" · ");
  }
  return row.name || row.title || row.id;
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
  productPickerAbortController?.abort();
  productPickerAbortController = null;
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
  const pinned = pinnedFilterPreferences[type] || [];
  return [...new Set([...pinned, ...preferences].filter((key) => allowed.has(key)))];
}

function createFilters(type = state.activeTab) {
  return { query: "", activeKeys: getFilterPreferences(type), values: {} };
}

function normalizeFilterPreferences(rawPreferences = {}) {
  const output = {};
  for (const type of Object.keys(entityConfig)) {
    const allowed = new Set(getFilterDefinitions(type).map((filter) => filter.key));
    const incoming = Array.isArray(rawPreferences[type]) ? rawPreferences[type] : defaultFilterPreferences[type] || [];
    const pinned = pinnedFilterPreferences[type] || [];
    output[type] = [...new Set([...pinned, ...incoming].filter((key) => allowed.has(key)))];
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

  const brand = currentBrand();
  if (brand && BRANDED_TYPES.has(type)) {
    item.brand_id = brand.id;
    item.brand = brand.name;
    if (brand.default_country && entityConfig[type].fields.some((field) => field.key === "country")) {
      item.country = brand.default_country;
    }
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
    timeZones: normalizeTimeZones(nextState?.meta?.timeZones),
  };

  shaped.brands = [];
  for (const brand of Array.isArray(nextState?.brands) ? nextState.brands : []) {
    const name = text(brand?.name || brand?.brand);
    if (!name || brandByName(name, shaped)) continue;
    shaped.brands.push({
      id: text(brand?.id) || uid("BR"),
      name,
      default_country: normalizeCountry(brand?.default_country),
      default_language: text(brand?.default_language),
      timezone: text(brand?.timezone),
      currency: text(brand?.currency),
      createdAt: text(brand?.createdAt) || new Date().toISOString(),
      updatedAt: text(brand?.updatedAt) || new Date().toISOString(),
    });
  }
  for (const type of ["creators", "resources", "leads", "products", "cooperations", "matches", "followUps"]) {
    for (const row of Array.isArray(nextState?.[type]) ? nextState[type] : []) {
      if (text(row?.brand)) ensureBrand(shaped, row.brand);
    }
  }

  shaped.creators = Array.isArray(nextState?.creators)
    ? nextState.creators.map((row) => applyRecordBrand({ ...row, country: normalizeCountry(row.country) }, shaped))
    : [];
  shaped.resources = Array.isArray(nextState?.resources)
    ? nextState.resources.map((row) => applyRecordBrand({ ...row, country: normalizeCountry(row.country) }, shaped))
    : [];
  shaped.leads = Array.isArray(nextState?.leads)
    ? nextState.leads.map((row) => applyRecordBrand({ ...row, country: normalizeCountry(row.country) }, shaped))
    : [];
  shaped.products = Array.isArray(nextState?.products)
    ? nextState.products.map((row) => applyRecordBrand({ ...row, country: normalizeCountry(row.country) }, shaped))
    : [];
  shaped.cooperations = Array.isArray(nextState?.cooperations)
    ? nextState.cooperations.map((row) => resolveCooperationLinks({ ...row }, shaped.creators, shaped.resources, shaped))
    : [];
  shaped.followUps = Array.isArray(nextState?.followUps)
    ? nextState.followUps.map((row) => normalizeFollowUp({ ...row }, shaped.creators, shaped.cooperations, shaped))
    : [];
  const followUpById = new Map(shaped.followUps.map((row) => [text(row.id), row]));
  shaped.followUpEvents = Array.isArray(nextState?.followUpEvents)
    ? nextState.followUpEvents.map((row) => applyRecordBrand({ ...row }, shaped, followUpById.get(text(row.follow_up_id))))
    : [];
  shaped.mailInbox = Array.isArray(nextState?.mailInbox)
    ? nextState.mailInbox.map((row) => applyRecordBrand({ ...row }, shaped))
    : [];
  shaped.matches = Array.isArray(nextState?.matches)
    ? nextState.matches.map((row) => applyRecordBrand({
        ...row,
        country: normalizeCountry(row.country),
        selected_resource_ids: Array.isArray(row.selected_resource_ids) ? row.selected_resource_ids : [],
      }, shaped))
    : [];
  shaped.importHistory = Array.isArray(nextState?.importHistory) ? nextState.importHistory : [];
  shaped.brands.sort((a, b) => text(a.name).localeCompare(text(b.name), "zh-CN"));
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
    timeZones: normalizeTimeZones(state.data.meta.timeZones),
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
    state.aiSettings = normalizeAiSettingsPayload(payload);
  } catch (error) {
    if (isOnlineDeployment()) throw error;
    state.aiSettings = clone(defaultAiSettings);
  }
}

function normalizeMailSettingsPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : source;
  const rawAccounts = Array.isArray(settings.accounts)
    ? settings.accounts
    : settings.account && typeof settings.account === "object"
      ? [settings.account]
      : [];
  const account = (raw = {}) => ({
    id: text(raw.id),
    brand_id: text(raw.brand_id),
    brand_name: text(raw.brand_name),
    enabled: raw.enabled !== false,
    label: text(raw.label),
    fromName: text(raw.fromName),
    imap: {
      host: text(raw.imap?.host ?? raw.host),
      port: Number(raw.imap?.port ?? raw.port) || 993,
      secure: raw.imap?.secure ?? raw.secure ?? true,
      user: text(raw.imap?.user ?? raw.user),
      hasPassword: Boolean(raw.imap?.hasPassword ?? raw.hasPassword),
      inboxFolder: text(raw.imap?.inboxFolder ?? raw.inboxFolder) || "INBOX",
      sentFolder: text(raw.imap?.sentFolder ?? raw.sentFolder) || "Sent",
      syncDays: Number(raw.imap?.syncDays ?? raw.syncDays) || 30,
    },
    smtp: {
      enabled: raw.smtp?.enabled !== false,
      host: text(raw.smtp?.host),
      port: Number(raw.smtp?.port) || 465,
      secure: raw.smtp?.secure !== false,
      user: text(raw.smtp?.user),
      hasPassword: Boolean(raw.smtp?.hasPassword),
      useImapPassword: raw.smtp?.useImapPassword !== false,
    },
    lastSyncAt: text(raw.lastSyncAt),
    lastSyncStatus: text(raw.lastSyncStatus),
    lastSyncSummary: raw.lastSyncSummary && typeof raw.lastSyncSummary === "object" ? raw.lastSyncSummary : null,
  });
  return {
    ...clone(defaultMailSettings),
    accounts: rawAccounts.map(account),
    contentPolicy: normalizedMailContentPolicy(settings),
  };
}

function normalizedMailContentPolicy(settings = state.mailSettings) {
  const source = settings?.contentPolicy && typeof settings.contentPolicy === "object" ? settings.contentPolicy : {};
  const cacheBodies = Boolean(source.cacheBodies);
  const retentionDays = Number(source.retentionDays);
  return {
    cacheBodies,
    allowAiContext: cacheBodies && Boolean(source.allowAiContext),
    retentionDays: Number.isFinite(retentionDays) ? Math.min(365, Math.max(1, Math.round(retentionDays))) : 90,
  };
}

function readMailContentPolicy() {
  const cacheBodies = Boolean(elements.mailCacheBodies?.checked);
  const retentionDays = Number(elements.mailBodyRetentionDays?.value) || 90;
  return {
    cacheBodies,
    allowAiContext: cacheBodies && Boolean(elements.mailAllowAiContext?.checked),
    retentionDays: Math.min(365, Math.max(1, Math.round(retentionDays))),
  };
}

async function loadMailSettings() {
  try {
    const response = await apiFetch(API_MAIL_SETTINGS);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "无法读取邮箱同步设置");
    state.mailSettings = normalizeMailSettingsPayload(payload);
  } catch (error) {
    if (isOnlineDeployment()) throw error;
    state.mailSettings = clone(defaultMailSettings);
  }
}

function normalizeAiSettingsPayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const profiles = source.profiles && typeof source.profiles === "object" ? source.profiles : {};
  const directProfile = Object.keys(profiles).length ? {} : source;
  const profile = (...candidates) => {
    const found = candidates.find((candidate) => candidate && typeof candidate === "object") || {};
    return { ...clone(defaultAiProfile), ...found };
  };
  const validAssignments = new Set(["standard", "advanced", "special"]);
  const assignment = (key) => {
    const selected = text(source.assignments?.[key]);
    return validAssignments.has(selected) ? selected : defaultAiSettings.assignments[key];
  };

  return {
    ...clone(defaultAiSettings),
    profiles: {
      standard: profile(profiles.standard, profiles.lead, profiles.product, profiles.creator, directProfile),
      advanced: profile(profiles.advanced, profiles.creator, profiles.lead, directProfile),
      special: profile(profiles.special, profiles.outreach, profiles.lead, profiles.creator, directProfile),
    },
    assignments: {
      creator: assignment("creator"),
      lead: assignment("lead"),
      product: assignment("product"),
      outreach: assignment("outreach"),
      followup: assignment("followup"),
    },
  };
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
      standard: profile("standard"),
      advanced: profile("advanced"),
      special: profile("special"),
    },
    assignments: {
      creator: text(formData.get("assignments.creator")) || defaultAiSettings.assignments.creator,
      lead: text(formData.get("assignments.lead")) || defaultAiSettings.assignments.lead,
      product: text(formData.get("assignments.product")) || defaultAiSettings.assignments.product,
      outreach: text(formData.get("assignments.outreach")) || defaultAiSettings.assignments.outreach,
      followup: text(formData.get("assignments.followup")) || defaultAiSettings.assignments.followup,
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

  const standard = bindProfile("standard", {
    protocol: elements.standardAiProtocol,
    apiBaseUrl: elements.standardAiApiBaseUrl,
    keySource: elements.standardAiKeySource,
    apiKey: elements.standardAiApiKey,
    model: elements.standardAiModel,
    proxyUrl: elements.standardAiProxyUrl,
  });
  const advanced = bindProfile("advanced", {
    protocol: elements.advancedAiProtocol,
    apiBaseUrl: elements.advancedAiApiBaseUrl,
    keySource: elements.advancedAiKeySource,
    apiKey: elements.advancedAiApiKey,
    model: elements.advancedAiModel,
    proxyUrl: elements.advancedAiProxyUrl,
  });
  const special = bindProfile("special", {
    protocol: elements.specialAiProtocol,
    apiBaseUrl: elements.specialAiApiBaseUrl,
    keySource: elements.specialAiKeySource,
    apiKey: elements.specialAiApiKey,
    model: elements.specialAiModel,
    proxyUrl: elements.specialAiProxyUrl,
  });
  const assignments = { ...defaultAiSettings.assignments, ...(state.aiSettings?.assignments || {}) };
  elements.creatorAiProfile.value = assignments.creator;
  elements.leadAiProfile.value = assignments.lead;
  elements.productAiProfile.value = assignments.product;
  elements.outreachAiProfile.value = assignments.outreach;
  elements.followUpAiProfile.value = assignments.followup;
  const describe = (settings, label) => `${label}${settings.hasApiKey ? "已配置" : "未配置"}${settings.model ? `（${settings.model}）` : ""}`;
  elements.aiSettingsStatus.textContent = `${describe(standard, "普通 AI ")}；${describe(advanced, "高能力 AI ")}；${describe(special, "特殊 AI ")}。`;
}

function formatMailSyncStatus(settings = state.mailSettings) {
  const accounts = Array.isArray(settings?.accounts) ? settings.accounts : [];
  if (!accounts.length) return "尚未新增官方邮箱账户。";
  return `${accounts.length} 个账户已保存。请选择一个账户后测试 IMAP / SMTP 或手动同步。`;
}

function formatMailAccountStatus(account = {}) {
  const imap = account.imap || {};
  const summary = account.lastSyncSummary || {};
  if (!imap.host || !imap.user || !imap.hasPassword) return "IMAP 尚未完成配置";
  if (!account.lastSyncAt) return "IMAP 已配置，尚未同步";
  const status = account.lastSyncStatus || "已完成";
  const details = `扫描 ${Number(summary.scanned || 0)}，归档 ${Number(summary.matched || 0)}，待处理 ${Number(summary.pending || 0)}，跳过重复 ${Number(summary.skipped || 0)}`;
  return `${status} · ${formatDateTime(account.lastSyncAt)} · ${details}${summary.warnings?.length ? ` · ${summary.warnings.join("；")}` : ""}`;
}

function brandById(id) {
  return (state.data.brands || []).find((brand) => text(brand.id) === text(id));
}

function emptyMailAccount(brandId = state.activeBrandId) {
  const brand = brandById(brandId);
  return {
    id: "",
    brand_id: text(brand?.id),
    brand_name: text(brand?.name),
    enabled: true,
    label: "",
    fromName: "",
    imap: { host: "", port: 993, secure: true, user: "", hasPassword: false, inboxFolder: "INBOX", sentFolder: "Sent", syncDays: 30 },
    smtp: { enabled: true, host: "", port: 465, secure: true, user: "", hasPassword: false, useImapPassword: true },
    lastSyncAt: "",
    lastSyncStatus: "",
    lastSyncSummary: null,
  };
}

function mailEditingAccount() {
  const current = (state.mailSettings.accounts || []).find((account) => text(account.id) === text(state.mailAccountEditingId));
  return current ? clone(current) : emptyMailAccount();
}

function readMailSettingsForm() {
  const form = new FormData(elements.mailSettingsForm);
  const id = text(form.get("id")) || uid("MB");
  const brand = brandById(form.get("brand_id"));
  if (!brand) throw new Error("请先在资料中新增品牌，再为该品牌配置官方邮箱。");
  const account = {
    id,
    brand_id: brand.id,
    brand_name: brand.name,
    enabled: elements.mailEnabled.checked,
    label: text(form.get("label")),
    fromName: text(form.get("fromName")),
    imap: {
      host: text(form.get("imap.host")),
      port: Number(form.get("imap.port")) || 993,
      secure: elements.mailSecure.checked,
      user: text(form.get("imap.user")),
      password: text(form.get("imap.password")),
      inboxFolder: text(form.get("imap.inboxFolder")) || "INBOX",
      sentFolder: text(form.get("imap.sentFolder")) || "Sent",
      syncDays: Number(form.get("imap.syncDays")) || 30,
    },
    smtp: {
      enabled: elements.mailSmtpEnabled.checked,
      host: text(form.get("smtp.host")),
      port: Number(form.get("smtp.port")) || 465,
      secure: elements.mailSmtpSecure.checked,
      user: text(form.get("smtp.user")),
      password: text(form.get("smtp.password")),
      useImapPassword: elements.mailSmtpUseImapPassword.checked,
    },
  };
  const accounts = (state.mailSettings.accounts || []).slice();
  const index = accounts.findIndex((item) => text(item.id) === id);
  if (index >= 0) accounts[index] = account;
  else accounts.unshift(account);
  return { accounts, editingId: id, contentPolicy: readMailContentPolicy() };
}

function renderMailSettings() {
  const allAccounts = state.mailSettings.accounts || [];
  const editingAccount = allAccounts.find((item) => text(item.id) === text(state.mailAccountEditingId));
  if (state.activeBrandId && editingAccount && text(editingAccount.brand_id) !== text(state.activeBrandId)) {
    state.mailAccountEditingId = null;
  }
  const accounts = state.activeBrandId
    ? allAccounts.filter((item) => text(item.brand_id) === text(state.activeBrandId))
    : allAccounts;
  const account = mailEditingAccount();
  const imap = account.imap || {};
  const smtp = account.smtp || {};
  const brands = state.data.brands || [];
  elements.mailAccountList.innerHTML = accounts.length
    ? accounts
        .map((item) => {
          const configured = item.imap?.host && item.imap?.user && item.imap?.hasPassword;
          const smtpConfigured = item.smtp?.enabled && (item.smtp?.host || item.imap?.host) && (item.smtp?.user || item.imap?.user) && (item.smtp?.useImapPassword ? item.imap?.hasPassword : item.smtp?.hasPassword);
          return `
            <article class="mail-account-row ${text(item.id) === text(state.mailAccountEditingId) ? "is-editing" : ""}">
              <div class="mail-account-row-main">
                <strong>${escapeHtml(item.label || item.imap?.user || "未命名邮箱")}</strong>
                <small>${escapeHtml([item.brand_name || brandById(item.brand_id)?.name || "未绑定品牌", item.imap?.user || "未填写邮箱", configured ? "IMAP 已配置" : "IMAP 待配置", smtpConfigured ? "SMTP 已配置" : "SMTP 待配置"].join(" · "))}</small>
                <span>${escapeHtml(formatMailAccountStatus(item))}</span>
              </div>
              <div class="mail-account-row-actions">
                <button type="button" class="ghost" data-mail-account-action="edit" data-mail-account-id="${escapeHtml(item.id)}">编辑</button>
                <button type="button" class="ghost" data-mail-account-action="test" data-mail-account-id="${escapeHtml(item.id)}">IMAP</button>
                <button type="button" class="ghost" data-mail-account-action="smtp" data-mail-account-id="${escapeHtml(item.id)}">SMTP</button>
                <button type="button" class="ghost" data-mail-account-action="sync" data-mail-account-id="${escapeHtml(item.id)}">同步</button>
                <button type="button" class="ghost danger-action" data-mail-account-action="delete" data-mail-account-id="${escapeHtml(item.id)}">删除</button>
              </div>
            </article>`;
        })
        .join("")
    : `<p class="mail-account-empty">暂无官方邮箱账户。请先在已有品牌下新增一个账户。</p>`;
  elements.mailEditorTitle.textContent = account.id ? `编辑账户：${account.label || imap.user || "未命名账户"}` : "新增官方邮箱账户";
  elements.mailCancelEditBtn.classList.toggle("hidden", !account.id);
  elements.mailAccountId.value = account.id || "";
  elements.mailBrandId.innerHTML = [
    `<option value="">选择品牌</option>`,
    ...brands.map((brand) => `<option value="${escapeHtml(brand.id)}">${escapeHtml(brand.name)}</option>`),
  ].join("");
  elements.mailBrandId.value = account.brand_id || "";
  elements.mailEnabled.checked = account.enabled !== false;
  elements.mailLabel.value = account.label || "";
  elements.mailFromName.value = account.fromName || "";
  elements.mailHost.value = imap.host || "";
  elements.mailPort.value = String(imap.port || 993);
  elements.mailSecure.checked = imap.secure !== false;
  elements.mailUser.value = imap.user || "";
  elements.mailPassword.value = "";
  elements.mailPassword.placeholder = imap.hasPassword ? "IMAP 授权码已保存，留空不修改" : "填写邮箱授权码或专用密码";
  elements.mailInboxFolder.value = imap.inboxFolder || "INBOX";
  elements.mailSentFolder.value = imap.sentFolder || "Sent";
  elements.mailSyncDays.value = String(imap.syncDays || 30);
  elements.mailSmtpEnabled.checked = smtp.enabled !== false;
  elements.mailSmtpUseImapPassword.checked = smtp.useImapPassword !== false;
  elements.mailSmtpHost.value = smtp.host || "";
  elements.mailSmtpPort.value = String(smtp.port || 465);
  elements.mailSmtpSecure.checked = smtp.secure !== false;
  elements.mailSmtpUser.value = smtp.user || "";
  elements.mailSmtpPassword.value = "";
  elements.mailSmtpPassword.placeholder = smtp.hasPassword ? "SMTP 授权码已保存，留空不修改" : "复用 IMAP 授权码时无需填写";
  const contentPolicy = normalizedMailContentPolicy(state.mailSettings);
  elements.mailCacheBodies.checked = contentPolicy.cacheBodies;
  elements.mailAllowAiContext.checked = contentPolicy.allowAiContext;
  elements.mailAllowAiContext.disabled = !contentPolicy.cacheBodies;
  elements.mailBodyRetentionDays.value = String(contentPolicy.retentionDays);
  elements.mailSettingsStatus.textContent = formatMailSyncStatus();
}

async function saveMailSettings(event) {
  event?.preventDefault();
  elements.mailSettingsStatus.textContent = "正在保存邮箱配置...";
  try {
    const formPayload = readMailSettingsForm();
    const payload = await withActivity("正在保存邮箱配置", "正在加密保存 IMAP 授权信息...", async () => {
      const response = await apiFetch(API_MAIL_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: formPayload.accounts, contentPolicy: formPayload.contentPolicy }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "邮箱配置保存失败");
      return result;
    });
    state.mailSettings = normalizeMailSettingsPayload(payload);
    state.mailAccountEditingId = formPayload.editingId;
    renderMailSettings();
    elements.mailSettingsStatus.textContent = "邮箱账户已保存。授权码不会回显，可直接测试或手动同步。";
  } catch (error) {
    elements.mailSettingsStatus.textContent = error.message || "邮箱配置保存失败";
  }
}

async function saveMailContentPolicy() {
  elements.mailSettingsStatus.textContent = "正在保存正文策略...";
  try {
    const contentPolicy = readMailContentPolicy();
    const payload = await withActivity("正在保存正文策略", "正在更新邮件正文缓存和 AI 使用授权...", async () => {
      const response = await apiFetch(API_MAIL_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: state.mailSettings.accounts || [], contentPolicy }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "正文策略保存失败");
      return result;
    });
    state.mailSettings = normalizeMailSettingsPayload(payload);
    renderMailSettings();
    const result = payload.policyResult || {};
    const changes = [
      result.cleared ? `清除 ${result.cleared} 封正文` : "",
      result.expired ? `清理 ${result.expired} 封过期正文` : "",
      result.migrated ? `更新 ${result.migrated} 封正文保留期` : "",
    ].filter(Boolean);
    elements.mailSettingsStatus.textContent = `正文策略已保存。${changes.length ? ` ${changes.join("；")}。` : ""}`;
  } catch (error) {
    elements.mailSettingsStatus.textContent = error.message || "正文策略保存失败";
  }
}

function mailAccountIdForAction(accountId = "") {
  return text(accountId || state.mailAccountEditingId);
}

async function testMailSettings(accountId = "") {
  const selectedId = mailAccountIdForAction(accountId);
  if (!selectedId) {
    elements.mailSettingsStatus.textContent = "请先保存当前邮箱账户，再测试 IMAP。";
    return;
  }
  elements.mailSettingsStatus.textContent = "正在测试 IMAP 连接...";
  try {
    const payload = await withActivity("正在测试邮箱连接", "正在验证服务器、端口、SSL 和授权码...", async () => {
      const response = await apiFetch(API_MAIL_TEST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "邮箱连接失败");
      return result;
    });
    elements.mailSettingsStatus.textContent = `连接成功：${payload.account} · ${payload.mailbox} 共 ${Number(payload.messageCount || 0)} 封邮件。`;
  } catch (error) {
    elements.mailSettingsStatus.textContent = error.message || "邮箱连接失败";
  }
}

async function testSmtpSettings(accountId = "") {
  const selectedId = mailAccountIdForAction(accountId);
  if (!selectedId) {
    elements.mailSettingsStatus.textContent = "请先保存当前邮箱账户，再测试 SMTP。";
    return;
  }
  elements.mailSettingsStatus.textContent = "正在测试 SMTP 连接...";
  try {
    const payload = await withActivity("正在测试 SMTP", "正在验证发信服务器和授权码...", async () => {
      const response = await apiFetch(API_MAIL_SMTP_TEST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "SMTP 连接失败");
      return result;
    });
    elements.mailSettingsStatus.textContent = `SMTP 连接成功：${payload.account} · ${payload.transport}。`;
  } catch (error) {
    elements.mailSettingsStatus.textContent = error.message || "SMTP 连接失败";
  }
}

function availableMailAccount(brandId = state.activeBrandId) {
  const accounts = state.mailSettings.accounts || [];
  if (text(brandId)) {
    return accounts.find((account) => account.enabled && text(account.brand_id) === text(brandId)) || null;
  }
  return accounts.find((account) => account.enabled) || null;
}

async function syncMailbox(accountId = "") {
  const selected = (state.mailSettings.accounts || []).find((item) => text(item.id) === text(accountId));
  const account = selected || availableMailAccount();
  if (account && state.activeBrandId && text(account.brand_id) !== text(state.activeBrandId)) {
    const error = "当前工作区只能使用绑定到同一品牌的官方邮箱。请切换工作区或在设置页配置该品牌邮箱。";
    if (state.activeTab === "settings") elements.mailSettingsStatus.textContent = error;
    else elements.importStatus.textContent = error;
    return;
  }
  if (!account?.enabled) {
    state.activeTab = SETTINGS_TAB.key;
    render();
    elements.mailSettingsStatus.textContent = "请先新增、保存并启用对应品牌的 IMAP 邮箱，再执行同步。";
    return;
  }
  try {
    const payload = await withActivity("正在同步官邮", "正在读取近期收件与已发送邮件，并按达人邮箱安全归档...", async () => {
      const response = await apiFetch(API_MAIL_SYNC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, maxPerFolder: 120 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "邮箱同步失败");
      return result;
    });
    state.data = ensureStateShape(payload.state);
    state.mailSettings = normalizeMailSettingsPayload(payload.settings);
    render();
    renderCreatorDrawer();
    if (state.followUpDetail.open) renderFollowUpDetail();
  } catch (error) {
    if (state.activeTab === "settings") {
      elements.mailSettingsStatus.textContent = error.message || "邮箱同步失败";
    } else {
      elements.importStatus.textContent = error.message || "邮箱同步失败";
    }
  }
}

async function deleteMailAccount(accountId) {
  const account = (state.mailSettings.accounts || []).find((item) => text(item.id) === text(accountId));
  if (!account) return;
  const label = account.label || account.imap?.user || "该官方邮箱";
  if (!window.confirm(`确认删除「${label}」的邮箱配置？不会删除已归档邮件或合作资料。`)) return;
  try {
    const accounts = (state.mailSettings.accounts || []).filter((item) => text(item.id) !== text(accountId));
    const payload = await withActivity("正在删除邮箱配置", "正在移除账户配置，不会改动业务资料...", async () => {
      const response = await apiFetch(API_MAIL_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts, contentPolicy: normalizedMailContentPolicy() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "邮箱配置删除失败");
      return result;
    });
    state.mailSettings = normalizeMailSettingsPayload(payload);
    if (text(state.mailAccountEditingId) === text(accountId)) state.mailAccountEditingId = null;
    renderMailSettings();
    elements.mailSettingsStatus.textContent = "邮箱账户配置已删除，既有邮件时间线保留不变。";
  } catch (error) {
    elements.mailSettingsStatus.textContent = error.message || "邮箱配置删除失败";
  }
}

async function saveAiSettings(event) {
  event.preventDefault();
  elements.aiSettingsStatus.textContent = "正在保存...";
  try {
    await withActivity("正在保存 AI 设置", "正在加密提交你的模型接入参数...", async () => {
      const response = await apiFetch(API_AI_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readAiSettingsForm()),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "AI 设置保存失败");
      }
      state.aiSettings = normalizeAiSettingsPayload(payload.settings);
    });
  } catch (error) {
    elements.aiSettingsStatus.textContent = error.message || "AI 设置保存失败";
    return;
  }
  renderAiSettings();
  const profiles = state.aiSettings.profiles;
  const saved = (profile) => (profile?.hasApiKey ? "已配置" : "未配置");
  elements.aiSettingsStatus.textContent = `设置已保存：普通 AI ${saved(profiles.standard)}；高能力 AI ${saved(profiles.advanced)}；特殊 AI ${saved(profiles.special)}。API Key 为安全起见不会回显。`;
}

async function checkAiStatus() {
  elements.aiSettingsStatus.textContent = "正在检查...";
  try {
    const payload = await withActivity("正在检查 AI 配置", "正在确认各模型的接入状态...", async () => {
      const response = await apiFetch(API_AI_STATUS);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "检查失败");
      return result;
    });
    const profiles = payload.profiles || {};
    const describe = (key, label) => {
      const profile = profiles[key] || {};
      const network = profile.network || {};
      const networkText = network.mode === "cloud" ? "网络：Vercel 云端直连" : network.mode === "proxy" ? `代理：${network.source || "已连接"}` : "网络：直连";
      return `${label}${profile.configured ? "已配置" : "未配置"}${profile.model ? `（${profile.model}）` : ""}，${networkText}`;
    };
    elements.aiSettingsStatus.textContent = `${describe("standard", "普通 AI ")}；${describe("advanced", "高能力 AI ")}；${describe("special", "特殊 AI ")}。`;
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

  if (type === "followups") {
    const now = Date.now();
    return [
      ["进行中跟进", dataRows.filter((row) => !FOLLOW_UP_TERMINAL_STAGES.has(text(row.stage))).length],
      ["今天需跟进", dataRows.filter((row) => isSameLocalDay(row.next_follow_up_at, new Date())).length],
      ["已逾期", dataRows.filter((row) => isFollowUpOverdue(row, now)).length],
      ["已发布 / 结案", dataRows.filter((row) => ["已发布", "数据回收", "已结案"].includes(text(row.stage))).length],
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
      closeCreatorDrawer();
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
  const pinnedFields = new Set(pinnedFilterPreferences[state.activeTab] || []);
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
                .map((filter) => {
                  const pinned = pinnedFields.has(filter.key);
                  return `
                    <label class="filter-option">
                      <input type="checkbox" data-filter-visibility="${escapeHtml(filter.key)}" ${selectedFields.has(filter.key) ? "checked" : ""} ${pinned ? "disabled" : ""} />
                      <span>${escapeHtml(filter.label)}${pinned ? '<small>常用</small>' : ""}</span>
                    </label>`;
                })
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
        if (state.activeTab === "cooperations" && field.key === "product_id") {
          return [...section, renderProductReferencePicker(field, selectedValue, `${fieldClass} field-wide`, mark, required)];
        }
        return [
          ...section,
          `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><select id="${field.key}" name="${field.key}" ${required}><option value="">不关联</option>${sourceRows
            .map((row) => `<option value="${escapeHtml(row.id)}" ${selectedValue === row.id ? "selected" : ""}>${escapeHtml(referenceLabel(field.reference, row))}</option>`)
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

      if (state.activeTab === "products" && field.key === "product_url") {
        return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><div class="field-with-action"><input id="${field.key}" name="${field.key}" type="${field.type}" step="${field.step || "1"}" value="${escapeHtml(value)}" ${required} ${placeholder} /><button type="button" id="productPreviewBtn" class="ghost">读取信息</button></div><p class="field-status" id="productPreviewStatus"></p></div>`];
      }

      const identityStatus = ["creators", "leads"].includes(state.activeTab) && field.key === "email" ? `<p class="field-status identity-status" id="identityEmailStatus"></p>` : "";
      return [...section, `<div class="${fieldClass}"><label for="${field.key}">${field.label}${mark}</label><input id="${field.key}" name="${field.key}" type="${field.type}" step="${field.step || "1"}" value="${escapeHtml(value)}" ${required} ${placeholder} />${identityStatus}</div>`];
    })
    .join("");

  const creatorAiBtn = document.getElementById("creatorAiBtn");
  if (creatorAiBtn) creatorAiBtn.addEventListener("click", handleCreatorAiEnrich);
  const productPreviewBtn = document.getElementById("productPreviewBtn");
  if (productPreviewBtn) productPreviewBtn.addEventListener("click", handleProductPreview);
  const creatorReference = elements.form.elements.creator_id;
  if (creatorReference) {
    creatorReference.addEventListener("change", () => syncCooperationName("creator"));
  }
  const resourceReference = elements.form.elements.resource_id;
  if (resourceReference) {
    resourceReference.addEventListener("change", () => syncCooperationName("resource"));
  }
  const productReference = elements.form.elements.product_id;
  if (productReference) {
    productReference.addEventListener("change", () => syncCooperationName("product"));
    bindProductReferencePicker();
  }
  if (state.activeTab === "followups") {
    elements.form.elements.creator_id?.addEventListener("change", syncFollowUpReferences);
    elements.form.elements.cooperation_id?.addEventListener("change", syncFollowUpReferences);
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
  elements.assistantPanel.classList.toggle("hidden", ["leads", "followups"].includes(state.activeTab));
  renderIdentityCheck();
  renderAssistant();
}

function productPickerMeta(product) {
  return [product.brand, product.country, product.store].filter((value) => text(value)).join(" · ") || "产品库商品";
}

function productPickerTriggerMarkup(product) {
  if (!product) {
    return `<span class="product-picker-trigger-empty">选择产品库商品</span><span class="product-picker-chevron" aria-hidden="true"></span>`;
  }
  return `<span class="product-picker-trigger-thumb">${productImageMarkup(product)}</span><span class="product-picker-trigger-copy"><strong title="${escapeHtml(product.name || "未命名产品")}">${escapeHtml(product.name || "未命名产品")}</strong><small>${escapeHtml(productPickerMeta(product))}</small></span><span class="product-picker-chevron" aria-hidden="true"></span>`;
}

function renderProductReferencePicker(field, value, fieldClass, mark, required) {
  const products = [...rows("products")].sort((a, b) => text(a.name).localeCompare(text(b.name), "zh-CN", { sensitivity: "base" }));
  const selected = products.find((product) => product.id === value);
  const productOptions = products
    .map((product) => {
      const searchable = [product.name, product.brand, product.country, product.category, product.store, product.tags].map((item) => text(item).toLowerCase()).join(" ");
      const active = product.id === value;
      return `<button type="button" class="product-picker-option ${active ? "is-selected" : ""}" data-product-picker-option="${escapeHtml(product.id)}" data-product-picker-search="${escapeHtml(searchable)}" aria-pressed="${active ? "true" : "false"}"><span class="product-picker-option-thumb">${productImageMarkup(product)}</span><span class="product-picker-option-copy"><strong title="${escapeHtml(product.name || "未命名产品")}">${escapeHtml(product.name || "未命名产品")}</strong><small>${escapeHtml(productPickerMeta(product))}</small></span></button>`;
    })
    .join("");

  return `<div class="${fieldClass} product-reference-field"><label id="${field.key}-label">${field.label}${mark}</label><input id="${field.key}" name="${field.key}" type="hidden" value="${escapeHtml(value)}" ${required} /><div class="product-picker" data-product-picker><button type="button" class="product-picker-trigger" data-product-picker-trigger aria-expanded="false" aria-haspopup="dialog" aria-labelledby="${field.key}-label">${productPickerTriggerMarkup(selected)}</button><section class="product-picker-popover hidden" data-product-picker-popover aria-label="选择关联产品"><div class="product-picker-search"><input type="search" data-product-picker-search-input placeholder="搜索产品名称、品牌、店铺..." autocomplete="off" /></div><div class="product-picker-grid" data-product-picker-grid><button type="button" class="product-picker-option product-picker-clear ${value ? "" : "is-selected"}" data-product-picker-option="" aria-pressed="${value ? "false" : "true"}"><span class="product-picker-clear-mark" aria-hidden="true">×</span><span class="product-picker-option-copy"><strong>不关联产品库</strong><small>保留手动填写的合作产品名称</small></span></button>${productOptions || `<p class="product-picker-empty">产品库暂无商品，请先在产品库中新增。</p>`}<p class="product-picker-empty hidden" data-product-picker-empty>没有匹配的产品</p></div></section></div></div>`;
}

function closeProductReferencePicker({ focusTrigger = false } = {}) {
  const picker = elements.form.querySelector("[data-product-picker]");
  if (!picker) return;
  const trigger = picker.querySelector("[data-product-picker-trigger]");
  const popover = picker.querySelector("[data-product-picker-popover]");
  if (!popover || popover.classList.contains("hidden")) return;
  popover.classList.add("hidden");
  trigger?.setAttribute("aria-expanded", "false");
  if (focusTrigger) trigger?.focus();
}

function updateProductReferencePickerSelection(picker, productId) {
  const product = rows("products").find((item) => item.id === productId);
  const trigger = picker.querySelector("[data-product-picker-trigger]");
  if (trigger) trigger.innerHTML = productPickerTriggerMarkup(product);
  picker.querySelectorAll("[data-product-picker-option]").forEach((option) => {
    const selected = option.dataset.productPickerOption === productId;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function bindProductReferencePicker() {
  productPickerAbortController?.abort();
  const picker = elements.form.querySelector("[data-product-picker]");
  const reference = elements.form.elements.product_id;
  if (!picker || !reference) return;

  const controller = new AbortController();
  productPickerAbortController = controller;
  const { signal } = controller;
  const trigger = picker.querySelector("[data-product-picker-trigger]");
  const popover = picker.querySelector("[data-product-picker-popover]");
  const search = picker.querySelector("[data-product-picker-search-input]");
  const options = [...picker.querySelectorAll("[data-product-picker-option]")];
  const empty = picker.querySelector("[data-product-picker-empty]");

  const filterOptions = () => {
    const query = text(search?.value).toLowerCase();
    let visible = 0;
    options.forEach((option) => {
      const matches = !query || option.dataset.productPickerOption === "" || text(option.dataset.productPickerSearch).includes(query);
      option.classList.toggle("hidden", !matches);
      if (matches && option.dataset.productPickerOption) visible += 1;
    });
    empty?.classList.toggle("hidden", !query || visible > 0);
  };

  trigger.addEventListener("click", () => {
    const willOpen = popover.classList.contains("hidden");
    if (willOpen) {
      popover.classList.remove("hidden");
      trigger.setAttribute("aria-expanded", "true");
      search?.focus();
    } else {
      closeProductReferencePicker();
    }
  }, { signal });

  search?.addEventListener("input", filterOptions, { signal });
  picker.addEventListener("click", (event) => {
    const option = event.target.closest("[data-product-picker-option]");
    if (!option) return;
    const productId = option.dataset.productPickerOption || "";
    reference.value = productId;
    updateProductReferencePickerSelection(picker, productId);
    reference.dispatchEvent(new Event("change", { bubbles: true }));
    closeProductReferencePicker({ focusTrigger: true });
  }, { signal });

  document.addEventListener("click", (event) => {
    if (!picker.contains(event.target)) closeProductReferencePicker();
  }, { signal });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || popover.classList.contains("hidden")) return;
    event.preventDefault();
    event.stopPropagation();
    closeProductReferencePicker({ focusTrigger: true });
  }, { signal, capture: true });
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
  if (["leads", "followups"].includes(state.activeTab)) return;
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

function isTransferredLead(record) {
  return text(record?.status) === "已转达人库";
}

function findIdentityConflicts(record, types = ["creators", "leads"]) {
  if (!["creators", "leads"].includes(state.activeTab)) return [];
  const socialUrl = normalizeSocialIdentity(record.social_url);
  const email = normalizeHeader(record.email);
  if (!socialUrl && !email) return [];
  const brandId = text(record.brand_id);

  return types.flatMap((type) =>
    allRows(type)
      .filter((row) => {
        if (type === state.activeTab && row.id === record.id) return false;
        if (type === "leads" && isTransferredLead(row)) return false;
        if (brandId && text(row.brand_id) !== brandId) return false;
        return true;
      })
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
    await withActivity(
      state.activeTab === "leads" ? "AI 正在整理待开发达人" : "AI 正在补全达人资料",
      state.activeTab === "leads" ? "正在提取公开的核心信息..." : "正在检索并核对公开资料...",
      async () => {
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
      },
    );
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

function statusTone(value) {
  const current = text(value);
  if (/已合作|成功|稳定|复投|已完成/.test(current)) return "success";
  if (/沟通|进行中|待观察|已联系/.test(current)) return "info";
  if (/待|开发|未配置/.test(current)) return "warning";
  if (/拒绝|失败|无订单|取消|不适合/.test(current)) return "danger";
  return "neutral";
}

function statusBadge(value, fallback = "未填写") {
  const label = text(value) || fallback;
  return `<span class="status-pill status-${statusTone(label)}">${escapeHtml(label)}</span>`;
}

function numberValue(value, fallback = "-") {
  return text(value) ? `<span class="numeric">${escapeHtml(value)}</span>` : `<span class="muted">${fallback}</span>`;
}

function creatorCooperations(creator) {
  return rows("cooperations")
    .filter((record) => text(record.creator_id) === text(creator.id) || (text(record.creator_name) && text(record.creator_name) === text(creator.name)))
    .sort((a, b) => new Date(b.post_date || b.updatedAt || 0) - new Date(a.post_date || a.updatedAt || 0));
}

function creatorProducts(cooperations) {
  const productRows = rows("products");
  const found = [];
  for (const cooperation of cooperations) {
    const rawCandidates = [
      cooperation.product_id,
      ...(Array.isArray(cooperation.product_ids) ? cooperation.product_ids : []),
      cooperation.product,
    ].flatMap((value) => splitList(value));
    for (const candidate of rawCandidates) {
      const normalized = normalizeHeader(candidate);
      const product = productRows.find((item) => item.id === candidate || normalizeHeader(item.name) === normalized || normalizeHeader(item.product_url) === normalized);
      if (product && !found.some((item) => item.id === product.id)) found.push(product);
    }
  }
  return found;
}

function creatorLogistics(cooperations) {
  return cooperations
    .map((record) => {
      const trackingNo = text(record.tracking_no || record.tracking_number || record.tracking);
      const shippingStatus = text(record.shipping_status);
      const legacyDetails = text(record.shipping || record.logistics || record.shipment);
      const details = [trackingNo && `单号：${trackingNo}`, shippingStatus, legacyDetails].filter(Boolean).join(" · ");
      return details
        ? {
            label: record.cooperation_no || record.no || record.id || "合作记录",
            value: details,
            date: record.post_date || record.updatedAt,
          }
        : null;
    })
    .filter(Boolean);
}

function openCreatorDrawer(creatorId) {
  const creator = rows("creators").find((row) => row.id === creatorId);
  if (!creator) return;
  state.creatorDrawer = { open: true, creatorId };
  renderCreatorDrawer();
}

function closeCreatorDrawer() {
  state.creatorDrawer = { open: false, creatorId: null };
  renderCreatorDrawer();
}

function renderCreatorDrawer() {
  const creator = rows("creators").find((row) => row.id === state.creatorDrawer.creatorId);
  const visible = Boolean(state.creatorDrawer.open && creator);
  elements.creatorDrawer.classList.toggle("hidden", !visible);
  elements.creatorDrawer.setAttribute("aria-hidden", String(!visible));
  if (!visible) {
    elements.creatorDrawerHead.innerHTML = "";
    elements.creatorDrawerContent.innerHTML = "";
    return;
  }

  const cooperations = creatorCooperations(creator);
  const logistics = creatorLogistics(cooperations);
  const products = creatorProducts(cooperations);
  const creatorFollowUps = rows("followups")
    .filter((row) => text(row.creator_id) === text(creator.id) || (text(row.creator_name) && text(row.creator_name) === text(creator.name)))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const creatorMailEvents = creatorFollowUps
    .flatMap((followUp) => followUpEventsFor(followUp.id))
    .filter((event) => event.type === "email")
    .sort((a, b) => new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0))
    .slice(0, 8);
  const profileUrl = safeExternalUrl(creator.social_url);
  elements.creatorDrawerHead.innerHTML = `
    <div class="creator-drawer-identity">
      <div class="creator-avatar">${escapeHtml((creator.name || creator.handle || "达").slice(0, 1).toUpperCase())}</div>
      <div>
        <span class="eyebrow">CREATOR PROFILE</span>
        <h2 id="creatorDrawerTitle">${escapeHtml(creator.name || creator.handle || "未命名达人")}</h2>
        <p>${escapeHtml([creator.handle, creator.platform, normalizeCountry(creator.country)].filter(Boolean).join(" · ") || "基础信息待补充")}</p>
      </div>
    </div>
    <div class="creator-drawer-actions">
      ${profileUrl ? `<a class="icon-button" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer" title="打开社媒主页" aria-label="打开社媒主页">↗</a>` : ""}
      <button type="button" class="icon-button" data-drawer-edit="${escapeHtml(creator.id)}" title="编辑达人" aria-label="编辑达人">✎</button>
      <button type="button" class="icon-button" data-drawer-close title="关闭详情" aria-label="关闭详情">×</button>
    </div>`;

  const metric = (label, value) => `<div class="drawer-metric"><span>${label}</span><strong>${value}</strong></div>`;
  elements.creatorDrawerContent.innerHTML = `
    <section class="drawer-section drawer-metrics">
      ${metric("粉丝", numberValue(creator.followers))}
      ${metric("近 30 条均播", numberValue(creator.avg_views))}
      ${metric("互动率", creator.engagement ? `${escapeHtml(creator.engagement)}%` : "-")}
      ${metric("合作次数", cooperations.length)}
    </section>
    <section class="drawer-section drawer-profile-grid">
      <div><span>合作状态</span>${statusBadge(creator.status)}</div>
      <div><span>优先级</span>${statusBadge(creator.priority || creator.follow_up_priority, "未设置")}</div>
      <div><span>邮箱</span><strong>${creator.email ? escapeHtml(creator.email) : `<span class="muted">暂无</span>`}</strong>${creator.email_source ? `<small>来源：${escapeHtml(creator.email_source)}</small>` : ""}</div>
      <div><span>社媒地址</span>${profileUrl ? `<a class="drawer-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(creator.social_url)}</a>` : `<span class="muted">暂无</span>`}</div>
    </section>
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>合作跟进</h3><button type="button" class="ghost drawer-inline-action" data-drawer-new-followup="${escapeHtml(creator.id)}">新建跟进</button></div>
      ${
        creatorFollowUps.length
          ? `<div class="drawer-record-list">${creatorFollowUps
              .map(
                (followUp) => `
                  <article class="drawer-record">
                    <div class="drawer-record-head"><strong>${escapeHtml(followUp.next_action || "下一步动作待补充")}</strong>${statusBadge(followUp.stage)} </div>
                    <p>${escapeHtml([followUp.brand, followUp.cooperation_mode, followUp.next_follow_up_at ? `下次 ${formatDateTime(followUp.next_follow_up_at)}` : ""].filter(Boolean).join(" · "))}</p>
                    <div class="drawer-record-stats"><span>物流 ${escapeHtml(followUp.shipping_status || "未寄样")}</span><span>${latestFollowUpEmail(followUp.id) ? `邮件 ${formatDateTime(latestFollowUpEmail(followUp.id).occurred_at)}` : "暂无邮件"}</span></div>
                    <div class="drawer-record-actions"><button type="button" class="ghost" data-drawer-edit-followup="${escapeHtml(followUp.id)}">编辑</button><button type="button" class="ghost" data-drawer-import-followup="${escapeHtml(followUp.id)}">导入邮件</button></div>
                  </article>`,
              )
              .join("")}</div>`
          : `<p class="drawer-empty">暂无合作跟进，可从这里建立第一条阶段记录。</p>`
      }
    </section>
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>邮件时间线</h3><span>${creatorMailEvents.length} 条</span></div>
      ${
        creatorMailEvents.length
          ? `<div class="followup-timeline">${creatorMailEvents
              .map(
                (event) => `
                  <article class="timeline-event">
                    <div><strong>${escapeHtml(event.subject || "无主题")}</strong><time>${escapeHtml(formatDateTime(event.occurred_at))}</time></div>
                    <span>${escapeHtml(event.direction === "inbound" ? "达人来信" : "我方发信")} · ${escapeHtml(event.source || "邮件导入")}</span>
                    <p>${escapeHtml(event.excerpt || "无正文摘要")}</p>
                  </article>`,
              )
              .join("")}</div>`
          : `<p class="drawer-empty">尚未导入 Foxmail 邮件。请先在 Foxmail 中导出 .eml，再从合作跟进卡导入。</p>`
      }
    </section>
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>历史合作</h3><span>${cooperations.length} 条</span></div>
      ${
        cooperations.length
          ? `<div class="drawer-record-list">${cooperations
              .map(
                (record) => `
                  <article class="drawer-record">
                    <div class="drawer-record-head">
                      <strong>${escapeHtml(record.cooperation_no || record.no || record.id || "合作记录")}</strong>
                      ${statusBadge(record.result || record.status, "待复盘")}
                    </div>
                    <p>${escapeHtml([record.resource_name, record.product, record.model, record.post_date].filter(Boolean).join(" · ") || "合作信息待补充")}</p>
                    <div class="drawer-record-stats"><span>订单 ${numberValue(record.orders, "0")}</span><span>点击 ${numberValue(record.clicks, "0")}</span><span>成本 ${numberValue(record.budget, "0")}</span></div>
                    ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
                  </article>`,
              )
              .join("")}</div>`
          : `<p class="drawer-empty">暂无历史合作记录</p>`
      }
    </section>
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>寄样物流</h3><span>${logistics.length} 条</span></div>
      ${
        logistics.length
          ? `<div class="drawer-logistics-list">${logistics.map((item) => `<div class="drawer-logistics-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.date ? new Date(item.date).toLocaleDateString("zh-CN") : "")}</small></div>`).join("")}</div>`
          : `<p class="drawer-empty">暂无寄样物流记录，可在合作记录备注或物流字段中补充</p>`
      }
    </section>
    <section class="drawer-section">
      <div class="drawer-section-head"><h3>关联商品</h3><span>${products.length} 个</span></div>
      ${
        products.length
          ? `<div class="drawer-product-list">${products.map((product) => `<a class="drawer-product" href="${escapeHtml(safeExternalUrl(product.product_url) || "#")}" ${safeExternalUrl(product.product_url) ? 'target="_blank" rel="noopener noreferrer"' : ""}><span>${escapeHtml((product.name || "产").slice(0, 1))}</span><strong>${escapeHtml(product.name || "未命名产品")}</strong><small>${escapeHtml([product.brand, product.store].filter(Boolean).join(" · "))}</small></a>`).join("")}</div>`
          : `<p class="drawer-empty">暂无可识别的关联商品</p>`
      }
    </section>`;

  elements.creatorDrawerContent.querySelector("[data-drawer-close]")?.addEventListener("click", closeCreatorDrawer);
  elements.creatorDrawerContent.querySelector("[data-drawer-edit]")?.addEventListener("click", () => {
    const id = elements.creatorDrawerContent.querySelector("[data-drawer-edit]")?.dataset.drawerEdit;
    closeCreatorDrawer();
    state.activeTab = "creators";
    openEditor(id);
  });
  elements.creatorDrawerHead.querySelector("[data-drawer-close]")?.addEventListener("click", closeCreatorDrawer);
  elements.creatorDrawerHead.querySelector("[data-drawer-edit]")?.addEventListener("click", () => {
    const id = elements.creatorDrawerHead.querySelector("[data-drawer-edit]")?.dataset.drawerEdit;
    closeCreatorDrawer();
    state.activeTab = "creators";
    openEditor(id);
  });
  elements.creatorDrawerContent.querySelector("[data-drawer-new-followup]")?.addEventListener("click", () => {
    closeCreatorDrawer();
    openFollowUpEditor({ creatorId: creator.id });
  });
  elements.creatorDrawerContent.querySelectorAll("[data-drawer-edit-followup]").forEach((button) => {
    button.addEventListener("click", () => {
      closeCreatorDrawer();
      openFollowUpEditor({ id: button.dataset.drawerEditFollowup });
    });
  });
  elements.creatorDrawerContent.querySelectorAll("[data-drawer-import-followup]").forEach((button) => {
    button.addEventListener("click", () => openFollowUpMailImport(button.dataset.drawerImportFollowup));
  });
}

function searchCatalog(query) {
  const needle = text(query).toLowerCase();
  if (!needle) return [];
  const match = (row, fields) => fields.some((field) => text(row[field]).toLowerCase().includes(needle));
  const results = [];
  for (const creator of rows("creators")) {
    if (match(creator, ["id", "name", "handle", "social_url", "email", "platform", "country", "niche"])) {
      results.push({ type: "creator", label: "达人", title: creator.name || creator.handle || creator.social_url || creator.id, meta: [creator.handle, creator.platform, normalizeCountry(creator.country)].filter(Boolean).join(" · "), id: creator.id });
    }
  }
  for (const cooperation of rows("cooperations")) {
    if (match(cooperation, ["id", "cooperation_no", "no", "creator_name", "resource_name", "product", "result"])) {
      results.push({ type: "cooperation", label: "合作", title: cooperation.cooperation_no || cooperation.no || cooperation.id, meta: [cooperation.creator_name, cooperation.resource_name, cooperation.product].filter(Boolean).join(" · "), id: cooperation.id });
    }
  }
  for (const product of rows("products")) {
    if (match(product, ["id", "name", "product_url", "brand", "store", "category", "tags"])) {
      results.push({ type: "product", label: "商品", title: product.name || product.product_url || product.id, meta: [product.brand, product.store, product.category].filter(Boolean).join(" · "), id: product.id });
    }
  }
  for (const resource of rows("resources")) {
    if (match(resource, ["id", "name", "brand", "country", "categories", "contact"])) {
      results.push({ type: "resource", label: "资源", title: resource.name || resource.id, meta: [resource.brand, normalizeCountry(resource.country), resource.categories].filter(Boolean).join(" · "), id: resource.id });
    }
  }
  for (const followUp of rows("followups")) {
    const creator = followUpCreator(followUp);
    const searchable = [followUp.id, followUp.creator_name, creator?.name, followUp.brand, followUp.stage, followUp.priority, followUp.next_action, followUp.notes];
    if (searchable.some((value) => text(value).toLowerCase().includes(needle))) {
      results.push({
        type: "followup",
        label: "跟进",
        title: `${creator?.name || followUp.creator_name || "未关联达人"} · ${followUp.stage || "未设置阶段"}`,
        meta: [followUp.brand, followUp.next_action, followUp.next_follow_up_at ? formatDateTime(followUp.next_follow_up_at) : ""].filter(Boolean).join(" · "),
        id: followUp.id,
      });
    }
  }
  return results.slice(0, 24);
}

function openGlobalSearch() {
  state.globalSearch.open = true;
  elements.globalSearchModal.classList.remove("hidden");
  elements.globalSearchModal.setAttribute("aria-hidden", "false");
  elements.globalSearchInput.value = state.globalSearch.query;
  renderGlobalSearch();
  window.setTimeout(() => elements.globalSearchInput.focus(), 0);
}

function closeGlobalSearch() {
  state.globalSearch.open = false;
  state.globalSearch.query = "";
  elements.globalSearchModal.classList.add("hidden");
  elements.globalSearchModal.setAttribute("aria-hidden", "true");
  elements.globalSearchResults.innerHTML = "";
}

function renderGlobalSearch() {
  const query = text(state.globalSearch.query);
  const results = searchCatalog(query);
  elements.globalSearchHint.textContent = query ? `${results.length} 条结果 · Enter 打开第一条` : "输入关键词后实时检索全部业务资料";
  elements.globalSearchResults.innerHTML = query
    ? results.length
      ? results
          .map((result, index) => `<button type="button" class="global-search-result" data-global-result-type="${result.type}" data-global-result-id="${escapeHtml(result.id)}"><span class="search-result-index">${String(index + 1).padStart(2, "0")}</span><span class="search-result-main"><strong>${escapeHtml(result.title)}</strong><small>${escapeHtml(result.meta || "暂无补充信息")}</small></span><span class="search-result-kind">${escapeHtml(result.label)}</span><span class="search-result-arrow">↵</span></button>`)
          .join("")
      : `<div class="global-search-empty"><strong>没有找到匹配资料</strong><span>试试达人 Handle、合作单号或商品名</span></div>`
    : `<div class="global-search-empty"><strong>快速定位业务资料</strong><span>达人、合作、商品和资源均可搜索</span></div>`;
}

function handleGlobalSearchResult(result) {
  const type = result.dataset.globalResultType;
  const id = result.dataset.globalResultId;
  closeGlobalSearch();
  if (type === "creator") {
    state.activeTab = "creators";
    state.filters = createFilters("creators");
    render();
    openCreatorDrawer(id);
    return;
  }
  if (type === "product") {
    state.activeTab = "products";
    state.productFilters = { query: "", brand: "", country: "", category: "", store: "" };
    render();
    const card = elements.productPage.querySelector(`[data-open-product="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("search-target");
    window.setTimeout(() => card?.classList.remove("search-target"), 1400);
    return;
  }
  if (type === "followup") {
    state.activeTab = "followups";
    state.followUpBoardFilter = { query: id, stage: "", priority: "", overdueOnly: false };
    render();
    return;
  }
  state.activeTab = type === "resource" ? "resources" : "cooperations";
  state.filters = createFilters(state.activeTab);
  state.filters.query = id;
  render();
  if (elements.searchInput) elements.searchInput.value = id;
}

function renderTable(visibleRows) {
  const item = config();
  const isLeadTable = state.activeTab === "leads";
  const selectedIds = state.selectedLeadIds;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));
  elements.tableHead.innerHTML = `<tr>${
    isLeadTable
      ? `<th class="lead-select-cell"><input type="checkbox" data-select-all-leads aria-label="选择当前筛选结果" title="选择当前筛选结果" ${allVisibleSelected ? "checked" : ""} /></th>`
      : ""
  }${item.columns.map(([, label]) => `<th>${label}</th>`).join("")}<th>操作</th></tr>`;

  if (!visibleRows.length) {
    elements.tableBody.innerHTML = `<tr><td colspan="${item.columns.length + 1 + (isLeadTable ? 1 : 0)}" class="muted">暂无记录，先新增或导入表格。</td></tr>`;
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
          if (key === "status" || key === "priority") {
            return `<td>${statusBadge(row[key])}</td>`;
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
          ? `<button type="button" class="ghost icon-action icon-action-transfer" data-transfer-lead="${escapeHtml(row.id)}" aria-label="转入达人库" title="转入达人库">⇥</button>`
          : "";
      const emailAction =
        state.activeTab === "leads" && text(row.email)
          ? `<button type="button" class="ghost icon-action icon-action-mail" data-open-mail-client="${escapeHtml(row.id)}" aria-label="联系邮件：打开默认邮件软件并标记已联系" title="联系邮件：打开默认邮件软件并标记已联系">✉</button><button type="button" class="ghost icon-action icon-action-history" data-open-mail-history="${escapeHtml(row.id)}" aria-label="邮件往来：复制邮箱并打开默认邮件软件" title="邮件往来：复制邮箱并打开默认邮件软件">⌕</button>`
          : "";
      const outreachAction =
        state.activeTab === "leads"
          ? `<button type="button" class="ghost icon-action icon-action-ai" data-outreach-lead="${escapeHtml(row.id)}" aria-label="AI 开发邮件" title="AI 开发邮件">✦</button>`
          : "";
      const selectCell = isLeadTable
        ? `<td class="lead-select-cell"><input type="checkbox" data-select-lead="${escapeHtml(row.id)}" aria-label="选择 ${escapeHtml(text(row.name) || "该达人")}" ${selectedIds.has(row.id) ? "checked" : ""} /></td>`
        : "";
      const creatorClick = state.activeTab === "creators" ? `data-open-creator="${escapeHtml(row.id)}"` : "";
      return `<tr data-open-editor="${escapeHtml(row.id)}" ${creatorClick} title="${state.activeTab === "creators" ? "单击查看详情，双击编辑" : "双击任意资料内容可编辑"}">${selectCell}${cells}<td><div class="row-actions">${emailAction}${outreachAction}${transferAction}<button type="button" class="ghost icon-action icon-action-delete" data-delete="${escapeHtml(row.id)}" aria-label="删除记录" title="删除记录">×</button></div></td></tr>`;
    })
    .join("");

  elements.tableBody.querySelectorAll("[data-open-editor]").forEach((tableRow) => {
    tableRow.addEventListener("dblclick", (event) => {
      if (event.target.closest("a, button")) return;
      if (state.activeTab === "creators") closeCreatorDrawer();
      openEditor(tableRow.dataset.openEditor);
    });
  });
  elements.tableBody.querySelectorAll("[data-open-creator]").forEach((tableRow) => {
    tableRow.addEventListener("click", (event) => {
      if (event.target.closest("a, button, input, select, textarea")) return;
      openCreatorDrawer(tableRow.dataset.openCreator);
    });
  });

  elements.tableBody.querySelectorAll("[data-transfer-lead]").forEach((button) => {
    button.addEventListener("click", () => transferLeadToCreator(button.dataset.transferLead));
  });

  elements.tableHead.querySelector("[data-select-all-leads]")?.addEventListener("change", (event) => {
    for (const row of visibleRows) {
      if (event.target.checked) state.selectedLeadIds.add(row.id);
      else state.selectedLeadIds.delete(row.id);
    }
    renderTable(visibleRows);
  });

  elements.tableBody.querySelectorAll("[data-select-lead]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selectedLeadIds.add(input.dataset.selectLead);
      else state.selectedLeadIds.delete(input.dataset.selectLead);
      renderTable(visibleRows);
    });
  });

  elements.tableBody.querySelectorAll("[data-outreach-lead]").forEach((button) => {
    button.addEventListener("click", () => openOutreachModal([button.dataset.outreachLead]));
  });

  elements.tableBody.querySelectorAll("[data-open-mail-client]").forEach((button) => {
    button.addEventListener("click", () => launchLeadMailClient(button.dataset.openMailClient));
  });

  elements.tableBody.querySelectorAll("[data-open-mail-history]").forEach((button) => {
    button.addEventListener("click", () => openLeadMailHistory(button.dataset.openMailHistory));
  });

  elements.tableBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (state.activeTab === "followups") {
        state.data.followUps = allRows("followups").filter((row) => row.id !== button.dataset.delete);
        state.data.followUpEvents = (state.data.followUpEvents || []).filter((event) => event.follow_up_id !== button.dataset.delete);
      } else {
        state.data[state.activeTab] = allRows().filter((row) => row.id !== button.dataset.delete);
      }
      state.selectedLeadIds.delete(button.dataset.delete);
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
  elements.productPage.classList.add("hidden");
  elements.followUpPage.classList.add("hidden");
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
  elements.followUpPage.classList.add("hidden");
  renderAiSettings();
  renderBrandManager();
  renderMailSettings();
  renderTimeZoneSettings();
  renderOptionSettings();
}

function getTimeZoneLabel(timeZone) {
  return timeZoneOptions.find((item) => item.value === timeZone)?.label || timeZone;
}

function formatTimeInZone(timeZone) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function renderTimeZoneBar() {
  const zones = normalizeTimeZones(state.data.meta?.timeZones);
  elements.timezoneBar.innerHTML = zones
    .map(
      (timeZone) => `
        <div class="timezone-clock" title="${escapeHtml(timeZone)}">
          <span>${escapeHtml(getTimeZoneLabel(timeZone))}</span>
          <strong>${escapeHtml(formatTimeInZone(timeZone))}</strong>
        </div>`,
    )
    .join("");
}

function renderTimeZoneSettings() {
  const zones = normalizeTimeZones(state.data.meta?.timeZones);
  const options = timeZoneOptions.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
  elements.timezoneSettingsFields.innerHTML = zones
    .map(
      (timeZone, index) => `
        <label class="field">
          <span>展示时区 ${index + 1}</span>
          <select data-timezone-select="${index}">
            ${options.replace(`value="${timeZone}"`, `value="${timeZone}" selected`)}
          </select>
        </label>`,
    )
    .join("");
  elements.timezoneSettingsStatus.textContent = `当前展示：${zones.map(getTimeZoneLabel).join("、")}。`;
}

async function saveTimeZones() {
  const zones = [...elements.timezoneSettingsFields.querySelectorAll("[data-timezone-select]")].map((select) => select.value);
  if (new Set(zones).size !== zones.length) {
    elements.timezoneSettingsStatus.textContent = "请选择三个不同的时区。";
    return;
  }
  state.data.meta.timeZones = normalizeTimeZones(zones);
  try {
    await persist();
    renderTimeZoneBar();
    renderTimeZoneSettings();
    elements.timezoneSettingsStatus.textContent = "全局时区时间已保存。";
  } catch (error) {
    elements.timezoneSettingsStatus.textContent = error.message || "时区设置保存失败。";
  }
}

function startTimeZoneTicker() {
  if (timeZoneTickerId) return;
  renderTimeZoneBar();
  timeZoneTickerId = window.setInterval(renderTimeZoneBar, 1000);
}

function markLeadAsContacted(leadId, channel) {
  const index = state.data.leads.findIndex((lead) => lead.id === leadId);
  if (index < 0) return false;
  const lead = state.data.leads[index];
  if (lead.status === "已转达人库") return false;
  const now = new Date().toISOString();
  state.data.leads[index] = {
    ...lead,
    status: "已联系",
    first_contacted_at: text(lead.first_contacted_at) || now,
    last_contacted_at: now,
    contact_channel: text(channel) || text(lead.contact_channel),
    updatedAt: now,
  };
  return true;
}

async function persistLeadContactStatus(leadId, channel) {
  if (!markLeadAsContacted(leadId, channel)) return false;
  try {
    await persist();
    if (state.activeTab === "leads") render();
    return true;
  } catch (error) {
    elements.importStatus.textContent = error.message || "开发状态保存失败，仍将尝试打开邮件客户端。";
    return false;
  }
}

async function launchLeadMailClient(leadId) {
  const lead = rows("leads").find((item) => item.id === leadId);
  const email = text(lead?.email);
  if (!email) return;
  await persistLeadContactStatus(leadId, "邮件客户端");
  window.location.href = `mailto:${encodeURIComponent(email)}`;
}

async function copyPlainText(value, promptMessage) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    window.prompt(promptMessage, value);
    return false;
  }
}

async function openLeadMailHistory(leadId) {
  const lead = rows("leads").find((item) => item.id === leadId);
  const email = text(lead?.email);
  if (!email) return;
  const copied = await copyPlainText(email, "复制以下达人邮箱后，请在邮件软件中搜索：");
  elements.importStatus.textContent = copied ? `已复制邮箱：${email}。正在打开默认邮件软件，可直接粘贴后搜索往来。` : "请复制弹窗中的邮箱后，在邮件软件中搜索往来。";
  window.location.href = "mailto:";
}

function setMatchingUiVisible(isVisible) {
  elements.summary.classList.toggle("hidden", isVisible);
  elements.workspace.classList.toggle("hidden", isVisible);
  elements.settingsPage.classList.add("hidden");
  elements.productPage.classList.add("hidden");
  elements.followUpPage.classList.add("hidden");
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
      state.data.matches = allRows("matches").filter((item) => item.id !== button.dataset.deleteMatch);
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

function isSameLocalDay(value, referenceDate = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toLocaleDateString("zh-CN") === referenceDate.toLocaleDateString("zh-CN");
}

function isFollowUpOverdue(row, now = Date.now()) {
  if (FOLLOW_UP_TERMINAL_STAGES.has(text(row.stage)) || !text(row.next_follow_up_at)) return false;
  const time = new Date(row.next_follow_up_at).getTime();
  return Number.isFinite(time) && time < now;
}

function followUpCreator(row) {
  return rows("creators").find((creator) => text(creator.id) === text(row.creator_id)) ||
    rows("creators").find((creator) => text(creator.name) === text(row.creator_name));
}

function followUpProduct(row) {
  return rows("products").find((product) => text(product.id) === text(row.product_id));
}

function followUpEventsFor(followUpId) {
  return (state.data.followUpEvents || [])
    .filter((event) => text(event.follow_up_id) === text(followUpId) && belongsToActiveBrand(event))
    .sort((a, b) => new Date(b.occurred_at || b.createdAt || 0) - new Date(a.occurred_at || a.createdAt || 0));
}

function latestFollowUpEmail(followUpId) {
  return followUpEventsFor(followUpId).find((event) => event.type === "email");
}

function latestInboundFollowUpEmail(followUpId) {
  return followUpEventsFor(followUpId).find((event) => event.direction === "inbound" && text(event.message_id));
}

function mailInboxStatusLabel(status) {
  if (status === "needs_followup") return "已匹配达人，缺少活跃跟进";
  if (status === "ambiguous_creator") return "匹配到多个达人";
  return "未匹配达人邮箱";
}

function setFollowUpInboxNotice(textValue, tone = "info") {
  state.followUpInboxNotice = { tone, text: text(textValue) };
}

function pendingMailBlockedReason(message) {
  if (message.status === "ambiguous_creator") {
    return "该邮箱匹配到多个达人。请先核对并整理达人邮箱，再归档到正确的合作跟进。";
  }
  if (message.status === "needs_followup" && !text(message.matched_creator_id)) {
    return "系统未能确认唯一达人。请先在达人库补充或修正该邮箱。";
  }
  return "该邮件尚未匹配唯一达人邮箱。请先在达人库或待开发达人中补充正确邮箱后重新同步。";
}

function isMailAlreadyArchived(message, followUp) {
  return (state.data.followUpEvents || []).some((event) => {
    if (text(event.brand_id) !== text(followUp.brand_id)) return false;
    const sameMessage = text(message.message_id) && text(event.message_id) === text(message.message_id);
    const sameFingerprint = text(message.fingerprint) && text(event.fingerprint) === text(message.fingerprint);
    const sameServerKey = text(message.server_key) && text(event.server_key) === text(message.server_key);
    return sameMessage || sameFingerprint || sameServerKey;
  });
}

function mailInboxRowMarkup(message) {
  const direction = message.direction === "inbound" ? "收件" : message.direction === "outbound" ? "已发送" : "待判断";
  const creator = message.matched_creator_name ? ` · ${message.matched_creator_name}` : "";
  const candidateFollowUps = (message.candidate_follow_up_ids || [])
    .map((id) => rows("followups").find((row) => text(row.id) === text(id)))
    .filter(Boolean);
  const busy = Boolean(state.followUpInboxBusyId);
  const isCurrentBusy = text(state.followUpInboxBusyId) === text(message.id);
  let action = "";
  if (message.status === "needs_followup" && message.matched_creator_id && !candidateFollowUps.length) {
    action = `
      <div class="mail-inbox-actions">
        <button type="button" class="ghost" data-mail-create-followup="${escapeHtml(message.id)}" ${busy ? "disabled" : ""}>
          ${isCurrentBusy ? "正在新建..." : "新建跟进并归档"}
        </button>
      </div>`;
  } else if (message.status === "needs_followup" && candidateFollowUps.length) {
    action = `
      <div class="mail-inbox-actions">
        <select data-mail-followup-select="${escapeHtml(message.id)}" aria-label="选择合作跟进" ${busy ? "disabled" : ""}>
          ${candidateFollowUps.map((followUp) => `<option value="${escapeHtml(followUp.id)}">${escapeHtml(`${followUp.creator_name || "未命名达人"} · ${followUp.stage || "初步沟通"} · ${followUp.next_action || "无下一步"}`)}</option>`).join("")}
        </select>
        <button type="button" class="ghost" data-mail-archive="${escapeHtml(message.id)}" ${busy ? "disabled" : ""}>${isCurrentBusy ? "正在归档..." : "归档到跟进"}</button>
      </div>`;
  } else {
    action = `<p class="mail-inbox-blocked">${escapeHtml(pendingMailBlockedReason(message))}</p>`;
  }
  return `
    <article class="mail-inbox-row">
      <div class="mail-inbox-row-head">
        <strong>${escapeHtml(message.subject || "无主题")}</strong>
        <span>${escapeHtml(mailInboxStatusLabel(message.status))}</span>
      </div>
      <small>${escapeHtml([direction, message.sender || "未知发件人", formatDateTime(message.occurred_at), message.mailbox].filter(Boolean).join(" · "))}${escapeHtml(creator)}</small>
      <p>${escapeHtml(message.excerpt || "没有可提取的正文摘要")}</p>
      ${action}
    </article>`;
}

function archiveMailIntoFollowUp(message, followUp) {
  if (text(message.brand_id) && text(followUp.brand_id) && text(message.brand_id) !== text(followUp.brand_id)) {
    throw new Error("邮件与合作跟进不属于同一品牌，已阻止归档。");
  }
  const now = new Date().toISOString();
  const event = {
    ...message,
    follow_up_id: followUp.id,
    brand_id: followUp.brand_id,
    brand: followUp.brand,
    updatedAt: now,
  };
  delete event.status;
  delete event.matched_creator_id;
  delete event.matched_creator_name;
  delete event.candidate_creator_ids;
  delete event.candidate_follow_up_ids;

  state.data.followUpEvents = [event, ...(state.data.followUpEvents || [])];
  state.data.mailInbox = (state.data.mailInbox || []).filter((item) => text(item.id) !== text(message.id));

  const followUpIndex = (state.data.followUps || []).findIndex((row) => text(row.id) === text(followUp.id));
  if (followUpIndex >= 0) {
    const current = state.data.followUps[followUpIndex];
    const currentLatest = text(current.last_email_at);
    state.data.followUps[followUpIndex] = {
      ...current,
      last_email_at: !currentLatest || text(message.occurred_at) > currentLatest ? message.occurred_at : currentLatest,
      updatedAt: now,
    };
  }
}

async function archivePendingMail(mailId, followUpId) {
  if (state.followUpInboxBusyId) return;
  state.followUpInboxBusyId = text(mailId);
  setFollowUpInboxNotice("正在归档邮件，请稍候...", "info");
  renderFollowUpPage();
  let snapshot = null;
  try {
    const message = (state.data.mailInbox || []).find((item) => text(item.id) === text(mailId));
    const followUp = allRows("followups").find((item) => text(item.id) === text(followUpId));
    if (!message) throw new Error("找不到这封待归档邮件，可能已被其他操作处理。");
    if (!followUp) throw new Error("找不到所选合作跟进，请刷新后重新选择。");
    if (!belongsToActiveBrand(message) || !belongsToActiveBrand(followUp)) throw new Error("当前工作区与所选邮件或合作跟进不一致。");
    if (message.status !== "needs_followup" || !text(message.matched_creator_id)) {
      throw new Error("该邮件尚未匹配唯一达人，不能直接归档。请先补充或修正达人邮箱。");
    }
    if (text(followUp.creator_id) !== text(message.matched_creator_id)) {
      throw new Error("所选合作跟进不属于该邮件匹配的达人，已阻止归档。");
    }
    if (text(message.brand_id) && text(message.brand_id) !== text(followUp.brand_id)) {
      throw new Error("邮件与所选合作跟进的品牌不一致，已阻止归档。");
    }
    if (isMailAlreadyArchived(message, followUp)) {
      throw new Error("该邮件已存在于合作跟进时间线，未重复归档。");
    }

    snapshot = clone(state.data);
    await withActivity("正在归档邮件", "正在将邮件摘要写入合作跟进时间线...", async () => {
      archiveMailIntoFollowUp(message, followUp);
      await persist();
    });
    setFollowUpInboxNotice(`已归档到「${followUp.creator_name || "未命名达人"}」的合作跟进。`, "success");
    renderCreatorDrawer();
  } catch (error) {
    if (snapshot) state.data = snapshot;
    setFollowUpInboxNotice(error.message || "邮件归档失败。", "error");
  } finally {
    state.followUpInboxBusyId = "";
    renderFollowUpPage();
  }
}

async function createFollowUpAndArchiveMail(mailId) {
  if (state.followUpInboxBusyId) return;
  state.followUpInboxBusyId = text(mailId);
  setFollowUpInboxNotice("正在新建合作跟进并归档邮件，请稍候...", "info");
  renderFollowUpPage();
  let snapshot = null;
  try {
    const message = (state.data.mailInbox || []).find((item) => text(item.id) === text(mailId));
    if (!message) throw new Error("找不到这封待归档邮件，可能已被其他操作处理。");
    if (!belongsToActiveBrand(message)) throw new Error("该邮件不属于当前工作区，请切换到对应品牌后处理。");
    if (message.status !== "needs_followup" || !text(message.matched_creator_id)) {
      throw new Error("该邮件尚未匹配唯一达人，不能自动新建跟进。请先补充或修正达人邮箱。");
    }
    const creator = allRows("creators").find((item) => text(item.id) === text(message.matched_creator_id));
    if (!creator) throw new Error("找不到该邮件匹配的达人资料，请刷新后再试。");
    if (!belongsToActiveBrand(creator)) throw new Error("邮件与达人资料不属于当前工作区，已阻止新建跟进。");
    if (text(message.brand_id) && text(creator.brand_id) && text(message.brand_id) !== text(creator.brand_id)) {
      throw new Error("邮件与达人资料不属于同一品牌，已阻止新建跟进。");
    }
    const existing = allRows("followups").find((followUp) => {
      return text(followUp.creator_id) === text(creator.id) &&
        text(followUp.brand_id) === text(creator.brand_id) &&
        !FOLLOW_UP_TERMINAL_STAGES.has(text(followUp.stage));
    });
    if (existing) {
      throw new Error(`该达人已有活跃合作跟进「${existing.stage || "初步沟通"}」。请在下方选择该跟进后归档。`);
    }
    if (isMailAlreadyArchived(message, { brand_id: creator.brand_id })) {
      throw new Error("该邮件已存在于该品牌的合作跟进时间线，未重复归档。");
    }

    const now = new Date().toISOString();
    const followUp = normalizeFollowUp({
      id: uid("FU"),
      creator_id: creator.id,
      creator_name: creator.name,
      brand_id: creator.brand_id || state.activeBrandId,
      brand: creator.brand || "",
      stage: "初步沟通",
      priority: "中",
      cooperation_mode: "待确认",
      next_action: "查看已同步邮件并确认下一步",
      shipping_status: "未寄样",
      notes: "由官邮 IMAP 同步邮件手动新建跟进。",
      createdAt: now,
      updatedAt: now,
    });

    snapshot = clone(state.data);
    await withActivity("正在新建跟进", "正在建立合作跟进并归档对应邮件...", async () => {
      state.data.followUps = [followUp, ...(state.data.followUps || [])];
      archiveMailIntoFollowUp(message, followUp);
      await persist();
    });
    setFollowUpInboxNotice(`已新建「${creator.name || "未命名达人"}」的合作跟进并归档邮件。`, "success");
    renderCreatorDrawer();
  } catch (error) {
    if (snapshot) state.data = snapshot;
    setFollowUpInboxNotice(error.message || "新建合作跟进失败。", "error");
  } finally {
    state.followUpInboxBusyId = "";
    renderFollowUpPage();
  }
}

function handlePendingMailAction(event) {
  const trigger = event.currentTarget?.matches?.("[data-mail-create-followup], [data-mail-archive]")
    ? event.currentTarget
    : event.target.closest("[data-mail-create-followup], [data-mail-archive]");
  if (!trigger) return;

  event.preventDefault();
  event.stopPropagation();
  if (trigger.dataset.mailCreateFollowup) {
    void createFollowUpAndArchiveMail(trigger.dataset.mailCreateFollowup);
    return;
  }

  const row = trigger.closest(".mail-inbox-row");
  const followUpId = row?.querySelector("[data-mail-followup-select]")?.value;
  if (!followUpId) {
    setFollowUpInboxNotice("请先选择要归档到的合作跟进。", "error");
    renderFollowUpPage();
    return;
  }
  void archivePendingMail(trigger.dataset.mailArchive, followUpId);
}

function decodeBytes(bytes, charset = "utf-8") {
  const normalized = String(charset || "utf-8").toLowerCase().replace(/["']/g, "");
  const aliases = { gb2312: "gb18030", gbk: "gb18030", "iso-8859-1": "windows-1252", latin1: "windows-1252" };
  try {
    return new TextDecoder(aliases[normalized] || normalized).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function base64ToBytes(value) {
  const normalized = text(value).replace(/\s+/g, "");
  if (!normalized) return new Uint8Array();
  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function binaryStringToBytes(value) {
  return Uint8Array.from(String(value || ""), (char) => char.charCodeAt(0) & 0xff);
}

async function readMailSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let output = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return output;
}

function quotedPrintableToBytes(value) {
  const normalized = String(value || "").replace(/=(?:\r?\n)/g, "");
  const bytes = [];
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "=" && /^[0-9a-f]{2}$/i.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      const code = normalized.charCodeAt(index);
      bytes.push(code <= 255 ? code : 63);
    }
  }
  return Uint8Array.from(bytes);
}

function unfoldMimeHeaders(raw) {
  const output = {};
  const lines = String(raw || "").split(/\r?\n/);
  let current = "";
  for (const line of lines) {
    if (/^[ \t]/.test(line) && current) {
      output[current] += ` ${line.trim()}`;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    current = line.slice(0, separator).trim().toLowerCase();
    output[current] = line.slice(separator + 1).trim();
  }
  return output;
}

function decodeMimeHeader(value) {
  return text(value).replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (_match, charset, encoding, payload) => {
    if (String(encoding).toLowerCase() === "b") return decodeBytes(base64ToBytes(payload), charset);
    return decodeBytes(quotedPrintableToBytes(String(payload).replace(/_/g, " ")), charset);
  });
}

function splitMimeEntity(raw) {
  const source = String(raw || "");
  const separatorMatch = source.match(/\r?\n\r?\n/);
  if (!separatorMatch) return { headers: {}, body: source };
  const separatorIndex = separatorMatch.index;
  return { headers: unfoldMimeHeaders(source.slice(0, separatorIndex)), body: source.slice(separatorIndex + separatorMatch[0].length) };
}

function mimeParameter(value, key) {
  const match = String(value || "").match(new RegExp(`${key}\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))`, "i"));
  return match ? match[1] || match[2] || "" : "";
}

function decodeMimeBody(body, headers) {
  const transfer = text(headers["content-transfer-encoding"]).toLowerCase();
  const charset = mimeParameter(headers["content-type"], "charset") || "utf-8";
  if (transfer === "base64") return decodeBytes(base64ToBytes(body), charset);
  if (transfer === "quoted-printable") return decodeBytes(quotedPrintableToBytes(body), charset);
  return decodeBytes(binaryStringToBytes(body), charset);
}

function htmlToText(value) {
  const source = String(value || "");
  if (!source) return "";
  try {
    const documentNode = new DOMParser().parseFromString(source, "text/html");
    documentNode.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
    return documentNode.body?.textContent || documentNode.documentElement?.textContent || "";
  } catch {
    return source.replace(/<[^>]+>/g, " ");
  }
}

function parseMimePart(raw, output = { plain: [], html: [] }) {
  const { headers, body } = splitMimeEntity(raw);
  const contentType = text(headers["content-type"]).toLowerCase();
  if (contentType.startsWith("multipart/")) {
    const boundary = mimeParameter(headers["content-type"], "boundary");
    if (!boundary) return output;
    body.split(`--${boundary}`).forEach((part) => {
      if (!part || part.trim() === "--") return;
      parseMimePart(part.replace(/^\r?\n/, "").replace(/\r?\n--$/, ""), output);
    });
    return output;
  }
  const decoded = decodeMimeBody(body, headers);
  if (contentType.startsWith("text/html")) output.html.push(decoded);
  else if (contentType.startsWith("text/plain") || !contentType) output.plain.push(decoded);
  return output;
}

function cleanMailExcerpt(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => !/^\s*(>|在.+写道：|On .+wrote:)/i.test(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1600);
}

function cleanImportedMailBody(value, maxChars = 12000) {
  const clean = htmlToText(value)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .filter((line) => !/^\s*(>|在.+写道：|On .+wrote:)/i.test(line))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    body: clean.slice(0, maxChars),
    truncated: clean.length > maxChars,
  };
}

function mailBodyRetentionUntil(retentionDays, now = new Date()) {
  const expires = new Date(now.getTime());
  expires.setDate(expires.getDate() + Math.min(365, Math.max(1, Number(retentionDays) || 90)));
  return expires.toISOString();
}

function firstEmail(value) {
  return decodeMimeHeader(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
}

function addressDisplay(value) {
  return decodeMimeHeader(value).replace(/\s+/g, " ").trim();
}

function simpleMailHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function parseEmlFile(file, followUp, creator) {
  const raw = await readMailSource(file);
  const { headers } = splitMimeEntity(raw);
  const parts = parseMimePart(raw);
  const plainText = parts.plain.join("\n\n").trim();
  const htmlText = parts.html.map(htmlToText).join("\n\n").trim();
  const rawBody = plainText || htmlText;
  const excerpt = cleanMailExcerpt(rawBody);
  const policy = normalizedMailContentPolicy();
  const cached = policy.cacheBodies ? cleanImportedMailBody(rawBody) : { body: "", truncated: false };
  const cachedAt = cached.body ? new Date().toISOString() : "";
  const sender = addressDisplay(headers.from);
  const recipients = [headers.to, headers.cc].map(addressDisplay).filter(Boolean).join("；");
  const senderEmail = firstEmail(sender);
  const creatorEmail = firstEmail(creator?.email);
  const occurred = new Date(headers.date || file.lastModified || Date.now());
  const occurredAt = Number.isNaN(occurred.getTime()) ? new Date(file.lastModified || Date.now()).toISOString() : occurred.toISOString();
  const subject = decodeMimeHeader(headers.subject || file.name.replace(/\.eml$/i, ""));
  const messageId = decodeMimeHeader(headers["message-id"] || "").replace(/[<>]/g, "").trim();
  const fingerprintSource = [occurredAt, sender, recipients, subject, excerpt].join("|").toLowerCase();
  return {
    id: uid("EM"),
    follow_up_id: followUp.id,
    brand_id: followUp.brand_id,
    brand: followUp.brand,
    mailbox_account_id: "",
    type: "email",
    occurred_at: occurredAt,
    direction: creatorEmail && senderEmail && creatorEmail === senderEmail ? "inbound" : "outbound",
    subject,
    sender,
    recipients,
    excerpt,
    body: cached.body,
    body_cached_at: cachedAt,
    body_retention_until: cachedAt ? mailBodyRetentionUntil(policy.retentionDays, new Date(cachedAt)) : "",
    body_truncated: cached.truncated,
    message_id: messageId,
    fingerprint: simpleMailHash(fingerprintSource),
    source: "Foxmail .eml",
    filename: file.name,
    createdAt: new Date().toISOString(),
  };
}

function openFollowUpMailImport(followUpId) {
  const followUp = rows("followups").find((row) => row.id === followUpId);
  if (!followUp) return;
  const creator = followUpCreator(followUp);
  state.mailImport = { open: true, followUpId, messages: [], status: "" };
  elements.mailImportTitle.textContent = "导入 Foxmail 邮件";
  const policy = normalizedMailContentPolicy();
  elements.mailImportHint.textContent = `${creator?.name || followUp.creator_name || "该达人"} · 选择从官邮 / Foxmail 导出的 .eml 文件。${policy.cacheBodies ? `将缓存纯文本正文 ${policy.retentionDays} 天${policy.allowAiContext ? "，并允许 AI 用于当前跟进研判" : "，AI 仍只使用摘要"}。` : "当前仅保存邮件摘要。"} 不保存附件、图片或原始邮件文件。`;
  elements.mailImportInput.value = "";
  elements.mailImportStatus.textContent = "尚未选择文件。";
  elements.mailImportPreview.innerHTML = "";
  elements.mailImportConfirmBtn.disabled = true;
  elements.mailImportModal.classList.remove("hidden");
  elements.mailImportModal.setAttribute("aria-hidden", "false");
}

function closeMailImport() {
  state.mailImport = { open: false, followUpId: null, messages: [], status: "" };
  elements.mailImportModal.classList.add("hidden");
  elements.mailImportModal.setAttribute("aria-hidden", "true");
  elements.mailImportInput.value = "";
  elements.mailImportPreview.innerHTML = "";
  elements.mailImportStatus.textContent = "";
  elements.mailImportConfirmBtn.disabled = true;
}

async function previewMailImport(files) {
  const followUp = rows("followups").find((row) => row.id === state.mailImport.followUpId);
  if (!followUp || !files.length) return;
  const creator = followUpCreator(followUp);
  elements.mailImportStatus.textContent = `正在解析 ${files.length} 封邮件...`;
  try {
    const messages = [];
    for (const file of files) messages.push(await parseEmlFile(file, followUp, creator));
    state.mailImport.messages = messages;
    const existingIds = new Set(followUpEventsFor(followUp.id).flatMap((event) => [text(event.message_id), text(event.fingerprint)]).filter(Boolean));
    const newCount = messages.filter((message) => !existingIds.has(message.message_id) && !existingIds.has(message.fingerprint)).length;
    elements.mailImportStatus.textContent = `已解析 ${messages.length} 封，预计新增 ${newCount} 封；重复邮件将在确认时自动跳过。`;
    elements.mailImportPreview.innerHTML = messages
      .map((message) => {
        const duplicate = existingIds.has(message.message_id) || existingIds.has(message.fingerprint);
        return `<article class="mail-import-row ${duplicate ? "is-duplicate" : ""}"><div><strong>${escapeHtml(message.subject || "无主题")}</strong><span>${escapeHtml([message.direction === "inbound" ? "达人来信" : "我方发信", message.sender || "未知发件人", formatDateTime(message.occurred_at)].join(" · "))}</span></div><p>${escapeHtml(message.excerpt || "没有可提取的正文摘要")}</p>${duplicate ? `<small>疑似已导入，将跳过</small>` : ""}</article>`;
      })
      .join("");
    elements.mailImportConfirmBtn.disabled = !messages.length;
  } catch (error) {
    state.mailImport.messages = [];
    elements.mailImportStatus.textContent = error.message || "邮件解析失败，请确认文件是 .eml 格式。";
    elements.mailImportPreview.innerHTML = "";
    elements.mailImportConfirmBtn.disabled = true;
  }
}

async function confirmMailImport() {
  const followUp = rows("followups").find((row) => row.id === state.mailImport.followUpId);
  if (!followUp || !state.mailImport.messages.length) return;
  const existingEvents = (state.data.followUpEvents || []).filter((event) => text(event.brand_id) === text(followUp.brand_id));
  const knownKeys = new Set(existingEvents.flatMap((event) => [text(event.message_id), text(event.fingerprint)]).filter(Boolean));
  const additions = state.mailImport.messages.filter((message) => {
    const keys = [text(message.message_id), text(message.fingerprint)].filter(Boolean);
    if (keys.some((key) => knownKeys.has(key))) return false;
    keys.forEach((key) => knownKeys.add(key));
    return true;
  });
  state.data.followUpEvents = [...additions, ...existingEvents];
  const followUpIndex = state.data.followUps.findIndex((row) => row.id === followUp.id);
  if (followUpIndex >= 0) {
    state.data.followUps[followUpIndex] = {
      ...state.data.followUps[followUpIndex],
      last_email_at: additions.map((item) => item.occurred_at).sort().at(-1) || state.data.followUps[followUpIndex].last_email_at || "",
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const bodyCount = additions.filter((item) => text(item.body)).length;
    await withActivity("正在导入邮件", `正在写入 ${additions.length} 封邮件${bodyCount ? `，其中 ${bodyCount} 封含缓存正文` : "摘要"}...`, persist);
    closeMailImport();
    renderFollowUpPage();
    renderCreatorDrawer();
  } catch (error) {
    elements.mailImportStatus.textContent = error.message || "邮件导入保存失败。";
  }
}

function followUpCardMarkup(row) {
  const creator = followUpCreator(row);
  const product = followUpProduct(row);
  const latestMail = latestFollowUpEmail(row.id);
  const overdue = isFollowUpOverdue(row);
  const creatorLabel = creator?.name || row.creator_name || "未关联达人";
  const meta = [row.brand, product?.name, row.cooperation_mode].filter(Boolean).join(" · ");
  const followUpAt = row.next_follow_up_at ? formatDateTime(row.next_follow_up_at) : "未设置";
  return `
    <article class="followup-card ${overdue ? "is-overdue" : ""}" data-followup-card="${escapeHtml(row.id)}" role="button" tabindex="0" aria-label="打开 ${escapeHtml(creatorLabel)} 的合作跟进详情">
      <div class="followup-card-head">
        <div class="followup-card-creator">
          <span class="creator-avatar small">${escapeHtml((creatorLabel || "达").slice(0, 1).toUpperCase())}</span>
          <div><strong>${escapeHtml(creatorLabel)}</strong><small>${escapeHtml([creator?.platform, normalizeCountry(creator?.country)].filter(Boolean).join(" · ") || "达人信息待补充")}</small></div>
        </div>
        <button type="button" class="icon-button" data-followup-edit="${escapeHtml(row.id)}" aria-label="编辑合作跟进" title="编辑合作跟进">✎</button>
      </div>
      <div class="followup-card-badges">${statusBadge(row.stage)}${statusBadge(row.priority, "中")}</div>
      <p class="followup-card-meta">${escapeHtml(meta || "品牌 / 产品待补充")}</p>
      <div class="followup-card-next">
        <span>下一步</span><strong>${escapeHtml(row.next_action || "待补充动作")}</strong>
        <time class="${overdue ? "is-overdue" : ""}">${overdue ? "已逾期 · " : ""}${escapeHtml(followUpAt)}</time>
      </div>
      <div class="followup-card-foot">
        <span>${latestMail ? `最近邮件 ${escapeHtml(formatDateTime(latestMail.occurred_at))}` : "暂无邮件记录"}</span>
        <div class="followup-card-actions">
          <button type="button" class="ghost icon-action" data-followup-mail="${escapeHtml(row.id)}" aria-label="导入 Foxmail 邮件" title="导入 Foxmail 邮件">✉</button>
          <button type="button" class="ghost icon-action" data-followup-delete="${escapeHtml(row.id)}" aria-label="删除合作跟进" title="删除合作跟进">×</button>
        </div>
      </div>
    </article>`;
}

function followUpSmtpAccounts(followUp) {
  const brandId = text(followUp?.brand_id);
  return (state.mailSettings.accounts || []).filter((account) => {
    const imap = account.imap || {};
    const smtp = account.smtp || {};
    const passwordReady = smtp.useImapPassword !== false ? imap.hasPassword : smtp.hasPassword;
    return (
      account.enabled &&
      smtp.enabled !== false &&
      text(account.brand_id) === brandId &&
      Boolean(smtp.host || imap.host) &&
      Boolean(smtp.user || imap.user) &&
      Boolean(passwordReady)
    );
  });
}

function followUpEventScopeLabel(event) {
  if (!text(event?.body)) return "已归档邮件摘要";
  const retentionUntil = Date.parse(text(event?.body_retention_until));
  if (Number.isFinite(retentionUntil) && retentionUntil <= Date.now()) return "正文缓存已过期";
  if (!text(event?.body_cached_at) || !Number.isFinite(retentionUntil)) return "历史正文未纳入 AI";
  const policy = normalizedMailContentPolicy();
  if (!policy.cacheBodies) return "完整正文缓存未开启";
  if (!policy.allowAiContext) return "正文已缓存，未授权给 AI";
  return "完整正文已缓存";
}

function followUpBodyContextSummary(followUpId) {
  const events = followUpEventsFor(followUpId).filter((event) => event.type === "email" || event.type === "mail_sent");
  const policy = normalizedMailContentPolicy();
  const counts = { full: 0, summary: 0, withheld: 0, expired: 0, legacy: 0 };
  events.forEach((event) => {
    const label = followUpEventScopeLabel(event);
    if (label === "完整正文已缓存") counts.full += 1;
    else {
      counts.summary += 1;
      if (label === "正文已缓存，未授权给 AI") counts.withheld += 1;
      if (label === "正文缓存已过期") counts.expired += 1;
      if (label === "历史正文未纳入 AI") counts.legacy += 1;
    }
  });
  const details = [`AI 上下文：完整正文 ${counts.full} 封，摘要 ${counts.summary} 封`];
  details.push(`正文缓存：${policy.cacheBodies ? `已开启（${policy.retentionDays} 天）` : "未开启"}`);
  details.push(`AI 正文授权：${policy.allowAiContext ? "已开启" : "未开启"}`);
  if (counts.withheld) details.push(`${counts.withheld} 封已缓存但未授权`);
  if (counts.expired) details.push(`${counts.expired} 封已过期`);
  if (counts.legacy) details.push(`${counts.legacy} 封历史正文未纳入`);
  return details;
}

function followUpEventDirectionLabel(event) {
  if (event?.direction === "inbound") return "达人来信";
  if (event?.direction === "outbound") return "我方发信";
  if (event?.direction === "internal") return "内部更新";
  return "收发方向待确认";
}

function followUpTimelineMarkup(events) {
  if (!events.length) return `<p class="followup-detail-empty">暂无邮件或阶段事件。可手动同步官邮，或从 Foxmail 导入 .eml 邮件。</p>`;
  return `
    <div class="followup-detail-timeline">
      ${events
        .map((event) => {
          const isMail = event.type === "email" || event.type === "mail_sent";
          const scope = isMail ? followUpEventScopeLabel(event) : "工作台记录";
          const content = text(event.body || event.excerpt);
          return `
            <article class="followup-detail-event ${event.direction === "inbound" ? "is-inbound" : event.direction === "outbound" ? "is-outbound" : "is-internal"}">
              <header>
                <div>
                  <strong>${escapeHtml(event.subject || "无主题")}</strong>
                  <span>${escapeHtml([followUpEventDirectionLabel(event), scope].join(" · "))}</span>
                </div>
                <time>${escapeHtml(formatDateTime(event.occurred_at || event.createdAt) || "时间未知")}</time>
              </header>
              ${event.sender || event.recipients ? `<small>${escapeHtml([event.sender ? `发件：${event.sender}` : "", event.recipients ? `收件：${event.recipients}` : ""].filter(Boolean).join(" · "))}</small>` : ""}
              ${content ? `<p>${escapeHtml(content)}</p>` : `<p class="is-empty">未保存邮件正文。</p>`}
              <footer>${escapeHtml(event.source || "工作台")}${event.mailbox ? ` · ${escapeHtml(event.mailbox)}` : ""}</footer>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function followUpAnalysisMarkup(analysis, selectedStrategy) {
  if (!analysis) {
    return `<p class="followup-detail-empty">先写下本次关注点后进行 AI 分析。AI 只给出建议，不会改动当前阶段或发送邮件。</p>`;
  }
  const confidence = { low: "低", medium: "中", high: "高" }[analysis.confidence] || "低";
  const list = (items = [], className = "") => (items.length ? `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="followup-detail-empty">暂无</p>`);
  return `
    <section class="followup-ai-analysis-result">
      <div class="followup-ai-summary">
        <span>AI 判断</span>
        <strong>${escapeHtml(analysis.summary_cn || "暂无摘要")}</strong>
      </div>
      <div class="followup-ai-meta">
        <span>建议阶段：<b>${escapeHtml(analysis.suggested_stage || "待人工确认")}</b></span>
        <span>置信度：<b>${escapeHtml(confidence)}</b></span>
        <span>建议间隔：<b>${escapeHtml(`${Number(analysis.recommended_follow_up_days || 0)} 天`)}</b></span>
      </div>
      <p class="followup-ai-notice">仅建议，不会自动修改当前阶段。${escapeHtml(analysis.context_notice || "")}</p>
      <div class="followup-ai-grid">
        <section><h4>关键事实</h4>${list(analysis.key_facts || [])}</section>
        <section><h4>风险与待确认</h4>${list(analysis.risk_notes || [])}</section>
      </div>
      <section class="followup-ai-evidence"><h4>证据范围</h4>${list(analysis.evidence || [])}</section>
      ${(analysis.warnings || []).length ? `<section class="followup-ai-warnings"><h4>提醒</h4>${list(analysis.warnings || [])}</section>` : ""}
      <section class="followup-ai-strategies">
        <h4>选择下一步策略</h4>
        <div>
          ${(analysis.recommended_options || [])
            .map(
              (option, index) => `
                <label class="followup-ai-strategy">
                  <input type="radio" name="followupStrategy" value="${escapeHtml(option.id)}" ${selectedStrategy === option.id || (!selectedStrategy && index === 0) ? "checked" : ""} />
                  <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.description)}</small></span>
                </label>
              `,
            )
            .join("")}
        </div>
      </section>
    </section>
  `;
}

function followUpDraftMarkup(draft) {
  if (!draft) return `<p class="followup-detail-empty">选择策略并填写中文回复思路后生成英文草稿。邮件不会自动发送。</p>`;
  return `
    <section class="followup-draft-result">
      <label>邮件主题<input type="text" data-followup-email-subject value="${escapeHtml(draft.subject || "")}" maxlength="500" /></label>
      <label>英文正文<textarea data-followup-email-body rows="12" maxlength="16000">${escapeHtml(draft.body || "")}</textarea></label>
      ${(draft.warnings || []).length ? `<div class="followup-draft-warnings">${draft.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function openFollowUpDetail(followUpId) {
  const followUp = rows("followups").find((row) => text(row.id) === text(followUpId));
  if (!followUp) return;
  state.followUpDetail = {
    open: true,
    followUpId: followUp.id,
    analysis: null,
    draft: null,
    userNote: "",
    customIntent: "",
    strategyId: "",
    status: "",
  };
  elements.followUpDetailModal.classList.remove("hidden");
  elements.followUpDetailModal.setAttribute("aria-hidden", "false");
  renderFollowUpDetail();
}

function closeFollowUpDetail() {
  state.followUpDetail = { open: false, followUpId: null, analysis: null, draft: null, userNote: "", customIntent: "", strategyId: "", status: "" };
  elements.followUpDetailModal.classList.add("hidden");
  elements.followUpDetailModal.setAttribute("aria-hidden", "true");
  elements.followUpDetailBody.innerHTML = "";
}

function renderFollowUpDetail() {
  if (!state.followUpDetail.open) return;
  const followUp = rows("followups").find((row) => text(row.id) === text(state.followUpDetail.followUpId));
  if (!followUp) {
    closeFollowUpDetail();
    return;
  }

  const creator = followUpCreator(followUp);
  const product = followUpProduct(followUp);
  const events = followUpEventsFor(followUp.id);
  const inbound = latestInboundFollowUpEmail(followUp.id);
  const smtpAccounts = followUpSmtpAccounts(followUp);
  const selectedStrategy = text(state.followUpDetail.strategyId) || text(state.followUpDetail.analysis?.recommended_options?.[0]?.id);
  const productUrl = safeExternalUrl(product?.product_url);
  const publishUrl = safeExternalUrl(followUp.publish_url);
  const creatorUrl = safeExternalUrl(creator?.social_url);
  const recipient = text(state.followUpDetail.recipient || creator?.email);

  elements.followUpDetailTitle.textContent = creator?.name || followUp.creator_name || "合作跟进详情";
  elements.followUpDetailHint.textContent = `${followUp.brand || "未绑定品牌"} · ${creator?.platform || "平台待补充"} · 当前阶段 ${followUp.stage || "待确认"}`;
  elements.followUpDetailBody.innerHTML = `
    <div class="followup-detail-layout">
      <section class="followup-detail-main">
        <section class="followup-detail-overview">
          <div class="followup-detail-creator">
            <span class="creator-avatar">${escapeHtml((creator?.name || followUp.creator_name || "达").slice(0, 1).toUpperCase())}</span>
            <div>
              <strong>${escapeHtml(creator?.name || followUp.creator_name || "未关联达人")}</strong>
              <span>${escapeHtml([creator?.handle, creator?.platform, normalizeCountry(creator?.country)].filter(Boolean).join(" · ") || "达人信息待补充")}</span>
              <small>${creator?.email ? escapeHtml(creator.email) : "达人邮箱待补充"}</small>
            </div>
            <div class="followup-detail-overview-actions">
              ${creatorUrl ? `<a class="icon-button" href="${escapeHtml(creatorUrl)}" target="_blank" rel="noreferrer" aria-label="打开达人社媒主页" title="打开达人社媒主页">↗</a>` : ""}
              <button type="button" class="icon-button" data-followup-detail-edit="${escapeHtml(followUp.id)}" aria-label="编辑合作跟进" title="编辑合作跟进">✎</button>
              <button type="button" class="icon-button" data-followup-detail-import="${escapeHtml(followUp.id)}" aria-label="导入 Foxmail 邮件" title="导入 Foxmail 邮件">✉</button>
            </div>
          </div>
          <div class="followup-detail-badges">${statusBadge(followUp.stage)}${statusBadge(followUp.priority, "中")}<span class="detail-brand-badge">${escapeHtml(followUp.brand || "未绑定品牌")}</span></div>
          <dl class="followup-detail-facts">
            <div><dt>合作方式</dt><dd>${escapeHtml(followUp.cooperation_mode || "待确认")}</dd></div>
            <div><dt>下一步</dt><dd>${escapeHtml(followUp.next_action || "待补充")}</dd></div>
            <div><dt>下次跟进</dt><dd>${escapeHtml(formatDateTime(followUp.next_follow_up_at) || "未设置")}</dd></div>
            <div><dt>寄样物流</dt><dd>${escapeHtml([followUp.shipping_status || "未寄样", followUp.tracking_no].filter(Boolean).join(" · "))}</dd></div>
            <div><dt>预计发布</dt><dd>${escapeHtml(followUp.publish_due_at || "未设置")}</dd></div>
            <div><dt>发布链接</dt><dd>${publishUrl ? `<a href="${escapeHtml(publishUrl)}" target="_blank" rel="noreferrer">打开链接</a>` : "待补充"}</dd></div>
          </dl>
          ${text(followUp.notes) ? `<p class="followup-detail-notes"><b>内部备注</b>${escapeHtml(followUp.notes)}</p>` : ""}
        </section>

        <section class="followup-detail-section">
          <header><div><span>PRODUCT</span><h3>关联产品</h3></div></header>
          ${product ? `<article class="followup-detail-product">${productImageMarkup(product)}<div><strong>${escapeHtml(product.name || "未命名产品")}</strong><span>${escapeHtml([product.country, product.category, product.store].filter(Boolean).join(" · ") || "产品资料待补充")}</span>${productUrl ? `<a href="${escapeHtml(productUrl)}" target="_blank" rel="noreferrer">打开产品页面</a>` : ""}</div></article>` : `<p class="followup-detail-empty">尚未关联产品。</p>`}
        </section>

        <section class="followup-detail-section">
          <header><div><span>MAIL TIMELINE</span><h3>邮件与推进记录</h3></div><small>${events.length} 条</small></header>
          ${followUpTimelineMarkup(events)}
        </section>
      </section>

      <aside class="followup-detail-side">
        <section class="followup-detail-section followup-ai-panel">
          <header><div><span>AI REVIEW</span><h3>沟通研判</h3></div></header>
          <p class="followup-context-scope">${followUpBodyContextSummary(followUp.id).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</p>
          <label class="followup-ai-note-label">本次关注点 / 人工备注<textarea data-followup-ai-note rows="4" maxlength="1600" placeholder="例如：确认对方是否接受置换，或说明我希望先确认报价。">${escapeHtml(state.followUpDetail.userNote || "")}</textarea></label>
          <button type="button" class="primary" data-followup-ai-analyze>AI 分析沟通状态</button>
          ${followUpAnalysisMarkup(state.followUpDetail.analysis, selectedStrategy)}
        </section>

        <section class="followup-detail-section followup-draft-panel">
          <header><div><span>REPLY DRAFT</span><h3>生成回复草稿</h3></div></header>
          <label class="followup-ai-note-label">中文回复思路<textarea data-followup-custom-intent rows="3" maxlength="1800" placeholder="补充你希望表达的内容；AI 会根据选中的策略生成英文草稿。">${escapeHtml(state.followUpDetail.customIntent || "")}</textarea></label>
          <button type="button" class="ghost" data-followup-ai-draft ${state.followUpDetail.analysis ? "" : "disabled"}>生成可编辑英文草稿</button>
          ${followUpDraftMarkup(state.followUpDetail.draft)}
        </section>

        <section class="followup-detail-section followup-send-panel">
          <header><div><span>MANUAL SEND</span><h3>人工确认发信</h3></div></header>
          ${smtpAccounts.length
            ? `
              <label>官方邮箱<select data-followup-send-account>${smtpAccounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(`${account.brand_name || followUp.brand} · ${account.label || account.smtp?.user || account.imap?.user}`)}</option>`).join("")}</select></label>
              <label>收件人<input type="email" data-followup-send-to value="${escapeHtml(recipient)}" placeholder="creator@example.com" /></label>
              <p class="followup-send-notice">发送前会再次确认；仅在本系统通过 SMTP 发出的正文才会保存在时间线。${inbound ? "将尝试关联最近一封达人来信。" : ""}</p>
              <button type="button" class="primary" data-followup-send ${state.followUpDetail.draft ? "" : "disabled"}>确认并发送邮件</button>
            `
            : `<p class="followup-detail-empty">当前品牌没有已配置 SMTP 的官方邮箱。请到设置页保存并测试该品牌的 SMTP 账户。</p>`}
        </section>
        ${state.followUpDetail.status ? `<p class="followup-detail-status">${escapeHtml(state.followUpDetail.status)}</p>` : ""}
      </aside>
    </div>
  `;

  elements.followUpDetailBody.querySelector("[data-followup-detail-edit]")?.addEventListener("click", () => {
    closeFollowUpDetail();
    openFollowUpEditor({ id: followUp.id });
  });
  elements.followUpDetailBody.querySelector("[data-followup-detail-import]")?.addEventListener("click", () => openFollowUpMailImport(followUp.id));
  elements.followUpDetailBody.querySelector("[data-followup-ai-analyze]")?.addEventListener("click", () => void analyzeFollowUpDetail());
  elements.followUpDetailBody.querySelector("[data-followup-ai-draft]")?.addEventListener("click", () => void draftFollowUpReply());
  elements.followUpDetailBody.querySelector("[data-followup-send]")?.addEventListener("click", () => void sendFollowUpReply(inbound?.id || ""));
  elements.followUpDetailBody.querySelectorAll('input[name="followupStrategy"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.followUpDetail.strategyId = input.value;
    });
  });
}

async function analyzeFollowUpDetail() {
  const followUpId = state.followUpDetail.followUpId;
  const note = text(elements.followUpDetailBody.querySelector("[data-followup-ai-note]")?.value);
  state.followUpDetail.userNote = note;
  state.followUpDetail.status = "正在读取已归档上下文并生成中文研判...";
  renderFollowUpDetail();
  try {
    const payload = await withActivity("正在分析沟通状态", "AI 正在仅根据已归档邮件和合作资料生成建议...", async () => {
      const response = await apiFetch(API_FOLLOWUP_ANALYZE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpId, userNote: note }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "AI 沟通分析失败");
      return result;
    });
    state.followUpDetail.analysis = payload;
    state.followUpDetail.strategyId = text(payload.recommended_options?.[0]?.id);
    state.followUpDetail.draft = null;
    state.followUpDetail.status = "AI 已完成研判。建议仅供人工决策，不会修改合作阶段。";
  } catch (error) {
    state.followUpDetail.status = error.message || "AI 沟通分析失败";
  }
  renderFollowUpDetail();
}

async function draftFollowUpReply() {
  const detail = state.followUpDetail;
  if (!detail.analysis) {
    detail.status = "请先完成 AI 沟通研判，再选择策略生成草稿。";
    renderFollowUpDetail();
    return;
  }
  const selected = elements.followUpDetailBody.querySelector('input[name="followupStrategy"]:checked');
  const note = text(elements.followUpDetailBody.querySelector("[data-followup-ai-note]")?.value);
  const intent = text(elements.followUpDetailBody.querySelector("[data-followup-custom-intent]")?.value);
  detail.userNote = note;
  detail.customIntent = intent;
  detail.strategyId = text(selected?.value) || text(detail.strategyId);
  detail.status = "正在生成可编辑英文回复草稿...";
  renderFollowUpDetail();
  try {
    const payload = await withActivity("正在生成回复草稿", "AI 正在根据选中策略和人工意图撰写草稿...", async () => {
      const response = await apiFetch(API_FOLLOWUP_DRAFT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpId: detail.followUpId,
          strategyId: detail.strategyId,
          customIntent: intent,
          userNote: note,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "AI 回复草稿生成失败");
      return result;
    });
    detail.draft = payload;
    detail.status = "草稿已生成。请逐项核对收件人、主题和正文后再发送。";
  } catch (error) {
    detail.status = error.message || "AI 回复草稿生成失败";
  }
  renderFollowUpDetail();
}

async function sendFollowUpReply(replyToEventId = "") {
  const detail = state.followUpDetail;
  const followUp = rows("followups").find((row) => text(row.id) === text(detail.followUpId));
  const accountId = text(elements.followUpDetailBody.querySelector("[data-followup-send-account]")?.value);
  const to = text(elements.followUpDetailBody.querySelector("[data-followup-send-to]")?.value);
  const subject = text(elements.followUpDetailBody.querySelector("[data-followup-email-subject]")?.value);
  const body = text(elements.followUpDetailBody.querySelector("[data-followup-email-body]")?.value);
  if (!followUp || !accountId || !to || !subject || !body) {
    detail.status = "请先确认官方邮箱、收件人、邮件主题和正文均已填写。";
    renderFollowUpDetail();
    return;
  }
  const account = followUpSmtpAccounts(followUp).find((item) => text(item.id) === accountId);
  if (!account) {
    detail.status = "所选官方邮箱与当前品牌不匹配，已阻止发送。";
    renderFollowUpDetail();
    return;
  }
  if (!window.confirm(`即将使用「${account.label || account.smtp?.user || account.imap?.user}」向 ${to} 发送邮件。\n\n邮件发送后将记录在本地时间线，是否继续？`)) return;

  detail.recipient = to;
  detail.draft = { ...(detail.draft || {}), subject, body };
  detail.status = "正在通过官方邮箱发送邮件...";
  renderFollowUpDetail();
  try {
    const payload = await withActivity("正在发送邮件", "正在通过当前品牌的 SMTP 官方邮箱发送；发送后将写入时间线...", async () => {
      const response = await apiFetch(API_MAIL_SEND, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpId: followUp.id,
          accountId,
          to,
          subject,
          text: body,
          replyToEventId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || "邮件发送失败");
      return result;
    });
    state.data = ensureStateShape(payload.state);
    detail.status = "邮件已发送并写入时间线。合作阶段保持不变，请按实际沟通结果手动更新。";
    renderFollowUpPage();
    renderCreatorDrawer();
  } catch (error) {
    detail.status = error.message || "邮件发送失败";
  }
  renderFollowUpDetail();
}

function openFollowUpEditor({ id = null, creatorId = "", cooperationId = "" } = {}) {
  state.activeTab = "followups";
  resetEditorState();
  const existing = id ? rows("followups").find((row) => row.id === id) : null;
  if (!existing && !state.activeBrandId) {
    window.alert("请先在顶部选择一个品牌工作区，再新建合作跟进。");
    return;
  }
  const draft = existing ? clone(existing) : defaultRecord("followups");
  if (!existing) {
    draft.creator_id = creatorId;
    draft.cooperation_id = cooperationId;
    resolveFollowUpLinks(draft);
    draft.priority = "中";
    draft.cooperation_mode = "待确认";
    draft.next_action = "";
  }
  state.editingId = existing?.id || null;
  state.editorDraft = draft;
  state.editorBaseline = editableSnapshot(draft, "followups");
  state.editorOpen = true;
  render();
}

function renderFollowUpPage() {
  setEntityUiVisible(false);
  elements.settingsPage.classList.add("hidden");
  elements.matchingPage.classList.add("hidden");
  elements.productPage.classList.add("hidden");
  elements.followUpPage.classList.remove("hidden");

  const allRows = rows("followups").slice().sort((a, b) => new Date(a.next_follow_up_at || "2999-01-01") - new Date(b.next_follow_up_at || "2999-01-01"));
  const boardFilter = state.followUpBoardFilter;
  const query = text(boardFilter.query).toLowerCase();
  const visibleRows = allRows.filter((row) => {
    const creator = followUpCreator(row);
    const haystack = [row.id, row.creator_name, creator?.name, row.brand, row.stage, row.priority, row.next_action, row.notes].map(text).join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (boardFilter.stage && text(row.stage) !== boardFilter.stage) return false;
    if (boardFilter.priority && text(row.priority) !== boardFilter.priority) return false;
    if (boardFilter.overdueOnly && !isFollowUpOverdue(row)) return false;
    return true;
  });
  const activeRows = visibleRows.filter((row) => !FOLLOW_UP_TERMINAL_STAGES.has(text(row.stage)));
  const terminalRows = visibleRows.filter((row) => FOLLOW_UP_TERMINAL_STAGES.has(text(row.stage)));
  const metrics = getMetrics("followups", allRows);
  const todayCount = allRows.filter((row) => isSameLocalDay(row.next_follow_up_at, new Date())).length;
  const overdueCount = allRows.filter((row) => isFollowUpOverdue(row)).length;
  const pendingMail = (state.data.mailInbox || [])
    .filter(belongsToActiveBrand)
    .slice()
    .sort((a, b) => new Date(b.occurred_at || b.createdAt || 0) - new Date(a.occurred_at || a.createdAt || 0));
  const activeMailAccount = state.activeBrandId ? availableMailAccount(state.activeBrandId) : null;
  const mailConfigured = Boolean(
    activeMailAccount?.enabled &&
      activeMailAccount.imap?.host &&
      activeMailAccount.imap?.user &&
      activeMailAccount.imap?.hasPassword,
  );
  const inboxNotice = state.followUpInboxNotice?.text
    ? `<p class="mail-inbox-notice is-${escapeHtml(state.followUpInboxNotice.tone || "info")}">${escapeHtml(state.followUpInboxNotice.text)}</p>`
    : "";

  elements.followUpPage.innerHTML = `
    <header class="followup-head">
      <div>
        <span class="eyebrow">PIPELINE</span>
        <h2>合作跟进</h2>
        <p class="panel-hint">按合作阶段集中查看沟通、寄样、物流和发布回收进度。连接官邮 IMAP 后可手动同步，Foxmail .eml 导入仍可作为备用。</p>
      </div>
      <div class="followup-head-actions">
        <button type="button" class="ghost" data-followup-filter-overdue title="只看逾期跟进">${overdueCount ? `逾期 ${overdueCount}` : "逾期"}</button>
        <button type="button" class="ghost" data-followup-sync title="${mailConfigured ? "同步当前品牌官邮 IMAP" : state.activeBrandId ? "前往设置当前品牌邮箱 IMAP" : "请先选择品牌工作区"}">${mailConfigured ? "同步邮箱" : state.activeBrandId ? "配置邮箱" : "选择品牌"}</button>
        <button type="button" class="primary" data-followup-new>新增跟进</button>
      </div>
    </header>
    <div class="followup-metrics">
      ${metrics.map(([label, value]) => `<div class="followup-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    </div>
    <div class="followup-toolbar">
      <input type="search" data-followup-filter="query" value="${escapeHtml(boardFilter.query)}" placeholder="搜索达人、品牌、动作、备注..." />
      <select data-followup-filter="stage"><option value="">全部阶段</option>${FOLLOW_UP_STAGES.map((stage) => `<option value="${escapeHtml(stage)}" ${boardFilter.stage === stage ? "selected" : ""}>${escapeHtml(stage)}</option>`).join("")}</select>
      <select data-followup-filter="priority"><option value="">全部优先级</option>${["高", "中", "低"].map((priority) => `<option value="${priority}" ${boardFilter.priority === priority ? "selected" : ""}>${priority}优先级</option>`).join("")}</select>
      <span class="followup-toolbar-count">当前显示 ${visibleRows.length} / ${allRows.length} 条</span>
    </div>
    <div class="followup-board">
      ${FOLLOW_UP_BOARD_COLUMNS.map((column) => {
        const columnRows = activeRows.filter((row) => column.stages.includes(text(row.stage)));
        return `
          <section class="followup-column">
            <header class="followup-column-head"><strong>${escapeHtml(column.title)}</strong><span>${columnRows.length}</span></header>
            <div class="followup-column-body">${columnRows.length ? columnRows.map(followUpCardMarkup).join("") : `<p class="followup-column-empty">暂无跟进</p>`}</div>
          </section>`;
      }).join("")}
    </div>
    <section class="followup-closed">
      <header class="followup-column-head"><strong>已结束 / 暂停</strong><span>${terminalRows.length}</span></header>
      <div class="followup-closed-list">${terminalRows.length ? terminalRows.map(followUpCardMarkup).join("") : `<p class="followup-column-empty">暂无已结束记录</p>`}</div>
    </section>
    <section class="mail-inbox">
      <header class="mail-inbox-head">
        <div><strong>待人工归档邮件</strong><small>仅在无法唯一关联到一条活跃合作跟进时保留在此处，避免把邮件写错到其他达人。</small></div>
        <span>${pendingMail.length}</span>
      </header>
      ${inboxNotice}
      <div class="mail-inbox-list">${pendingMail.length ? pendingMail.slice(0, 24).map(mailInboxRowMarkup).join("") : `<p class="followup-column-empty">暂无待人工处理邮件</p>`}</div>
    </section>
    ${!allRows.length ? `<section class="followup-empty"><strong>还没有合作跟进</strong><p>把已进入达人库的达人按实际进度建立跟进记录，之后就能在看板上持续追踪。</p><button type="button" class="primary" data-followup-new>新增第一条跟进</button></section>` : ""}
  `;

  elements.followUpPage.querySelectorAll("[data-followup-new]").forEach((button) => button.addEventListener("click", () => openFollowUpEditor()));
  elements.followUpPage.querySelectorAll("[data-mail-create-followup], [data-mail-archive]").forEach((button) => {
    button.addEventListener("click", handlePendingMailAction);
  });
  elements.followUpPage.querySelectorAll("[data-followup-card]").forEach((card) => {
    card.addEventListener("click", () => openFollowUpDetail(card.dataset.followupCard));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openFollowUpDetail(card.dataset.followupCard);
    });
  });
  elements.followUpPage.querySelectorAll("[data-followup-edit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openFollowUpEditor({ id: button.dataset.followupEdit });
    });
  });
  elements.followUpPage.querySelectorAll("[data-followup-mail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openFollowUpMailImport(button.dataset.followupMail);
    });
  });
  elements.followUpPage.querySelector("[data-followup-sync]")?.addEventListener("click", () => {
    if (!state.activeBrandId) {
      state.activeTab = SETTINGS_TAB.key;
      render();
      elements.mailSettingsStatus.textContent = "请先在顶部选择一个品牌工作区，再同步该品牌官方邮箱。";
      return;
    }
    if (!mailConfigured) {
      state.activeTab = SETTINGS_TAB.key;
      render();
      elements.mailSettingsStatus.textContent = "当前品牌还没有配置完成的 IMAP 邮箱。请先新增或编辑邮箱账户。";
      return;
    }
    void syncMailbox(activeMailAccount.id);
  });
  elements.followUpPage.querySelectorAll("[data-followup-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const followUp = rows("followups").find((row) => row.id === button.dataset.followupDelete);
      if (!followUp || !window.confirm(`确认删除「${followUp.creator_name || "该达人"}」的合作跟进？`)) return;
      state.data.followUps = allRows("followups").filter((row) => row.id !== followUp.id);
      state.data.followUpEvents = (state.data.followUpEvents || []).filter((event) => event.follow_up_id !== followUp.id);
      await persist();
      renderFollowUpPage();
      renderCreatorDrawer();
    });
  });
  elements.followUpPage.querySelectorAll("[data-followup-filter]").forEach((control) => {
    const eventName = control.tagName === "INPUT" ? "input" : "change";
    control.addEventListener(eventName, () => {
      state.followUpBoardFilter[control.dataset.followupFilter] = control.value;
      renderFollowUpPage();
    });
  });
  elements.followUpPage.querySelector("[data-followup-filter-overdue]")?.addEventListener("click", () => {
    state.followUpBoardFilter.overdueOnly = !state.followUpBoardFilter.overdueOnly;
    renderFollowUpPage();
  });
}

function productFilterOptions(fieldKey) {
  return getOptionValues("products", fieldKey);
}

function filteredProducts() {
  const filters = state.productFilters;
  const query = text(filters.query).toLowerCase();
  return rows("products").filter((product) => {
    const haystack = Object.values(product).map((value) => text(value).toLowerCase()).join(" ");
    if (query && !haystack.includes(query)) return false;
    return ["brand", "country", "category", "store"].every((key) => !text(filters[key]) || text(product[key]) === text(filters[key]));
  });
}

function productImageMarkup(product) {
  const imageUrl = safeExternalUrl(product.image_url);
  if (imageUrl) {
    return `<img class="product-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name || "产品主图")}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div class="product-image-empty" hidden>${escapeHtml((product.name || "产").slice(0, 1))}</div>`;
  }
  return `<div class="product-image-empty">${escapeHtml((product.name || "产").slice(0, 1))}</div>`;
}

function renderProductPage() {
  elements.summary.classList.add("hidden");
  elements.workspace.classList.add("hidden");
  elements.settingsPage.classList.add("hidden");
  elements.matchingPage.classList.add("hidden");
  elements.followUpPage.classList.add("hidden");
  elements.productPage.classList.remove("hidden");

  const products = filteredProducts();
  const selectOptions = (key, label) => `
    <label class="product-filter">
      <span>${label}</span>
      <select data-product-filter="${key}">
        <option value="">全部</option>
        ${productFilterOptions(key).map((value) => `<option value="${escapeHtml(value)}" ${text(state.productFilters[key]) === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
      </select>
    </label>`;
  const grouped = new Map();
  for (const product of products) {
    const groupKey = [text(product.country) || "未分国家", text(product.category) || "未分类", text(product.store) || "未分店铺"].join(" / ");
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(product);
  }

  elements.productPage.innerHTML = `
    <header class="product-library-head">
      <div>
        <h2>产品库</h2>
        <p class="panel-hint">按国家、类目与店铺沉淀产品。邮件生成时只会引用本次选择的产品资料。</p>
      </div>
      <button type="button" class="primary" data-new-product>新增产品</button>
    </header>
    <div class="product-filters">
      <label class="product-filter product-search">
        <span>搜索</span>
        <input type="search" data-product-filter="query" value="${escapeHtml(state.productFilters.query)}" placeholder="搜索产品名、卖点、标签..." />
      </label>
      ${selectOptions("brand", "品牌")}
      ${selectOptions("country", "国家地区")}
      ${selectOptions("category", "产品类目")}
      ${selectOptions("store", "店铺")}
    </div>
    <p class="product-count">共 ${products.length} 个产品${products.length !== rows("products").length ? `，已按条件筛选` : ""}</p>
    ${
      products.length
        ? [...grouped.entries()]
            .map(
              ([group, items]) => `
                <section class="product-group">
                  <h3>${escapeHtml(group)} <span>${items.length}</span></h3>
                  <div class="product-grid">
                    ${items
                      .map(
                        (product) => `
                          <article class="product-card" data-open-product="${escapeHtml(product.id)}" title="双击编辑产品">
                            <div class="product-image-wrap">${productImageMarkup(product)}</div>
                            <div class="product-card-meta">
                              <strong>${escapeHtml(product.name || "未命名产品")}</strong>
                              <span class="product-card-context">${escapeHtml([product.brand, product.tags].filter(Boolean).join(" · ") || "尚未填写标签")}</span>
                              ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
                              <div class="product-card-actions">
                                ${safeExternalUrl(product.product_url) ? `<a class="ghost" href="${escapeHtml(safeExternalUrl(product.product_url))}" target="_blank" rel="noopener noreferrer">打开链接</a>` : ""}
                                <button type="button" class="ghost" data-edit-product="${escapeHtml(product.id)}">编辑</button>
                                <button type="button" class="ghost" data-delete-product="${escapeHtml(product.id)}">删除</button>
                              </div>
                            </div>
                          </article>`,
                      )
                      .join("")}
                  </div>
                </section>`,
            )
            .join("")
        : `<section class="product-empty"><strong>还没有匹配的产品</strong><p>先新增产品链接，或调整上方筛选条件。</p><button type="button" class="primary" data-new-product>新增产品</button></section>`
    }
  `;

  elements.productPage.querySelectorAll("[data-product-filter]").forEach((control) => {
    const eventName = control.tagName === "INPUT" ? "input" : "change";
    control.addEventListener(eventName, () => {
      state.productFilters[control.dataset.productFilter] = control.value;
      renderProductPage();
    });
  });
  elements.productPage.querySelectorAll("[data-new-product]").forEach((button) => button.addEventListener("click", () => openEditor()));
  elements.productPage.querySelectorAll("[data-open-product]").forEach((card) => {
    card.addEventListener("dblclick", (event) => {
      if (event.target.closest("a, button")) return;
      openEditor(card.dataset.openProduct);
    });
  });
  elements.productPage.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.editProduct)));
  elements.productPage.querySelectorAll("[data-delete-product]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.data.products = allRows("products").filter((product) => product.id !== button.dataset.deleteProduct);
      await persist();
      renderProductPage();
    });
  });
}

async function handleProductPreview() {
  const productUrl = text(elements.form.elements.product_url?.value);
  const status = document.getElementById("productPreviewStatus");
  if (!safeExternalUrl(productUrl)) {
    if (status) status.textContent = "请输入有效的 http(s) 产品链接。";
    elements.form.elements.product_url?.focus();
    return;
  }
  const button = document.getElementById("productPreviewBtn");
  if (button) button.disabled = true;
  if (status) status.textContent = "正在读取公开产品信息，必要时将由 AI 补充...";
  try {
    await withActivity("AI 正在读取产品资料", "正在提取网页信息并补齐可确认字段...", async () => {
      const response = await apiFetch(API_PRODUCT_PREVIEW, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "读取产品信息失败");
      const filled = [];
      for (const key of ["name", "image_url", "description"]) {
        const input = elements.form.elements[key];
        if (input && !text(input.value) && text(payload[key])) {
          input.value = payload[key];
          filled.push(key === "name" ? "产品名称" : key === "image_url" ? "主图" : "简介");
        }
      }
      if (status) {
        const webFields = Array.isArray(payload.web_fields) ? payload.web_fields : [];
        const aiFields = Array.isArray(payload.ai_fields) ? payload.ai_fields : [];
        const labels = { name: "产品名称", image_url: "主图", description: "简介" };
        const detail = [
          webFields.length ? `网页读取：${webFields.map((key) => labels[key] || key).join("、")}` : "",
          aiFields.length ? `AI 补充：${aiFields.map((key) => labels[key] || key).join("、")}（请核对）` : "",
        ].filter(Boolean).join("；");
        if (filled.length) {
          status.textContent = `已填入${filled.join("、")}。${detail ? ` ${detail}。` : ""}${payload.warning ? ` ${payload.warning}` : ""}`;
        } else if (payload.warning) {
          status.textContent = `${detail ? `${detail}。` : ""}${payload.warning}`;
        } else {
          status.textContent = detail ? `${detail}。现有手填内容未被覆盖。` : "已读取公开页面；现有手填内容未被覆盖。";
        }
      }
    });
  } catch (error) {
    if (status) status.textContent = `${error.message || "读取失败"}，可直接手工填写产品名称和主图。`;
  } finally {
    if (button) button.disabled = false;
  }
}

function selectedLeadsForOutreach(ids = []) {
  const accepted = new Set(ids);
  return rows("leads").filter((lead) => accepted.has(lead.id));
}

function openOutreachModal(leadIds = [...state.selectedLeadIds]) {
  const leads = selectedLeadsForOutreach(leadIds);
  if (!leads.length) {
    elements.importStatus.textContent = "请先勾选至少一位待开发达人。";
    return;
  }
  state.outreach = { open: true, leadIds: leads.map((lead) => lead.id), result: null };
  renderOutreachModal();
}

function closeOutreachModal() {
  state.outreach = { open: false, leadIds: [], result: null };
  elements.outreachModal.classList.add("hidden");
  elements.outreachModal.setAttribute("aria-hidden", "true");
}

function renderOutreachModal() {
  const leads = selectedLeadsForOutreach(state.outreach.leadIds);
  if (!state.outreach.open || !leads.length) {
    closeOutreachModal();
    return;
  }
  const products = rows("products");
  const savedOptions = loadOutreachOptions();
  const validProductIds = new Set(products.map((product) => product.id));
  const selectedProductIds = new Set(savedOptions.productIds.filter((id) => validProductIds.has(id)));
  elements.outreachModal.classList.remove("hidden");
  elements.outreachModal.setAttribute("aria-hidden", "false");
  elements.outreachHint.textContent = `已选择 ${leads.length} 位达人：${leads.map((lead) => lead.name || lead.social_url).join("、")}`;
  elements.outreachForm.innerHTML = `
    <section class="outreach-section">
      <h3>选择产品 <span>至少 1 个，可多选；邮件会包含全部已选产品</span></h3>
      ${
        products.length
          ? `<div class="outreach-product-list">${products
              .map(
                (product) => `
                  <label class="outreach-product-option">
                    <input type="checkbox" name="productIds" value="${escapeHtml(product.id)}" ${selectedProductIds.has(product.id) ? "checked" : ""} />
                    <span class="outreach-product-thumb">${productImageMarkup(product)}</span>
                    <span><strong>${escapeHtml(product.name || "未命名产品")}</strong><small>${escapeHtml([product.country, product.category, product.store].filter(Boolean).join(" · ") || "未分组产品")}</small></span>
                  </label>`,
              )
              .join("")}</div>`
          : `<p class="outreach-empty">产品库为空。请先在“产品库”中新增可推广产品。</p>`
      }
    </section>
    <section class="outreach-section">
      <h3>邮件口径</h3>
      <div class="outreach-rule-grid">
        <label class="field"><span>语言</span><select name="language"><option value="English" ${savedOptions.language === "English" ? "selected" : ""}>英文</option><option value="creator" ${savedOptions.language === "creator" ? "selected" : ""}>按达人公开语言判断</option></select></label>
        <label class="field"><span>语气</span><select name="tone"><option value="自然友好" ${savedOptions.tone === "自然友好" ? "selected" : ""}>自然友好</option><option value="专业简洁" ${savedOptions.tone === "专业简洁" ? "selected" : ""}>专业简洁</option><option value="创作者同行" ${savedOptions.tone === "创作者同行" ? "selected" : ""}>创作者同行</option></select></label>
      </div>
      <fieldset class="outreach-checklist">
        <legend>合作方式</legend>
        <label><input type="checkbox" name="cooperation" value="让 AI 根据量级建议" ${savedOptions.cooperation.includes("让 AI 根据量级建议") ? "checked" : ""} /> 让 AI 根据量级建议</label>
        <label><input type="checkbox" name="cooperation" value="产品置换" ${savedOptions.cooperation.includes("产品置换") ? "checked" : ""} /> 产品置换</label>
        <label><input type="checkbox" name="cooperation" value="CPS / 佣金" ${savedOptions.cooperation.includes("CPS / 佣金") ? "checked" : ""} /> CPS / 佣金</label>
        <label><input type="checkbox" name="cooperation" value="付费合作" ${savedOptions.cooperation.includes("付费合作") ? "checked" : ""} /> 付费合作</label>
        <label><input type="checkbox" name="cooperation" value="长期合作" ${savedOptions.cooperation.includes("长期合作") ? "checked" : ""} /> 长期合作</label>
      </fieldset>
      <fieldset class="outreach-checklist">
        <legend>样品选择</legend>
        <label><input type="checkbox" name="allowSampleChoice" ${savedOptions.allowSampleChoice ? "checked" : ""} /> 允许达人按偏好从本品牌其他样品中替换选择</label>
      </fieldset>
      <fieldset class="outreach-checklist">
        <legend>内容细节</legend>
        <label><input type="checkbox" name="mentionCooperation" ${savedOptions.mentionCooperation ? "checked" : ""} /> 邮件中提及合作方式</label>
        <label><input type="checkbox" name="includeProductLinks" ${savedOptions.includeProductLinks ? "checked" : ""} /> 附上产品链接</label>
        <label><input type="checkbox" name="mentionProductBenefits" ${savedOptions.mentionProductBenefits ? "checked" : ""} /> 提及产品卖点</label>
      </fieldset>
      <label class="field field-wide"><span>补充规则</span><textarea name="customRules" placeholder="例如：本次不提及付费合作；不要推荐某类产品；必须保持简短。">${escapeHtml(savedOptions.customRules)}</textarea></label>
    </section>
    <div class="form-actions outreach-actions">
      <button type="submit" class="primary" ${products.length ? "" : "disabled"}>生成开发邮件</button>
      <button type="button" class="ghost" data-close-outreach>取消</button>
      <p class="outreach-status" id="outreachStatus"></p>
    </div>
  `;
  renderOutreachResults();
  elements.outreachForm.querySelector("[data-close-outreach]")?.addEventListener("click", closeOutreachModal);
  const rememberOptions = () => saveOutreachOptions(outreachOptionsFromForm(elements.outreachForm));
  elements.outreachForm.addEventListener("change", rememberOptions);
  elements.outreachForm.addEventListener("input", rememberOptions);
}

function renderOutreachResults() {
  const output = state.outreach.result;
  if (!output?.drafts?.length) {
    elements.outreachResult.classList.add("hidden");
    elements.outreachResult.innerHTML = "";
    return;
  }
  const leadMap = new Map(selectedLeadsForOutreach(state.outreach.leadIds).map((lead) => [lead.id, lead]));
  elements.outreachResult.innerHTML = `
    ${output.warnings?.length ? `<p class="outreach-warning">${escapeHtml(output.warnings.join("；"))}</p>` : ""}
    <h3>邮件草稿</h3>
    ${output.drafts
      .map((draft, index) => {
        const lead = leadMap.get(draft.lead_id) || {};
        return `
          <article class="outreach-draft" data-outreach-draft="${index}">
            <header><div><strong>${escapeHtml(lead.name || lead.social_url || "达人")}</strong><span>${escapeHtml(draft.recommended_cooperation || "请人工确认合作方式")}${draft.reason ? ` · ${escapeHtml(draft.reason)}` : ""}</span></div>${lead.email ? `<a class="ghost mail-link" data-send-outreach="${index}" href="#">打开邮件并复制排版正文</a>` : `<span class="outreach-no-email">暂无可验证邮箱</span>`}</header>
            <label>主题<input data-outreach-subject="${index}" value="${escapeHtml(draft.subject)}" /></label>
            <label>正文<textarea data-outreach-body="${index}">${escapeHtml(draft.body)}</textarea></label>
            <div class="outreach-draft-actions">
              <button type="button" class="ghost" data-copy-outreach="${index}">复制主题和排版正文</button>
              <p class="outreach-draft-note" data-outreach-note="${index}">粘贴到支持富文本的邮件编辑器时，会保留段落，并将产品链接显示为简洁的可点击文字。</p>
            </div>
          </article>`;
      })
      .join("")}
  `;
  elements.outreachResult.classList.remove("hidden");
}

async function submitOutreach(event) {
  event.preventDefault();
  const formData = new FormData(elements.outreachForm);
  saveOutreachOptions(outreachOptionsFromForm(elements.outreachForm));
  const productIds = formData.getAll("productIds").map(text).filter(Boolean);
  const status = document.getElementById("outreachStatus");
  if (!productIds.length) {
    if (status) status.textContent = "请至少选择一个产品。";
    return;
  }
  const selectedProducts = rows("products").filter((product) => productIds.includes(product.id));
  if (!selectedProducts.length) {
    if (status) status.textContent = "所选产品已不存在，请重新选择。";
    return;
  }
  const button = elements.outreachForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  if (status) status.textContent = "AI 正在根据达人资料和产品资料分别构思邮件...";
  try {
    await withActivity(
      "AI 正在构思开发邮件",
      `正在为 ${state.outreach.leadIds.length} 位达人分别生成邮件草稿...`,
      async () => {
        const response = await apiFetch(API_OUTREACH_GENERATE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leads: selectedLeadsForOutreach(state.outreach.leadIds),
            products: selectedProducts,
            rules: {
              language: text(formData.get("language")),
              tone: text(formData.get("tone")),
              cooperation: formData.getAll("cooperation").map(text).filter(Boolean),
              mentionCooperation: formData.get("mentionCooperation") === "on",
              includeProductLinks: formData.get("includeProductLinks") === "on",
              mentionProductBenefits: formData.get("mentionProductBenefits") === "on",
              allowSampleChoice: formData.get("allowSampleChoice") === "on",
              customRules: text(formData.get("customRules")),
            },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) throw new Error(payload.error || "邮件生成失败");
        state.outreach.result = payload;
        if (status) status.textContent = `已生成 ${payload.drafts?.length || 0} 封邮件草稿。`;
        renderOutreachResults();
      },
    );
  } catch (error) {
    if (status) status.textContent = error.message || "邮件生成失败，请检查设置页中的开发邮件 AI 参数。";
  } finally {
    if (button) button.disabled = false;
  }
}

function normalizeOutreachBody(value) {
  return text(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function outreachLinkLabel(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "");
    if (/(amazon\.[a-z.]+|amzn\.to)$/i.test(hostname)) return "View product";
    return `Open ${hostname}`;
  } catch {
    return "Open link";
  }
}

function linkifyOutreachText(value) {
  const escaped = escapeHtml(value);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const trailing = url.match(/[),.!?;:]+$/)?.[0] || "";
    const href = url.slice(0, url.length - trailing.length);
    return `<a href="${href}" style="color:#1565c0;text-decoration:underline;">${outreachLinkLabel(href)}</a>${trailing}`;
  });
}

function buildOutreachHtml(body) {
  const paragraphs = normalizeOutreachBody(body).split(/\n\s*\n/).filter(Boolean);
  const paragraphHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6;">${linkifyOutreachText(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;color:#111827;">${paragraphHtml || "<p></p>"}</div>`;
}

async function copyOutreachDraft(index, includeSubject = true) {
  const subject = text(elements.outreachResult.querySelector(`[data-outreach-subject="${index}"]`)?.value);
  const body = normalizeOutreachBody(elements.outreachResult.querySelector(`[data-outreach-body="${index}"]`)?.value);
  const plainText = includeSubject ? `Subject: ${subject}\n\n${body}` : body;
  const html = buildOutreachHtml(body);
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(plainText);
    }
    return true;
  } catch {
    window.prompt("复制以下邮件内容：", plainText);
    return false;
  }
}

function setOutreachDraftNote(index, message) {
  const note = elements.outreachResult.querySelector(`[data-outreach-note="${index}"]`);
  if (note) note.textContent = message;
}

async function launchOutreachMail(index) {
  const draft = state.outreach.result?.drafts?.[Number(index)];
  const lead = selectedLeadsForOutreach(state.outreach.leadIds).find((item) => item.id === draft?.lead_id);
  if (!lead?.email) return;
  const subject = text(elements.outreachResult.querySelector(`[data-outreach-subject="${index}"]`)?.value || draft.subject);
  const copiedRichText = await copyOutreachDraft(index, false);
  await persistLeadContactStatus(lead.id, "AI 开发邮件");
  window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}`;
  setOutreachDraftNote(
    index,
    copiedRichText
      ? "邮件客户端已打开。带短链接的排版正文已复制，点正文后按 Ctrl+V 即可粘贴可点击的产品名称链接。"
      : "邮件客户端已打开。请使用上方“复制主题和排版正文”后粘贴，可得到产品名称形式的可点击链接。",
  );
}

function renderEntityPage() {
  setEntityUiVisible(true);
  elements.newRecordBtn.textContent = `新增${config().title.replace("库", "")}`;
  elements.outreachBtn.classList.toggle("hidden", state.activeTab !== "leads");
  if (state.activeTab === "leads") elements.outreachBtn.textContent = `AI 开发邮件${state.selectedLeadIds.size ? `（${state.selectedLeadIds.size}）` : ""}`;
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
  renderBrandWorkspace();
  renderTimeZoneBar();
  renderTabs();
  if (state.activeTab === SETTINGS_TAB.key) {
    elements.outreachBtn.classList.add("hidden");
    resetEditorState();
    renderEditor();
    renderSettingsPage();
    return;
  }
  if (state.activeTab === MATCHING_TAB.key) {
    elements.outreachBtn.classList.add("hidden");
    resetEditorState();
    renderEditor();
    renderMatchingPage();
    return;
  }
  if (state.activeTab === "products") {
    elements.outreachBtn.classList.add("hidden");
    resetEditorState();
    renderEditor();
    renderProductPage();
    return;
  }
  if (state.activeTab === "followups") {
    elements.outreachBtn.classList.add("hidden");
    renderFollowUpPage();
    renderEditor();
    return;
  }
  renderEntityPage();
}

function fieldValue(field, rawValue) {
  if (field.type === "number") return toNumber(rawValue);
  if (field.key === "country") return normalizeCountry(rawValue);
  return text(rawValue);
}

function resolveCooperationLinks(record, creators = rows("creators"), resources = rows("resources"), data = state.data) {
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
  return applyRecordBrand(record, data, creator || resource || null);
}

function normalizeFollowUp(record, creators = rows("creators"), cooperations = rows("cooperations"), data = state.data) {
  const creator = creators.find((row) => row.id === text(record.creator_id)) || creators.find((row) => text(row.name) === text(record.creator_name));
  const cooperation = cooperations.find((row) => row.id === text(record.cooperation_id));
  const now = new Date().toISOString();
  const normalized = {
    ...record,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    stage: FOLLOW_UP_STAGES.includes(text(record.stage)) ? text(record.stage) : "初步沟通",
    priority: ["高", "中", "低"].includes(text(record.priority)) ? text(record.priority) : "中",
    cooperation_mode: ["待确认", "置换", "付费", "CPS", "混合"].includes(text(record.cooperation_mode)) ? text(record.cooperation_mode) : "待确认",
    shipping_status: ["未寄样", "待揽收", "运输中", "已送达", "异常"].includes(text(record.shipping_status)) ? text(record.shipping_status) : "未寄样",
  };
  if (creator) {
    normalized.creator_id = creator.id;
    normalized.creator_name = creator.name;
    if (!text(normalized.brand)) normalized.brand = text(creator.brand);
    if (!text(normalized.brand_id)) normalized.brand_id = text(creator.brand_id);
  } else {
    normalized.creator_id = text(normalized.creator_id);
    normalized.creator_name = text(normalized.creator_name);
  }
  if (cooperation) {
    normalized.cooperation_id = cooperation.id;
    if (!text(normalized.brand)) normalized.brand = text(cooperation.brand);
    if (!text(normalized.brand_id)) normalized.brand_id = text(cooperation.brand_id);
    if (!text(normalized.product_id)) normalized.product_id = text(cooperation.product_id);
    if (normalized.cooperation_mode === "待确认" && text(cooperation.model)) normalized.cooperation_mode = text(cooperation.model);
    if (!text(normalized.tracking_no)) normalized.tracking_no = text(cooperation.tracking_no);
    if (normalized.shipping_status === "未寄样" && text(cooperation.shipping_status)) normalized.shipping_status = text(cooperation.shipping_status);
  } else {
    normalized.cooperation_id = text(normalized.cooperation_id);
  }
  return applyRecordBrand(normalized, data, creator || cooperation || null);
}

function resolveFollowUpLinks(record) {
  return normalizeFollowUp(record, rows("creators"), rows("cooperations"));
}

function syncFollowUpReferences() {
  if (state.activeTab !== "followups") return;
  const creator = rows("creators").find((row) => row.id === text(elements.form.elements.creator_id?.value));
  const cooperation = rows("cooperations").find((row) => row.id === text(elements.form.elements.cooperation_id?.value));
  if (creator && !text(elements.form.elements.brand?.value)) elements.form.elements.brand.value = creator.brand || "";
  if (cooperation) {
    if (creator && cooperation.creator_id && cooperation.creator_id !== creator.id) {
      elements.editorStatus.textContent = "提示：所选合作记录关联的是另一位达人，请确认关联关系。";
    }
    if (!text(elements.form.elements.product_id?.value) && elements.form.elements.product_id) elements.form.elements.product_id.value = cooperation.product_id || "";
    if (elements.form.elements.cooperation_mode?.value === "待确认" && cooperation.model) elements.form.elements.cooperation_mode.value = cooperation.model;
    if (!text(elements.form.elements.tracking_no?.value) && cooperation.tracking_no) elements.form.elements.tracking_no.value = cooperation.tracking_no;
    if (elements.form.elements.shipping_status?.value === "未寄样" && cooperation.shipping_status) elements.form.elements.shipping_status.value = cooperation.shipping_status;
  }
}

function syncCooperationName(kind) {
  if (state.activeTab !== "cooperations") return;
  const idField = `${kind}_id`;
  const nameField = kind === "product" ? "product" : `${kind}_name`;
  const sourceType = kind === "creator" ? "creators" : kind === "resource" ? "resources" : "products";
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
  if (state.activeTab === "followups") resolveFollowUpLinks(record);
  if (BRANDED_TYPES.has(state.activeTab)) applyRecordBrand(record);
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
  if (state.editorSaving) return false;
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
  if (BRANDED_TYPES.has(state.activeTab) && !text(record.brand_id)) {
    const message = "请先选择或填写所属品牌，再保存资料。";
    elements.editorStatus.textContent = message;
    elements.form.elements.brand?.focus();
    if (showError) window.alert(message);
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

  const list = allRows();
  const previous = state.editingId ? list.find((row) => row.id === state.editingId) : null;
  const index = list.findIndex((row) => row.id === record.id);
  if (index >= 0) list[index] = record;
  else list.unshift(record);
  if (state.activeTab === "followups") {
    state.data.followUps = list;
    if (previous && text(previous.stage) !== text(record.stage)) {
      state.data.followUpEvents.unshift({
        id: uid("EV"),
        follow_up_id: record.id,
        brand_id: record.brand_id,
        brand: record.brand,
        type: "stage",
        occurred_at: new Date().toISOString(),
        direction: "internal",
        subject: `阶段更新为：${record.stage}`,
        excerpt: `合作跟进阶段从“${previous.stage || "未填写"}”更新为“${record.stage}”。`,
        source: "工作台",
        createdAt: new Date().toISOString(),
      });
    }
  }

  state.editorSaving = true;
  const title = state.editingId ? "正在保存资料" : "正在新增资料";
  const message = close ? "正在同步资料并更新工作台..." : "正在自动保存本次更改...";
  try {
    await withActivity(title, message, persist);
    if (close) {
      resetEditorState();
      render();
    } else {
      state.editingId = record.id;
      state.editorDraft = clone(record);
      state.editorBaseline = editableSnapshot(record);
      elements.editorStatus.textContent = "已自动保存。";
    }
  } catch (error) {
    const message = error.message || "保存失败，请稍后重试。";
    elements.editorStatus.textContent = message;
    if (showError) window.alert(message);
    return false;
  } finally {
    state.editorSaving = false;
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
  for (const key of ["brand", "name", "handle", "social_url", "email", "email_source", "country", "platform", "niche", "followers", "avg_views", "engagement", "priority"]) {
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
    if (type === "followups") resolveFollowUpLinks(record);
    if (BRANDED_TYPES.has(type)) applyRecordBrand(record);
    const requiredOk = entityConfig[type].fields.filter((field) => field.required).every((field) => text(record[field.key]));
    const hasAny = entityConfig[type].fields.some((field) => text(record[field.key]));
    const branded = !BRANDED_TYPES.has(type) || Boolean(text(record.brand_id));
    if (requiredOk && hasAny && branded) {
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
  const brandPrefix = BRANDED_TYPES.has(type) ? `brand::${text(record.brand_id) || brandKey(record.brand)}::` : "";
  if (type === "creators" || type === "leads") {
    const socialUrl = normalizeSocialIdentity(record.social_url);
    const email = normalizeHeader(record.email);
    if (socialUrl) return `${brandPrefix}social::${socialUrl}`;
    if (email) return `${brandPrefix}email::${email}`;
    return `${brandPrefix}${normalizeHeader(record.name)}::${normalizeHeader(record.platform)}`;
  }
  if (type === "resources") return `${brandPrefix}${normalizeHeader(record.name)}::${normalizeHeader(record.type)}`;
  return `${brandPrefix}${normalizeHeader(record.creator_name)}::${normalizeHeader(record.product)}::${normalizeHeader(record.post_date)}`;
}

function snapshotBusinessState() {
  return {
    meta: clone(state.data.meta || { version: 1 }),
    brands: clone(state.data.brands || []),
    creators: clone(state.data.creators || []),
    resources: clone(state.data.resources || []),
    leads: clone(state.data.leads || []),
    products: clone(state.data.products || []),
    cooperations: clone(state.data.cooperations || []),
    matches: clone(state.data.matches || []),
    followUps: clone(state.data.followUps || []),
    followUpEvents: clone(state.data.followUpEvents || []),
    mailInbox: clone(state.data.mailInbox || []),
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
  state.data.brands = Array.isArray(snapshot?.brands) ? snapshot.brands : state.data.brands;
  state.data.creators = Array.isArray(snapshot?.creators) ? snapshot.creators : [];
  state.data.resources = Array.isArray(snapshot?.resources) ? snapshot.resources : [];
  state.data.leads = Array.isArray(snapshot?.leads) ? snapshot.leads : [];
  state.data.products = Array.isArray(snapshot?.products) ? snapshot.products : [];
  state.data.cooperations = Array.isArray(snapshot?.cooperations) ? snapshot.cooperations : [];
  state.data.matches = Array.isArray(snapshot?.matches) ? snapshot.matches : state.data.matches;
  state.data.followUps = Array.isArray(snapshot?.followUps) ? snapshot.followUps : state.data.followUps;
  state.data.followUpEvents = Array.isArray(snapshot?.followUpEvents) ? snapshot.followUpEvents : state.data.followUpEvents;
  state.data.mailInbox = Array.isArray(snapshot?.mailInbox) ? snapshot.mailInbox : state.data.mailInbox;
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
  const list = allRows();
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
  const list = allRows(draft.type);
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
    if (BRANDED_TYPES.has(draft.type)) applyRecordBrand(record);
    if (BRANDED_TYPES.has(draft.type) && !text(record.brand_id)) {
      skipped += 1;
      continue;
    }
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
    await loadMailSettings();
    renderAiSettings();
    renderBrandManager();
    renderMailSettings();
  });
  elements.brandForm.addEventListener("submit", saveBrand);
  elements.brandManageBtn.addEventListener("click", () => openBrandManager());
  elements.brandNewBtn.addEventListener("click", () => openBrandManager({ create: true }));
  elements.brandCancelEditBtn.addEventListener("click", () => {
    state.brandEditingId = null;
    setBrandSettingsStatus("");
    renderBrandManager();
  });
  elements.brandList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand-action]");
    if (!button || button.disabled) return;
    const brandId = button.dataset.brandId;
    const action = button.dataset.brandAction;
    if (action === "switch") {
      state.activeBrandId = brandId;
      state.selectedLeadIds.clear();
      state.filters = createFilters(state.activeTab);
      state.filterMenu = null;
      state.productFilters = { query: "", brand: "", country: "", category: "", store: "" };
      state.followUpBoardFilter = { query: "", stage: "", priority: "", overdueOnly: false };
      resetEditorState();
      closeCreatorDrawer();
      closeFollowUpDetail();
      render();
      return;
    }
    if (action === "edit") {
      state.brandEditingId = brandId;
      setBrandSettingsStatus("");
      renderBrandManager();
      elements.brandForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "delete") void deleteBrand(brandId);
  });
  elements.mailSettingsForm.addEventListener("submit", saveMailSettings);
  elements.mailSaveContentPolicyBtn.addEventListener("click", () => void saveMailContentPolicy());
  elements.mailCacheBodies.addEventListener("change", () => {
    elements.mailAllowAiContext.disabled = !elements.mailCacheBodies.checked;
    if (!elements.mailCacheBodies.checked) elements.mailAllowAiContext.checked = false;
  });
  elements.mailTestBtn.addEventListener("click", testMailSettings);
  elements.mailSmtpTestBtn.addEventListener("click", testSmtpSettings);
  elements.mailSyncBtn.addEventListener("click", syncMailbox);
  elements.mailNewAccountBtn.addEventListener("click", () => {
    state.mailAccountEditingId = null;
    renderMailSettings();
  });
  elements.mailCancelEditBtn.addEventListener("click", () => {
    state.mailAccountEditingId = null;
    renderMailSettings();
  });
  elements.mailAccountList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mail-account-action]");
    if (!button) return;
    const accountId = button.dataset.mailAccountId;
    const action = button.dataset.mailAccountAction;
    if (action === "edit") {
      state.mailAccountEditingId = accountId;
      renderMailSettings();
      elements.mailAccountEditor.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "test") {
      void testMailSettings(accountId);
      return;
    }
    if (action === "smtp") {
      void testSmtpSettings(accountId);
      return;
    }
    if (action === "sync") {
      void syncMailbox(accountId);
      return;
    }
    if (action === "delete") void deleteMailAccount(accountId);
  });
  elements.brandWorkspaceSelect.addEventListener("change", () => {
    state.activeBrandId = elements.brandWorkspaceSelect.value;
    state.selectedLeadIds.clear();
    state.filters = createFilters(state.activeTab);
    state.filterMenu = null;
    state.productFilters = { query: "", brand: "", country: "", category: "", store: "" };
    state.followUpBoardFilter = { query: "", stage: "", priority: "", overdueOnly: false };
    resetEditorState();
    closeCreatorDrawer();
    closeFollowUpDetail();
    render();
  });
  elements.saveTimezonesBtn.addEventListener("click", saveTimeZones);
  const bindKeySource = (source, keyInput) => {
    source.addEventListener("change", () => {
      const useEnvironment = source.value === "environment";
      keyInput.disabled = useEnvironment;
      keyInput.placeholder = useEnvironment ? "由环境变量读取" : "已保存时可留空不改";
    });
  };
  bindKeySource(elements.standardAiKeySource, elements.standardAiApiKey);
  bindKeySource(elements.advancedAiKeySource, elements.advancedAiApiKey);
  bindKeySource(elements.specialAiKeySource, elements.specialAiApiKey);
  elements.resetFormBtn.addEventListener("click", resetForm);
  elements.newRecordBtn.addEventListener("click", () => openEditor());
  elements.outreachBtn.addEventListener("click", () => openOutreachModal());
  elements.editorBackdrop.addEventListener("click", handleEditorBackdropClick);
  elements.closeEditorBtn.addEventListener("click", handleEditorCloseClick);
  document.addEventListener("keydown", handleEditorEscape);
  elements.outreachBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.outreachBackdrop) closeOutreachModal();
  });
  elements.closeOutreachBtn.addEventListener("click", closeOutreachModal);
  elements.outreachForm.addEventListener("submit", submitOutreach);
  elements.mailImportInput.addEventListener("change", async (event) => {
    const files = [...(event.target.files || [])];
    await previewMailImport(files);
  });
  elements.mailImportConfirmBtn.addEventListener("click", confirmMailImport);
  elements.closeMailImportBtn.addEventListener("click", closeMailImport);
  document.getElementById("mailImportCancelBtn")?.addEventListener("click", closeMailImport);
  elements.mailImportBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.mailImportBackdrop) closeMailImport();
  });
  elements.closeFollowUpDetailBtn.addEventListener("click", closeFollowUpDetail);
  elements.followUpDetailBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.followUpDetailBackdrop) closeFollowUpDetail();
  });
  elements.outreachResult.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-outreach]");
    if (copyButton) {
      void copyOutreachDraft(copyButton.dataset.copyOutreach).then((copiedRichText) => {
        setOutreachDraftNote(
          copyButton.dataset.copyOutreach,
          copiedRichText ? "已复制主题和排版正文。粘贴到支持富文本的邮件编辑器时会保留段落和链接。" : "请从弹出的文本框复制内容后粘贴到邮件编辑器。",
        );
      });
      return;
    }
    const mailLink = event.target.closest("[data-send-outreach]");
    if (mailLink) {
      event.preventDefault();
      launchOutreachMail(mailLink.dataset.sendOutreach);
    }
  });
  elements.resetMatchBtn.addEventListener("click", () => {
    state.matchingEditingId = null;
    elements.matchingStatus.textContent = "";
    renderMatchingPage();
  });
  elements.refreshBtn.addEventListener("click", async () => {
    await loadState();
    await loadAiSettings();
    await loadMailSettings();
    render();
  });
  elements.globalSearchBtn.addEventListener("click", openGlobalSearch);
  elements.closeGlobalSearchBtn.addEventListener("click", closeGlobalSearch);
  elements.globalSearchBackdrop.addEventListener("click", closeGlobalSearch);
  elements.globalSearchInput.addEventListener("input", () => {
    state.globalSearch.query = elements.globalSearchInput.value;
    renderGlobalSearch();
  });
  elements.globalSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = elements.globalSearchResults.querySelector("[data-global-result-id]");
    if (!first) return;
    event.preventDefault();
    handleGlobalSearchResult(first);
  });
  elements.globalSearchResults.addEventListener("click", (event) => {
    const result = event.target.closest("[data-global-result-id]");
    if (result) handleGlobalSearchResult(result);
  });
  elements.creatorDrawerBackdrop.addEventListener("click", closeCreatorDrawer);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (state.globalSearch.open) closeGlobalSearch();
      else openGlobalSearch();
      return;
    }
    if (event.key !== "Escape") return;
    if (state.globalSearch.open) {
      event.preventDefault();
      closeGlobalSearch();
      return;
    }
    if (state.followUpDetail.open) {
      event.preventDefault();
      closeFollowUpDetail();
      return;
    }
    if (state.creatorDrawer.open) {
      event.preventDefault();
      closeCreatorDrawer();
      return;
    }
    if (state.mailImport.open) {
      event.preventDefault();
      closeMailImport();
    }
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
  await loadMailSettings();
  startTimeZoneTicker();
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
    elements.accessStatus.textContent = "正在验证并加载工作台...";
    sessionStorage.setItem(STORAGE_ACCESS_PASSWORD, password);
    try {
      await withActivity("正在进入工作台", "正在验证访问权限并载入资料...", async () => {
        const response = await apiFetch(API_STATE);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "访问密码不正确。");
        await init();
      });
      hideAccessGate();
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
    await withActivity("正在恢复工作台", "正在载入资料、设置与全球时间...", init);
    hideAccessGate();
    return;
  }
  await init();
}

start().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><h1>启动失败</h1><p>${escapeHtml(error.message)}</p></main>`;
});
