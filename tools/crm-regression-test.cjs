const assert = require("node:assert/strict");
const {
  archiveTriageMail,
  canTransitionCaseStage,
  completeTask,
  createActionTask,
  createCase,
  patchVersionedRecord,
  recordCaseStageChange,
  reconcileCaseTasks,
} = require("./crm-domain.cjs");

const now = "2026-09-11T12:00:00.000Z";

function fixture() {
  const caseA = createCase({
    id: "CASE-A",
    brand_id: "BR-A",
    creator_id: "CR-A",
    stage: "待寄样",
  }, now);
  const caseB = createCase({
    id: "CASE-B",
    brand_id: "BR-B",
    creator_id: "CR-B",
    stage: "已联系待回复",
    last_outreach_at: "2026-09-07T08:00:00.000Z",
  }, now);
  return {
    cases: [caseA, caseB],
    followUps: [{
      id: "FU-A",
      case_id: "CASE-A",
      brand_id: "BR-A",
      has_unread_reply: true,
    }],
    followUpEvents: [{
      id: "EV-A-REPLY",
      brand_id: "BR-A",
      case_id: "CASE-A",
      follow_up_id: "FU-A",
      direction: "inbound",
      subject: "Re: Collaboration",
      occurred_at: "2026-09-11T10:00:00.000Z",
    }, {
      id: "EV-B-OUTBOUND",
      brand_id: "BR-B",
      case_id: "CASE-B",
      direction: "outbound",
      occurred_at: "2026-09-07T08:00:00.000Z",
    }],
    mailInbox: [{
      id: "MAIL-A",
      brand_id: "BR-A",
      direction: "inbound",
      subject: "Re: sample details",
      excerpt: "Please let me know.",
      occurred_at: "2026-09-11T09:00:00.000Z",
      status: "待人工归档",
      candidate_case_ids: ["CASE-A"],
    }, {
      id: "MAIL-B",
      brand_id: "BR-B",
      direction: "inbound",
      subject: "Re: partnership",
      occurred_at: "2026-09-11T09:30:00.000Z",
      status: "待人工归档",
      candidate_case_ids: ["CASE-B"],
    }],
    actionTasks: [],
  };
}

function testCaseIsolationAndTriage() {
  const state = fixture();
  state.cases.push(createCase({
    id: "CASE-A-ROUND-2",
    brand_id: "BR-A",
    creator_id: "CR-A",
    product_ids: ["PR-A-2"],
    stage: "待开发",
  }, now));
  assert.equal(state.cases.filter((item) => item.brand_id === "BR-A" && item.creator_id === "CR-A").length, 2);
  const archived = archiveTriageMail(state, { mail_id: "MAIL-A", case_id: "CASE-A" }, now);
  assert.equal(archived.mail.status, "已归档");
  assert.equal(archived.mail.case_id, "CASE-A");
  assert.equal(archived.eventCreated, true);
  assert.equal(state.followUpEvents.filter((item) => item.case_id === "CASE-A").length, 2);
  assert.equal(state.followUpEvents.filter((item) => item.case_id === "CASE-B").length, 1);

  assert.throws(
    () => archiveTriageMail(state, { mail_id: "MAIL-B", case_id: "CASE-A" }, now),
    /品牌不一致/,
    "分诊不能将共享邮箱的邮件归档到其他品牌的 Case。",
  );
  assert.equal(state.mailInbox.find((item) => item.id === "MAIL-B").status, "待人工归档");
}

function testTaskLifecycle() {
  const state = fixture();
  state.followUpEvents.push({
    id: "EV-A-OLDER-REPLY",
    brand_id: "BR-A",
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    direction: "inbound",
    occurred_at: "2026-09-11T08:00:00.000Z",
  }, {
    id: "EV-A-OUTBOUND",
    brand_id: "BR-A",
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    direction: "outbound",
    occurred_at: "2026-09-11T09:00:00.000Z",
  }, {
    id: "EV-A-CROSS-BRAND",
    brand_id: "BR-B",
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    direction: "inbound",
    occurred_at: "2026-09-11T11:00:00.000Z",
  });
  let result = reconcileCaseTasks(state, now);
  const types = result.created.map((task) => task.type).sort();
  assert.deepEqual(types, ["address_needed", "mail_triage", "mail_triage", "new_reply"]);

  result = reconcileCaseTasks(state, now);
  assert.equal(result.created.length, 0, "同一事实重复同步不能重复生成待办。");
  assert.equal(state.actionTasks.length, 4);

  const replyTask = state.actionTasks.find((task) => task.type === "new_reply");
  assert.equal(replyTask.source_id, "EV-A-REPLY", "新回信待办必须取同品牌、最新且晚于最近外联的回信事件。");
  state.followUps.find((item) => item.id === "FU-A").has_unread_reply = false;
  result = reconcileCaseTasks(state, "2026-09-11T13:00:00.000Z");
  assert.equal(result.invalidated.some((task) => task.id === replyTask.id), true, "打开跟进并标记已读后，开放的新回信任务应失效。");
  assert.equal(replyTask.status, "已失效");

  state.followUps.find((item) => item.id === "FU-A").has_unread_reply = true;
  result = reconcileCaseTasks(state, "2026-09-11T13:30:00.000Z");
  assert.equal(result.created.length, 0, "同一回信重新变为未读时，应恢复既有任务而非新建重复任务。");
  assert.equal(replyTask.status, "待处理");

  const completed = completeTask(state, replyTask.id, "已阅读并准备回复", now);
  assert.equal(completed.status, "已完成");
  assert.equal(completed.completion_evidence, "已阅读并准备回复");
  state.followUps.find((item) => item.id === "FU-A").has_unread_reply = false;
  result = reconcileCaseTasks(state, "2026-09-11T13:45:00.000Z");
  assert.equal(result.invalidated.some((task) => task.id === replyTask.id), false, "已完成的新回信任务不应被覆盖为失效。");

  state.cases.find((item) => item.id === "CASE-A").shipping_address = "Madrid, Spain";
  result = reconcileCaseTasks(state, "2026-09-11T14:00:00.000Z");
  assert.equal(
    state.actionTasks.find((task) => task.type === "address_needed").status,
    "已失效",
    "条件消失后尚未完成的自动任务应失效。",
  );
  assert.equal(result.created.some((task) => task.type === "sample_pending"), true);
}

function testAllGeneratedTaskRules() {
  const state = {
    cases: [
      createCase({ id: "CASE-QUOTE", brand_id: "BR-A", creator_id: "CR-A", stage: "谈合作方式 / 报价" }, now),
      createCase({ id: "CASE-PUBLISH", brand_id: "BR-A", creator_id: "CR-B", stage: "待发布", publish_due_at: "2026-09-15T09:00:00.000Z" }, now),
      createCase({ id: "CASE-DATA", brand_id: "BR-A", creator_id: "CR-C", stage: "待数据回收" }, now),
      createCase({ id: "CASE-TRIAGE", brand_id: "BR-A", creator_id: "CR-D", stage: "初步沟通" }, now),
      createCase({ id: "CASE-OTHER-BRAND", brand_id: "BR-B", creator_id: "CR-E", stage: "初步沟通" }, now),
      createCase({
        id: "CASE-OVERDUE",
        brand_id: "BR-A",
        creator_id: "CR-F",
        stage: "已联系待回复",
        last_outreach_at: "2026-09-07T08:00:00.000Z",
      }, now),
    ],
    followUpEvents: [],
    mailInbox: [{
      id: "MAIL-TRIAGE-UNIQUE",
      brand_id: "BR-A",
      direction: "inbound",
      status: "待人工归档",
      occurred_at: now,
      candidate_case_ids: ["CASE-TRIAGE"],
    }, {
      id: "MAIL-TRIAGE-AMBIGUOUS",
      brand_id: "BR-A",
      direction: "inbound",
      status: "待人工归档",
      occurred_at: now,
      candidate_case_ids: ["CASE-TRIAGE", "CASE-QUOTE"],
    }, {
      id: "MAIL-TRIAGE-CROSS-BRAND",
      brand_id: "BR-B",
      direction: "inbound",
      status: "待人工归档",
      occurred_at: now,
      candidate_case_ids: ["CASE-TRIAGE"],
    }],
    actionTasks: [],
  };

  let result = reconcileCaseTasks(state, now);
  assert.deepEqual(
    result.created.map((task) => task.type).sort(),
    ["mail_triage", "performance_data_pending", "publish_pending", "quote_confirmation_pending", "reply_overdue"],
    "应覆盖报价、发布、数据回收、三天未回复和唯一关联待归档邮件；歧义和跨品牌邮件不可猜测性建任务。",
  );

  const publishTask = state.actionTasks.find((task) => task.type === "publish_pending");
  assert.equal(publishTask.due_at, "2026-09-15T09:00:00.000Z");
  state.cases.find((item) => item.id === "CASE-PUBLISH").publish_due_at = "2026-09-16T09:00:00.000Z";
  result = reconcileCaseTasks(state, "2026-09-11T13:00:00.000Z");
  assert.equal(result.created.length, 0, "同一待发布事实变更截止时间不能创建重复任务。");
  assert.equal(publishTask.due_at, "2026-09-15T09:00:00.000Z", "活动任务不应在规则重算中覆盖人工可能已调整的截止时间。");

  state.cases.find((item) => item.id === "CASE-QUOTE").stage = "待寄样";
  state.cases.find((item) => item.id === "CASE-PUBLISH").stage = "已发布";
  state.cases.find((item) => item.id === "CASE-DATA").stage = "合作完成";
  state.cases.find((item) => item.id === "CASE-OVERDUE").stage = "初步沟通";
  state.mailInbox.find((item) => item.id === "MAIL-TRIAGE-UNIQUE").status = "已归档";
  result = reconcileCaseTasks(state, "2026-09-11T14:00:00.000Z");
  assert.deepEqual(
    result.invalidated.map((task) => task.type).sort(),
    ["mail_triage", "performance_data_pending", "publish_pending", "quote_confirmation_pending", "reply_overdue"],
    "条件不再成立的未完成自动任务必须失效。",
  );
  const quoteTask = state.actionTasks.find((task) => task.type === "quote_confirmation_pending");
  completeTask(state, quoteTask.id, "报价已人工确认", "2026-09-11T14:10:00.000Z");
  state.cases.find((item) => item.id === "CASE-QUOTE").stage = "谈合作方式 / 报价";
  result = reconcileCaseTasks(state, "2026-09-11T14:20:00.000Z");
  assert.equal(result.created.length, 0, "同一已完成自动任务不应被规则重开。");
  assert.equal(quoteTask.status, "已完成");
}

function testPersistedTaskContract() {
  const state = fixture();
  const task = createActionTask(state, {
    id: "TASK-MANUAL-A",
    brand_id: "BR-A",
    case_id: "CASE-A",
    source: "manual",
    type: "confirm_quote",
    title: "确认达人报价",
    description: "核对报价和合作方式。",
    owner_id: "USER-A",
    owner_name: "运营 A",
    priority: "高",
    due_at: "2026-09-12T09:00:00.000Z",
  }, now);
  state.actionTasks.push(task);
  assert.equal(task.brand_id, "BR-A");
  assert.equal(task.case_id, "CASE-A");
  assert.equal(task.status, "待处理");
  assert.equal(task.version, 1);
  assert.equal(task.generated, false);

  assert.throws(
    () => createActionTask(state, {
      case_id: "CASE-A",
      brand_id: "BR-B",
      title: "不应跨品牌保存",
    }, now),
    /品牌不一致/,
    "任务不能跨品牌挂到其他 Case。",
  );
  assert.throws(
    () => createActionTask(state, {
      case_id: "CASE-A",
      title: "",
    }, now),
    /必须填写标题/,
  );
  assert.throws(
    () => completeTask(state, "TASK-MANUAL-A", "", now),
    /必须填写完成证据/,
  );

  const complete = completeTask(state, "TASK-MANUAL-A", "报价已由达人邮件确认", now);
  assert.equal(complete.status, "已完成");
  assert.equal(complete.completed_at, now);
  assert.equal(complete.version, 2);

  task.brand_id = "BR-B";
  assert.throws(
    () => completeTask(state, "TASK-MANUAL-A", "不应写入", now),
    /品牌不一致/,
    "读取到跨品牌的异常任务后，完成操作必须拒绝写入。",
  );
}

function testOptimisticLocking() {
  const state = fixture();
  const first = patchVersionedRecord(state.cases, "CASE-A", 1, { stage: "初步沟通" }, now);
  assert.equal(first.ok, true);
  assert.equal(first.entity.version, 2);

  const stale = patchVersionedRecord(state.cases, "CASE-A", 1, { priority: "高" }, now);
  assert.deepEqual(
    { ok: stale.ok, code: stale.code, actualVersion: stale.actualVersion },
    { ok: false, code: "version_conflict", actualVersion: 2 },
    "旧版本写入必须返回冲突，不能静默覆盖较新的修改。",
  );
  assert.equal(state.cases.find((item) => item.id === "CASE-A").priority, "普通");
}

function testCaseStageContract() {
  const unknownStage = createCase({ id: "CASE-UNKNOWN", brand_id: "BR-A", creator_id: "CR-A", stage: "不存在阶段" }, now);
  assert.equal(unknownStage.stage, "待开发");
  assert.equal(canTransitionCaseStage("已联系待回复", "初步沟通"), true);
  assert.equal(canTransitionCaseStage("待寄样", "已发布"), false, "Case 不能跳过人工确认的寄样和发布阶段。");
  assert.equal(canTransitionCaseStage("合作完成", "已结案"), true);
  assert.equal(canTransitionCaseStage("已结案", "初步沟通"), false);
}

function testCaseStageAuditContract() {
  const state = fixture();
  state.followUps = [{
    id: "FU-A",
    case_id: "CASE-A",
    brand_id: "BR-A",
    stage: "待寄样",
    has_unread_reply: true,
  }];

  assert.throws(
    () => recordCaseStageChange(state, {
      case_id: "CASE-A",
      follow_up_id: "FU-A",
      next_stage: "已寄样",
      actor: "人工操作",
    }, now),
    /必须填写原因/,
    "手动阶段变更不能没有原因。",
  );

  const result = recordCaseStageChange(state, {
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    next_stage: "已寄样",
    actor: "人工操作",
    source: "manual_stage_change",
    change_reason: "已确认收件地址并完成寄样交接。",
    evidence: "物流单已创建",
  }, now);
  assert.equal(result.case.stage, "已寄样");
  assert.equal(result.followUp.stage, "已寄样", "Case 与兼容 FollowUp 必须同步阶段。");
  assert.equal(result.followUp.has_unread_reply, false);
  assert.equal(result.case.version, 2, "阶段变更必须推进 Case 版本。");
  assert.equal(result.case.last_stage_change_reason, "已确认收件地址并完成寄样交接。");
  assert.equal(result.event.previous_stage, "待寄样");
  assert.equal(result.event.next_stage, "已寄样");
  assert.equal(result.event.case_version, 2);
  assert.equal(result.event.change_reason, "已确认收件地址并完成寄样交接。");
  assert.equal(result.event.evidence, "物流单已创建");
  assert.equal(result.event.brand_id, "BR-A");

  const aiResult = recordCaseStageChange(state, {
    case_id: "CASE-A",
    follow_up_id: "FU-A",
    next_stage: "运输中",
    actor: "人工确认",
    source: "ai_suggestion_confirmed",
    change_reason: "人工确认 AI 建议：已取得承运商揽收状态。",
    evidence: "AI 建议下一步：核对物流号",
  }, "2026-09-11T12:10:00.000Z");
  assert.equal(aiResult.event.source, "ai_suggestion_confirmed");
  assert.equal(aiResult.event.actor, "人工确认", "AI 建议必须有人工确认操作者。");
  assert.equal(aiResult.case.version, 3);

  state.followUps.push({
    id: "FU-CROSS-BRAND",
    case_id: "CASE-A",
    brand_id: "BR-B",
    stage: "待寄样",
  });
  assert.throws(
    () => recordCaseStageChange(state, {
      case_id: "CASE-A",
      follow_up_id: "FU-CROSS-BRAND",
      next_stage: "已寄样",
      change_reason: "测试跨品牌阻止。",
    }, now),
    /品牌不一致/,
    "阶段审计不能跨品牌写入 Case。",
  );
}

testCaseIsolationAndTriage();
testTaskLifecycle();
testAllGeneratedTaskRules();
testPersistedTaskContract();
testOptimisticLocking();
testCaseStageContract();
testCaseStageAuditContract();
console.log("PASS CRM regression: Case isolation, persistent action-task contract, manual mail triage, action task lifecycle, optimistic locking, and stage audit.");
