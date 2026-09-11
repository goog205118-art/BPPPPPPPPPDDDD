const assert = require("node:assert/strict");
const {
  archiveTriageMail,
  canTransitionCaseStage,
  completeTask,
  createCase,
  patchVersionedRecord,
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
    followUpEvents: [{
      id: "EV-A-REPLY",
      brand_id: "BR-A",
      case_id: "CASE-A",
      direction: "inbound",
      needs_action: true,
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
  let result = reconcileCaseTasks(state, now);
  const types = result.created.map((task) => task.type).sort();
  assert.deepEqual(types, ["address_needed", "new_reply", "reply_overdue"]);

  result = reconcileCaseTasks(state, now);
  assert.equal(result.created.length, 0, "同一事实重复同步不能重复生成待办。");
  assert.equal(state.actionTasks.length, 3);

  const replyTask = state.actionTasks.find((task) => task.type === "new_reply");
  const completed = completeTask(state, replyTask.id, "已阅读并准备回复", now);
  assert.equal(completed.status, "已完成");
  assert.equal(completed.completion_evidence, "已阅读并准备回复");

  state.followUpEvents.find((item) => item.id === "EV-A-REPLY").needs_action = false;
  result = reconcileCaseTasks(state, "2026-09-11T13:00:00.000Z");
  assert.equal(result.invalidated.some((task) => task.type === "new_reply"), false, "已完成的任务不应被覆盖为失效。");

  state.cases.find((item) => item.id === "CASE-A").shipping_address = "Madrid, Spain";
  result = reconcileCaseTasks(state, "2026-09-11T14:00:00.000Z");
  assert.equal(
    state.actionTasks.find((task) => task.type === "address_needed").status,
    "已失效",
    "条件消失后尚未完成的自动任务应失效。",
  );
  assert.equal(result.created.some((task) => task.type === "sample_pending"), true);
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

testCaseIsolationAndTriage();
testTaskLifecycle();
testOptimisticLocking();
testCaseStageContract();
console.log("PASS CRM regression: Case isolation, manual mail triage, action task lifecycle, and optimistic locking.");
