"""One-time, fail-fast SQLite to PostgreSQL data transfer.

Run Alembic against the destination first. This script never modifies or deletes
the SQLite file and refuses to merge into a non-empty destination.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import MetaData, create_engine, func, inspect, select, text

from fastapi_app.database import Base
from fastapi_app import models  # noqa: F401

TABLE_ORDER = (
    "users", "devices", "topology_links", "device_history",
    "alarm_history", "incidents", "incident_timeline",
)
DUPLICATE_KEYS = {
    "users": ("username", "email", "employee_id"),
    "incidents": ("incident_id",),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="sqlite:///./fastapi_app/noc.db")
    parser.add_argument("--target", required=True, help="postgresql+psycopg://...")
    return parser.parse_args()


def duplicates(connection, table, column: str) -> list[tuple[Any, int]]:
    statement = (
        select(table.c[column], func.count())
        .where(table.c[column].is_not(None))
        .group_by(table.c[column]).having(func.count() > 1)
    )
    return [(value, count) for value, count in connection.execute(statement)]


def comparable(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return value


def main() -> int:
    args = parse_args()
    if not args.source.startswith("sqlite:"):
        raise SystemExit("--source must be a SQLite SQLAlchemy URL")
    if not args.target.startswith(("postgresql+psycopg:", "postgresql:")):
        raise SystemExit("--target must be a PostgreSQL SQLAlchemy URL")
    source_path = args.source.removeprefix("sqlite:///")
    if source_path and not Path(source_path).exists():
        raise SystemExit(f"SQLite source does not exist: {source_path}")

    source_engine = create_engine(args.source, connect_args={"check_same_thread": False})
    target_engine = create_engine(args.target, pool_pre_ping=True)
    source_meta = MetaData()
    source_meta.reflect(bind=source_engine)
    missing_source = [name for name in TABLE_ORDER if name not in source_meta.tables]
    missing_target = [name for name in TABLE_ORDER if not inspect(target_engine).has_table(name)]
    if missing_source or missing_target:
        raise SystemExit(f"Missing tables; source={missing_source}, target={missing_target}")

    with source_engine.connect() as source, target_engine.begin() as target:
        problems: list[str] = []
        for table_name, columns in DUPLICATE_KEYS.items():
            for column in columns:
                found = duplicates(source, source_meta.tables[table_name], column)
                if found:
                    problems.append(f"{table_name}.{column}: {found}")
        if problems:
            raise SystemExit("Duplicate values found; nothing copied:\n" + "\n".join(problems))

        occupied = {
            name: target.scalar(select(func.count()).select_from(Base.metadata.tables[name]))
            for name in TABLE_ORDER
        }
        if any(occupied.values()):
            raise SystemExit(f"Destination is not empty; nothing copied: {occupied}")

        source_rows: dict[str, list[dict[str, Any]]] = {}
        for name in TABLE_ORDER:
            source_table = source_meta.tables[name]
            target_table = Base.metadata.tables[name]
            target_columns = {column.name for column in target_table.columns}
            rows = [
                {key: value for key, value in dict(row._mapping).items() if key in target_columns}
                for row in source.execute(select(source_table))
            ]
            required = {c.name for c in target_table.columns if not c.nullable and c.default is None and not c.primary_key}
            for index, row in enumerate(rows, 1):
                nulls = sorted(key for key in required if row.get(key) is None)
                if nulls:
                    raise SystemExit(f"NULL violation in {name} source row {index}: {nulls}")
            if rows:
                target.execute(target_table.insert(), rows)
            source_rows[name] = rows

        for name in TABLE_ORDER:
            table = Base.metadata.tables[name]
            if "id" in table.c:
                target.execute(text(
                    "SELECT setval(pg_get_serial_sequence(:table_name, 'id'), "
                    "COALESCE((SELECT MAX(id) FROM \"" + name + "\"), 1), "
                    "(SELECT COUNT(*) > 0 FROM \"" + name + "\"))"
                ), {"table_name": name})

        results = {}
        for name in TABLE_ORDER:
            table = Base.metadata.tables[name]
            copied = [dict(row._mapping) for row in target.execute(select(table).order_by(table.c.id))]
            original = sorted(source_rows[name], key=lambda row: row["id"])
            source_signatures = Counter(tuple((k, comparable(v)) for k, v in sorted(row.items())) for row in original)
            target_signatures = Counter(
                tuple((k, comparable(row[k])) for k in sorted(original[0])) for row in copied
            ) if original else Counter()
            if len(original) != len(copied) or source_signatures != target_signatures:
                raise RuntimeError(f"Post-copy verification failed for {name}")
            results[name] = len(copied)

    print("Migration committed; SQLite source was left unchanged.")
    for name, count in results.items():
        print(f"{name}: source={count} target={count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
