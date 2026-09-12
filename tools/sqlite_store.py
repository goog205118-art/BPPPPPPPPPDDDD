import json
import os
import sqlite3
import sys
from pathlib import Path


SCHEMA = {
    "brands": {
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT",
        "default_country": "TEXT",
        "default_language": "TEXT",
        "timezone": "TEXT",
        "currency": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "creators": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "name": "TEXT",
        "handle": "TEXT",
        "social_url": "TEXT",
        "email": "TEXT",
        "email_source": "TEXT",
        "first_contacted_at": "TEXT",
        "last_contacted_at": "TEXT",
        "last_outreach_at": "TEXT",
        "contact_channel": "TEXT",
        "country": "TEXT",
        "language": "TEXT",
        "platform": "TEXT",
        "niche": "TEXT",
        "followers": "REAL",
        "avg_views": "REAL",
        "engagement": "REAL",
        "audience": "TEXT",
        "competitor": "TEXT",
        "exchange": "TEXT",
        "cps": "TEXT",
        "price": "TEXT",
        "status": "TEXT",
        "priority": "TEXT",
        "longterm": "TEXT",
        "content_types": "TEXT",
        "ad_auth": "TEXT",
        "tags": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "resources": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "name": "TEXT",
        "type": "TEXT",
        "country": "TEXT",
        "categories": "TEXT",
        "users": "TEXT",
        "fee": "TEXT",
        "fee_amount": "REAL",
        "exclusivity": "TEXT",
        "coupon": "TEXT",
        "cycle": "TEXT",
        "historical_clicks": "REAL",
        "historical_orders": "REAL",
        "suitable_new": "TEXT",
        "suitable_clearance": "TEXT",
        "grade": "TEXT",
        "contact": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "leads": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "social_url": "TEXT",
        "name": "TEXT",
        "handle": "TEXT",
        "platform": "TEXT",
        "country": "TEXT",
        "niche": "TEXT",
        "followers": "REAL",
        "avg_views": "REAL",
        "engagement": "REAL",
        "email": "TEXT",
        "email_source": "TEXT",
        "source_mail_inbox_id": "TEXT",
        "source_mail_message_id": "TEXT",
        "source_mail_sender": "TEXT",
        "source_mail_occurred_at": "TEXT",
        "source_mail_subject": "TEXT",
        "source_mail_fingerprint": "TEXT",
        "source_mail_server_key": "TEXT",
        "source_mail_imap_uid": "TEXT",
        "last_outreach_at": "TEXT",
        "status": "TEXT",
        "priority": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "products": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "country": "TEXT",
        "category": "TEXT",
        "store": "TEXT",
        "name": "TEXT",
        "product_url": "TEXT",
        "image_url": "TEXT",
        "description": "TEXT",
        "tags": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "cooperations": {
        "id": "TEXT PRIMARY KEY",
        "follow_up_id": "TEXT",
        "case_id": "TEXT",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "cooperation_no": "TEXT",
        "creator_id": "TEXT",
        "resource_id": "TEXT",
        "match_id": "TEXT",
        "creator_name": "TEXT",
        "resource_name": "TEXT",
        "product": "TEXT",
        "product_id": "TEXT",
        "model": "TEXT",
        "budget": "REAL",
        "tracking_no": "TEXT",
        "shipping_status": "TEXT",
        "post_date": "TEXT",
        "link": "TEXT",
        "clicks": "REAL",
        "orders": "REAL",
        "result": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "cases": {
        "id": "TEXT PRIMARY KEY",
        "migration_source_follow_up_id": "TEXT",
        "migration_version": "REAL",
        "migration_created_at": "TEXT",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "creator_id": "TEXT",
        "lead_id": "TEXT",
        "cooperation_id": "TEXT",
        "product_ids": "TEXT",
        "stage": "TEXT",
        "priority": "TEXT",
        "cooperation_mode": "TEXT",
        "budget": "REAL",
        "quote_amount": "REAL",
        "shipping_address": "TEXT",
        "shipping_status": "TEXT",
        "tracking_no": "TEXT",
        "publish_due_at": "TEXT",
        "publish_url": "TEXT",
        "next_action": "TEXT",
        "next_action_at": "TEXT",
        "last_outreach_at": "TEXT",
        "notes": "TEXT",
        "version": "REAL",
        "last_stage_changed_at": "TEXT",
        "last_stage_changed_by": "TEXT",
        "last_stage_change_reason": "TEXT",
        "last_stage_change_source": "TEXT",
        "last_stage_change_event_id": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "actionTasks": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "case_id": "TEXT",
        "source": "TEXT",
        "source_id": "TEXT",
        "type": "TEXT",
        "title": "TEXT",
        "description": "TEXT",
        "owner_id": "TEXT",
        "owner_name": "TEXT",
        "priority": "TEXT",
        "due_at": "TEXT",
        "status": "TEXT",
        "completion_evidence": "TEXT",
        "completed_at": "TEXT",
        "defer_reason": "TEXT",
        "dedupe_key": "TEXT",
        "generated": "REAL",
        "validation_error": "TEXT",
        "version": "REAL",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "actionTaskEvents": {
        "id": "TEXT PRIMARY KEY",
        "task_id": "TEXT",
        "brand_id": "TEXT",
        "case_id": "TEXT",
        "type": "TEXT",
        "actor_id": "TEXT",
        "actor_name": "TEXT",
        "summary": "TEXT",
        "metadata": "TEXT",
        "occurred_at": "TEXT",
        "validation_error": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "matches": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "title": "TEXT",
        "country": "TEXT",
        "categories": "TEXT",
        "goal": "TEXT",
        "budget": "REAL",
        "exclusivity": "TEXT",
        "max_cycle_days": "REAL",
        "status": "TEXT",
        "selected_resource_ids": "TEXT",
        "result": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "followUps": {
        "id": "TEXT PRIMARY KEY",
        "case_id": "TEXT",
        "brand_id": "TEXT",
        "creator_id": "TEXT",
        "lead_id": "TEXT",
        "creator_name": "TEXT",
        "cooperation_id": "TEXT",
        "brand": "TEXT",
        "product_id": "TEXT",
        "stage": "TEXT",
        "priority": "TEXT",
        "cooperation_mode": "TEXT",
        "budget": "REAL",
        "next_action": "TEXT",
        "next_follow_up_at": "TEXT",
        "shipping_status": "TEXT",
        "tracking_no": "TEXT",
        "publish_due_at": "TEXT",
        "publish_url": "TEXT",
        "last_email_at": "TEXT",
        "has_unread_reply": "REAL",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "followUpEvents": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "mailbox_account_id": "TEXT",
        "case_id": "TEXT",
        "follow_up_id": "TEXT",
        "mail_inbox_id": "TEXT",
        "lead_id": "TEXT",
        "person_type": "TEXT",
        "person_id": "TEXT",
        "contact_track_id": "TEXT",
        "contact_id": "TEXT",
        "type": "TEXT",
        "occurred_at": "TEXT",
        "direction": "TEXT",
        "subject": "TEXT",
        "sender": "TEXT",
        "recipients": "TEXT",
        "excerpt": "TEXT",
        "body": "TEXT",
        "body_cached_at": "TEXT",
        "body_retention_until": "TEXT",
        "body_truncated": "REAL",
        "body_expired_at": "TEXT",
        "message_id": "TEXT",
        "in_reply_to": "TEXT",
        "references": "TEXT",
        "fingerprint": "TEXT",
        "source": "TEXT",
        "previous_stage": "TEXT",
        "next_stage": "TEXT",
        "actor": "TEXT",
        "change_reason": "TEXT",
        "evidence": "TEXT",
        "case_version": "REAL",
        "filename": "TEXT",
        "mailbox": "TEXT",
        "server_key": "TEXT",
        "imap_uid": "TEXT",
        "send_confirmed": "REAL",
        "signature_applied": "REAL",
        "signature_mode": "TEXT",
        "signature_has_image": "REAL",
        "delivery_status": "TEXT",
        "delivery_source": "TEXT",
        "delivery_event_at": "TEXT",
        "delivery_error": "TEXT",
        "delivery_code": "TEXT",
        "delivery_message_id": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "contactTracks": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "person_type": "TEXT",
        "person_id": "TEXT",
        "person_name": "TEXT",
        "contact_id": "TEXT",
        "email": "TEXT",
        "mailbox_account_id": "TEXT",
        "last_outbound_at": "TEXT",
        "last_outbound_subject": "TEXT",
        "status": "TEXT",
        "follow_up_id": "TEXT",
        "case_id": "TEXT",
        "replied_at": "TEXT",
        "source": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "contacts": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "brand": "TEXT",
        "person_type": "TEXT",
        "person_id": "TEXT",
        "name": "TEXT",
        "email": "TEXT",
        "role": "TEXT",
        "is_primary": "REAL",
        "validity": "TEXT",
        "unsubscribed": "REAL",
        "unsubscribed_at": "TEXT",
        "blacklisted": "REAL",
        "blacklist_reason": "TEXT",
        "blacklisted_at": "TEXT",
        "delivery_status": "TEXT",
        "last_delivery_event_at": "TEXT",
        "last_delivery_error": "TEXT",
        "is_deleted": "REAL",
        "deleted_at": "TEXT",
        "deleted_by": "TEXT",
        "deletion_reason": "TEXT",
        "deletion_source": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "mailInbox": {
        "id": "TEXT PRIMARY KEY",
        "brand_id": "TEXT",
        "case_id": "TEXT",
        "lead_id": "TEXT",
        "mailbox_account_id": "TEXT",
        "type": "TEXT",
        "occurred_at": "TEXT",
        "direction": "TEXT",
        "subject": "TEXT",
        "sender": "TEXT",
        "recipients": "TEXT",
        "excerpt": "TEXT",
        "body": "TEXT",
        "body_cached_at": "TEXT",
        "body_retention_until": "TEXT",
        "body_truncated": "REAL",
        "body_expired_at": "TEXT",
        "message_id": "TEXT",
        "fingerprint": "TEXT",
        "in_reply_to": "TEXT",
        "references": "TEXT",
        "source": "TEXT",
        "mailbox": "TEXT",
        "server_key": "TEXT",
        "imap_uid": "TEXT",
        "status": "TEXT",
        "matched_creator_id": "TEXT",
        "matched_creator_name": "TEXT",
        "matched_contact_id": "TEXT",
        "candidate_creator_ids": "TEXT",
        "candidate_lead_ids": "TEXT",
        "candidate_brand_ids": "TEXT",
        "candidate_follow_up_ids": "TEXT",
        "candidate_case_ids": "TEXT",
        "match_disposition": "TEXT",
        "match_score": "REAL",
        "match_reasons": "TEXT",
        "match_candidates": "TEXT",
        "triage_status": "TEXT",
        "triage_reason": "TEXT",
        "triage_resolved_at": "TEXT",
        "triage_resolved_by": "TEXT",
        "delivery_notification": "REAL",
        "delivery_match_status": "TEXT",
        "delivery_status": "TEXT",
        "delivery_source": "TEXT",
        "delivery_event_at": "TEXT",
        "delivery_error": "TEXT",
        "delivery_code": "TEXT",
        "delivery_message_id": "TEXT",
        "delivery_target_event_id": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "importHistory": {
        "id": "TEXT PRIMARY KEY",
        "type": "TEXT",
        "filename": "TEXT",
        "totalRows": "REAL",
        "createdCount": "REAL",
        "updatedCount": "REAL",
        "skippedCount": "REAL",
        "beforeCounts": "TEXT",
        "snapshot": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "complianceAudit": {
        "id": "TEXT PRIMARY KEY",
        "action": "TEXT",
        "brand_id": "TEXT",
        "contact_id": "TEXT",
        "scopes": "TEXT",
        "request_id": "TEXT",
        "actor_id": "TEXT",
        "actor_name": "TEXT",
        "source": "TEXT",
        "reason": "TEXT",
        "affected_email_bodies": "REAL",
        "affected_follow_up_events": "REAL",
        "affected_mail_inbox": "REAL",
        "affected_contacts": "REAL",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
}


def sql_identifier(value):
    return '"' + str(value).replace('"', '""') + '"'


def connect(db_path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def create_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )
        """
    )

    for table, columns in SCHEMA.items():
        table_id = sql_identifier(table)
        column_sql = ", ".join(f"{sql_identifier(name)} {definition}" for name, definition in columns.items())
        conn.execute(f"CREATE TABLE IF NOT EXISTS {table_id} ({column_sql})")
        existing_columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table_id})")}
        for name, definition in columns.items():
            if name in existing_columns or "PRIMARY KEY" in definition.upper():
                continue
            conn.execute(f"ALTER TABLE {table_id} ADD COLUMN {sql_identifier(name)} {definition}")

    conn.commit()


def table_count(conn, table):
    return conn.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()["count"]


def rows_to_state(conn):
    state = {
        "meta": {
            "version": 1,
            "updatedAt": current_time_iso(),
        },
        "brands": [],
        "creators": [],
        "resources": [],
        "leads": [],
        "products": [],
        "cooperations": [],
        "matches": [],
        "followUps": [],
        "cases": [],
        "actionTasks": [],
        "actionTaskEvents": [],
        "followUpEvents": [],
        "contacts": [],
        "mailInbox": [],
        "contactTracks": [],
        "importHistory": [],
        "complianceAudit": [],
    }

    meta_rows = conn.execute("SELECT key, value FROM meta").fetchall()
    for row in meta_rows:
        if row["key"] == "version":
            try:
                state["meta"][row["key"]] = int(row["value"])
            except (TypeError, ValueError):
                state["meta"][row["key"]] = row["value"]
        elif row["key"] == "updatedAt":
            state["meta"][row["key"]] = row["value"]
        else:
            try:
                state["meta"][row["key"]] = json.loads(row["value"])
            except (TypeError, ValueError):
                state["meta"][row["key"]] = row["value"]

    for table in SCHEMA:
        table_id = sql_identifier(table)
        rows = conn.execute(f"SELECT * FROM {table_id} ORDER BY {sql_identifier('updatedAt')} DESC, {sql_identifier('createdAt')} DESC").fetchall()
        state[table] = [row_to_dict(row) for row in rows]

    return state


def row_to_dict(row):
    payload = {key: row[key] for key in row.keys()}
    if "has_unread_reply" in payload:
        payload["has_unread_reply"] = parse_flag(payload["has_unread_reply"])
    if "generated" in payload:
        payload["generated"] = parse_flag(payload["generated"])
    if "delivery_notification" in payload:
        payload["delivery_notification"] = parse_flag(payload["delivery_notification"])
    for key in ("is_primary", "unsubscribed", "blacklisted", "is_deleted"):
        if key in payload:
            payload[key] = parse_flag(payload[key])
    for key in ("beforeCounts", "snapshot", "selected_resource_ids", "product_ids", "candidate_creator_ids", "candidate_lead_ids", "candidate_brand_ids", "candidate_follow_up_ids", "candidate_case_ids", "match_reasons", "match_candidates", "references", "metadata", "scopes"):
        if payload.get(key):
            try:
                payload[key] = json.loads(payload[key])
            except (TypeError, ValueError):
                pass
    return payload


def parse_flag(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "y", "是", "有"}


def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def recovery_backup_path(db_path):
    return Path(f"{db_path}.bak")


def create_recovery_backup(conn, db_path):
    """Create a self-contained backup before a state transaction starts."""
    backup_path = recovery_backup_path(db_path)
    temp_path = backup_path.with_name(f".{backup_path.name}.{os.getpid()}.tmp")
    if temp_path.exists():
        temp_path.unlink()

    conn.commit()
    backup_conn = sqlite3.connect(temp_path)
    try:
        conn.backup(backup_conn)
        backup_conn.commit()
    finally:
        backup_conn.close()
    os.replace(temp_path, backup_path)


def restore_recovery_backup(conn, db_path):
    backup_path = recovery_backup_path(db_path)
    if not backup_path.exists():
        raise FileNotFoundError("当前 SQLite 没有可恢复备份。")

    conn.commit()
    backup_conn = sqlite3.connect(backup_path)
    try:
        backup_conn.backup(conn)
        conn.commit()
    finally:
        backup_conn.close()


def row_values(table, row, keys):
    if not isinstance(row, dict):
        raise ValueError(f"{table} 中存在无效记录。")
    if row.get("id") is None or str(row.get("id")).strip() == "":
        raise ValueError(f"{table} 中存在缺少 id 的记录，已拒绝保存。")
    return [
        int(parse_flag(row.get(key)))
        if (table == "followUps" and key == "has_unread_reply")
        or (table == "actionTasks" and key == "generated")
        else normalize_value(row.get(key))
        for key in keys
    ]


def upsert_table(conn, table, columns, rows):
    keys = list(columns.keys())
    table_id = sql_identifier(table)
    column_sql = ", ".join(sql_identifier(key) for key in keys)
    placeholders = ", ".join("?" for _ in keys)
    update_columns = [key for key in keys if key != "id"]
    update_sql = ", ".join(
        f"{sql_identifier(key)} = excluded.{sql_identifier(key)}" for key in update_columns
    )
    insert_sql = (
        f"INSERT INTO {table_id} ({column_sql}) VALUES ({placeholders}) "
        f"ON CONFLICT({sql_identifier('id')}) DO UPDATE SET {update_sql}"
    )

    incoming_ids = set()
    for row in rows:
        values = row_values(table, row, keys)
        incoming_ids.add(str(row["id"]))
        conn.execute(insert_sql, values)

    existing_ids = [
        str(row["id"])
        for row in conn.execute(f"SELECT {sql_identifier('id')} AS id FROM {table_id}").fetchall()
    ]
    removed_ids = [record_id for record_id in existing_ids if record_id not in incoming_ids]
    if removed_ids:
        delete_sql = f"DELETE FROM {table_id} WHERE {sql_identifier('id')} = ?"
        conn.executemany(delete_sql, ((record_id,) for record_id in removed_ids))


def save_state(conn, state, db_path=None):
    create_schema(conn)
    payload = dict(state or {})
    meta = payload.get("meta") or {}
    expected_raw = payload.get("expectedVersion")
    expected_version = None
    if expected_raw is not None and str(expected_raw).strip() != "":
        try:
            expected_version = int(expected_raw)
        except (TypeError, ValueError):
            raise ValueError("保存请求的版本号无效。")

    current = rows_to_state(conn)
    actual_version = max(1, int(current.get("meta", {}).get("version", 1) or 1))
    if expected_version is not None and expected_version != actual_version:
        return {
            "ok": False,
            "code": "version_conflict",
            "actualVersion": actual_version,
            "current": current,
        }

    payload.pop("expectedVersion", None)
    next_version = actual_version + 1
    payload["meta"] = {
        **meta,
        "version": next_version,
        "updatedAt": meta.get("updatedAt") or current_time_iso(),
    }

    resolved_db_path = db_path
    if resolved_db_path is None:
        resolved_db_path = Path(conn.execute("PRAGMA database_list").fetchone()[2])
    create_recovery_backup(conn, Path(resolved_db_path))
    with conn:
        stored_meta = {**current.get("meta", {}), **payload["meta"]}
        stored_meta["version"] = next_version
        stored_meta["updatedAt"] = payload["meta"]["updatedAt"]
        for key, value in stored_meta.items():
            if key == "version":
                stored_value = str(value)
            elif key == "updatedAt":
                stored_value = str(value)
            else:
                stored_value = json.dumps(value, ensure_ascii=False)
            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (str(key), stored_value))

        for table, columns in SCHEMA.items():
            if table not in payload:
                continue
            upsert_table(conn, table, columns, payload.get(table) or [])
    return {"ok": True, "version": next_version}


def seed_from_json_if_needed(conn, state_json_path):
    if any(table_count(conn, table) for table in ("creators", "resources", "leads", "products", "cooperations", "matches")):
        return

    if state_json_path.exists():
        try:
            with state_json_path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            save_state(conn, payload)
        except Exception:
            pass


def write_json_mirror(state_json_path, state):
    state_json_path.parent.mkdir(parents=True, exist_ok=True)
    with state_json_path.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2)


def load_ai_settings(conn):
    row = conn.execute("SELECT value FROM ai_settings WHERE key = ?", ("profiles",)).fetchone()
    if not row:
        return {}
    try:
        return json.loads(row["value"])
    except (TypeError, ValueError):
        return {}


def save_ai_settings(conn, settings):
    payload = json.dumps(settings or {}, ensure_ascii=False)
    with conn:
        conn.execute(
            "INSERT OR REPLACE INTO ai_settings (key, value, updatedAt) VALUES (?, ?, ?)",
            ("profiles", payload, current_time_iso()),
        )


def current_time_iso():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def main():
    if len(sys.argv) < 4:
        raise SystemExit("Usage: sqlite_store.py <command> <db_path> <state_json_path>")

    command = sys.argv[1]
    db_path = Path(sys.argv[2])
    state_json_path = Path(sys.argv[3])

    conn = connect(db_path)
    create_schema(conn)
    seed_from_json_if_needed(conn, state_json_path)

    if command == "load_ai_settings":
        print(json.dumps(load_ai_settings(conn), ensure_ascii=False))
        return

    if command == "save_ai_settings":
        body = sys.stdin.read().strip() or "{}"
        payload = json.loads(body)
        save_ai_settings(conn, payload)
        print(json.dumps({"ok": True}, ensure_ascii=False))
        return

    if command == "load_state":
        state = rows_to_state(conn)
        print(json.dumps(state, ensure_ascii=False))
        return

    if command == "save_state":
        body = sys.stdin.read().strip() or "{}"
        payload = json.loads(body)
        result = save_state(conn, payload, db_path)
        if result and result.get("ok") is False:
            print(json.dumps(result, ensure_ascii=False))
            return
        state = rows_to_state(conn)
        write_json_mirror(state_json_path, state)
        print(json.dumps({"ok": True, "version": state["meta"]["version"]}, ensure_ascii=False))
        return

    if command == "restore_backup":
        restore_recovery_backup(conn, db_path)
        state = rows_to_state(conn)
        write_json_mirror(state_json_path, state)
        print(json.dumps({"ok": True, "version": state["meta"]["version"]}, ensure_ascii=False))
        return

    if command == "export_csv":
        if len(sys.argv) < 5:
            raise SystemExit("Usage: sqlite_store.py export_csv <db_path> <state_json_path> <table>")
        table = sys.argv[4]
        if table not in SCHEMA:
            print("")
            return
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY updatedAt DESC, createdAt DESC").fetchall()
        if not rows:
            print("")
            return
        headers = list(rows[0].keys())
        lines = [",".join(csv_escape(header) for header in headers)]
        for row in rows:
            lines.append(",".join(csv_escape(row[header]) for header in headers))
        print("\n".join(lines))
        return

    raise SystemExit(f"Unknown command: {command}")


def csv_escape(value):
    text = "" if value is None else str(value)
    if any(char in text for char in ['"', ",", "\n", "\r"]):
        return '"' + text.replace('"', '""') + '"'
    return text


if __name__ == "__main__":
    main()
