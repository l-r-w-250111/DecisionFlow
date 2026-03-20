import enum
from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class StatusColumn(str, enum.Enum):
    DECIDABLE = "DECIDABLE"
    NOT_DECIDABLE = "NOT_DECIDABLE"
    DECIDED = "DECIDED"


class DecisionResult(str, enum.Enum):
    UNDECIDED = "UNDECIDED"
    GO = "GO"
    NO_GO = "NO_GO"
    HOLD = "HOLD"
    CONDITIONAL_GO = "CONDITIONAL_GO"
    PIVOT = "PIVOT"


class EvidenceStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class GateStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    OPEN = "OPEN"
    PASSED = "PASSED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_start_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    planned_end_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    actual_start_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    gates: Mapped[list["Gate"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    card_contexts: Mapped[list["DecisionCardContext"]] = relationship(back_populates="project")


class Gate(Base):
    __tablename__ = "gates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    planned_review_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    actual_review_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    gate_status: Mapped[GateStatus] = mapped_column(Enum(GateStatus), default=GateStatus.PLANNED, nullable=False)
    entry_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project: Mapped[Project] = relationship(back_populates="gates")
    card_contexts: Mapped[list["DecisionCardContext"]] = relationship(back_populates="gate")


class DecisionCard(Base):
    __tablename__ = "decision_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    decision_question: Mapped[str] = mapped_column(Text, nullable=False)
    status_column: Mapped[StatusColumn] = mapped_column(Enum(StatusColumn), default=StatusColumn.NOT_DECIDABLE, nullable=False)
    decision_result: Mapped[DecisionResult] = mapped_column(Enum(DecisionResult), default=DecisionResult.UNDECIDED, nullable=False)
    decision_due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    decider_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    summary_known: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_missing: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocker_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    evidence_items: Mapped[list["EvidenceItem"]] = relationship(back_populates="card", cascade="all, delete-orphan")
    logs: Mapped[list["DecisionLog"]] = relationship(back_populates="card", cascade="all, delete-orphan")
    context: Mapped["DecisionCardContext | None"] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
        uselist=False,
        foreign_keys="DecisionCardContext.decision_card_id",
    )


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    decision_card_id: Mapped[int] = mapped_column(ForeignKey("decision_cards.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[EvidenceStatus] = mapped_column(Enum(EvidenceStatus), default=EvidenceStatus.PLANNED, nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    card: Mapped[DecisionCard] = relationship(back_populates="evidence_items")


class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    decision_card_id: Mapped[int] = mapped_column(ForeignKey("decision_cards.id"), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    acted_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    acted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    card: Mapped[DecisionCard] = relationship(back_populates="logs")


class DecisionCardContext(Base):
    __tablename__ = "decision_card_contexts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    decision_card_id: Mapped[int] = mapped_column(ForeignKey("decision_cards.id"), nullable=False, unique=True, index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    gate_id: Mapped[int | None] = mapped_column(ForeignKey("gates.id"), nullable=True, index=True)
    gate_target_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    parent_card_id: Mapped[int | None] = mapped_column(ForeignKey("decision_cards.id"), nullable=True, index=True)
    review_meeting_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decision_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    gate_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    card: Mapped[DecisionCard] = relationship(back_populates="context", foreign_keys=[decision_card_id])
    parent_card: Mapped[DecisionCard | None] = relationship(foreign_keys=[parent_card_id])
    project: Mapped[Project | None] = relationship(back_populates="card_contexts")
    gate: Mapped[Gate | None] = relationship(back_populates="card_contexts")
