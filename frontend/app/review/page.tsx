"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type DecisionResult = "UNDECIDED" | "GO" | "NO_GO" | "HOLD" | "CONDITIONAL_GO" | "PIVOT";
type GateStatus = "PLANNED" | "OPEN" | "PASSED" | "BLOCKED" | "FAILED";
type StatusColumn = "DECIDABLE" | "NOT_DECIDABLE" | "DECIDED";

type Project = {
  id: number;
  name: string;
  code?: string | null;
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

type EvidenceItem = {
  id: number;
  title: string;
  status: string;
  owner_name?: string | null;
  due_date?: string | null;
  note?: string | null;
};

type DecisionCard = {
  id: number;
  title: string;
  decision_question: string;
  decision_due_date?: string | null;
  owner_name?: string | null;
  decider_name?: string | null;
  summary_known?: string | null;
  summary_missing?: string | null;
  next_plan?: string | null;
  blocker_type?: string | null;
  context?: CardContext | null;
  evidence_items?: EvidenceItem[];
};

type NextCardForm = {
  title: string;
  decision_question: string;
  status_column: StatusColumn;
  decision_due_date: string;
  owner_name: string;
  decider_name: string;
  blocker_type: string;
};

type ContextUpsertPayload = {
  project_id?: number | null;
  gate_id?: number | null;
  gate_target_date?: string | null;
  parent_card_id?: number | null;
  review_meeting_label?: string | null;
  decision_criteria?: string | null;
  gate_required?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const emptyDecision = {
  decision_result: "GO" as DecisionResult,
  acted_by: "",
  comment: "",
};
const emptyNextCardForm: NextCardForm = {
  title: "",
  decision_question: "",
  status_column: "NOT_DECIDABLE",
  decision_due_date: "",
  owner_name: "",
  decider_name: "",
  blocker_type: "",
};

function toNullable(value: string) {
  return value.trim() ? value : null;
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

function decisionResultLabel(result: DecisionResult) {
  switch (result) {
    case "GO":
      return "GO";
    case "NO_GO":
      return "NO-GO";
    case "HOLD":
      return "HOLD";
    case "CONDITIONAL_GO":
      return "条件付きGO";
    case "PIVOT":
      return "PIVOT";
    default:
      return "未判断";
  }
}

function queueUrl(projectId: string, gateId: string) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (gateId) params.set("gate_id", gateId);
  const query = params.toString();
  return `${API_BASE}/api/review/queue${query ? `?${query}` : ""}`;
}

function buildSuggestedNextCard(card: DecisionCard, decisionResult: DecisionResult): NextCardForm {
  const suffix = {
    GO: "次判断",
    NO_GO: "代替案判断",
    HOLD: "再検討判断",
    CONDITIONAL_GO: "条件確認判断",
    PIVOT: "Pivot後判断",
    UNDECIDED: "次判断",
  }[decisionResult];

  return {
    title: `${card.title} - ${suffix}`,
    decision_question: "",
    status_column: "NOT_DECIDABLE",
    decision_due_date: "",
    owner_name: card.owner_name ?? "",
    decider_name: card.decider_name ?? "",
    blocker_type: "",
  };
}

function buildAutoContextPayload(sourceCard: DecisionCard): ContextUpsertPayload {
  const ctx = sourceCard.context;
  return {
    project_id: ctx?.project_id ?? ctx?.project?.id ?? null,
    gate_id: ctx?.gate_id ?? ctx?.gate?.id ?? null,
    gate_target_date: ctx?.gate_target_date ?? null,
    parent_card_id: sourceCard.id,
    review_meeting_label: ctx?.review_meeting_label ?? null,
    decision_criteria: ctx?.decision_criteria ?? null,
    gate_required: Boolean(ctx?.gate_required),
  };
}

export default function ReviewModePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedGateId, setSelectedGateId] = useState("");
  const [index, setIndex] = useState(0);
  const [decisionForm, setDecisionForm] = useState(emptyDecision);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [projectApiAvailable, setProjectApiAvailable] = useState(true);
  const [gateApiAvailable, setGateApiAvailable] = useState(true);
  const [lastDecidedCard, setLastDecidedCard] = useState<DecisionCard | null>(null);
  const [showNextCardForm, setShowNextCardForm] = useState(false);
  const [nextCardForm, setNextCardForm] = useState<NextCardForm>(emptyNextCardForm);
  const [creatingNextCard, setCreatingNextCard] = useState(false);
  const [lastCreatedCardId, setLastCreatedCardId] = useState<number | null>(null);

  const selectedCard = cards[index] ?? null;
  const evidenceItems = selectedCard?.evidence_items ?? [];

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedGate = useMemo(
    () => gates.find((gate) => String(gate.id) === selectedGateId) ?? null,
    [gates, selectedGateId]
  );

  const loadProjectsOptional = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Project[] = await response.json();
      setProjects(data);
      setProjectApiAvailable(true);
      return true;
    } catch {
      setProjects([]);
      setProjectApiAvailable(false);
      return false;
    }
  };

  const loadGatesOptional = async (projectId: string) => {
    if (!projectId) {
      setGates([]);
      setGateApiAvailable(true);
      return true;
    }
    try {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/gates`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Gate[] = await response.json();
      setGates(data);
      setGateApiAvailable(true);
      return true;
    } catch {
      setGates([]);
      setGateApiAvailable(false);
      setSelectedGateId("");
      return false;
    }
  };

  const loadQueue = async (projectId: string, gateId: string, opts?: { fallbackToGlobal?: boolean }) => {
    const fallbackToGlobal = opts?.fallbackToGlobal ?? true;
    const response = await fetch(queueUrl(projectId, gateId), { cache: "no-store" });
    if (response.ok) {
      const data: DecisionCard[] = await response.json();
      setCards(data);
      setIndex(0);
      setWarning((prev) => {
        if (prev?.includes("全体レビューへフォールバック")) {
          return null;
        }
        return prev;
      });
      return data;
    }

    if (fallbackToGlobal && (projectId || gateId)) {
      const fallbackResponse = await fetch(queueUrl("", ""), { cache: "no-store" });
      if (fallbackResponse.ok) {
        const fallbackData: DecisionCard[] = await fallbackResponse.json();
        setCards(fallbackData);
        setIndex(0);
        setWarning("フィルタ付きレビュー対象の取得に失敗したため、全体レビューへフォールバックしました。");
        return fallbackData;
      }
    }

    throw new Error("レビュー対象カードの取得に失敗しました。");
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const projectOk = await loadProjectsOptional();
        if (!projectOk) {
          setWarning("Project API の取得に失敗しました。全体レビューは継続できますが、Project / Gate フィルタは利用できません。");
        }
        await loadQueue("", "", { fallbackToGlobal: false });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "レビュー対象の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedGateId("");
      setGates([]);
      setGateApiAvailable(true);
      loadQueue("", "").catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "レビュー対象の取得に失敗しました。");
      });
      return;
    }

    (async () => {
      try {
        const gateOk = await loadGatesOptional(selectedProjectId);
        if (!gateOk) {
          setWarning("Gate API の取得に失敗しました。Project フィルタのみで全体レビューは継続できます。");
        } else if (warning?.includes("Gate API の取得に失敗")) {
          setWarning(null);
        }
        await loadQueue(selectedProjectId, gateOk ? selectedGateId : "");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "レビュー対象の取得に失敗しました。");
      }
    })();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !gateApiAvailable) return;
    loadQueue(selectedProjectId, selectedGateId).catch((err) => {
      console.error(err);
      setError(err instanceof Error ? err.message : "レビュー対象の取得に失敗しました。");
    });
  }, [selectedGateId]);

  useEffect(() => {
    if (selectedCard) {
      setDecisionForm({
        decision_result: "GO",
        acted_by: selectedCard.decider_name ?? "",
        comment: "",
      });
    } else {
      setDecisionForm(emptyDecision);
    }
  }, [selectedCard?.id]);

  const onDecide = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCard) return;
    setDeciding(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/cards/${selectedCard.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_result: decisionForm.decision_result,
          acted_by: toNullable(decisionForm.acted_by),
          comment: toNullable(decisionForm.comment),
        }),
      });
      if (!response.ok) throw new Error("判断結果の記録に失敗しました。");
      const decidedCard = selectedCard;
      const decidedResult = decisionForm.decision_result;
      setLastDecidedCard(decidedCard);
      setLastCreatedCardId(null);
      setNextCardForm(buildSuggestedNextCard(decidedCard, decidedResult));
      setShowNextCardForm(false);
      await loadQueue(selectedProjectId, gateApiAvailable ? selectedGateId : "");
      setMessage("判断結果を記録しました。必要なら次カードを作成できます。");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "判断結果の記録に失敗しました。");
    } finally {
      setDeciding(false);
    }
  };

  const onCreateNextCard = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lastDecidedCard) return;
    setCreatingNextCard(true);
    setError(null);
    setMessage(null);
    try {
      const createResponse = await fetch(`${API_BASE}/api/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextCardForm.title,
          decision_question: nextCardForm.decision_question,
          status_column: nextCardForm.status_column,
          decision_due_date: toNullable(nextCardForm.decision_due_date),
          owner_name: toNullable(nextCardForm.owner_name),
          decider_name: toNullable(nextCardForm.decider_name),
          blocker_type: toNullable(nextCardForm.blocker_type),
        }),
      });
      if (!createResponse.ok) throw new Error("次カード作成に失敗しました。");
      const created = await createResponse.json();
      setLastCreatedCardId(created.id);

      const autoContextPayload = buildAutoContextPayload(lastDecidedCard);
      let contextLinked = false;
      try {
        const contextResponse = await fetch(`${API_BASE}/api/cards/${created.id}/context`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(autoContextPayload),
        });
        contextLinked = contextResponse.ok;
      } catch {
        contextLinked = false;
      }

      setShowNextCardForm(false);
      setLastDecidedCard(null);
      setNextCardForm(emptyNextCardForm);
      if (contextLinked) {
        setMessage(`次カードを作成し、可能な範囲で Project / Gate / 親カードへ自動接続しました。#${created.id}`);
      } else {
        setMessage(`次カードを作成しました。文脈の自動接続はできなかったため、必要なら詳細画面で設定してください。#${created.id}`);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "次カード作成に失敗しました。");
    } finally {
      setCreatingNextCard(false);
    }
  };

  const onPrev = () => setIndex((prev) => Math.max(prev - 1, 0));
  const onNext = () => setIndex((prev) => Math.min(prev + 1, Math.max(cards.length - 1, 0)));

  if (loading) {
    return <main className="container"><p className="muted">読み込み中...</p></main>;
  }

  return (
    <main className="container detailPage">
      <div className="titlebar">
        <div>
          <h1 style={{ marginBottom: 6 }}>Review Mode</h1>
          <div className="muted">Project / Gate API が落ちても全体レビューを継続できるレビュー会議モード</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/" className="inlineLinkButton">ボードへ戻る</Link>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="inlineLinkButton">API Docs</a>
        </div>
      </div>

      {error ? <div className="alertBox">{error}</div> : null}
      {warning ? <div className="alertBox" style={{ background: 'rgba(124,74,3,0.16)', borderColor: 'rgba(255,210,127,0.35)', color: '#ffe4a8' }}>{warning}</div> : null}
      {message ? (
        <div className="successBox">
          <div>{message}</div>
          {lastCreatedCardId ? (
            <div style={{ marginTop: 8 }}>
              <Link href={`/cards/${lastCreatedCardId}`} className="inlineLinkButton">作成した次カードを開く</Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {lastDecidedCard ? (
        <section className="panelCard" style={{ marginTop: 18 }}>
          <div className="sectionTitleRow">
            <h2>次カード作成（任意）</h2>
            <span className="muted small">不要ならそのままレビュー継続で問題ありません</span>
          </div>
          {!showNextCardForm ? (
            <div style={{ marginTop: 14 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                直前に記録した判断 <strong>{lastDecidedCard.title}</strong> から、必要なら次の判断カードを作成できます。作成しなくてもレビューは継続できます。
              </p>
              <div className="small muted" style={{ marginBottom: 12 }}>
                作成した場合は、可能なら元カードの Project / Gate / 親カード文脈へ自動接続を試みます。失敗しても次カード作成自体は成功扱いです。
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowNextCardForm(true)} style={{ maxWidth: 240 }}>必要なら次カードを作成</button>
                <button type="button" onClick={() => { setLastDecidedCard(null); setShowNextCardForm(false); setNextCardForm(emptyNextCardForm); }} style={{ maxWidth: 220, background: 'rgba(15,22,48,0.95)', border: '1px solid var(--border)' }}>今は作成しない</button>
              </div>
            </div>
          ) : (
            <form onSubmit={onCreateNextCard} className="compactForm" style={{ marginTop: 14 }}>
              <div className="row2">
                <div>
                  <label>判断タイトル</label>
                  <input value={nextCardForm.title} onChange={(e) => setNextCardForm({ ...nextCardForm, title: e.target.value })} required />
                </div>
                <div>
                  <label>状態列</label>
                  <select value={nextCardForm.status_column} onChange={(e) => setNextCardForm({ ...nextCardForm, status_column: e.target.value as StatusColumn })}>
                    <option value="NOT_DECIDABLE">判断不可</option>
                    <option value="DECIDABLE">判断可能</option>
                    <option value="DECIDED">判断済み</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label>いま判断したいこと（1文）</label>
                <textarea value={nextCardForm.decision_question} onChange={(e) => setNextCardForm({ ...nextCardForm, decision_question: e.target.value })} required />
              </div>
              <div className="row3" style={{ marginTop: 12 }}>
                <div>
                  <label>判断目安日</label>
                  <input type="date" value={nextCardForm.decision_due_date} onChange={(e) => setNextCardForm({ ...nextCardForm, decision_due_date: e.target.value })} />
                </div>
                <div>
                  <label>Owner</label>
                  <input value={nextCardForm.owner_name} onChange={(e) => setNextCardForm({ ...nextCardForm, owner_name: e.target.value })} />
                </div>
                <div>
                  <label>Decider</label>
                  <input value={nextCardForm.decider_name} onChange={(e) => setNextCardForm({ ...nextCardForm, decider_name: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label>ブロッカー種別</label>
                <input value={nextCardForm.blocker_type} onChange={(e) => setNextCardForm({ ...nextCardForm, blocker_type: e.target.value })} />
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={creatingNextCard} style={{ maxWidth: 220 }}>{creatingNextCard ? '作成中...' : '次カードを作成'}</button>
                <button type="button" onClick={() => setShowNextCardForm(false)} style={{ maxWidth: 180, background: 'rgba(15,22,48,0.95)', border: '1px solid var(--border)' }}>戻る</button>
                <button type="button" onClick={() => { setLastDecidedCard(null); setShowNextCardForm(false); setNextCardForm(emptyNextCardForm); }} style={{ maxWidth: 180, background: 'rgba(15,22,48,0.95)', border: '1px solid var(--border)' }}>作成しない</button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow">
          <h2>フィルタ</h2>
          <span className="muted small">判断可能カードのみ表示 / API 障害時は全体レビューへフォールバック</span>
        </div>
        {!projectApiAvailable ? (
          <p className="muted" style={{ marginTop: 14 }}>
            Project API が利用できないため、Project / Gate フィルタは無効です。現在は全体レビューで継続しています。
          </p>
        ) : (
          <div className="row2" style={{ marginTop: 14 }}>
            <div>
              <label>Project</label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                <option value="">全Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code ? `${project.code} / ${project.name}` : project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Gate</label>
              <select value={selectedGateId} onChange={(e) => setSelectedGateId(e.target.value)} disabled={!selectedProjectId || !gateApiAvailable}>
                <option value="">全Gate</option>
                {gates.map((gate) => (
                  <option key={gate.id} value={gate.id}>{`G${gate.sequence_no} / ${gate.name}`}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {(selectedProject || selectedGate) ? (
          <div className="evidenceList">
            {selectedProject ? (
              <article className="subCard">
                <div className="sectionTitleRow"><strong>選択中 Project</strong><span className="small muted">フィルタ条件</span></div>
                <div style={{ marginTop: 10 }}>{selectedProject.code ? `${selectedProject.code} / ${selectedProject.name}` : selectedProject.name}</div>
              </article>
            ) : null}
            {selectedGate ? (
              <article className="subCard">
                <div className="sectionTitleRow"><strong>選択中 Gate</strong><span className="small muted">フィルタ条件</span></div>
                <div className="row2" style={{ marginTop: 10 }}>
                  <div><div className="small muted">Gate</div><div>{`G${selectedGate.sequence_no} / ${selectedGate.name}`}</div></div>
                  <div><div className="small muted">状態</div><div>{gateStatusLabel(selectedGate.gate_status)}</div></div>
                </div>
              </article>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow">
          <h2>対象カード</h2>
          <span className="muted small">{cards.length}件 / {cards.length === 0 ? 0 : index + 1}件目</span>
        </div>

        {!selectedCard ? (
          <p className="muted" style={{ marginTop: 14 }}>現在処理できる「判断可能」カードはありません。</p>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div className="detailMetaRow">
              <span className="badge decidable">判断可能</span>
              {selectedCard.context?.project ? (
                <span className="badge neutral">{selectedCard.context.project.code ? `${selectedCard.context.project.code} / ${selectedCard.context.project.name}` : selectedCard.context.project.name}</span>
              ) : null}
              {selectedCard.context?.gate ? (
                <span className="badge neutral">{`G${selectedCard.context.gate.sequence_no} / ${selectedCard.context.gate.name}`}</span>
              ) : null}
              {selectedCard.context?.gate ? (
                <span className="badge neutral">{gateStatusLabel(selectedCard.context.gate.gate_status)}</span>
              ) : null}
            </div>

            <div className="subCard">
              <div className="sectionTitleRow">
                <strong style={{ fontSize: 20 }}>{selectedCard.title}</strong>
                <span className="muted small">#{selectedCard.id}</span>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>{selectedCard.decision_question}</p>

              <div className="row3" style={{ marginTop: 12 }}>
                <div><div className="small muted">判断目安日</div><div>{selectedCard.decision_due_date ?? "-"}</div></div>
                <div><div className="small muted">Owner</div><div>{selectedCard.owner_name ?? "-"}</div></div>
                <div><div className="small muted">Decider</div><div>{selectedCard.decider_name ?? "-"}</div></div>
              </div>

              <div className="row2" style={{ marginTop: 12 }}>
                <div><div className="small muted">ここまでに分かったこと</div><div>{selectedCard.summary_known ?? "-"}</div></div>
                <div><div className="small muted">不足材料</div><div>{selectedCard.summary_missing ?? "-"}</div></div>
              </div>

              <div style={{ marginTop: 12 }}><div className="small muted">次にやる計画</div><div>{selectedCard.next_plan ?? "-"}</div></div>
              <div style={{ marginTop: 12 }}><div className="small muted">ブロッカー</div><div>{selectedCard.blocker_type ?? "-"}</div></div>

              {selectedCard.context ? (
                <div className="row2" style={{ marginTop: 12 }}>
                  <div><div className="small muted">Gate 目標日</div><div>{selectedCard.context.gate_target_date ?? "-"}</div></div>
                  <div><div className="small muted">レビュー会ラベル</div><div>{selectedCard.context.review_meeting_label ?? "-"}</div></div>
                </div>
              ) : null}

              {selectedCard.context?.decision_criteria ? (
                <div style={{ marginTop: 12 }}><div className="small muted">判断基準</div><div>{selectedCard.context.decision_criteria}</div></div>
              ) : null}
            </div>

            <div className="sectionTitleRow" style={{ marginTop: 16 }}>
              <h3 style={{ margin: 0 }}>判断入力</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={onPrev} disabled={index === 0} style={{ width: 120 }}>前へ</button>
                <button type="button" onClick={onNext} disabled={index >= cards.length - 1} style={{ width: 120 }}>次へ</button>
              </div>
            </div>

            <form onSubmit={onDecide} className="compactForm" style={{ marginTop: 12 }}>
              <div className="row2">
                <div>
                  <label>判断結果</label>
                  <select value={decisionForm.decision_result} onChange={(e) => setDecisionForm({ ...decisionForm, decision_result: e.target.value as DecisionResult })}>
                    <option value="GO">GO</option>
                    <option value="NO_GO">NO-GO</option>
                    <option value="HOLD">HOLD</option>
                    <option value="CONDITIONAL_GO">条件付きGO</option>
                    <option value="PIVOT">PIVOT</option>
                  </select>
                </div>
                <div>
                  <label>決定者</label>
                  <input value={decisionForm.acted_by} onChange={(e) => setDecisionForm({ ...decisionForm, acted_by: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label>決定理由コメント</label>
                <textarea value={decisionForm.comment} onChange={(e) => setDecisionForm({ ...decisionForm, comment: e.target.value })} placeholder="会議中に短く記録する" />
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button disabled={deciding} style={{ maxWidth: 220 }}>{deciding ? '記録中...' : `${decisionResultLabel(decisionForm.decision_result)} を記録`}</button>
                <Link href={`/cards/${selectedCard.id}`} className="inlineLinkButton">詳細画面を開く</Link>
              </div>
            </form>

            <div className="evidenceList">
              <div className="sectionTitleRow"><h3 style={{ margin: 0 }}>判断材料</h3><span className="muted small">{evidenceItems.length}件</span></div>
              {evidenceItems.length === 0 ? (
                <p className="muted">判断材料はまだありません。</p>
              ) : (
                evidenceItems.map((item) => (
                  <article key={item.id} className="subCard">
                    <div className="sectionTitleRow"><strong>{item.title}</strong><span className="badge neutral">{item.status}</span></div>
                    <div className="row2" style={{ marginTop: 10 }}>
                      <div><div className="small muted">担当</div><div>{item.owner_name ?? "-"}</div></div>
                      <div><div className="small muted">期限</div><div>{item.due_date ?? "-"}</div></div>
                    </div>
                    {item.note ? <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>{item.note}</p> : null}
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
