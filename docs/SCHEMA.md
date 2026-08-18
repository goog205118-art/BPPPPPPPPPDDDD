# 数据结构说明

## creators

达人库主表，用于记录达人画像与合作状态。

- `id`
- `brand`（所属品牌，用于区分多品牌达人资料）
- `name`
- `social_url`
- `email`
- `email_source`（邮箱所在公开页面的链接；AI 仅在公开证据可验证时写入）
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
- `status`（待开发、已联系、已转达人库、不适合）
- `notes`
- `createdAt`
- `updatedAt`

社媒地址和邮箱会与正式达人库双向去重。确认可合作时，可从待开发页直接转入达人库，原线索会保留并标记为“已转达人库”。

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
