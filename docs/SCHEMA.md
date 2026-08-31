# 数据结构说明

## creators

达人库主表，用于记录达人画像与合作状态。

- `id`
- `brand`（所属品牌，用于区分多品牌达人资料）
- `name`
- `social_url`
- `email`
- `email_source`（邮箱所在公开页面的链接；AI 仅在公开证据可验证时写入）
- `last_outreach_at`（最近首联 / 复联发件时间；用于在 30 天有效窗口内识别达人回信并自动进入初步沟通）
- `country`
- `language`
- `platform`
- `niche`
- `followers`
- `avg_views`
- `engagement`
- `audience`
- `competitor`
- `exchange`
- `cps`
- `price`
- `status`
- `longterm`
- `content_types`
- `ad_auth`
- `tags`
- `notes`
- `createdAt`
- `updatedAt`

## resources

资源库主表，用于记录 Deal 站、社群、联盟、媒体等资源。

- `id`
- `brand`（所属品牌，用于区分多品牌资源资料）
- `name`
- `type`
- `country`
- `categories`
- `users`
- `fee`
- `fee_amount`
- `exclusivity`
- `coupon`
- `cycle`
- `historical_clicks`
- `historical_orders`
- `suitable_new`
- `suitable_clearance`
- `grade`
- `contact`
- `notes`
- `createdAt`
- `updatedAt`

## leads

待开发达人表，用于先收集各平台新发现的达人，再确认是否转入正式达人库。

- `id`
- `brand`（所属品牌）
- `social_url`（达人社媒主页链接）
- `name`
- `platform`
- `country`
- `niche`
- `followers`
- `avg_views`（近 30 条平均播放）
- `engagement`
- `email`（仅保留可验证公开邮箱）
- `email_source`（邮箱所在公开页面链接）
- `last_outreach_at`（最近首联 / 复联发件时间；可人工补录历史首发邮件）
- `status`（待开发、已联系、已转达人库、不适合）
- `notes`
- `createdAt`
- `updatedAt`

社媒地址和邮箱会与正式达人库双向去重。确认可合作时，可从待开发页直接转入达人库，原线索会保留并标记为“已转达人库”。

## products

产品库主表，用于维护可供达人开发邮件选择的产品。产品可按品牌、国家/地区、类目和店铺归档；填写产品链接后可尝试读取公开页面的标题、主图和简介，人工填写内容不会被自动覆盖。

- `id`
- `brand`
- `country`
- `category`
- `store`
- `name`
- `product_url`
- `image_url`
- `description`
- `tags`
- `notes`
- `createdAt`
- `updatedAt`

待开发达人页的“AI 开发邮件”只能从本表选取产品。邮件将根据本次选择的产品、语气、是否提及合作方式/链接/卖点和补充规则动态生成；AI 不得虚构产品参数、达人内容细节、报价或邮箱来源。

## cooperations

合作记录表，用于记录单次合作结果和复盘信息。

- `id`
- `creator_id`
- `resource_id`
- `match_id`
- `creator_name`
- `resource_name`
- `product`
- `model`
- `budget`
- `post_date`
- `link`
- `clicks`
- `orders`
- `result`
- `notes`
- `createdAt`
- `updatedAt`

`creator_id` 与 `resource_id` 是稳定关联字段；名称字段保留用于展示和兼容历史表格。保存时会尽量按已选 ID 或完全相同的名称自动关联。

## followUps

合作跟进主表，用于记录达人从初步沟通到发布、数据回收或终止的阶段进度。每条记录对应一个达人和一项具体合作，可选关联历史合作记录与产品。

- `id`
- `creator_id`（关联 `creators.id`，稳定关联）
- `lead_id`（关联 `leads.id`；达人仍在待开发阶段时使用，收到回信转入达人库后保留历史关联）
- `cooperation_id`（关联 `cooperations.id`，可选）
- `brand`
- `product_id`（关联 `products.id`，可选）
- `stage`（已联系待回复、初步沟通、已回复、谈合作方式 / 报价、条款确认、待寄样、运输中、已签收、待发布、已发布、数据回收、已结案、暂停跟进、未谈妥）
- `priority`（高、中、低）
- `cooperation_mode`（待确认、置换、付费、CPS、混合）
- `next_action`
- `next_follow_up_at`
- `shipping_status`（未寄样、待揽收、运输中、已送达、异常）
- `tracking_no`
- `publish_due_at`
- `publish_url`
- `last_email_at`
- `has_unread_reply`（布尔值；`true` 表示同步到达人新回信，打开跟进详情或人工处理后可清除）
- `notes`
- `createdAt`
- `updatedAt`

看板根据 `stage` 将记录分为初步沟通、合作协商、寄样、物流、待发布、发布与回收六列；已结案、暂停跟进和未谈妥会进入已结束 / 暂停区域。`creator_id`、`cooperation_id` 和 `product_id` 用于稳定追溯，展示名称仅作为冗余快照和兼容旧数据使用。

## followUpEvents

合作跟进事件表，用于保存从 Foxmail 导出的 `.eml` 或官邮 IMAP 同步的邮件摘要，形成单条跟进的沟通时间线。

- `id`
- `follow_up_id`（关联 `followUps.id`）
- `type`（当前为 `email`）
- `occurred_at`
- `direction`（`inbound` 达人来信，`outbound` 我方发信）
- `subject`
- `sender`
- `recipients`
- `excerpt`
- `brand_id`（所属品牌工作区）
- `mailbox_account_id`（来源官方邮箱账户）
- `body`（按缓存策略保存的纯文本正文；默认为空）
- `body_cached_at`
- `body_retention_until`
- `body_truncated`
- `message_id`
- `in_reply_to`
- `references`（线程引用的 Message-ID 列表）
- `fingerprint`（无 Message-ID 时用于去重）
- `source`（例如 `Foxmail .eml` 或 `IMAP · 官邮 IMAP`）
- `filename`
- `mailbox`（IMAP 文件夹名称）
- `server_key`（邮箱服务器、文件夹和 UID 组成的去重键）
- `imap_uid`
- `createdAt`

邮件导入会保存标题、时间、收发方向、地址、正文摘要，并按邮箱正文缓存策略保存完整纯文本正文；不保存原始 `.eml` 文件、HTML 原文或附件。相同 `Message-ID`、相同指纹或同一 IMAP 服务器 UID 的邮件会跳过，避免重复导入；摘要再次同步到完整正文时会升级原记录，旧的截断正文也允许被后续完整正文替换，不新增重复事件。完整正文仍受保留期限、单封长度和 AI 总上下文预算限制。

## mailInbox

待人工归档邮件表。官邮 IMAP 同步发现邮件后，只有在能唯一对应“一个达人 + 一条活跃合作跟进”时才会直接写入 `followUpEvents`。其余邮件保留在本表，供人工确认，防止错写到其他达人的合作历史。

- `id`
- `type`（当前为 `email`）
- `occurred_at`
- `direction`
- `subject`
- `sender`
- `recipients`
- `excerpt`
- `brand_id`（已确认归属时写入）
- `mailbox_account_id`
- `body`
- `body_cached_at`
- `body_retention_until`
- `body_truncated`
- `message_id`
- `in_reply_to`
- `references`
- `fingerprint`
- `source`
- `mailbox`
- `server_key`
- `imap_uid`
- `status`（`needs_followup`、`ambiguous_creator`、`unmatched`）
- `matched_creator_id`
- `matched_creator_name`
- `candidate_creator_ids`
- `candidate_lead_ids`
- `candidate_brand_ids`
- `candidate_follow_up_ids`
- `createdAt`
- `updatedAt`

当 `status` 为 `needs_followup` 且没有活跃跟进时，可新建一条默认合作跟进后归档；当同一达人有多条活跃跟进时，必须先选择具体跟进。无法自动确认达人或匹配多个达人时，不提供自动归档，但前端可从当前品牌达人库人工绑定已有达人后继续处理；品牌不一致时始终阻止归档。人工确认或 Foxmail 导入保存失败时，页面内存状态会恢复到操作前快照。

邮件同步会先匹配现有“已联系待回复”轨迹；若历史首发邮件未同步为轨迹，但能唯一匹配当前品牌中的达人或待开发达人，并且该资料的 `last_outreach_at` 距来信不超过 30 天，则会自动建立“初步沟通”合作跟进。超过 30 天、来信早于发件时间、同邮箱跨品牌或匹配多人时，邮件仍停留在待人工归档区。30 天窗口只用于首次自动建入合作跟进；已经明确关联到某条合作跟进的邮件线程，后续来信会持续归档到原跟进，不会因合作周期较长而中断。

## matches

本周资源匹配任务表，用于把一次具体投放目标、推荐清单和执行结果保存为可追溯任务。

- `id`
- `title`
- `country`
- `categories`
- `goal`
- `budget`
- `exclusivity`
- `max_cycle_days`
- `status`
- `selected_resource_ids`
- `result`
- `notes`
- `createdAt`
- `updatedAt`

## importHistory

导入历史表，用于记录每次批量导入的影响范围，并保存导入前快照，支持回滚。

- `id`
- `type`
- `filename`
- `totalRows`
- `createdCount`
- `updatedCount`
- `skippedCount`
- `beforeCounts`
- `snapshot`
- `createdAt`
- `updatedAt`
