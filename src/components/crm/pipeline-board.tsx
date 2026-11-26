"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScoreBadge, useToast } from "@/components/ui";
import { cn, formatEuro, STAGES, stageLabel, type StageId } from "@/lib/utils";
import type { PipelineCard } from "@/lib/crm/types";
import { FollowUpBadge } from "./bits";
import { api } from "./client-api";
import { LostReasonDialog } from "./lost-reason-dialog";
import { useSynced } from "./use-lead";

type Columns = Record<StageId, PipelineCard[]>;
type Move = { leadId: string; stage: StageId; index: number; from: StageId };

const STAGE_SET = new Set<string>(STAGES.map((s) => s.id));

export function groupByStage(cards: PipelineCard[]): Columns {
  const cols = Object.fromEntries(STAGES.map((s) => [s.id, [] as PipelineCard[]])) as unknown as Columns;
  for (const c of cards) (cols[c.stage as StageId] ?? cols.new).push(c);
  for (const s of STAGES) cols[s.id].sort((a, b) => a.position - b.position);
  return cols;
}

export function PipelineBoard({ cards }: { cards: PipelineCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => groupByStage(cards), [cards]);
  const [columns, setColumns] = useSynced(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<Move | null>(null);
  const snapshot = useRef<Columns | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: UniqueIdentifier, cols = columns): StageId | null => {
    if (STAGE_SET.has(String(id))) return id as StageId;
    for (const s of STAGES) if (cols[s.id].some((c) => c.id === id)) return s.id;
    return null;
  };
  const findCard = (id: string | null) => (id ? STAGES.flatMap((s) => columns[s.id]).find((c) => c.id === id) ?? null : null);
  const nameOf = (id: UniqueIdentifier) => findCard(String(id))?.name ?? "Cliente";

  function onDragStart(e: DragStartEvent) {
    snapshot.current = columns;
    setActiveId(String(e.active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const card = cols[from].find((c) => c.id === active.id);
      if (!card) return cols;
      const overIndex = cols[to].findIndex((c) => c.id === over.id);
      const below = over.rect && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      const index = overIndex < 0 ? cols[to].length : overIndex + (below ? 1 : 0);
      const target = [...cols[to]];
      target.splice(index, 0, { ...card, stage: to });
      return { ...cols, [from]: cols[from].filter((c) => c.id !== active.id), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const before = snapshot.current;
    if (!over || !before) return restore();
    const to = findContainer(over.id);
    const fromNow = findContainer(active.id);
    if (!to || !fromNow) return restore();
    let cols = columns;
    if (fromNow === to) {
      const oldIndex = cols[to].findIndex((c) => c.id === active.id);
      const overIndex = cols[to].findIndex((c) => c.id === over.id);
      const newIndex = overIndex < 0 ? cols[to].length - 1 : overIndex;
      if (oldIndex !== newIndex) {
        cols = { ...cols, [to]: arrayMove(cols[to], oldIndex, newIndex) };
        setColumns(cols);
      }
    }
    const index = cols[to].findIndex((c) => c.id === active.id);
    const origin = findContainer(active.id, before)!;
    const originIndex = before[origin].findIndex((c) => c.id === active.id);
    if (origin === to && originIndex === index) return;
    const move: Move = { leadId: String(active.id), stage: to, index, from: origin };
    if (to === "lost" && origin !== "lost") return setPendingLost(move);
    commit(move, before);
  }

  function restore() {
    if (snapshot.current) setColumns(snapshot.current);
    snapshot.current = null;
    setActiveId(null);
  }

  async function commit(move: Move, before: Columns | null, lostReason?: string | null) {
    const res = await api("/api/pipeline", "POST", { leadId: move.leadId, stage: move.stage, index: move.index, lostReason });
    if (!res.ok) {
      if (before) setColumns(before);
      toast(`Spostamento non riuscito: ${res.error}`, "error");
      return;
    }
    if (move.from !== move.stage) toast(`Spostato in ${stageLabel(move.stage)}`, "info");
    router.refresh();
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Hai preso ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} è sopra ${STAGE_SET.has(String(over.id)) ? stageLabel(String(over.id)) : nameOf(over.id)}.` : `${nameOf(active.id)} non è sopra nessuna colonna.`),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} rilasciato in ${stageLabel(findContainer(over.id) ?? "")}.` : `${nameOf(active.id)} rilasciato.`),
    onDragCancel: ({ active }) => `Spostamento di ${nameOf(active.id)} annullato.`,
  };

  const active = findCard(activeId);

  return (
    <>
      <DndContext
        id="pipeline-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={restore}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "Premi spazio per prendere il cliente. Usa le frecce per spostarlo tra le colonne, spazio per rilasciarlo, Esc per annullare.",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-3 snap-x snap-mandatory scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:-mx-10 lg:px-10 lg:snap-none">
          <div className="flex gap-3">
            {STAGES.map((s) => <Column key={s.id} stage={s.id} label={s.label} cards={columns[s.id]} />)}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {active ? <CardBody card={active} overlay /> : null}
        </DragOverlay>
      </DndContext>
      <LostReasonDialog
        open={pendingLost !== null}
        leadName={pendingLost ? nameOf(pendingLost.leadId) : undefined}
        onCancel={() => { setPendingLost(null); restore(); }}
        onConfirm={(reason) => {
          const move = pendingLost!;
          setPendingLost(null);
          commit(move, snapshot.current, reason);
          snapshot.current = null;
        }}
      />
    </>
  );
}

function Column({ stage, label, cards }: { stage: StageId; label: string; cards: PipelineCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = cards.reduce((a, c) => a + (c.value ?? 0), 0);
  return (
    <section className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[var(--radius)] border border-line bg-surface-2/50 sm:w-[272px]" aria-label={`${label}: ${cards.length} clienti`}>
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--stage-${stage})` }} aria-hidden />
          <h2 className="truncate text-[13.5px] font-semibold">{label}</h2>
          <span className="rounded-full bg-surface px-1.5 text-[11.5px] font-medium tabular-nums text-ink-2">{cards.length}</span>
        </div>
        <span className="text-[12px] font-medium tabular-nums text-ink-3">{formatEuro(total)}</span>
      </header>
      <SortableContext id={stage} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef}
          className={cn("flex h-[calc(100dvh-300px)] min-h-[240px] flex-col gap-2 overflow-y-auto p-2 transition-colors lg:h-[calc(100dvh-250px)]", isOver && "bg-accent-soft/40")}>
          {cards.map((c) => <SortableCard key={c.id} card={c} />)}
          {cards.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-[12.5px] text-ink-3">
              Trascina qui un cliente
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ card }: { card: PipelineCard }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={(el) => { setNodeRef(el); setActivatorNodeRef(el); }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="cliente trascinabile"
      aria-label={`${card.name}, ${stageLabel(card.stage)}`}
      className={cn("touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent", isDragging && "opacity-40")}
    >
      <CardBody card={card} />
    </li>
  );
}

function CardBody({ card, overlay }: { card: PipelineCard; overlay?: boolean }) {
  return (
    <div className={cn(
      "cursor-grab select-none rounded-xl border border-line bg-surface p-3 shadow-card transition-shadow hover:border-line-strong active:cursor-grabbing",
      overlay && "rotate-[1.5deg] cursor-grabbing shadow-pop ring-1 ring-ink/5",
    )}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/app/leads/${card.id}`} className="min-w-0 text-[13.5px] font-medium leading-snug hover:underline" draggable={false} tabIndex={overlay ? -1 : 0}>
          <span className="line-clamp-2">{card.name}</span>
        </Link>
        <ScoreBadge score={card.score} className="shrink-0 px-1.5 text-[11px]" />
      </div>
      {(card.city || card.category) && <div className="mt-0.5 truncate text-[12px] text-ink-3">{[card.category, card.city].filter(Boolean).join(" · ")}</div>}
      {(card.value != null || card.nextFollowUp) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium tabular-nums text-ink-2">{card.value != null ? formatEuro(card.value) : ""}</span>
          {card.nextFollowUp && <FollowUpBadge date={card.nextFollowUp} className="text-[11.5px]" />}
        </div>
      )}
    </div>
  );
}
