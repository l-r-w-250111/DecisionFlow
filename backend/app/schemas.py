from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import DecisionResult, EvidenceStatus, GateStatus, StatusColumn


class EvidenceItemBase(BaseModel):
    type: str = "general"
    title: str
    status: EvidenceStatus = EvidenceStatus.PLANNED
    owner_name: Optional[str] = None
    due_date: Optional[date] = None
    link_url: Optional[str] = None
    note: Optional[str] = None


class EvidenceItemCreate(EvidenceItemBase):
    pass


class EvidenceItemRead(EvidenceItemBase):
    id: int

    class Config:
        from_attributes = True


class DecisionLogRead(BaseModel):
    id: int
    action_type: str
    comment: Optional[str] = None
    acted_by: Optional[str] = None
    acted_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = None
    description: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sequence_no: int = Field(default=1, ge=1)
    planned_review_date: Optional[date] = None
    actual_review_date: Optional[date] = None
    gate_status: GateStatus = GateStatus.PLANNED
    entry_criteria: Optional[str] = None
    exit_criteria: Optional[str] = None


class GateCreate(GateBase):
    pass


class GateUpdate(BaseModel):
    name: Optional[str] = None
    sequence_no: Optional[int] = Field(default=None, ge=1)
    planned_review_date: Optional[date] = None
    actual_review_date: Optional[date] = None
    gate_status: Optional[GateStatus] = None
    entry_criteria: Optional[str] = None
    exit_criteria: Optional[str] = None


class GateRead(GateBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DecisionCardContextBase(BaseModel):
    project_id: Optional[int] = None
    gate_id: Optional[int] = None
    gate_target_date: Optional[date] = None
    parent_card_id: Optional[int] = None
    review_meeting_label: Optional[str] = None
    decision_criteria: Optional[str] = None
    gate_required: bool = False


class DecisionCardContextUpsert(DecisionCardContextBase):
    pass


class DecisionCardContextRead(DecisionCardContextBase):
    id: int
    decision_card_id: int
    created_at: datetime
    updated_at: datetime
    project: Optional[ProjectRead] = None
    gate: Optional[GateRead] = None

    class Config:
        from_attributes = True


class DecisionCardBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    decision_question: str = Field(..., min_length=1)
    status_column: StatusColumn = StatusColumn.NOT_DECIDABLE
    decision_due_date: Optional[date] = None
    owner_name: Optional[str] = None
    decider_name: Optional[str] = None
    summary_known: Optional[str] = None
    summary_missing: Optional[str] = None
    next_plan: Optional[str] = None
    blocker_type: Optional[str] = None
    priority: Optional[str] = None
    risk_level: Optional[str] = None


class DecisionCardCreate(DecisionCardBase):
    pass


class DecisionCardUpdate(BaseModel):
    title: Optional[str] = None
    decision_question: Optional[str] = None
    status_column: Optional[StatusColumn] = None
    decision_due_date: Optional[date] = None
    owner_name: Optional[str] = None
    decider_name: Optional[str] = None
    summary_known: Optional[str] = None
    summary_missing: Optional[str] = None
    next_plan: Optional[str] = None
    blocker_type: Optional[str] = None
    priority: Optional[str] = None
    risk_level: Optional[str] = None


class DecisionAction(BaseModel):
    decision_result: DecisionResult
    acted_by: Optional[str] = None
    comment: Optional[str] = None


class ReopenAction(BaseModel):
    status_column: StatusColumn
    acted_by: Optional[str] = None
    reason: str = Field(..., min_length=1)


class DecisionCardRead(DecisionCardBase):
    id: int
    decision_result: DecisionResult
    created_at: datetime
    updated_at: datetime
    decided_at: Optional[datetime] = None
    evidence_items: list[EvidenceItemRead] = []
    logs: list[DecisionLogRead] = []
    context: Optional[DecisionCardContextRead] = None

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    total_cards: int
    undecided_cards: int
    decidable_cards: int
    not_decidable_cards: int
    decided_cards: int
    overdue_cards: int
