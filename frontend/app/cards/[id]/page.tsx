"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StatusColumn = "DECIDABLE" | "NOT_DECIDABLE" | "DECIDED";
type DecisionResult = "UNDECIDED" | "GO" | "NO_GO" | "HOLD" | "CONDITIONAL_GO" | "PIVOT";
type EvidenceStatus = "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
type GateStatus = "PLANNED" | "OPEN" | "PASSED" | "BLOCKED" | "FAILED";

type EvidenceItem = {
  id: number;
  type: string;
  title: string;
  status: EvidenceStatus;
  owner_name?: string | null;
  due_date?: string | null;
  link_url?: string | null;
  note?: string | null;
};

type DecisionLog = {
  id: number;
  action_type: string;
  comment?: string | null;
  acted_by?: string | null;
  acted_at: string;
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
  actual_review_date?: string | null;
  gate_status: GateStatus;
  entry_criteria?: string | null;
  exit_criteria?: string | null;
};

type CardContext = {
  id?: number;
  decision_card_id?: number;
  project_id?: number | null;
  gate_id?: number | null;
  gate_target_date?: string | null;
  parent_card_id?: number | null;
  review_meeting_label?: string | null;
  decision_criteria?: string | null;
  gate_required?: boolean;
  project?: Project | null;
  gate?: Gate | null;
};

type DecisionCard = {
  id: number;
  title: string;
  decision_question: string;
  status_column: StatusColumn;
  decision_result: DecisionResult;
  decision_due_date?: string | null;
  owner_name?: string | null;
  decider_name?: string | null;
  summary_known?: string | null;
  summary_missing?: string | null;
  next_plan?: string | null;
  blocker_type?: string | null;
  priority?: string | null;
  risk_level?: string | null;
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
  evidence_items?: EvidenceItem[];
  logs?: DecisionLog[];
  context?: CardContext | null;
};

type DecisionCardListItem = { id: number; title: string };
type ReopenTarget = "DECIDABLE" | "NOT_DECIDABLE";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const emptyEvidence = {
  type: "general",
  title: "",
  status: "PLANNED" as EvidenceStatus,
  owner_name: "",
  due_date: "",
  link_url: "",
  note: "",
};

const emptyDecision = {
  decision_result: "GO" as DecisionResult,
  acted_by: "",
  comment: "",
};

const emptyReopen = {
  status_column: "NOT_DECIDABLE" as ReopenTarget,
  acted_by: "",
  reason: "",
};

const emptyContextForm = {
  project_id: "",
  gate_id: "",
  gate_target_date: "",
  parent_card_id: "",
  review_meeting_label: "",
  decision_criteria: "",
  gate_required: false,
};

function toNullable(value: string) {
  return value.trim() ? value : null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function actionTypeLabel(actionType: string) {
  switch (actionType) {
    case "created": return "作成";
    case "updated": return "更新";
    case "decided": return "判断確定";
    case "reopened": return "再オープン";
    case "evidence_added": return "判断材料追加";
    default: return actionType;
  }
}

function gateStatusLabel(gateStatus: GateStatus) {
  switch (gateStatus) {
    case "PLANNED": return "計画中";
    case "OPEN": return "レビュー準備済み";
    case "PASSED": return "通過";
    case "BLOCKED": return "保留";
    case "FAILED": return "不通過";
    default: return gateStatus;
  }
}

export default function CardDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const cardId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [card, setCard] = useState<DecisionCard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [allCards, setAllCards] = useState<DecisionCardListItem[]>([]);
  const [contextAvailable, setContextAvailable] = useState(true);
  const [projectApiAvailable, setProjectApiAvailable] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [reopening, setReopening] = useState(false);

  const [form, setForm] = useState({
    title: "",
    decision_question: "",
    status_column: "NOT_DECIDABLE" as StatusColumn,
    decision_due_date: "",
    owner_name: "",
    decider_name: "",
    summary_known: "",
    summary_missing: "",
    next_plan: "",
    blocker_type: "",
    priority: "",
    risk_level: "",
  });
  const [contextForm, setContextForm] = useState(emptyContextForm);
  const [evidenceForm, setEvidenceForm] = useState(emptyEvidence);
  const [decisionForm, setDecisionForm] = useState(emptyDecision);
  const [reopenForm, setReopenForm] = useState(emptyReopen);

  const logs = card?.logs ?? [];
  const evidenceItems = card?.evidence_items ?? [];

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === Number(contextForm.project_id)) ?? null,
    [projects, contextForm.project_id]
  );
  const selectedGate = useMemo(
    () => gates.find((gate) => gate.id === Number(contextForm.gate_id)) ?? null,
    [gates, contextForm.gate_id]
  );
  const parentCardOptions = useMemo(
    () => allCards.filter((item) => String(item.id) !== String(cardId)).sort((a, b) => a.id - b.id),
    [allCards, cardId]
  );

  const setFormFromCard = (data: DecisionCard) => {
    setForm({
      title: data.title ?? "",
      decision_question: data.decision_question ?? "",
      status_column: data.status_column ?? "NOT_DECIDABLE",
      decision_due_date: data.decision_due_date ?? "",
      owner_name: data.owner_name ?? "",
      decider_name: data.decider_name ?? "",
      summary_known: data.summary_known ?? "",
      summary_missing: data.summary_missing ?? "",
      next_plan: data.next_plan ?? "",
      blocker_type: data.blocker_type ?? "",
      priority: data.priority ?? "",
      risk_level: data.risk_level ?? "",
    });
    setDecisionForm({
      decision_result: "GO",
      acted_by: data.decider_name ?? "",
      comment: "",
    });
    setReopenForm({
      status_column: data.status_column === "DECIDABLE" ? "DECIDABLE" : "NOT_DECIDABLE",
      acted_by: data.decider_name ?? data.owner_name ?? "",
      reason: "",
    });
    const ctx = data.context;
    if (ctx) {
      setContextForm({
        project_id: ctx.project_id ? String(ctx.project_id) : "",
        gate_id: ctx.gate_id ? String(ctx.gate_id) : "",
        gate_target_date: ctx.gate_target_date ?? "",
        parent_card_id: ctx.parent_card_id ? String(ctx.parent_card_id) : "",
        review_meeting_label: ctx.review_meeting_label ?? "",
        decision_criteria: ctx.decision_criteria ?? "",
        gate_required: Boolean(ctx.gate_required),
      });
    } else {
      setContextForm(emptyContextForm);
    }
  };

  const loadCoreCard = async () => {
    const response = await fetch(`${API_BASE}/api/cards/${cardId}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("カード詳細の取得に失敗しました。");
    }
    const data: DecisionCard = await response.json();
    setCard(data);
    setFormFromCard(data);
    return data;
  };

  const loadOptionalContextSide = async (coreCard: DecisionCard) => {
    const warnings: string[] = [];

    try {
      const contextRes = await fetch(`${API_BASE}/api/cards/${cardId}/context`, { cache: "no-store" });
      if (!contextRes.ok) throw new Error();
      const contextJson: CardContext | null = await contextRes.json();
      setContextAvailable(true);
      if (contextJson) {
        const merged = { ...coreCard, context: contextJson };
        setCard(merged);
        setFormFromCard(merged);
      }
    } catch {
      setContextAvailable(false);
      warnings.push("Context API の取得に失敗しました。カード本体の編集は利用できます。");
    }

    try {
      const cardsRes = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
      if (!cardsRes.ok) throw new Error();
      const cardsJson: DecisionCardListItem[] = await cardsRes.json();
      setAllCards(cardsJson.map((item) => ({ id: item.id, title: item.title })));
    } catch {
      setAllCards([]);
      warnings.push("関連カード一覧の取得に失敗しました。親カード選択は一時的に使えません。");
    }

    try {
      const projectsRes = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
      if (!projectsRes.ok) throw new Error();
      const projectsJson: Project[] = await projectsRes.json();
      setProjects(projectsJson);
      setProjectApiAvailable(true);

      const projectId = coreCard.context?.project_id ?? coreCard.context?.project?.id ?? null;
      if (projectId) {
        try {
          const gatesRes = await fetch(`${API_BASE}/api/projects/${projectId}/gates`, { cache: "no-store" });
          if (!gatesRes.ok) throw new Error();
          setGates(await gatesRes.json());
        } catch {
          setGates([]);
          warnings.push("Gate 一覧の取得に失敗しました。カード本体の編集は利用できます。");
        }
      } else {
        setGates([]);
      }
    } catch {
      setProjects([]);
      setGates([]);
      setProjectApiAvailable(false);
      warnings.push("Project / Gate API の取得に失敗しました。カード本体の編集は利用できます。");
    }

    setWarning(warnings.length > 0 ? warnings.join(" ") : null);
  };

  const loadAll = async () => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      const coreCard = await loadCoreCard();
      await loadOptionalContextSide(coreCard);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "データ取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll().catch((err) => console.error(err));
  }, [cardId]);

  useEffect(() => {
    if (!projectApiAvailable || !contextForm.project_id) {
      if (!contextForm.project_id) setGates([]);
      return;
    }
    fetch(`${API_BASE}/api/projects/${contextForm.project_id}/gates`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setGates(await res.json());
      })
      .catch(() => {
        setGates([]);
        setWarning("Gate 一覧の取得に失敗しました。カード本体の編集は利用できます。");
      });
  }, [contextForm.project_id, projectApiAvailable]);

  const onSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          decision_question: form.decision_question,
          status_column: form.status_column,
          decision_due_date: toNullable(form.decision_due_date),
          owner_name: toNullable(form.owner_name),
          decider_name: toNullable(form.decider_name),
          summary_known: toNullable(form.summary_known),
          summary_missing: toNullable(form.summary_missing),
          next_plan: toNullable(form.next_plan),
          blocker_type: toNullable(form.blocker_type),
          priority: toNullable(form.priority),
          risk_level: toNullable(form.risk_level),
        }),
      });
      if (!response.ok) throw new Error("カード保存に失敗しました。");
      const saved: DecisionCard = await response.json();
      setCard(saved);
      setFormFromCard(saved);
      setMessage("カードを保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "カード保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const onSaveContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId || !contextAvailable || !projectApiAvailable) return;
    setSavingContext(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/context`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: toNullableNumber(contextForm.project_id),
          gate_id: toNullableNumber(contextForm.gate_id),
          gate_target_date: toNullable(contextForm.gate_target_date),
          parent_card_id: toNullableNumber(contextForm.parent_card_id),
          review_meeting_label: toNullable(contextForm.review_meeting_label),
          decision_criteria: toNullable(contextForm.decision_criteria),
          gate_required: contextForm.gate_required,
        }),
      });
      if (!response.ok) throw new Error("Context 保存に失敗しました。");
      const savedContext: CardContext = await response.json();
      setCard((prev) => (prev ? { ...prev, context: savedContext } : prev));
      setMessage("Gate / 日程コンテキストを保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Context 保存に失敗しました。");
    } finally {
      setSavingContext(false);
    }
  };

  const onAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) return;
    setAddingEvidence(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: evidenceForm.type,
          title: evidenceForm.title,
          status: evidenceForm.status,
          owner_name: toNullable(evidenceForm.owner_name),
          due_date: toNullable(evidenceForm.due_date),
          link_url: toNullable(evidenceForm.link_url),
          note: toNullable(evidenceForm.note),
        }),
      });
      if (!response.ok) throw new Error("判断材料追加に失敗しました。");
      setEvidenceForm(emptyEvidence);
      await loadCoreCard();
      setMessage("判断材料を追加しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "判断材料追加に失敗しました。");
    } finally {
      setAddingEvidence(false);
    }
  };

  const onDecide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) return;
    setDeciding(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_result: decisionForm.decision_result,
          acted_by: toNullable(decisionForm.acted_by),
          comment: toNullable(decisionForm.comment),
        }),
      });
      if (!response.ok) throw new Error("判断確定に失敗しました。");
      await loadCoreCard();
      setMessage("判断結果を記録しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "判断確定に失敗しました。");
    } finally {
      setDeciding(false);
    }
  };

  const onReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId) return;
    setReopening(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${cardId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_column: reopenForm.status_column,
          acted_by: toNullable(reopenForm.acted_by),
          reason: reopenForm.reason.trim(),
        }),
      });
      if (!response.ok) throw new Error("再オープンに失敗しました。");
      await loadCoreCard();
      setMessage("カードを再オープンしました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "再オープンに失敗しました。");
    } finally {
      setReopening(false);
    }
  };

  if (loading) {
    return <main className="container"><p className="muted">読み込み中...</p></main>;
  }

  if (!card) {
    return (
      <main className="container">
        <div className="titlebar">
          <h1>Card Detail</h1>
          <Link href="/" className="inlineLinkButton">ボードへ戻る</Link>
        </div>
        {error ? <div className="alertBox">{error}</div> : <p className="muted">カードが見つかりません。</p>}
      </main>
    );
  }

  return (
    <main className="container detailPage">
      <div className="titlebar">
        <div>
          <div className="detailMetaRow">
            <Link href="/" className="inlineLinkButton">← ボードへ戻る</Link>
            <span className={`badge ${card.status_column === "DECIDABLE" ? "decidable" : card.status_column === "DECIDED" ? "decided" : "notDecidable"}`}>
              {card.status_column === "DECIDABLE" ? "判断可能" : card.status_column === "DECIDED" ? "判断済み" : "判断不可"}
            </span>
            <span className="badge neutral">#{card.id}</span>
          </div>
          <h1 style={{ marginBottom: 8 }}>{card.title}</h1>
          <div className="muted">{card.decision_question}</div>
        </div>
      </div>

      {error ? <div className="alertBox">{error}</div> : null}
      {warning ? <div className="alertBox" style={{ background: 'rgba(124,74,3,0.16)', borderColor: 'rgba(255,210,127,0.35)', color: '#ffe4a8' }}>{warning}</div> : null}
      {message ? <div className="successBox">{message}</div> : null}

      <section className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(360px, 0.9fr)', marginTop: 18, alignItems: 'start' }}>
        <section className="panelCard">
          <div className="sectionTitleRow">
            <h2>カード編集</h2>
            <span className="muted small">更新日時: {new Date(card.updated_at).toLocaleString()}</span>
          </div>
          <form onSubmit={onSaveCard} className="compactForm">
            <div className="row2">
              <div><label>判断タイトル</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div><label>現在列</label><select value={form.status_column} onChange={(e) => setForm({ ...form, status_column: e.target.value as StatusColumn })}><option value="DECIDABLE">判断可能</option><option value="NOT_DECIDABLE">判断不可</option><option value="DECIDED">判断済み</option></select></div>
            </div>
            <div style={{ marginTop: 12 }}><label>いま判断したいこと（1文）</label><textarea value={form.decision_question} onChange={(e) => setForm({ ...form, decision_question: e.target.value })} required /></div>
            <div className="row3" style={{ marginTop: 12 }}>
              <div><label>判断目安日</label><input type="date" value={form.decision_due_date} onChange={(e) => setForm({ ...form, decision_due_date: e.target.value })} /></div>
              <div><label>Owner</label><input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
              <div><label>Decider</label><input value={form.decider_name} onChange={(e) => setForm({ ...form, decider_name: e.target.value })} /></div>
            </div>
            <div className="row3" style={{ marginTop: 12 }}>
              <div><label>ここまでに分かったこと</label><textarea value={form.summary_known} onChange={(e) => setForm({ ...form, summary_known: e.target.value })} /></div>
              <div><label>不足材料</label><textarea value={form.summary_missing} onChange={(e) => setForm({ ...form, summary_missing: e.target.value })} /></div>
              <div><label>次にやる計画</label><textarea value={form.next_plan} onChange={(e) => setForm({ ...form, next_plan: e.target.value })} /></div>
            </div>
            <div className="row3" style={{ marginTop: 12 }}>
              <div><label>ブロッカー種別</label><input value={form.blocker_type} onChange={(e) => setForm({ ...form, blocker_type: e.target.value })} /></div>
              <div><label>優先度</label><input value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
              <div><label>リスク</label><input value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 16 }}><button disabled={saving}>{saving ? '保存中...' : 'カードを保存'}</button></div>
          </form>
        </section>

        <section className="stackCol">
          <section className="panelCard">
            <div className="sectionTitleRow"><h2>Gate / 日程コンテキスト</h2><span className="muted small">補助情報</span></div>
            {!contextAvailable || !projectApiAvailable ? (
              <div className="muted" style={{ marginTop: 14 }}>
                Context / Project / Gate API が利用できないため、このセクションは一時的に編集できません。カード本体の編集・判断・再オープン・判断材料追加は利用できます。
              </div>
            ) : (
              <form onSubmit={onSaveContext} className="compactForm" style={{ marginTop: 14 }}>
                <div className="row2">
                  <div><label>Project</label><select value={contextForm.project_id} onChange={(e) => setContextForm({ ...contextForm, project_id: e.target.value, gate_id: '' })}><option value="">未設定</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code ? `${project.code} / ${project.name}` : project.name}</option>)}</select></div>
                  <div><label>Gate</label><select value={contextForm.gate_id} onChange={(e) => setContextForm({ ...contextForm, gate_id: e.target.value })} disabled={!contextForm.project_id}><option value="">未設定</option>{gates.map((gate) => <option key={gate.id} value={gate.id}>{`G${gate.sequence_no} / ${gate.name}`}</option>)}</select></div>
                </div>
                <div className="row3" style={{ marginTop: 12 }}>
                  <div><label>Gate 目標日</label><input type="date" value={contextForm.gate_target_date} onChange={(e) => setContextForm({ ...contextForm, gate_target_date: e.target.value })} /></div>
                  <div><label>親カード</label><select value={contextForm.parent_card_id} onChange={(e) => setContextForm({ ...contextForm, parent_card_id: e.target.value })}><option value="">未設定</option>{parentCardOptions.map((item) => <option key={item.id} value={item.id}>{`#${item.id} ${item.title}`}</option>)}</select></div>
                  <div><label>レビュー会ラベル</label><input value={contextForm.review_meeting_label} onChange={(e) => setContextForm({ ...contextForm, review_meeting_label: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 12 }}><label>判断基準</label><textarea value={contextForm.decision_criteria} onChange={(e) => setContextForm({ ...contextForm, decision_criteria: e.target.value })} /></div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={contextForm.gate_required} onChange={(e) => setContextForm({ ...contextForm, gate_required: e.target.checked })} style={{ width: 18, height: 18 }} /><label style={{ margin: 0 }}>このカードは Gate 判定に必須</label></div>
                <div style={{ marginTop: 16 }}><button disabled={savingContext}>{savingContext ? '保存中...' : 'Gate / 日程コンテキストを保存'}</button></div>
              </form>
            )}

            <div className="evidenceList">
              <article className="subCard">
                <div className="sectionTitleRow"><strong>現在の紐づけ</strong><span className="small muted">読み取り専用</span></div>
                <div className="row2" style={{ marginTop: 12 }}>
                  <div><div className="small muted">Project</div><div>{card.context?.project ? (card.context.project.code ? `${card.context.project.code} / ${card.context.project.name}` : card.context.project.name) : '-'}</div></div>
                  <div><div className="small muted">Gate</div><div>{card.context?.gate ? `G${card.context.gate.sequence_no} / ${card.context.gate.name}` : '-'}</div></div>
                </div>
                <div className="row2" style={{ marginTop: 12 }}>
                  <div><div className="small muted">Gate 状態</div><div>{card.context?.gate ? gateStatusLabel(card.context.gate.gate_status) : '-'}</div></div>
                  <div><div className="small muted">Gate 目標日</div><div>{card.context?.gate_target_date ?? '-'}</div></div>
                </div>
              </article>
              {selectedProject ? <article className="subCard"><div className="sectionTitleRow"><strong>選択中 Project</strong><span className="small muted">参考情報</span></div><p className="muted small" style={{ marginTop: 10 }}>{selectedProject.description ?? '説明未設定'}</p></article> : null}
              {selectedGate ? <article className="subCard"><div className="sectionTitleRow"><strong>選択中 Gate</strong><span className="small muted">参考情報</span></div><div className="row2" style={{ marginTop: 10 }}><div><div className="small muted">予定レビュー日</div><div>{selectedGate.planned_review_date ?? '-'}</div></div><div><div className="small muted">Gate 状態</div><div>{gateStatusLabel(selectedGate.gate_status)}</div></div></div></article> : null}
            </div>
          </section>

          <section className="panelCard">
            <div className="sectionTitleRow"><h2>判断結果</h2><span className="muted small">現在結果: {card.decision_result}</span></div>
            <form onSubmit={onDecide} className="compactForm" style={{ marginTop: 14 }}>
              <div className="row2">
                <div><label>判断結果</label><select value={decisionForm.decision_result} onChange={(e) => setDecisionForm({ ...decisionForm, decision_result: e.target.value as DecisionResult })}><option value="GO">GO</option><option value="NO_GO">NO-GO</option><option value="HOLD">HOLD</option><option value="CONDITIONAL_GO">条件付きGO</option><option value="PIVOT">PIVOT</option></select></div>
                <div><label>決定者</label><input value={decisionForm.acted_by} onChange={(e) => setDecisionForm({ ...decisionForm, acted_by: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: 12 }}><label>決定理由コメント</label><textarea value={decisionForm.comment} onChange={(e) => setDecisionForm({ ...decisionForm, comment: e.target.value })} /></div>
              <div style={{ marginTop: 16 }}><button disabled={deciding}>{deciding ? '記録中...' : '判断結果を確定'}</button></div>
            </form>
          </section>

          <section className="panelCard">
            <div className="sectionTitleRow"><h2>再オープン</h2><span className="muted small">判断済みカードを未判断へ戻す</span></div>
            {card.status_column !== 'DECIDED' ? (
              <p className="muted">このカードはまだ判断済みではないため、再オープンはできません。</p>
            ) : (
              <form onSubmit={onReopen} className="compactForm" style={{ marginTop: 14 }}>
                <div className="row2"><div><label>戻し先の列</label><select value={reopenForm.status_column} onChange={(e) => setReopenForm({ ...reopenForm, status_column: e.target.value as ReopenTarget })}><option value="NOT_DECIDABLE">判断不可（材料集め中）</option><option value="DECIDABLE">判断可能</option></select></div><div><label>実行者</label><input value={reopenForm.acted_by} onChange={(e) => setReopenForm({ ...reopenForm, acted_by: e.target.value })} /></div></div>
                <div style={{ marginTop: 12 }}><label>再オープン理由</label><textarea value={reopenForm.reason} onChange={(e) => setReopenForm({ ...reopenForm, reason: e.target.value })} required /></div>
                <div style={{ marginTop: 16 }}><button disabled={reopening}>{reopening ? '再オープン中...' : 'カードを再オープン'}</button></div>
              </form>
            )}
          </section>
        </section>
      </section>

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow"><h2>判断材料 / 計画</h2><span className="muted small">{evidenceItems.length}件</span></div>
        <div className="evidenceList">
          {evidenceItems.length === 0 ? <p className="muted">まだ判断材料は登録されていません。</p> : evidenceItems.map((item) => (
            <article key={item.id} className="subCard">
              <div className="sectionTitleRow"><strong>{item.title}</strong><span className="badge neutral">{item.status}</span></div>
              <div className="row2" style={{ marginTop: 10 }}><div><div className="small muted">担当</div><div>{item.owner_name ?? '-'}</div></div><div><div className="small muted">期限</div><div>{item.due_date ?? '-'}</div></div></div>
              {item.note ? <p className="muted small" style={{ marginTop: 10 }}>{item.note}</p> : null}
            </article>
          ))}
        </div>
        <form onSubmit={onAddEvidence} className="compactForm" style={{ marginTop: 16 }}>
          <div className="row2"><div><label>種別</label><input value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value })} /></div><div><label>状態</label><select value={evidenceForm.status} onChange={(e) => setEvidenceForm({ ...evidenceForm, status: e.target.value as EvidenceStatus })}><option value="PLANNED">planned</option><option value="IN_PROGRESS">in_progress</option><option value="DONE">done</option><option value="CANCELLED">cancelled</option></select></div></div>
          <div style={{ marginTop: 12 }}><label>タイトル</label><input value={evidenceForm.title} onChange={(e) => setEvidenceForm({ ...evidenceForm, title: e.target.value })} required /></div>
          <div className="row3" style={{ marginTop: 12 }}><div><label>担当者</label><input value={evidenceForm.owner_name} onChange={(e) => setEvidenceForm({ ...evidenceForm, owner_name: e.target.value })} /></div><div><label>期限</label><input type="date" value={evidenceForm.due_date} onChange={(e) => setEvidenceForm({ ...evidenceForm, due_date: e.target.value })} /></div><div><label>リンク</label><input value={evidenceForm.link_url} onChange={(e) => setEvidenceForm({ ...evidenceForm, link_url: e.target.value })} /></div></div>
          <div style={{ marginTop: 12 }}><label>メモ</label><textarea value={evidenceForm.note} onChange={(e) => setEvidenceForm({ ...evidenceForm, note: e.target.value })} /></div>
          <div style={{ marginTop: 16 }}><button disabled={addingEvidence}>{addingEvidence ? '追加中...' : '判断材料を追加'}</button></div>
        </form>
      </section>

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow"><h2>履歴</h2><span className="muted small">{logs.length}件</span></div>
        <div className="evidenceList">
          {logs.length === 0 ? <p className="muted">履歴はまだありません。</p> : logs.slice().sort((a, b) => new Date(b.acted_at).getTime() - new Date(a.acted_at).getTime()).map((log) => (
            <article key={log.id} className="subCard">
              <div className="sectionTitleRow"><strong>{actionTypeLabel(log.action_type)}</strong><span className="muted small">{new Date(log.acted_at).toLocaleString()}</span></div>
              <div className="small muted" style={{ marginTop: 8 }}>実行者: {log.acted_by ?? '-'}</div>
              {log.comment ? <p style={{ marginBottom: 0 }}>{log.comment}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
