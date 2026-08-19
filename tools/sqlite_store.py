import json
import sqlite3
import sys
from pathlib import Path


SCHEMA = {
    "creators": {
        "id": "TEXT PRIMARY KEY",
        "brand": "TEXT",
        "name": "TEXT",
        "social_url": "TEXT",
        "email": "TEXT",
        "email_source": "TEXT",
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
        "brand": "TEXT",
        "social_url": "TEXT",
        "name": "TEXT",
        "platform": "TEXT",
        "country": "TEXT",
        "niche": "TEXT",
        "followers": "REAL",
        "avg_views": "REAL",
        "engagement": "REAL",
        "email": "TEXT",
        "email_source": "TEXT",
        "status": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "cooperations": {
        "id": "TEXT PRIMARY KEY",
        "creator_id": "TEXT",
        "resource_id": "TEXT",
        "match_id": "TEXT",
        "creator_name": "TEXT",
        "resource_name": "TEXT",
        "product": "TEXT",
        "model": "TEXT",
        "budget": "REAL",
        "post_date": "TEXT",
        "link": "TEXT",
        "clicks": "REAL",
        "orders": "REAL",
        "result": "TEXT",
        "notes": "TEXT",
        "createdAt": "TEXT",
        "updatedAt": "TEXT",
    },
    "matches": {
        "id": "TEXT PRIMARY KEY",
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
}


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
        column_sql = ", ".join(f"{name} {definition}" for name, definition in columns.items())
        conn.execute(f"CREATE TABLE IF NOT EXISTS {table} ({column_sql})")
        existing_columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        for name, definition in columns.items():
            if name in existing_columns or "PRIMARY KEY" in definition.upper():
                continue
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")

    conn.commit()


def table_count(conn, table):
    return conn.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()["count"]


def rows_to_state(conn):
    state = {
        "meta": {
            "version": 1,
            "updatedAt": current_time_iso(),
        },
        "creators": [],
        "resources": [],
        "leads": [],
        "cooperations": [],
        "matches": [],
        "importHistory": [],
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
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY updatedAt DESC, createdAt DESC").fetchall()
        state[table] = [row_to_dict(row) for row in rows]

    return state


def row_to_dict(row):
    payload = {key: row[key] for key in row.keys()}
    for key in ("beforeCounts", "snapshot", "selected_resource_ids"):
        if payload.get(key):
            try:
                payload[key] = json.loads(payload[key])
            except (TypeError, ValueError):
                pass
    return payload


def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def save_state(conn, state):
    create_schema(conn)
    payload = state or {}
    meta = payload.get("meta") or {}

    with conn:
        for table in SCHEMA:
            conn.execute(f"DELETE FROM {table}")

        conn.execute("DELETE FROM meta")
        for key, value in {
            **meta,
            "version": meta.get("version", 1),
            "updatedAt": meta.get("updatedAt") or current_time_iso(),
        }.items():
            if key == "version":
                stored_value = str(value)
            elif key == "updatedAt":
                stored_value = str(value)
            else:
                stored_value = json.dumps(value, ensure_ascii=False)
            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (str(key), stored_value))

        for table, columns in SCHEMA.items():
            rows = payload.get(table) or []
            keys = list(columns.keys())
            placeholders = ", ".join("?" for _ in keys)
            column_sql = ", ".join(keys)
            insert_sql = f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders})"

            for row in rows:
                values = [normalize_value(row.get(key)) for key in keys]
                conn.execute(insert_sql, values)


def seed_from_json_if_needed(conn, state_json_path):
    if any(table_count(conn, table) for table in ("creators", "resources", "leads", "cooperations", "matches")):
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
        save_state(conn, payload)
        state = rows_to_state(conn)
        write_json_mirror(state_json_path, state)
        print(json.dumps({"ok": True}, ensure_ascii=False))
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
