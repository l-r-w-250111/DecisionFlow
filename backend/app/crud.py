from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import models, schemas


CARD_LOAD_OPTIONS = (
    selectinload(models.DecisionCard.evidence_items),
    selectinload(models.DecisionCard.logs),
    selectinload(models.DecisionCard.context).selectinload(models.DecisionCardContext.project),
    selectinload(models.DecisionCard.context).selectinload(models.DecisionCardContext.gate),
)


def create_card(db: Session, payload: schemas.DecisionCardCreate) -> models.DecisionCard:
    card = models.DecisionCard(**payload.model_dump())
    db.add(card)
    db.flush()
    db.add(models.DecisionLog(decision_card_id=card.id, action_type="created", acted_by=payload.owner_name))
    db.commit()
    return get_card(db, card.id)


def list_cards(db: Session) -> list[models.DecisionCard]:
    stmt = select(models.DecisionCard).options(*CARD_LOAD_OPTIONS).order_by(models.DecisionCard.updated_at.desc())
    return list(db.scalars(stmt).all())


def list_review_cards(db: Session, project_id: int | None = None, gate_id: int | None = None) -> list[models.DecisionCard]:
    stmt = (
        select(models.DecisionCard)
        .join(models.DecisionCard.context, isouter=True)
        .options(*CARD_LOAD_OPTIONS)
        .where(models.DecisionCard.status_column == models.StatusColumn.DECIDABLE)
    )
    if project_id is not None:
        stmt = stmt.where(models.DecisionCardContext.project_id == project_id)
    if gate_id is not None:
        stmt = stmt.where(models.DecisionCardContext.gate_id == gate_id)
    stmt = stmt.order_by(models.DecisionCard.decision_due_date.asc().nulls_last(), models.DecisionCard.updated_at.desc())
    return list(db.scalars(stmt).unique().all())


def get_card(db: Session, card_id: int) -> models.DecisionCard | None:
    stmt = select(models.DecisionCard).where(models.DecisionCard.id == card_id).options(*CARD_LOAD_OPTIONS)
    return db.scalars(stmt).first()


def update_card(db: Session, card: models.DecisionCard, payload: schemas.DecisionCardUpdate) -> models.DecisionCard:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.add(models.DecisionLog(decision_card_id=card.id, action_type="updated", acted_by=payload.owner_name))
    db.commit()
    return get_card(db, card.id)


def decide_card(db: Session, card: models.DecisionCard, payload: schemas.DecisionAction) -> models.DecisionCard:
    card.decision_result = payload.decision_result
    card.status_column = models.StatusColumn.DECIDED
    card.decided_at = datetime.utcnow()
    db.add(models.DecisionLog(decision_card_id=card.id, action_type="decided", comment=payload.comment, acted_by=payload.acted_by))
    db.commit()
    return get_card(db, card.id)


def reopen_card(db: Session, card: models.DecisionCard, payload: schemas.ReopenAction) -> models.DecisionCard:
    card.decision_result = models.DecisionResult.UNDECIDED
    card.status_column = payload.status_column
    card.decided_at = None
    db.add(models.DecisionLog(decision_card_id=card.id, action_type="reopened", comment=payload.reason, acted_by=payload.acted_by))
    db.commit()
    return get_card(db, card.id)


def create_evidence_item(db: Session, card_id: int, payload: schemas.EvidenceItemCreate) -> models.EvidenceItem:
    item = models.EvidenceItem(decision_card_id=card_id, **payload.model_dump())
    db.add(item)
    db.add(models.DecisionLog(decision_card_id=card_id, action_type="evidence_added", comment=payload.title, acted_by=payload.owner_name))
    db.commit()
    db.refresh(item)
    return item


def dashboard_summary(db: Session) -> schemas.DashboardSummary:
    today = date.today()
    total_cards = db.scalar(select(func.count(models.DecisionCard.id))) or 0
    undecided_cards = db.scalar(select(func.count(models.DecisionCard.id)).where(models.DecisionCard.decision_result == models.DecisionResult.UNDECIDED)) or 0
    decidable_cards = db.scalar(select(func.count(models.DecisionCard.id)).where(models.DecisionCard.status_column == models.StatusColumn.DECIDABLE)) or 0
    not_decidable_cards = db.scalar(select(func.count(models.DecisionCard.id)).where(models.DecisionCard.status_column == models.StatusColumn.NOT_DECIDABLE)) or 0
    decided_cards = db.scalar(select(func.count(models.DecisionCard.id)).where(models.DecisionCard.status_column == models.StatusColumn.DECIDED)) or 0
    overdue_cards = db.scalar(select(func.count(models.DecisionCard.id)).where(models.DecisionCard.status_column != models.StatusColumn.DECIDED, models.DecisionCard.decision_due_date.is_not(None), models.DecisionCard.decision_due_date < today)) or 0
    return schemas.DashboardSummary(total_cards=total_cards, undecided_cards=undecided_cards, decidable_cards=decidable_cards, not_decidable_cards=not_decidable_cards, decided_cards=decided_cards, overdue_cards=overdue_cards)


def list_projects(db: Session) -> list[models.Project]:
    return list(db.scalars(select(models.Project).order_by(models.Project.updated_at.desc(), models.Project.id.desc())).all())


def create_project(db: Session, payload: schemas.ProjectCreate) -> models.Project:
    project = models.Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project(db: Session, project_id: int) -> models.Project | None:
    return db.scalars(select(models.Project).where(models.Project.id == project_id)).first()


def update_project(db: Session, project: models.Project, payload: schemas.ProjectUpdate) -> models.Project:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def list_gates(db: Session, project_id: int | None = None) -> list[models.Gate]:
    stmt = select(models.Gate)
    if project_id is not None:
        stmt = stmt.where(models.Gate.project_id == project_id)
    stmt = stmt.order_by(models.Gate.project_id.asc(), models.Gate.sequence_no.asc(), models.Gate.id.asc())
    return list(db.scalars(stmt).all())


def create_gate(db: Session, project_id: int, payload: schemas.GateCreate) -> models.Gate:
    gate = models.Gate(project_id=project_id, **payload.model_dump())
    db.add(gate)
    db.commit()
    db.refresh(gate)
    return gate


def get_gate(db: Session, gate_id: int) -> models.Gate | None:
    return db.scalars(select(models.Gate).where(models.Gate.id == gate_id)).first()


def update_gate(db: Session, gate: models.Gate, payload: schemas.GateUpdate) -> models.Gate:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(gate, field, value)
    db.commit()
    db.refresh(gate)
    return gate


def get_card_context(db: Session, card_id: int) -> models.DecisionCardContext | None:
    stmt = select(models.DecisionCardContext).where(models.DecisionCardContext.decision_card_id == card_id).options(selectinload(models.DecisionCardContext.project), selectinload(models.DecisionCardContext.gate))
    return db.scalars(stmt).first()


def upsert_card_context(db: Session, card_id: int, payload: schemas.DecisionCardContextUpsert) -> models.DecisionCardContext:
    context = get_card_context(db, card_id)
    if context is None:
        context = models.DecisionCardContext(decision_card_id=card_id)
        db.add(context)
        db.flush()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(context, field, value)
    db.commit()
    return get_card_context(db, card_id)
