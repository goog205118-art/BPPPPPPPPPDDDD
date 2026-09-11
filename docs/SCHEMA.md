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
- `source_mail_inbox_id`（由陌生合作来信人工创建时，关联来源 `mailInbox.id`）
- `source_mail_message_id`、`source_mail_sender`、`source_mail_occurred_at`、`source_mail_subject`（来源邮件身份与发生时间）
- `source_mail_fingerprint`、`source_mail_server_key`、`source_mail_imap_uid`（用于回溯来源邮件和避免重复处理）
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

历史合作跟进兼容表。现有页面仍可读写本表；`cases` 上线后，一条跟进会稳定映射到一个 Case，后续的邮件、待办、分诊和审计会以 Case 为中心聚合。

- `id`
- `case_id`（关联 `cases.id`；旧数据首次读取时按 `CASE-FU-{follow_up_id}` 生成兼容 Case）
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

## cases

合作 Case 是一项具体合作的正式聚合实体：同一达人可在不同品牌、不同产品组合或不同合作轮次下拥有多个 Case。`followUps` 仍是旧页面兼容层，不能再作为跨邮件、待办和审计的唯一身份。

- `id`
- `brand_id`、`brand`
- `creator_id` 或 `lead_id`（至少一个；待开发达人收到有效回信后可保留 `lead_id` 并关联正式达人）
- `cooperation_id`
- `product_ids`（产品 ID 数组）
- `stage`
- `priority`
- `cooperation_mode`
- `budget`、`quote_amount`
- `shipping_address`、`shipping_status`、`tracking_no`
- `publish_due_at`、`publish_url`
- `next_action`、`next_action_at`
- `last_outreach_at`
- `notes`
- `version`（记录级乐观锁版本；后续实体写入接口必须校验）
- `last_stage_changed_at`（最近一次人工确认阶段变更时间）
- `last_stage_changed_by`（最近一次变更操作者；当前为人工操作、人工编辑或人工确认 AI 建议）
- `last_stage_change_reason`（最近一次人工阶段变更原因；不能为空）
- `last_stage_change_source`（最近一次变更来源，例如 `manual_stage_change`、`editor_manual_change`、`ai_suggestion_confirmed`）
- `last_stage_change_event_id`（对应 `followUpEvents.id`，用于快速跳转到完整审计记录）
- `createdAt`、`updatedAt`
- `migration_source_follow_up_id`（兼容迁移创建的 Case 所对应的旧 `followUps.id`；人工创建的 Case 为空）
- `migration_version`（兼容迁移版本号；当前为 `1`）
- `migration_created_at`（兼容迁移创建时间）

阶段契约为：`待开发 -> 已联系待回复 -> 初步沟通 -> 合作协商 -> 待寄样 -> 已寄样/运输中/已签收 -> 待发布 -> 已发布 -> 待数据回收 -> 合作完成 -> 已结案`。旧阶段名称在兼容期内继续允许读取；报价、条款、寄样、签收、发布和结案仍必须人工确认，不允许 AI 自动跨阶段。

## actionTasks

行动任务是独立于页面筛选和看板显示保存的推进事项，必须稳定关联到一个同品牌 Case。当前由每次常规业务状态保存、邮箱同步保存和发信保存时的规则重算生成；不依赖定时任务，也不会自动发送邮件或自动推进合作阶段。

- `id`
- `brand_id`、`brand`
- `case_id`
- `source`、`source_id`、`dedupe_key`
- `type`、`title`、`description`
- `owner_id`、`owner_name`
- `priority`、`due_at`
- `status`（`待处理`、`已完成`、`已失效`、`已跳过`、`待修复`）
- `completion_evidence`、`completed_at`、`defer_reason`
- `generated`、`validation_error`、`version`
- `createdAt`、`updatedAt`

当前自动规则覆盖：已归档新回信待处理、首次外联后三天未回复、待补寄样地址、地址齐备但待安排寄样、待确认报价与合作方式、待确认内容发布、待回收合作数据，以及已唯一匹配到 Case 但待人工归档的入站邮件。新回信规则仅采用同品牌、已关联当前 Case 且 `has_unread_reply = true` 的旧跟进记录，并要求存在其最新的入站邮件事件，避免把历史邮件重复列为待办。`dedupe_key = case_id + type + source_id`；同一事实重复保存不会重复创建任务。条件消失时仅将未完成的 `case_rule` 任务标记为 `已失效`，不会覆盖人工完成或跳过的记录。歧义或跨品牌待归档邮件不生成 Case 任务，留待 `CRM-30` 邮件分诊台处理。

任务可在今日推进中由人工指派负责人、记录内部备注、延期或完成/跳过。延期必须写明原因；每个操作均写入追加式 `actionTaskEvents` 审计记录。任务操作本身不会自动变更 Case 或 FollowUp 阶段，也不会发送邮件。

人工在邮件分诊台确认归档一封入站达人回信时，系统会保留 `mailInbox` 原记录并标记为 `triage_status = archived`，以 `mail_inbox_id` 写入邮件事件，联动同品牌且唯一的 `followUp` 的 `has_unread_reply` 和 `last_email_at`，并生成唯一的 `new_reply` 行动任务。只有 Case 和 FollowUp 均处于空值、`已联系待回复`、`待回复` 或 `初步沟通` 时，才允许这次人工归档将两者安全推进至 `初步沟通`；报价、条款、寄样、发布、回收和结案阶段不会因邮件归档自动改变。打开或人工标记跟进为已读后，重算会将对应未完成 `new_reply` 任务标记为 `已失效`，不会改变 Case 阶段。

## actionTaskEvents

行动任务事件是 `actionTasks` 的追加式协作审计记录，必须关联到同品牌、同 Case 的既有任务。旧数据缺少该集合时读取会初始化为空；无效事件保留 `validation_error`，不自动跨品牌或跨 Case 修复。

- `id`
- `task_id`、`brand_id`、`case_id`
- `type`（`created`、`assignment`、`note`、`defer`、`complete`、`skip`）
- `actor_id`、`actor_name`
- `summary`（必填、面向人工查看的操作摘要）
- `metadata`（结构化细节，例如前后负责人、延期前后截止时间、延期原因或完成证据）
- `occurred_at`
- `validation_error`
- `createdAt`、`updatedAt`

### 旧跟进兼容迁移

`POST /api/cases/migration` 用于显式把仍未关联 Case 的旧 `followUps` 映射为 `CASE-FU-{follow_up_id}`。迁移只补齐兼容身份和关联，不删除旧跟进，也不删除邮件正文、产品或物流资料。迁移结果写入 `meta.caseMigration`：

- `version`、`status`（`completed` 或 `rolled_back`）
- `migratedAt`、`lastMigratedAt`、`rolledBackAt`
- `sourceFollowUpCount`
- `migratedFollowUpIds`
- `createdCaseIds`
- `snapshot.followUps`、`snapshot.cooperations`、`snapshot.followUpEvents`、`snapshot.contactTracks`（仅保存本次被补写的原 `case_id`）

迁移是幂等的：重复调用不会重复创建 Case，也不会在没有实际变化时刷新 `lastMigratedAt`。`POST /api/cases/migration/rollback` 只删除本次迁移创建且未被人工修改的 Case，并按快照恢复关联字段；如果检测到迁移后的人工修改，默认返回错误并拒绝覆盖。回滚后普通读取不会自动重建兼容 Case，必须再次显式调用迁移接口恢复。这两个接口仅用于兼容迁移和人工恢复，不代表开放自动阶段推进。

## followUpEvents

合作跟进事件表，用于保存从 Foxmail 导出的 `.eml` 或官邮 IMAP 同步的邮件摘要，形成单条跟进的沟通时间线。

- `id`
- `follow_up_id`（关联 `followUps.id`）
- `case_id`（关联 `cases.id`；由历史 `follow_up_id` 兼容回填）
- `mail_inbox_id`（人工分诊归档时关联 `mailInbox.id`，用于防止同一邮件重复写入时间线）
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
- `previous_stage`、`next_stage`（仅阶段变更事件记录变更前后状态）
- `actor`（阶段变更执行者；AI 建议只能记录为人工确认）
- `change_reason`（人工阶段变更原因；不能为空）
- `evidence`（支持该阶段变更的最小证据摘要；不写入隐藏的完整邮件正文）
- `case_version`（该事件提交后对应的 Case 版本）
- `filename`
- `mailbox`（IMAP 文件夹名称）
- `server_key`（邮箱服务器、文件夹和 UID 组成的去重键）
- `imap_uid`
- `createdAt`

邮件导入会保存标题、时间、收发方向、地址、正文摘要，并按邮箱正文缓存策略保存完整纯文本正文；不保存原始 `.eml` 文件、HTML 原文或附件。相同 `Message-ID`、相同指纹或同一 IMAP 服务器 UID 的邮件会跳过，避免重复导入；摘要再次同步到完整正文时会升级原记录，旧的截断正文也允许被后续完整正文替换，不新增重复事件。完整正文仍受保留期限、单封长度和 AI 总上下文预算限制。

阶段推进事件为追加式审计记录：手动推进或编辑保存时必须填写人工原因；由 AI 给出的建议只有在用户明确点击应用后才会写入，并使用 `ai_suggestion_confirmed` 来源与“人工确认”操作者。阶段事件会同时更新 Case 的阶段、版本和最近审计摘要，不允许 AI 在无人确认时变更高风险阶段。

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
- `case_id`（人工或规则确认后的目标 Case）
- `lead_id`（从陌生合作来信人工创建待开发达人后关联 `leads.id`）
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
- `candidate_case_ids`
- `match_disposition`（`unique`、`ambiguous`、`unmatched`；仅表达匹配置信度，不会绕过人工归档）
- `match_score`
- `match_reasons`（匹配结论的简短说明）
- `match_candidates`（候选品牌、联系人、Case、分数与逐条规则证据；用于后续邮件分诊台解释推荐）
- `triage_status`（空值为待处理；`archived` 为人工确认已归档；`ignored` 为人工忽略；`lead_created` 为已从陌生合作来信创建待开发达人）
- `triage_reason`（人工归档或忽略的理由；忽略时必填）
- `triage_resolved_at`
- `triage_resolved_by`
- `createdAt`
- `updatedAt`

同步时会对线程 Message-ID、联系人邮箱、联系人轨迹、首联 30 天窗口、活跃 FollowUp 与活跃 Case 计算可解释评分。评分为 `unique` 才可作为自动归档候选；最高分接近其他候选时为 `ambiguous`，证据不足时为 `unmatched`。共享邮箱绝不按账号的第一个品牌默认归属，跨品牌候选也绝不自动归档。评分与每条证据会保留在待归档邮件记录中，供后续分诊台展示。

邮件分诊台必须展示候选达人、候选 Case、分数及逐条规则证据。人工归档只能选取当前邮件候选范围内、同一品牌且未结案的 Case；没有候选 Case 时不得退化为选择任意同品牌 Case。人工绑定已有达人后，系统会重新写入该达人当前活跃 Case 的候选范围。忽略邮件必须填写理由，保留原始 `mailInbox` 记录，但不会创建 Case/FollowUp 时间线事件；已忽略邮件不可再次归档。仅当邮件唯一识别到已有达人且该达人没有活跃 Case 时，才能新建默认阶段为“初步沟通”的 Case 并归档，不能跳过到报价、寄样、发布等阶段。

当 `status` 为 `needs_followup` 且没有活跃跟进时，可新建一条默认合作跟进后归档；当同一达人有多条活跃跟进时，必须先选择具体跟进。无法自动确认达人或匹配多个达人时，不提供自动归档，但前端可从当前品牌达人库人工绑定已有达人后继续处理；品牌不一致时始终阻止归档。人工确认或 Foxmail 导入保存失败时，页面内存状态会恢复到操作前快照。

对于同品牌、入站、已确认品牌且未关联现有达人或活跃 Case 候选的陌生合作来信，分诊台可由人工明确确认后创建一条“待开发”达人线索。创建时必须保留来源邮件身份，并以来源邮箱及可选社媒地址同时检查同品牌的待开发达人和达人库；出现重复时只提示既有资料，不会自动合并或重复创建。此操作不会创建 Case、FollowUp、邮件时间线事件或行动任务，也不会调用 AI 或发送邮件。

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
