"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatusColumn = "DECIDABLE" | "NOT_DECIDABLE" | "DECIDED";
type GateStatus = "PLANNED" | "OPEN" | "PASSED" | "BLOCKED" | "FAILED";

type DecisionCard = {
  id: number;
  title: string;
  decision_question: string;
  status_column: StatusColumn;
  decision_due_date?: string | null;
  owner_name?: string | null;
  decider_name?: string | null;
  blocker_type?: string | null;
  updated_at?: string | null;
};

type Project = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
};

type Gate = {
  id: number;
  project_id: number;
  name: string;
  sequence_no: number;
  planned_review_date?: string | null;
  gate_status: GateStatus;
  entry_criteria?: string | null;
  exit_criteria?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const emptyCardForm = {
  title: "",
  decision_question: "",
  status_column: "NOT_DECIDABLE" as StatusColumn,
  decision_due_date: "",
  owner_name: "",
  decider_name: "",
  blocker_type: "",
};

const emptyProjectForm = {
  name: "",
  code: "",
  description: "",
  planned_start_date: "",
  planned_end_date: "",
};

const emptyGateForm = {
  project_id: "",
  name: "",
  sequence_no: "1",
  planned_review_date: "",
  gate_status: "PLANNED" as GateStatus,
  entry_criteria: "",
  exit_criteria: "",
};

function toNullable(value: string) {
  return value.trim() ? value : null;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.length <= 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function gateStatusLabel(gateStatus: GateStatus) {
  switch (gateStatus) {
    case "PLANNED":
      return "計画中";
    case "OPEN":
      return "レビュー準備済み";
    case "PASSED":
      return "通過";
    case "BLOCKED":
      return "保留";
    case "FAILED":
      return "不通過";
    default:
      return gateStatus;
  }
}

export default function Page() {
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [gateForm, setGateForm] = useState(emptyGateForm);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingGate, setSavingGate] = useState(false);

  const loadCards = async () => {
    const cardsRes = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
    if (!cardsRes.ok) {
      throw new Error("カード一覧の取得に失敗しました。");
    }
    const cardsJson: DecisionCard[] = await cardsRes.json();
    setCards(cardsJson);
  };

  const loadProjectsOptional = async () => {
    try {
      const projectsRes = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
      if (!projectsRes.ok) throw new Error();
      const projectsJson: Project[] = await projectsRes.json();
      setProjects(projectsJson);
      if (!gateForm.project_id && projectsJson[0]) {
        setGateForm((prev) => ({ ...prev, project_id: String(projectsJson[0].id) }));
      }
      setWarning(null);
    } catch {
      setProjects([]);
      setGates([]);
      setWarning("Project / Gate API の取得に失敗しました。カード機能は利用できます。");
    }
  };

  const loadGatesOptional = async (projectId: string) => {
    if (!projectId) {
      setGates([]);
      return;
    }
    try {
      const gatesRes = await fetch(`${API_BASE}/api/projects/${projectId}/gates`, { cache: "no-store" });
      if (!gatesRes.ok) throw new Error();
      const gatesJson: Gate[] = await gatesRes.json();
      setGates(gatesJson);
    } catch {
      setGates([]);
      setWarning("Gate API の取得に失敗しました。カード機能は利用できます。");
    }
  };

  const reloadCore = async () => {
    await loadCards();
    await loadProjectsOptional();
  };

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await reloadCore();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "データ取得に失敗しました。");
      }
    })();
  }, []);

  useEffect(() => {
    if (gateForm.project_id) {
      loadGatesOptional(gateForm.project_id);
    }
  }, [gateForm.project_id]);

  const grouped = useMemo(() => ({
    DECIDABLE: cards.filter((c) => c.status_column === "DECIDABLE"),
    NOT_DECIDABLE: cards.filter((c) => c.status_column === "NOT_DECIDABLE"),
    DECIDED: cards.filter((c) => c.status_column === "DECIDED"),
  }), [cards]);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCards = cards.filter((card) => {
      if (card.status_column === "DECIDED") return false;
      const due = parseDate(card.decision_due_date);
      return due ? due.getTime() < today.getTime() : false;
    });
    return {
      total_cards: cards.length,
      undecided_cards: grouped.DECIDABLE.length + grouped.NOT_DECIDABLE.length,
      decidable_cards: grouped.DECIDABLE.length,
      not_decidable_cards: grouped.NOT_DECIDABLE.length,
      decided_cards: grouped.DECIDED.length,
      overdue_cards: overdueCards.length,
    };
  }, [cards, grouped]);

  const onCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCard(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cardForm.title,
          decision_question: cardForm.decision_question,
          status_column: cardForm.status_column,
          decision_due_date: toNullable(cardForm.decision_due_date),
          owner_name: toNullable(cardForm.owner_name),
          decider_name: toNullable(cardForm.decider_name),
          blocker_type: toNullable(cardForm.blocker_type),
        }),
      });
      if (!res.ok) throw new Error("判断カード作成に失敗しました。");
      setCardForm(emptyCardForm);
      await loadCards();
      setMessage("判断カードを作成しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "判断カード作成に失敗しました。");
    } finally {
      setSavingCard(false);
    }
  };

  const onCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProject(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectForm.name,
          code: toNullable(projectForm.code),
          description: toNullable(projectForm.description),
          planned_start_date: toNullable(projectForm.planned_start_date),
          planned_end_date: toNullable(projectForm.planned_end_date),
        }),
      });
      if (!res.ok) throw new Error("Project 作成に失敗しました。");
      const created: Project = await res.json();
      setProjectForm(emptyProjectForm);
      setGateForm((prev) => ({ ...prev, project_id: String(created.id) }));
      await loadProjectsOptional();
      setMessage("Project を作成しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Project 作成に失敗しました。");
    } finally {
      setSavingProject(false);
    }
  };

  const onCreateGate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateForm.project_id) {
      setError("先に Project を選択してください。");
      return;
    }
    setSavingGate(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${gateForm.project_id}/gates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: gateForm.name,
          sequence_no: Number(gateForm.sequence_no || "1"),
          planned_review_date: toNullable(gateForm.planned_review_date),
          gate_status: gateForm.gate_status,
          entry_criteria: toNullable(gateForm.entry_criteria),
          exit_criteria: toNullable(gateForm.exit_criteria),
        }),
      });
      if (!res.ok) throw new Error("Gate 作成に失敗しました。");
      const pid = gateForm.project_id;
      setGateForm({ ...emptyGateForm, project_id: pid });
      await loadGatesOptional(pid);
      setMessage("Gate を作成しました。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Gate 作成に失敗しました。");
    } finally {
      setSavingGate(false);
    }
  };

  const renderColumn = (title: string, items: DecisionCard[], badgeClass: string) => (
    <section className="column">
      <div className="titlebar">
        <h2>{title}</h2>
        <span className={`badge ${badgeClass}`}>{items.length}件</span>
      </div>
      {items.map((card) => {
        const due = parseDate(card.decision_due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdue = due ? due.getTime() < today.getTime() && card.status_column !== "DECIDED" : false;
        return (
          <article key={card.id} className="card cardLinkWrap">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong>{card.title}</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {overdue ? <span className="badge overdue">期限超過</span> : null}
                <span className="badge neutral">#{card.id}</span>
              </div>
            </div>
            <p className="muted small">{card.decision_question}</p>
            <div className="row2">
              <div><div className="small muted">判断目安日</div><div>{card.decision_due_date ?? "-"}</div></div>
              <div><div className="small muted">ブロッカー</div><div>{card.blocker_type ?? "-"}</div></div>
            </div>
            <div className="row2" style={{ marginTop: 10 }}>
              <div><div className="small muted">Owner</div><div>{card.owner_name ?? "-"}</div></div>
              <div><div className="small muted">Decider</div><div>{card.decider_name ?? "-"}</div></div>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/cards/${card.id}`} className="inlineLinkButton">詳細</Link>
            </div>
          </article>
        );
      })}
      {items.length === 0 ? <p className="muted">カードはまだありません。</p> : null}
    </section>
  );

  return (
    <main className="container">
      <div className="titlebar">
        <div>
          <h1 style={{ marginBottom: 6 }}>Decision-Flow PM</h1>
          <div className="muted">判断を管理して、探索全体を前に進める MVP スキャフォールド</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/timeline" className="inlineLinkButton">Timeline</Link>
          <Link href="/review" className="inlineLinkButton">Review Mode</Link>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="inlineLinkButton">API Docs</a>
        </div>
      </div>

      {error ? <div className="alertBox">{error}</div> : null}
      {warning ? <div className="alertBox" style={{ background: 'rgba(124,74,3,0.16)', borderColor: 'rgba(255,210,127,0.35)', color: '#ffe4a8' }}>{warning}</div> : null}
      {message ? <div className="successBox">{message}</div> : null}

      <section className="grid dashboard" style={{ marginTop: 18 }}>
        <div className="stat"><div className="label">総カード</div><div className="value">{summary.total_cards}</div></div>
        <div className="stat"><div className="label">未判断</div><div className="value">{summary.undecided_cards}</div></div>
        <div className="stat"><div className="label">判断可能</div><div className="value">{summary.decidable_cards}</div></div>
        <div className="stat"><div className="label">判断不可</div><div className="value">{summary.not_decidable_cards}</div></div>
        <div className="stat"><div className="label">判断済み</div><div className="value">{summary.decided_cards}</div></div>
        <div className="stat"><div className="label">期限超過</div><div className="value">{summary.overdue_cards}</div></div>
      </section>

      <section className="board">
        {renderColumn("判断可能", grouped.DECIDABLE, "decidable")}
        {renderColumn("判断不可（材料集め中）", grouped.NOT_DECIDABLE, "notDecidable")}
        {renderColumn("判断済み", grouped.DECIDED, "decided")}
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1.15fr 0.85fr", marginTop: 18 }}>
        <form onSubmit={onCreateCard}>
          <h2 style={{ marginTop: 0 }}>新規判断カード作成</h2>
          <div className="row2">
            <div><label>判断タイトル</label><input value={cardForm.title} onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })} required /></div>
            <div><label>状態列</label><select value={cardForm.status_column} onChange={(e) => setCardForm({ ...cardForm, status_column: e.target.value as StatusColumn })}><option value="DECIDABLE">判断可能</option><option value="NOT_DECIDABLE">判断不可</option><option value="DECIDED">判断済み</option></select></div>
          </div>
          <div style={{ marginTop: 12 }}><label>いま判断したいこと（1文）</label><textarea value={cardForm.decision_question} onChange={(e) => setCardForm({ ...cardForm, decision_question: e.target.value })} required /></div>
          <div className="row3" style={{ marginTop: 12 }}>
            <div><label>判断目安日</label><input type="date" value={cardForm.decision_due_date} onChange={(e) => setCardForm({ ...cardForm, decision_due_date: e.target.value })} /></div>
            <div><label>Owner</label><input value={cardForm.owner_name} onChange={(e) => setCardForm({ ...cardForm, owner_name: e.target.value })} /></div>
            <div><label>Decider</label><input value={cardForm.decider_name} onChange={(e) => setCardForm({ ...cardForm, decider_name: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label>ブロッカー種別</label><input value={cardForm.blocker_type} onChange={(e) => setCardForm({ ...cardForm, blocker_type: e.target.value })} /></div>
          <div style={{ marginTop: 16 }}><button disabled={savingCard}>{savingCard ? "作成中..." : "判断カードを作成"}</button></div>
        </form>

        <div className="stackCol">
          <section className="panelCard">
            <div className="sectionTitleRow"><h2>Project 作成</h2><span className="muted small">Gate の親単位</span></div>
            <form onSubmit={onCreateProject} className="compactForm" style={{ marginTop: 14 }}>
              <div className="row2">
                <div><label>Project 名</label><input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} required /></div>
                <div><label>コード</label><input value={projectForm.code} onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 12 }}><label>説明</label><textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></div>
              <div className="row2" style={{ marginTop: 12 }}>
                <div><label>計画開始日</label><input type="date" value={projectForm.planned_start_date} onChange={(e) => setProjectForm({ ...projectForm, planned_start_date: e.target.value })} /></div>
                <div><label>計画終了日</label><input type="date" value={projectForm.planned_end_date} onChange={(e) => setProjectForm({ ...projectForm, planned_end_date: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 16 }}><button disabled={savingProject}>{savingProject ? "作成中..." : "Project を作成"}</button></div>
            </form>
          </section>

          <section className="panelCard">
            <div className="sectionTitleRow"><h2>Gate 作成</h2><span className="muted small">Project ごとに追加</span></div>
            <form onSubmit={onCreateGate} className="compactForm" style={{ marginTop: 14 }}>
              <div className="row2">
                <div><label>Project</label><select value={gateForm.project_id} onChange={(e) => setGateForm({ ...gateForm, project_id: e.target.value })}><option value="">選択してください</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code ? `${project.code} / ${project.name}` : project.name}</option>)}</select></div>
                <div><label>Gate 名</label><input value={gateForm.name} onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })} required /></div>
              </div>
              <div className="row3" style={{ marginTop: 12 }}>
                <div><label>Gate 番号</label><input type="number" min="1" value={gateForm.sequence_no} onChange={(e) => setGateForm({ ...gateForm, sequence_no: e.target.value })} /></div>
                <div><label>予定レビュー日</label><input type="date" value={gateForm.planned_review_date} onChange={(e) => setGateForm({ ...gateForm, planned_review_date: e.target.value })} /></div>
                <div><label>状態</label><select value={gateForm.gate_status} onChange={(e) => setGateForm({ ...gateForm, gate_status: e.target.value as GateStatus })}><option value="PLANNED">計画中</option><option value="OPEN">レビュー準備済み</option><option value="PASSED">通過</option><option value="BLOCKED">保留</option><option value="FAILED">不通過</option></select></div>
              </div>
              <div style={{ marginTop: 12 }}><label>Entry Criteria</label><textarea value={gateForm.entry_criteria} onChange={(e) => setGateForm({ ...gateForm, entry_criteria: e.target.value })} /></div>
              <div style={{ marginTop: 12 }}><label>Exit Criteria</label><textarea value={gateForm.exit_criteria} onChange={(e) => setGateForm({ ...gateForm, exit_criteria: e.target.value })} /></div>
              <div style={{ marginTop: 16 }}><button disabled={savingGate}>{savingGate ? "作成中..." : "Gate を作成"}</button></div>
            </form>
            <div className="evidenceList">
              {gateForm.project_id && gates.length > 0 ? gates.map((gate) => (
                <article key={gate.id} className="subCard">
                  <div className="sectionTitleRow"><strong>{`G${gate.sequence_no} / ${gate.name}`}</strong><span className="badge neutral">{gateStatusLabel(gate.gate_status)}</span></div>
                  <div className="row2" style={{ marginTop: 10 }}>
                    <div><div className="small muted">予定レビュー日</div><div>{gate.planned_review_date ?? "-"}</div></div>
                    <div><div className="small muted">Entry / Exit</div><div>{gate.entry_criteria || gate.exit_criteria ? "あり" : "-"}</div></div>
                  </div>
                </article>
              )) : <p className="muted">Gate 一覧はまだありません。</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
