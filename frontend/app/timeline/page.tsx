"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StatusColumn = "DECIDABLE" | "NOT_DECIDABLE" | "DECIDED";
type GateStatus = "PLANNED" | "OPEN" | "PASSED" | "BLOCKED" | "FAILED";

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
  decision_due_date?: string | null;
  owner_name?: string | null;
  decider_name?: string | null;
  blocker_type?: string | null;
  summary_known?: string | null;
  summary_missing?: string | null;
  next_plan?: string | null;
  context?: CardContext | null;
  created_at?: string;
  updated_at?: string;
};

type TimelineLane = {
  key: string;
  label: string;
  projectId?: number | null;
  gateId?: number | null;
  projectName?: string | null;
  gateName?: string | null;
  gateSeq?: number | null;
  items: TimelineItem[];
};

type TimelineItem = {
  kind: "card" | "gate";
  id: string;
  date: string;
  title: string;
  subtitle?: string | null;
  color: string;
  href?: string;
  statusText?: string;
  overdue?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.length <= 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(value?: string | null): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * DAY_MS);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function statusLabel(status: StatusColumn): string {
  switch (status) {
    case "DECIDABLE":
      return "判断可能";
    case "NOT_DECIDABLE":
      return "判断不可";
    case "DECIDED":
      return "判断済み";
    default:
      return status;
  }
}

function cardColor(status: StatusColumn): string {
  switch (status) {
    case "DECIDABLE":
      return "#22c55e";
    case "NOT_DECIDABLE":
      return "#f59e0b";
    case "DECIDED":
      return "#60a5fa";
    default:
      return "#a5b4fc";
  }
}

function gateStatusLabel(status: GateStatus): string {
  switch (status) {
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
      return status;
  }
}

function gateColor(status: GateStatus): string {
  switch (status) {
    case "PLANNED":
      return "#c084fc";
    case "OPEN":
      return "#38bdf8";
    case "PASSED":
      return "#34d399";
    case "BLOCKED":
      return "#f59e0b";
    case "FAILED":
      return "#f87171";
    default:
      return "#cbd5e1";
  }
}

function projectDisplay(project?: Project | null): string {
  if (!project) return "未紐づけ";
  return project.code ? `${project.code} / ${project.name}` : project.name;
}

function gateDisplay(gate?: Gate | null): string {
  if (!gate) return "Gate未設定";
  return `G${gate.sequence_no} / ${gate.name}`;
}

export default function TimelinePage() {
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedGateId, setSelectedGateId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [searchText, setSearchText] = useState("");
  const [windowDays, setWindowDays] = useState(90);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const cardsRes = await fetch(`${API_BASE}/api/cards`, { cache: "no-store" });
        if (!cardsRes.ok) {
          throw new Error("カード一覧の取得に失敗しました。");
        }
        const cardsJson: DecisionCard[] = await cardsRes.json();
        setCards(cardsJson);

        const warningMessages: string[] = [];

        try {
          const projectsRes = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
          if (!projectsRes.ok) throw new Error();
          const projectsJson: Project[] = await projectsRes.json();
          setProjects(projectsJson);

          try {
            const gatesArrays = await Promise.all(
              projectsJson.map(async (project) => {
                const gatesRes = await fetch(`${API_BASE}/api/projects/${project.id}/gates`, { cache: "no-store" });
                if (!gatesRes.ok) throw new Error();
                return (await gatesRes.json()) as Gate[];
              })
            );
            setGates(gatesArrays.flat());
          } catch {
            setGates([]);
            warningMessages.push("Gate API の取得に失敗しました。カード中心のタイムラインとして継続します。");
          }
        } catch {
          setProjects([]);
          setGates([]);
          warningMessages.push("Project / Gate API の取得に失敗しました。カード中心のタイムラインとして継続します。");
        }

        setWarning(warningMessages.length > 0 ? warningMessages.join(" ") : null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "データ取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const owners = useMemo(() => {
    const set = new Set<string>();
    cards.forEach((card) => {
      if (card.owner_name?.trim()) set.add(card.owner_name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [cards]);

  const availableGates = useMemo(() => {
    if (!selectedProjectId) return gates;
    return gates.filter((gate) => String(gate.project_id) === selectedProjectId);
  }, [gates, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    if (!availableGates.some((gate) => String(gate.id) === selectedGateId)) {
      setSelectedGateId("");
    }
  }, [availableGates, selectedGateId, selectedProjectId]);

  const filteredCards = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return cards.filter((card) => {
      const projectId = card.context?.project_id ?? card.context?.project?.id ?? null;
      const gateId = card.context?.gate_id ?? card.context?.gate?.id ?? null;
      if (selectedProjectId && String(projectId ?? "") !== selectedProjectId) return false;
      if (selectedGateId && String(gateId ?? "") !== selectedGateId) return false;
      if (selectedStatus && card.status_column !== selectedStatus) return false;
      if (selectedOwner && (card.owner_name ?? "") !== selectedOwner) return false;
      if (search) {
        const hay = [
          card.title,
          card.decision_question,
          card.owner_name,
          card.decider_name,
          card.blocker_type,
          card.context?.review_meeting_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [cards, searchText, selectedProjectId, selectedGateId, selectedStatus, selectedOwner]);

  const timelineLanes = useMemo(() => {
    const lanesMap = new Map<string, TimelineLane>();
    const today = startOfDay(new Date());

    const ensureLane = (
      key: string,
      label: string,
      projectId?: number | null,
      gateId?: number | null,
      projectName?: string | null,
      gateName?: string | null,
      gateSeq?: number | null
    ) => {
      if (!lanesMap.has(key)) {
        lanesMap.set(key, {
          key,
          label,
          projectId,
          gateId,
          projectName,
          gateName,
          gateSeq,
          items: [],
        });
      }
      return lanesMap.get(key)!;
    };

    filteredCards.forEach((card) => {
      const dateKey = toDateKey(card.decision_due_date) ?? toDateKey(card.context?.gate_target_date);
      if (!dateKey) return;

      const contextProject = card.context?.project ?? null;
      const contextGate = card.context?.gate ?? null;
      const projectId = card.context?.project_id ?? contextProject?.id ?? null;
      const gateId = card.context?.gate_id ?? contextGate?.id ?? null;
      const projectName = projectDisplay(contextProject);
      const gateName = gateDisplay(contextGate);
      const laneKey = gateId != null ? `gate:${gateId}` : projectId != null ? `project:${projectId}` : `floating`;
      const laneLabel = gateId != null ? `${projectName} / ${gateName}` : projectId != null ? `${projectName} / 判断カード` : "未紐づけ / 判断カード";
      const lane = ensureLane(laneKey, laneLabel, projectId, gateId, projectName, contextGate?.name ?? null, contextGate?.sequence_no ?? null);
      const overdue = parseDate(dateKey) ? parseDate(dateKey)!.getTime() < today.getTime() && card.status_column !== "DECIDED" : false;
      lane.items.push({
        kind: "card",
        id: `card-${card.id}`,
        date: dateKey,
        title: card.title,
        subtitle: card.owner_name ?? null,
        color: overdue ? "#ef4444" : cardColor(card.status_column),
        href: `/cards/${card.id}`,
        statusText: `${statusLabel(card.status_column)} / ${formatDate(dateKey)}`,
        overdue,
      });
    });

    gates.forEach((gate) => {
      if (selectedProjectId && String(gate.project_id) !== selectedProjectId) return;
      if (selectedGateId && String(gate.id) !== selectedGateId) return;
      const dateKey = toDateKey(gate.planned_review_date) ?? toDateKey(gate.actual_review_date);
      if (!dateKey) return;
      const project = projects.find((p) => p.id === gate.project_id) ?? null;
      const laneKey = `gate:${gate.id}`;
      const laneLabel = `${projectDisplay(project)} / ${gateDisplay(gate)}`;
      const lane = ensureLane(laneKey, laneLabel, gate.project_id, gate.id, projectDisplay(project), gate.name, gate.sequence_no);
      lane.items.push({
        kind: "gate",
        id: `gate-${gate.id}`,
        date: dateKey,
        title: `Gate ${gate.sequence_no}`,
        subtitle: gate.name,
        color: gateColor(gate.gate_status),
        statusText: `${gateStatusLabel(gate.gate_status)} / ${formatDate(dateKey)}`,
      });
    });

    return Array.from(lanesMap.values()).sort((a, b) => {
      const pa = a.projectName ?? "";
      const pb = b.projectName ?? "";
      if (pa !== pb) return pa.localeCompare(pb, "ja");
      const ga = a.gateSeq ?? Number.MAX_SAFE_INTEGER;
      const gb = b.gateSeq ?? Number.MAX_SAFE_INTEGER;
      if (ga !== gb) return ga - gb;
      return a.label.localeCompare(b.label, "ja");
    });
  }, [filteredCards, gates, projects, selectedProjectId, selectedGateId]);

  const timelineDates = useMemo(() => {
    const allDates: Date[] = [];
    timelineLanes.forEach((lane) => lane.items.forEach((item) => {
      const parsed = parseDate(item.date);
      if (parsed) allDates.push(parsed);
    }));
    const today = startOfDay(new Date());

    let minDate = today;
    let maxDate = addDays(today, windowDays - 1);

    if (allDates.length > 0) {
      allDates.sort((a, b) => a.getTime() - b.getTime());
      const observedMin = startOfDay(allDates[0]);
      const observedMax = startOfDay(allDates[allDates.length - 1]);
      minDate = startOfDay(new Date(Math.min(observedMin.getTime(), addDays(today, -14).getTime())));
      maxDate = startOfDay(new Date(Math.max(observedMax.getTime(), addDays(minDate, windowDays - 1).getTime(), addDays(today, 21).getTime())));
    }

    const days: Date[] = [];
    for (let cursor = startOfDay(minDate); cursor.getTime() <= maxDate.getTime(); cursor = addDays(cursor, 1)) {
      days.push(cursor);
    }

    return { days, minDate, maxDate };
  }, [timelineLanes, windowDays]);

  const todayLeftPercent = useMemo(() => {
    const { minDate, maxDate } = timelineDates;
    const span = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / DAY_MS));
    const offset = Math.round((startOfDay(new Date()).getTime() - minDate.getTime()) / DAY_MS);
    return clamp((offset / span) * 100, 0, 100);
  }, [timelineDates]);

  const summaryCards = useMemo(() => {
    const undecided = filteredCards.filter((card) => card.status_column !== "DECIDED").length;
    const decidable = filteredCards.filter((card) => card.status_column === "DECIDABLE").length;
    const overdue = filteredCards.filter((card) => {
      const key = toDateKey(card.decision_due_date) ?? toDateKey(card.context?.gate_target_date);
      const parsed = parseDate(key);
      return parsed ? parsed.getTime() < startOfDay(new Date()).getTime() && card.status_column !== "DECIDED" : false;
    }).length;
    return { undecided, decidable, overdue, total: filteredCards.length };
  }, [filteredCards]);

  if (loading) {
    return <main className="container"><p className="muted">読み込み中...</p></main>;
  }

  if (error) {
    return (
      <main className="container">
        <div className="titlebar">
          <h1>判断点タイムライン</h1>
          <Link href="/" className="inlineLinkButton">ボードへ戻る</Link>
        </div>
        <div className="alertBox">{error}</div>
      </main>
    );
  }

  return (
    <main className="container timelinePageRoot">
      <div className="titlebar">
        <div>
          <h1 style={{ marginBottom: 6 }}>判断点タイムライン</h1>
          <div className="muted">Excelガントの代替として、Project / Gate / 判断カードを時間軸で俯瞰するビュー</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" className="inlineLinkButton">ボードへ戻る</Link>
          <Link href="/review" className="inlineLinkButton">Review Mode</Link>
          <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="inlineLinkButton">API Docs</a>
        </div>
      </div>

      {warning ? <div className="alertBox warningTone">{warning}</div> : null}

      <section className="grid timelineStats" style={{ marginTop: 18 }}>
        <div className="stat"><div className="label">表示中カード</div><div className="value">{summaryCards.total}</div></div>
        <div className="stat"><div className="label">未判断</div><div className="value">{summaryCards.undecided}</div></div>
        <div className="stat"><div className="label">判断可能</div><div className="value">{summaryCards.decidable}</div></div>
        <div className="stat"><div className="label">期限超過</div><div className="value">{summaryCards.overdue}</div></div>
      </section>

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow">
          <h2>フィルタ</h2>
          <span className="muted small">カード中心 / Gate が取れれば上位判断点も重ねて表示</span>
        </div>
        <div className="row3" style={{ marginTop: 14 }}>
          <div>
            <label>Project</label>
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">全Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{projectDisplay(project)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Gate</label>
            <select value={selectedGateId} onChange={(e) => setSelectedGateId(e.target.value)} disabled={!selectedProjectId || availableGates.length === 0}>
              <option value="">全Gate</option>
              {availableGates.map((gate) => (
                <option key={gate.id} value={gate.id}>{gateDisplay(gate)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>状態</label>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="">全状態</option>
              <option value="DECIDABLE">判断可能</option>
              <option value="NOT_DECIDABLE">判断不可</option>
              <option value="DECIDED">判断済み</option>
            </select>
          </div>
        </div>
        <div className="row3" style={{ marginTop: 12 }}>
          <div>
            <label>Owner</label>
            <select value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}>
              <option value="">全Owner</option>
              {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
          </div>
          <div>
            <label>検索</label>
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="タイトル / 判断文 / レビュー会ラベル" />
          </div>
          <div>
            <label>表示範囲</label>
            <select value={String(windowDays)} onChange={(e) => setWindowDays(Number(e.target.value))}>
              <option value="45">45日</option>
              <option value="90">90日</option>
              <option value="180">180日</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panelCard" style={{ marginTop: 18 }}>
        <div className="sectionTitleRow">
          <h2>タイムライン</h2>
          <span className="muted small">縦: Project / Gate / 未紐づけ, 横: 日付, 点: 判断点</span>
        </div>
        {timelineLanes.length === 0 ? (
          <p className="muted" style={{ marginTop: 14 }}>表示条件に合う日付付きの判断カード / Gate がまだありません。</p>
        ) : (
          <div className="timelineBoardWrap">
            <div className="timelineBoardGrid headerRow">
              <div className="laneLabelCell">レーン</div>
              <div className="timelineCanvas headerCanvas">
                <div className="todayLine" style={{ left: `${todayLeftPercent}%` }} />
                {timelineDates.days.map((day, idx) => (
                  <div key={`d-${idx}`} className="dayCell" style={{ left: `${(idx / Math.max(1, timelineDates.days.length - 1)) * 100}%` }}>
                    <div className="small muted">{day.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</div>
                    <div className="verySmall muted">{day.toLocaleDateString("ja-JP", { weekday: "short" })}</div>
                  </div>
                ))}
              </div>
            </div>
            {timelineLanes.map((lane) => (
              <div key={lane.key} className="timelineBoardGrid laneRow">
                <div className="laneLabelCell">
                  <div style={{ fontWeight: 700 }}>{lane.label}</div>
                  <div className="small muted">{lane.items.length}件</div>
                </div>
                <div className="timelineCanvas laneCanvas">
                  <div className="todayLine" style={{ left: `${todayLeftPercent}%` }} />
                  {timelineDates.days.map((_, idx) => (
                    <div key={`grid-${lane.key}-${idx}`} className={`gridTick ${idx % 7 === 0 ? "weekTick" : ""}`} style={{ left: `${(idx / Math.max(1, timelineDates.days.length - 1)) * 100}%` }} />
                  ))}
                  {lane.items.map((item) => {
                    const itemDate = parseDate(item.date);
                    if (!itemDate) return null;
                    const left = clamp(((startOfDay(itemDate).getTime() - timelineDates.minDate.getTime()) / Math.max(DAY_MS, (timelineDates.maxDate.getTime() - timelineDates.minDate.getTime()))) * 100, 0, 100);
                    return (
                      <div key={item.id} className="timelinePointWrap" style={{ left: `${left}%` }}>
                        {item.kind === "gate" ? (
                          <div className="timelineDiamond" style={{ background: item.color }} title={`${item.title} / ${item.statusText ?? ""}`} />
                        ) : (
                          <div className="timelineDot" style={{ background: item.color, boxShadow: item.overdue ? "0 0 0 4px rgba(239,68,68,0.15)" : undefined }} title={`${item.title} / ${item.statusText ?? ""}`} />
                        )}
                        <div className="timelineLabelCard">
                          <div className="sectionTitleRow" style={{ gap: 8 }}>
                            {item.href ? <Link href={item.href} className="timelineItemLink">{item.title}</Link> : <strong>{item.title}</strong>}
                            <span className="small muted">{formatDate(item.date)}</span>
                          </div>
                          {item.subtitle ? <div className="small muted" style={{ marginTop: 6 }}>{item.subtitle}</div> : null}
                          {item.statusText ? <div className="verySmall muted" style={{ marginTop: 6 }}>{item.statusText}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1.05fr 0.95fr", marginTop: 18 }}>
        <section className="panelCard">
          <div className="sectionTitleRow">
            <h2>会議用サマリー</h2>
            <span className="muted small">Excel一覧の代替として使う想定</span>
          </div>
          <div className="summaryTableWrap">
            <div className="summaryTable summaryHeader">
              <div>Project / Gate</div>
              <div>次の判断点</div>
              <div>判断可能</div>
              <div>期限超過</div>
            </div>
            {timelineLanes.length === 0 ? (
              <div className="muted" style={{ marginTop: 14 }}>サマリー表示対象がありません。</div>
            ) : (
              timelineLanes.map((lane) => {
                const cardsOnly = lane.items.filter((item) => item.kind === "card");
                const nextItem = lane.items.slice().sort((a, b) => (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0))[0];
                const overdueCount = cardsOnly.filter((item) => item.overdue).length;
                const decidableCount = cardsOnly.filter((item) => item.statusText?.includes("判断可能")).length;
                return (
                  <div key={`summary-${lane.key}`} className="summaryTable summaryRow">
                    <div>{lane.label}</div>
                    <div>{nextItem ? `${nextItem.title} (${formatDate(nextItem.date)})` : "-"}</div>
                    <div>{decidableCount}</div>
                    <div>{overdueCount}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="panelCard">
          <div className="sectionTitleRow">
            <h2>使いどころ</h2>
            <span className="muted small">普通のガントに戻さないための注意</span>
          </div>
          <div className="evidenceList">
            <article className="subCard">
              <strong>何をやるかではなく、いつ次に決めるかを見る</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                本ビューでは工程バーではなく判断点を主役にしています。遅延は「未判断の停滞」として見る想定です。
              </p>
            </article>
            <article className="subCard">
              <strong>Gate は上位判断点、カードはその下の具体判断</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                Gate が取得できる環境では、Project / Gate / 判断カードを同じ時間軸で重ねて表示します。
              </p>
            </article>
            <article className="subCard">
              <strong>うまくなかった所は後から直せるように単純構造で実装</strong>
              <p className="muted small" style={{ marginBottom: 0 }}>
                GUI 要件が固まっていない前提で、まずは触れる形のビューを優先しています。色・配置・粒度は次に調整しやすい構成です。
              </p>
            </article>
          </div>
        </section>
      </section>

      <style jsx global>{`
        .timelinePageRoot .timelineStats {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .timelineBoardWrap {
          margin-top: 14px;
          overflow-x: auto;
          border: 1px solid rgba(159, 176, 214, 0.16);
          border-radius: 14px;
        }
        .timelineBoardGrid {
          display: grid;
          grid-template-columns: 260px minmax(1200px, 1fr);
          min-width: 1460px;
        }
        .headerRow {
          background: rgba(11, 16, 32, 0.45);
          border-bottom: 1px solid rgba(159, 176, 214, 0.16);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .laneRow + .laneRow {
          border-top: 1px solid rgba(159, 176, 214, 0.12);
        }
        .laneLabelCell {
          padding: 16px;
          border-right: 1px solid rgba(159, 176, 214, 0.12);
          background: rgba(19, 26, 46, 0.7);
          position: sticky;
          left: 0;
          z-index: 1;
        }
        .timelineCanvas {
          position: relative;
          min-height: 82px;
          background:
            linear-gradient(180deg, rgba(19, 26, 46, 0.55) 0%, rgba(27, 35, 64, 0.55) 100%);
        }
        .headerCanvas {
          min-height: 64px;
        }
        .laneCanvas {
          min-height: 110px;
        }
        .dayCell {
          position: absolute;
          top: 10px;
          transform: translateX(-50%);
          width: 44px;
          text-align: center;
        }
        .gridTick {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(159, 176, 214, 0.08);
        }
        .weekTick {
          background: rgba(159, 176, 214, 0.16);
        }
        .todayLine {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, rgba(244, 63, 94, 0.9), rgba(251, 191, 36, 0.9));
          z-index: 1;
        }
        .timelinePointWrap {
          position: absolute;
          top: 20px;
          transform: translateX(-50%);
          width: 0;
          z-index: 3;
        }
        .timelineDot {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgba(11, 16, 32, 0.95);
          margin-left: -7px;
        }
        .timelineDiamond {
          width: 16px;
          height: 16px;
          transform: translateX(-8px) rotate(45deg);
          border: 2px solid rgba(11, 16, 32, 0.95);
        }
        .timelineLabelCard {
          margin-top: 8px;
          min-width: 200px;
          max-width: 260px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(15, 22, 48, 0.96);
          border: 1px solid rgba(89, 119, 198, 0.35);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
        }
        .timelineItemLink {
          color: inherit;
          font-weight: 700;
          text-decoration: none;
        }
        .verySmall {
          font-size: 11px;
        }
        .warningTone {
          background: rgba(124, 74, 3, 0.16) !important;
          border-color: rgba(255, 210, 127, 0.35) !important;
          color: #ffe4a8 !important;
        }
        .summaryTableWrap {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }
        .summaryTable {
          display: grid;
          grid-template-columns: 1.25fr 1.35fr 120px 120px;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
        }
        .summaryHeader {
          background: rgba(15, 22, 48, 0.95);
          border: 1px solid rgba(159, 176, 214, 0.14);
          font-weight: 700;
        }
        .summaryRow {
          background: rgba(27, 35, 64, 0.72);
          border: 1px solid rgba(159, 176, 214, 0.12);
        }
        @media (max-width: 1200px) {
          .timelinePageRoot .timelineStats {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 900px) {
          .timelinePageRoot .timelineStats,
          .summaryTable {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
