"""PostgreSQL baseline for the shared NOC persistence models.

Revision ID: 20260806_0001
Revises:
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260806_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.String(64), nullable=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(128), nullable=True),
        sa.Column("teams", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("department", sa.String(128), nullable=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("employee_id"), sa.UniqueConstraint("username"), sa.UniqueConstraint("email"),
    )
    for column in ("id", "employee_id", "username", "email", "status", "deleted_at"):
        op.create_index(
            f"ix_users_{column}", "users", [column],
            unique=column in {"employee_id", "username", "email"},
        )

    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("device_name", sa.String(255), nullable=False),
        sa.Column("ip", sa.String(64), nullable=False),
        sa.Column("device_type", sa.String(64), nullable=False),
        sa.Column("layer", sa.String(16), nullable=False),
        sa.Column("region", sa.String(64), nullable=False),
        sa.Column("site", sa.String(64), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("backup_owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("device_id"), sa.UniqueConstraint("ip"),
    )
    for column in ("id", "device_id", "ip", "status"):
        op.create_index(f"ix_devices_{column}", "devices", [column], unique=column in {"device_id", "ip"})

    op.create_table(
        "topology_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_device_id", sa.String(128), sa.ForeignKey("devices.device_id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_device_id", sa.String(128), sa.ForeignKey("devices.device_id", ondelete="CASCADE"), nullable=False),
        sa.Column("link_type", sa.String(16), nullable=False), sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("id", "source_device_id", "target_device_id"):
        op.create_index(f"ix_topology_links_{column}", "topology_links", [column])

    op.create_table(
        "device_history",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("action", sa.String(16), nullable=False), sa.Column("before_data", sa.Text(), nullable=True),
        sa.Column("after_data", sa.Text(), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("id", "device_id"):
        op.create_index(f"ix_device_history_{column}", "device_history", [column])

    op.create_table(
        "alarm_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("device_id", sa.String(128), sa.ForeignKey("devices.device_id", ondelete="CASCADE"), nullable=False),
        sa.Column("alarm", sa.String(255), nullable=False), sa.Column("status", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False), sa.Column("device_status", sa.String(16), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False), sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True), sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("id", "device_id", "status", "severity", "device_status", "start_time", "created_at"):
        op.create_index(f"ix_alarm_history_{column}", "alarm_history", [column])

    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("incident_id", sa.String(64), nullable=False),
        sa.Column("device_id", sa.String(128), sa.ForeignKey("devices.device_id", ondelete="CASCADE"), nullable=False),
        sa.Column("alarm_history_id", sa.Integer(), sa.ForeignKey("alarm_history.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alarm_type", sa.String(255), nullable=False), sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False), sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_time", sa.DateTime(timezone=True), nullable=True), sa.Column("recovered_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_time", sa.DateTime(timezone=True), nullable=True), sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("engineer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("root_cause", sa.Text(), nullable=True), sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("incident_id"), sa.UniqueConstraint("alarm_history_id"),
    )
    for column in ("id", "incident_id", "device_id", "alarm_history_id", "severity", "status", "operator_id", "engineer_id"):
        op.create_index(
            f"ix_incidents_{column}", "incidents", [column],
            unique=column in {"incident_id", "alarm_history_id"},
        )

    op.create_table(
        "incident_timeline",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False), sa.Column("from_status", sa.String(16), nullable=True),
        sa.Column("to_status", sa.String(16), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("id", "incident_id", "actor_user_id", "created_at"):
        op.create_index(f"ix_incident_timeline_{column}", "incident_timeline", [column])


def downgrade() -> None:
    for table in ("incident_timeline", "incidents", "alarm_history", "device_history", "topology_links", "devices", "users"):
        op.drop_table(table)
