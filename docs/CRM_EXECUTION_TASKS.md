# 合作跟进 CRM 固定执行台账

## 文档职责

这是合作跟进 CRM 的唯一执行台账，用于替代分散的口头规划、聊天记录和临时待办。后续所有涉及合作跟进、官邮、AI 跟进、达人联系人、任务队列和存储并发的改动，必须先核对本文件，再开始实现。

- 建立日期：2026-09-11
- 当前里程碑：`CRM-20` 今日推进与任务生命周期
- 总体状态：`active`
- 本轮范围：先跑稳人工确认的合作跟进闭环；定时同步暂缓。
- 数据原则：不改动正式业务资料、不暴露邮箱授权码或 AI Key。
- 自动化原则：AI 只摘要、建议和起草；发信、价格/条款确认、寄样、签收、发布和结案等高风险动作必须人工确认。

## 状态与记录规则

### 任务状态

| 状态 | 含义 |
| --- | --- |
| `planned` | 已确认要做，但尚未开始。 |
| `active` | 正在实现或验证。每次只允许一个核心实现任务处于此状态。 |
| `blocked` | 有明确外部阻塞，必须写明阻塞原因和恢复条件。 |
| `done` | 已满足验收标准，记录了测试证据和提交号。 |
| `deferred` | 已确认暂不做，写明重新评估的前置条件。 |

### 强制检查点

1. **开始前**：读取本台账，确认任务编号、状态、前置任务和不做范围；已有 `done` 证据的内容不得重复规划或重做。
2. **实现前**：将本次最小变更记为 `active`，写入计划改动和预期验证方式。
3. **每个小阶段结束后**：在“阶段变更日志”追加一条记录，包含任务编号、状态变化、文件、测试结果、提交号和下一道门槛。
4. **提交规则**：功能改动和对应测试先形成独立功能提交；本台账随后立即形成检查点提交并引用该功能提交号。两者共同构成一次可追溯完成记录；尚未提交时，日志中的提交号写 `待提交`。
5. **完成规则**：没有验收证据、没有回归测试结果或没有提交号的任务不得标记 `done`。
6. **中断或上下文压缩后**：先读取本文件的“当前执行指针”和最后三条日志，再恢复工作；不得仅依赖聊天上下文。
7. **范围变化**：新增需求必须先新增任务编号或挂到已有任务的“子项”，不得直接插入实现。

## 当前执行指针

| 项目 | 当前值 |
| --- | --- |
| 当前任务 | `CRM-20-03` |
| 当前状态 | `active` |
| 当前目标 | 建立首页“今日推进”中枢；在不改变当前人工确认边界的前提下展示、筛选和处理已持久化的行动任务。 |
| 已完成前序 | `CRM-00` 基线与执行治理；`CRM-10` Case 模型、兼容迁移、Case 中心展示与阶段审计；`CRM-20-01` 持久化行动任务数据契约；`CRM-20-02` 规则生成、去重与失效生命周期。 |
| 禁止提前启动 | `CRM-60` 定时同步、自动发送、AI 自动推进高风险阶段。 |
| 最近已验证基线 | `npm.cmd run check`、`npm.cmd run test:action-task-storage`、`npm.cmd run test:case-display`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析、`git diff --check`（功能提交 `140b6f2`）。 |

## 总体闭环与完成定义

目标闭环为：

`待开发达人 -> 选择品牌邮箱并人工确认发送首联 -> 已联系待回复 -> 同步或人工归档回信 -> 初步沟通 -> AI/人工建议与回复草稿 -> 协商/寄样/发布/数据回收 -> 结案 -> 达人库与合作记录沉淀`

所有邮件都先落入“品牌 -> 联系人身份 -> Case”的归属规则。可唯一确认时自动归档；存在歧义时进入邮件分诊台，不允许猜测性绑定。AI 只可使用当前品牌、当前 Case 且在授权/保留期内的文本上下文。

## 固定任务表

### CRM-00：基线、治理与文档一致性

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-00-01` | P1 | `done` | 建立本固定执行台账、执行指针与追加式变更日志。 | 无 | 本文件成为唯一入口；后续每个小阶段可按编号、证据和提交号追溯。 |
| `CRM-00-02` | P2 | `done` | 统一 README、当前状态和隐私说明，明确默认摘要、可选纯文本正文缓存、保留期、AI 授权与不保存范围。 | `CRM-00-01` | 各文档不再互相矛盾；不误称“绝不保存正文”。 |
| `CRM-00-03` | P1 | `done` | 为后续 Case、任务队列和邮件归档建立可重复的隔离回归基线。 | `CRM-00-01` | 测试可验证多品牌隔离、并发冲突防护、Case 关联、任务生成和人工归档。 |

### CRM-10：Case 基础模型

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-10-01` | P1 | `done` | 定义 `cases` 的字段、阶段状态机、与品牌/达人/线索/产品/合作记录的稳定关联。 | `CRM-00-03` | 一条具体合作可有独立 Case；可区分同一达人不同品牌或同品牌多次合作。 |
| `CRM-10-02` | P1 | `done` | 设计并实现从现有 `followUps` 向 Case 的兼容迁移与回滚。 | `CRM-10-01` | 不丢失现有跟进、邮件事件、物流、产品和时间线；旧入口仍可读取。 |
| `CRM-10-03` | P1 | `done` | 将看板、详情抽屉和历史合作沉淀改为以 Case 为中心展示。 | `CRM-10-02` | Case 一屏汇总邮件线程、当前阶段、产品、报价、地址、寄样、发布日期、内部备注和历史动作。 |
| `CRM-10-04` | P2 | `done` | 为 Case 增加审计字段与人工阶段变更原因。 | `CRM-10-03` | 高风险阶段的变更人、时间、原因和证据可追溯。 |

### CRM-20：今日推进与任务生命周期

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-20-01` | P1 | `done` | 定义行动任务模型：来源、所属 Case、负责人、截止时间、优先级、状态、完成证据。 | `CRM-10-01` | 任务可独立于页面展示保存，不只是临时筛选结果。 |
| `CRM-20-02` | P1 | `done` | 根据规则生成并去重“新回信待处理、三天未回复、待补地址、待寄样、待确认报价、待发布、待数据回收、待人工归档”。 | `CRM-20-01` | 同一事实不会重复生成多条待办；条件消失后任务自动关闭或标记失效。 |
| `CRM-20-03` | P1 | `active` | 建立首页“今日推进”中枢，支持按品牌、负责人、优先级、截止时间与任务类型筛选。 | `CRM-20-02` | 用户可在一个队列中完成/跳过/延期/进入对应 Case，不必逐个看板查找。 |
| `CRM-20-04` | P2 | `planned` | 支持任务指派、备注、延期理由和操作历史。 | `CRM-20-03` | 团队协作时能知道谁正在处理、何时处理、为什么延后。 |

### CRM-30：邮件分诊与可靠归档

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-30-01` | P1 | `planned` | 设计邮件匹配评分：品牌、收发邮箱、Message-ID 线程、联系人身份、首联时间窗、活跃 Case。 | `CRM-10-01` | 明确唯一匹配、歧义匹配和未匹配的判定理由；不跨品牌误归档。 |
| `CRM-30-02` | P2 | `planned` | 建立邮件分诊台，展示候选达人、候选 Case、匹配证据和一键确认/忽略/新建 Case。 | `CRM-30-01` | 共享邮箱、经纪人邮箱、多人合作和陌生来信都可人工高效处理。 |
| `CRM-30-03` | P1 | `planned` | 将分诊结果、手动纠正和回信高亮联动到 Case 与今日推进。 | `CRM-20-03`, `CRM-30-02` | 新回信自动生成待办；人工归档后邮件、Case 和待办状态一致。 |
| `CRM-30-04` | P2 | `planned` | 为陌生达人合作来信增加“新线索”入口与去重建议。 | `CRM-30-02` | 可从邮件创建待开发达人，保留来源邮件与品牌归属。 |

### CRM-40：人工主导的 AI 跟进工作台

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-40-01` | P1 | `planned` | 将 AI 输入固定为当前品牌、当前 Case、授权有效的完整正文/摘要、结构化合作资料。 | `CRM-10-03`, `CRM-30-03` | 不接收前端伪造上下文；清楚展示本次分析使用的邮件范围与缺失信息。 |
| `CRM-40-02` | P1 | `planned` | 输出中文沟通摘要、对方意图、风险、缺失信息、可选下一步和建议阶段；用户选择策略并写备注。 | `CRM-40-01` | 用户可理解后再决定，不被黑盒自动推进。 |
| `CRM-40-03` | P1 | `planned` | 基于用户选定策略生成可编辑邮件草稿，统一应用品牌邮箱的 HTML/文本/图片签名规范，并要求发送确认。 | `CRM-40-02` | 草稿、签名和实际发信记录一致；多产品、链接和格式不丢失。 |
| `CRM-40-04` | P1 | `planned` | AI 建议阶段仅支持人工点击应用；涉及报价、条款、寄样、签收、发布、结案必须提供人工确认及理由。 | `CRM-40-02` | AI 不会自行改变高风险阶段；审计记录完整。 |

### CRM-50：多人协作与存储并发

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-50-01` | P1 | `planned` | 为本地 SQLite 和线上存储制定并发策略：记录级写入、版本号/乐观锁、冲突响应与恢复提示。 | `CRM-00-03` | 两个用户或“同步 + 手工编辑”同时操作时，后写不会静默覆盖前写。 |
| `CRM-50-02` | P1 | `planned` | 将本地全表删除重写替换为针对实体的事务性增删改；保留可恢复备份。 | `CRM-50-01` | 多次保存只写入受影响记录；失败可回滚，不损坏其他实体。 |
| `CRM-50-03` | P1 | `planned` | 将线上 Blob 全量状态覆盖迁移到具备记录级并发控制的数据后端或服务层。 | `CRM-50-01` | 跨浏览器并发可检测和解决冲突；邮件同步不覆盖人工编辑。 |
| `CRM-50-04` | P2 | `planned` | 增加变更审计、冲突处理界面及按实体恢复。 | `CRM-50-02`, `CRM-50-03` | 可查看谁何时更改，冲突可选择保留版本或合并字段。 |

### CRM-60：定时同步与受控自动建议

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-60-01` | P1 | `deferred` | 定义定时 IMAP 同步的开关、频率、邮箱范围、日志、失败重试、幂等与告警。 | `CRM-20-03`, `CRM-30-03`, `CRM-50-03` | 仅在人工链路验收后解锁；可随时关闭，失败不重复导入或丢失邮件。 |
| `CRM-60-02` | P2 | `deferred` | 定时触发 AI 仅生成“待审核建议”，绝不自动发信或自动推进高风险阶段。 | `CRM-40-04`, `CRM-60-01` | 所有建议进入今日推进并等待人工审核。 |

### CRM-70：联系人身份与投递治理

| ID | 优先级 | 状态 | 工作项 | 前置 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| `CRM-70-01` | P2 | `planned` | 建立联系人/邮箱身份模型：多个邮箱、经纪人/商务角色、CC、主邮箱、有效性和退订状态。 | `CRM-10-01`, `CRM-30-01` | 同一达人可管理多个联系方式，邮件匹配和发送可选定正确身份。 |
| `CRM-70-02` | P2 | `planned` | 增加退信、投递失败、退订、黑名单与触达频率控制。 | `CRM-70-01`, `CRM-40-03` | SMTP 接收成功不再被误解为送达；不向退订/黑名单联系人发信。 |
| `CRM-70-03` | P2 | `planned` | 建立合规审计与联系人数据保留/删除策略。 | `CRM-70-01` | 可按品牌、联系人和邮件数据执行最小化保留与删除。 |

## 本阶段不启动

以下项目已明确延后，不得因便利而绕过前置条件启动：

1. `CRM-60` 的定时 IMAP 同步、自动重试和定时 AI 建议。
2. 自动发送邮件。
3. AI 自动推进报价、条款、寄样、签收、发布、数据回收或结案。
4. 全量历史邮箱迁移、附件抓取、HTML 原文或原始 MIME 保存。
5. 未完成 `CRM-50` 前面向多人协作的正式上线承诺。

## 阶段变更日志

> 只追加，不改写历史记录。每次小阶段完成、阻塞、恢复、验收或范围变更都必须新增一行。

| 时间 | 任务 ID | 状态变化 | 改动文件 | 验证/证据 | 提交 | 结论与下一门槛 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-11 | `CRM-00-01` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已对照 `CURRENT_STATUS.md`、`SCHEMA.md`、`FOLLOWUP_EMAIL_EXECUTION.md`、`README.md` 与最近提交 `66eb6a1` 建立基线。 | `978ae3d` | 台账已创建；下一步完成 README/状态文档的正文缓存说明统一后，才进入 Case 数据模型设计。 |
| 2026-09-11 | `CRM-00-01` | `active -> done` | `docs/CRM_EXECUTION_TASKS.md` | 任务表已包含固定编号、状态定义、前置依赖、验收条件、禁止提前启动项、恢复指针和追加日志模板。 | `978ae3d` | 执行治理完成；后续实现先查询本台账。 |
| 2026-09-11 | `CRM-00-02` | `planned -> done` | `README.md`、`docs/CURRENT_STATUS.md`、`docs/CRM_EXECUTION_TASKS.md` | README 已改为“默认摘要 + 可选纯文本正文缓存 + 保留期 + AI 授权”；当前状态文档已指向统一台账。`git diff --check` 通过。 | `978ae3d` | 文档说明已统一；下一任务为 `CRM-00-03` 回归基线。 |
| 2026-09-11 | `CRM-00-03` | 保持 `planned` | `docs/CRM_EXECUTION_TASKS.md` | 检查点：确认当前尚未增加 Case、任务队列或邮件归档代码；仅完成治理与文档一致性，避免把准备工作误报为功能完成。 | `待提交` | 下次从隔离回归基线开始，先定义测试数据和不可回归的现有行为。 |
| 2026-09-11 | `CRM-00-03` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已核对现有 `test:followup-isolation`：覆盖品牌/邮件正文隔离与邮件路由，但未覆盖 Case、行动任务和并发冲突。计划补齐独立 CRM 隔离回归骨架，并保持不写入正式资料。 | 待提交 | 先完成可扩展测试夹具与现有行为基线，再进入 `CRM-10-01` Case 字段与状态机设计。 |
| 2026-09-11 | `CRM-00-03` | 保持 `active` | `docs/CRM_EXECUTION_TASKS.md` | 已执行 `npm.cmd run check`、`npm.cmd run test:followup-isolation`、`git diff --check`，均通过；现有回归确认了品牌隔离、共享邮箱路由、正文授权/过期清理、人工确认与跨品牌发信拦截。 | 待提交 | 启动基线已固化；下一小阶段只补 Case/任务/分诊/并发的可执行隔离测试骨架，不提前实现业务模型。 |
| 2026-09-11 | `CRM-00-03` | `active -> done` | `tools/crm-domain.cjs`、`tools/crm-regression-test.cjs`、`package.json`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、`npm.cmd run check`、`git diff --check` 均通过。新回归实际覆盖 Case 品牌隔离、人工归档、待办去重与关闭、乐观锁冲突。未读取或写入正式业务资料。 | 待提交 | 基线完成；只激活 `CRM-10-01`，下一步将 Case 字段和关联规则接入前后端状态与 SQLite。 |
| 2026-09-11 | `CRM-10-01` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已核对前置任务和 Case 契约测试；当前仅有纯领域模块，尚未进入正式状态、SQLite 或界面，不能被当作已上线。 | 待提交 | 先完成最小数据模型、阶段规则和品牌/达人/线索/产品/合作稳定关联，再进行兼容迁移。 |
| 2026-09-11 | `CRM-10-01` | `active -> done` | `tools/sqlite_store.py`、`tools/local-server.cjs`、`api/[...route].mjs`、`app/app.js`、`tools/crm-domain.cjs`、`docs/SCHEMA.md`、两套回归测试 | `npm.cmd run check`、`python -c` AST 解析、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、`git diff --check` 全部通过。验证同品牌同达人多轮 Case、品牌隔离、产品/合作/邮件关联、版本号及旧跟进兼容 Case。正式资料未读取或写入；旧跟进仍保留。 | `16765f0` | Case 正式数据契约完成；下一步仅做迁移快照与恢复验证，不能提前改看板界面。 |
| 2026-09-11 | `CRM-10-02` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已完成 Case 模型前置条件；现有读取迁移已可生成兼容 Case，但尚未具备单独的迁移版本标记、备份快照和恢复回归。 | `16765f0` | 先实现幂等迁移记录与恢复路径，确认不丢失跟进、邮件、物流和时间线后才可标记完成。 |
| 2026-09-11 | `CRM-10-01` | 保持 `done`，提交前复验 | `api/[...route].mjs`、`app/app.js`、`tools/local-server.cjs`、`tools/sqlite_store.py`、`tools/crm-domain.cjs`、两套回归测试、`docs/SCHEMA.md` | 已再次执行 `npm.cmd run check`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析和 `git diff --check`，全部通过。 | `16765f0` | Case 数据模型基线已冻结；继续唯一激活任务 `CRM-10-02`，不触碰正式业务资料。 |
| 2026-09-11 | `CRM-10-02` | `active -> done` | `tools/case-migration.cjs`、`tools/local-server.cjs`、`api/[...route].mjs`、`app/app.js`、`tools/sqlite_store.py`、`tools/followup-isolation-test.cjs`、`docs/SCHEMA.md`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run check`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析和 `git diff --check` 全部通过。回归覆盖兼容 Case 创建、物流/备注/产品/邮件正文保留、邮件事件与联系人轨迹关联、幂等、回滚、回滚后不自动重建、显式恢复及人工修改拒绝回滚。 | `fd2e096` | 迁移闭环完成；正式资料未读取或写入。下一门槛为 `CRM-10-03`：仅将界面展示改为 Case 中心，不启动任务队列、分诊台、AI 自动推进或定时同步。 |
| 2026-09-11 | `CRM-10-03` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已确认 `CRM-10-02` 已完成且提交为 `fd2e096`；本阶段只审查并调整合作跟进看板、详情抽屉和历史合作展示，不启动 `CRM-20`、`CRM-30`、`CRM-40`、`CRM-50` 或 `CRM-60`。 | 待提交 | 计划：以兼容生成后的 Case 作为展示聚合源，保留旧 `followUps` 编辑/保存入口；验证 Case/旧跟进一致、品牌隔离、邮件正文授权范围和历史合作关联。下一门槛为完成展示改动并通过现有回归。 |
| 2026-09-11 | `CRM-10-03` | `active -> done` | `app/app.js`、`app/styles.css`、`tools/case-display-regression-test.cjs`、`package.json`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run test:case-display`、`npm.cmd run check`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析和 `git diff --check` 全部通过。验证 Case 优先展示、旧 FollowUp 回退、邮件/合作/多产品关联、阶段事件写入 `case_id`、品牌隔离和紧凑详情样式。未读取或写入正式业务资料，未调用真实邮箱或 AI。 | `7e45acb`（功能提交） | Case 中心展示闭环完成；回滚 `7e45acb` 即可，旧 FollowUp 字段仍可读取。下一门槛为 `CRM-10-04`：增加审计字段与人工阶段变更原因；不提前启动任务队列、分诊台、自动跟进、并发重构或定时同步。 |
| 2026-09-11 | `CRM-10-04` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已核对当前执行指针、最近三条完成记录及前置 `CRM-10-03`；现有阶段事件缺少统一的前后阶段、人工原因、操作者、证据和 Case 版本审计字段。 | 待提交 | 本阶段只补 Case 阶段审计与人工理由，保持 AI 建议必须由人工确认；不启动任务队列、邮件分诊、定时同步、自动发送或并发存储重构。 |
| 2026-09-11 | `CRM-10-04` | `active -> done` | `app/app.js`、`app/styles.css`、`tools/sqlite_store.py`、`tools/crm-domain.cjs`、`tools/crm-regression-test.cjs`、`tools/case-display-regression-test.cjs`、`docs/SCHEMA.md`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run check`、`npm.cmd run test:case-display`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析与 `git diff --check` 全部通过。验证手动/编辑页阶段变更必须填写原因，AI 仅能在人工点击应用后写入；Case、兼容 FollowUp、Case 版本及结构化审计事件保持一致，跨品牌写入被拒绝。未读取或写入正式业务资料，未调用真实 IMAP、SMTP 或 AI。 | `b6570d2`（功能提交） | 阶段审计闭环完成；回滚 `b6570d2` 即可，SQLite 采用新增列迁移不删除旧数据。已核对未提前启动 CRM-20 任务队列、CRM-30 邮件分诊、CRM-40 AI 工作台、CRM-50 并发重构、CRM-60 定时同步、CRM-70 联系人/投递治理。下一执行门槛为 `CRM-20-01`，当前仅标记 planned。 |
| 2026-09-11 | `CRM-20-01` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已核对 `CRM-10-04` 的完成记录、当前状态源、SQLite、前后端状态归一化与 CRM 领域回归。发现 `actionTasks` 仅存在于领域测试夹具，尚未持久化到正式状态、SQLite 或线上归一化，因此不计作已完成。 | 待提交 | 本阶段只定义并接入可独立保存的行动任务数据契约、品牌/Case 隔离与最小领域校验；不调用生成规则、不增加今日推进 UI、不处理邮件分诊、AI 自动化、定时同步或并发重构。 |
| 2026-09-11 | `CRM-20-01` | `active -> done` | `tools/sqlite_store.py`、`tools/local-server.cjs`、`api/[...route].mjs`、`app/app.js`、`tools/crm-domain.cjs`、`tools/action-task-storage-test.cjs`、`tools/crm-regression-test.cjs`、`docs/SCHEMA.md`、`package.json`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run check`、`npm.cmd run test:action-task-storage`、`npm.cmd run test:case-display`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析与 `git diff --check` 全部通过。隔离 SQLite 往返确认任务可独立保存；创建/完成动作验证 Case 存在、品牌一致、标题和完成证据。 | `c08db7e`（功能提交） | 数据影响：仅新增 SQLite `actionTasks` 表和状态集合，未读取或写入正式业务资料、IMAP、SMTP 或 AI；回滚：`git revert c08db7e`，新增表为可安全闲置的加法，任何破坏性数据库降级前先导出。核对：既有领域夹具不再被误报为上线功能；未启动 `CRM-20-02` 规则生成、`CRM-20-03` 任务中心、`CRM-20-04` 协作界面、`CRM-30+` 分诊、`CRM-40+` AI 工作台、`CRM-50+` 并发重构、`CRM-60` 定时同步或 `CRM-70+` 联系人治理。下一门槛：仅激活 `CRM-20-02`。 |
| 2026-09-11 | `CRM-20-02` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已读取当前执行指针、最近完成记录、`crm-domain.cjs`、前后端状态保存入口与现有回归。确认领域层已有部分任务规格和去重雏形，但未覆盖全部八类任务，且未在本地/线上常规保存与邮箱同步保存后统一重算。 | 待提交 | 本阶段只实现规则生成、去重、条件消失失效和运行时保存接入；计划覆盖新回信、三天未回复、地址、寄样、报价、发布、数据回收、人工归档八类任务，并新增隔离回归。不得启动今日推进 UI、指派/历史界面、邮件分诊台、AI 工作台、定时同步、自动发送或并发存储重构。 |
| 2026-09-11 | `CRM-20-02` | `active -> done` | `tools/crm-domain.cjs`、`tools/local-server.cjs`、`api/[...route].mjs`、`tools/crm-regression-test.cjs`、`docs/SCHEMA.md`、`docs/CRM_EXECUTION_TASKS.md` | `npm.cmd run check`、`npm.cmd run test:action-task-storage`、`npm.cmd run test:case-display`、`npm.cmd run test:crm-regression`、`npm.cmd run test:followup-isolation`、Python AST 解析与 `git diff --check` 全部通过。回归覆盖八类规则、同一事实去重、条件消失失效、失效任务恢复、已完成任务不重开、同品牌 Case 隔离、最新未读回信识别、跨品牌事件排除和唯一候选待归档邮件。 | `140b6f2`（功能提交） | 数据影响：保存时新增规则重算；未读取或写入正式业务资料，未调用真实 IMAP、SMTP 或 AI。新回信只依据同品牌、当前 Case 的 `has_unread_reply` 与最新有效入站事件，避免历史邮件误报。回滚：`git revert 140b6f2`。核对：已比对 `CRM-20-01` 的持久化契约，未重复实现其数据表；未启动 `CRM-20-03` 今日推进 UI、`CRM-20-04` 指派/历史、`CRM-30+` 分诊、`CRM-40+` AI 工作台、`CRM-50+` 并发重构、`CRM-60` 定时同步或 `CRM-70+` 联系人治理。下一门槛：仅可激活 `CRM-20-03`。 |
| 2026-09-11 | `CRM-20-03` | `planned -> active` | `docs/CRM_EXECUTION_TASKS.md` | 已核对执行指针、最近完成记录、行动任务持久化与规则生成回归。计划仅增加“今日推进”筛选队列及完成/跳过/延期/进入 Case 操作；不新增指派或操作历史，不启动邮件分诊、AI 工作台、定时同步、自动发信或并发重构。 | `adf3c69`（启动检查点） | 下一门槛：完成任务状态操作的最小领域校验和界面回归后，独立提交功能与台账检查点。 |

## 阶段完成记录模板

后续追加时使用下列结构，避免遗漏：

```text
时间：YYYY-MM-DD HH:mm（时区）
任务：CRM-XX-XX
状态：planned/active/blocked/done -> 新状态
目标：本次最小改动解决的问题
改动：文件路径；关键行为变化
验证：执行命令、结果；人工验证步骤和结果
数据影响：是否迁移、是否触碰正式数据、回滚方式
提交：commit hash 或“待提交”
核对：已确认未重复完成；前置任务满足；下一门槛
```
