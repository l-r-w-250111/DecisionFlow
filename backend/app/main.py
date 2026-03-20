from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .config import settings
from .db import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Decision-Flow PM API", version="0.1.0")

origins = [origin.strip() for origin in settings.cors_origins.split(',') if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.get('/api/cards', response_model=list[schemas.DecisionCardRead])
def list_cards(db: Session = Depends(get_db)):
    return crud.list_cards(db)


@app.get('/api/review/queue', response_model=list[schemas.DecisionCardRead])
def get_review_queue(project_id: int | None = Query(default=None), gate_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    if gate_id is not None:
        gate = crud.get_gate(db, gate_id)
        if not gate:
            raise HTTPException(status_code=404, detail='Gate not found')
        if project_id is not None and gate.project_id != project_id:
            raise HTTPException(status_code=400, detail='Gate does not belong to project_id')
        if project_id is None:
            project_id = gate.project_id
    if project_id is not None:
        project = crud.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail='Project not found')
    return crud.list_review_cards(db, project_id=project_id, gate_id=gate_id)


@app.post('/api/cards', response_model=schemas.DecisionCardRead, status_code=201)
def create_card(payload: schemas.DecisionCardCreate, db: Session = Depends(get_db)):
    return crud.create_card(db, payload)


@app.get('/api/cards/{card_id}', response_model=schemas.DecisionCardRead)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    return card


@app.patch('/api/cards/{card_id}', response_model=schemas.DecisionCardRead)
def update_card(card_id: int, payload: schemas.DecisionCardUpdate, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    return crud.update_card(db, card, payload)


@app.post('/api/cards/{card_id}/decide', response_model=schemas.DecisionCardRead)
def decide_card(card_id: int, payload: schemas.DecisionAction, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    return crud.decide_card(db, card, payload)


@app.post('/api/cards/{card_id}/reopen', response_model=schemas.DecisionCardRead)
def reopen_card(card_id: int, payload: schemas.ReopenAction, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    if card.status_column != models.StatusColumn.DECIDED:
        raise HTTPException(status_code=400, detail='Only decided cards can be reopened')
    if payload.status_column == models.StatusColumn.DECIDED:
        raise HTTPException(status_code=400, detail='Reopened card must move to DECIDABLE or NOT_DECIDABLE')
    return crud.reopen_card(db, card, payload)


@app.post('/api/cards/{card_id}/evidence', response_model=schemas.EvidenceItemRead, status_code=201)
def create_evidence_item(card_id: int, payload: schemas.EvidenceItemCreate, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    return crud.create_evidence_item(db, card_id, payload)


@app.get('/api/cards/{card_id}/context', response_model=schemas.DecisionCardContextRead | None)
def get_card_context(card_id: int, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    return crud.get_card_context(db, card_id)


@app.put('/api/cards/{card_id}/context', response_model=schemas.DecisionCardContextRead)
def upsert_card_context(card_id: int, payload: schemas.DecisionCardContextUpsert, db: Session = Depends(get_db)):
    card = crud.get_card(db, card_id)
    if not card:
        raise HTTPException(status_code=404, detail='Card not found')
    if payload.parent_card_id is not None:
        parent_card = crud.get_card(db, payload.parent_card_id)
        if not parent_card:
            raise HTTPException(status_code=404, detail='Parent card not found')
        if payload.parent_card_id == card_id:
            raise HTTPException(status_code=400, detail='parent_card_id cannot equal card_id')
    project_id = payload.project_id
    if project_id is not None:
        project = crud.get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail='Project not found')
    if payload.gate_id is not None:
        gate = crud.get_gate(db, payload.gate_id)
        if not gate:
            raise HTTPException(status_code=404, detail='Gate not found')
        if project_id is not None and gate.project_id != project_id:
            raise HTTPException(status_code=400, detail='Gate does not belong to project_id')
        if project_id is None:
            payload = payload.model_copy(update={'project_id': gate.project_id})
    return crud.upsert_card_context(db, card_id, payload)


@app.get('/api/projects', response_model=list[schemas.ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    return crud.list_projects(db)


@app.post('/api/projects', response_model=schemas.ProjectRead, status_code=201)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, payload)


@app.get('/api/projects/{project_id}', response_model=schemas.ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return project


@app.patch('/api/projects/{project_id}', response_model=schemas.ProjectRead)
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return crud.update_project(db, project, payload)


@app.get('/api/projects/{project_id}/gates', response_model=list[schemas.GateRead])
def list_project_gates(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return crud.list_gates(db, project_id=project_id)


@app.post('/api/projects/{project_id}/gates', response_model=schemas.GateRead, status_code=201)
def create_gate(project_id: int, payload: schemas.GateCreate, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail='Project not found')
    return crud.create_gate(db, project_id, payload)


@app.get('/api/gates/{gate_id}', response_model=schemas.GateRead)
def get_gate(gate_id: int, db: Session = Depends(get_db)):
    gate = crud.get_gate(db, gate_id)
    if not gate:
        raise HTTPException(status_code=404, detail='Gate not found')
    return gate


@app.patch('/api/gates/{gate_id}', response_model=schemas.GateRead)
def update_gate(gate_id: int, payload: schemas.GateUpdate, db: Session = Depends(get_db)):
    gate = crud.get_gate(db, gate_id)
    if not gate:
        raise HTTPException(status_code=404, detail='Gate not found')
    return crud.update_gate(db, gate, payload)


@app.get('/api/dashboard/summary', response_model=schemas.DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return crud.dashboard_summary(db)
