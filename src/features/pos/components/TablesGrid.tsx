"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  joinTablesAction,
  separateTablesAction,
  setTableStatusAction,
} from "@/features/pos/actions";
import { OpenTableDrawer } from "@/features/pos/components/OpenTableDrawer";
import { TABLE_STATUS_LABELS } from "@/lib/pos-labels";
import {
  FLOOR_ROWS,
  FLOOR_SEATS,
  formatGroupLabel,
  parseTableCode,
  seatOf,
} from "@/lib/table-floor";

export type TableCardData = {
  id: string;
  name: string;
  capacity: number;
  status: string;
  joinedToId: string | null;
  openOrderId: string | null;
  openMinutes: number | null;
  checkTotal: string | null;
  waiterName: string | null;
  partySize: number | null;
  checkCount: number;
  unpaidCount: number;
};

type WaiterOption = { id: string; name: string };

type Props = {
  tables: TableCardData[];
  waiters: WaiterOption[];
  currentUserId: string;
};

const STATUS_BORDER: Record<string, string> = {
  AVAILABLE: "border-border bg-surface",
  OCCUPIED: "border-[var(--pub-blue)] bg-surface",
  AWAITING_PAYMENT: "border-[var(--warning)] bg-surface",
  RESERVED: "border-[var(--pub-blue-light)] bg-surface",
  CLEANING: "border-muted-foreground/40 bg-surface-secondary",
};

type TableFilter = "all" | "free" | "occupied" | "pay";

type FloorSegment = {
  root: TableCardData;
  members: TableCardData[];
  codes: number[];
  capacity: number;
  minSeat: number;
  maxSeat: number;
  span: number;
};

function displayStatus(table: TableCardData) {
  if (
    table.openOrderId &&
    table.unpaidCount > 0 &&
    (table.status === "OCCUPIED" || table.status === "AWAITING_PAYMENT")
  ) {
    return "AWAITING_PAYMENT";
  }
  return table.status;
}

function collectDescendants(
  rootId: string,
  byParent: Map<string, TableCardData[]>,
): TableCardData[] {
  const out: TableCardData[] = [];
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    out.push(node);
    stack.push(...(byParent.get(node.id) ?? []));
  }
  return out;
}

export function TablesGrid({ tables, waiters, currentUserId }: Props) {
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState<TableCardData | null>(null);
  const [filter, setFilter] = useState<TableFilter>("all");

  const byId = useMemo(() => {
    const map = new Map<string, TableCardData>();
    for (const t of tables) map.set(t.id, t);
    return map;
  }, [tables]);

  const byCode = useMemo(() => {
    const map = new Map<number, TableCardData>();
    for (const t of tables) {
      const code = parseTableCode(t.name);
      if (code != null) map.set(code, t);
    }
    return map;
  }, [tables]);

  const byParent = useMemo(() => {
    const map = new Map<string, TableCardData[]>();
    for (const t of tables) {
      if (!t.joinedToId) continue;
      const list = map.get(t.joinedToId) ?? [];
      list.push(t);
      map.set(t.joinedToId, list);
    }
    return map;
  }, [tables]);

  function resolveRoot(table: TableCardData): TableCardData {
    let cur = table;
    const seen = new Set<string>();
    while (cur.joinedToId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const parent = byId.get(cur.joinedToId);
      if (!parent) break;
      cur = parent;
    }
    return cur;
  }

  function buildSegment(root: TableCardData): FloorSegment {
    const descendants = collectDescendants(root.id, byParent);
    const members = [root, ...descendants];
    const codes = members
      .map((m) => parseTableCode(m.name))
      .filter((c): c is number => c != null)
      .sort((a, b) => a - b);
    const seats = codes.map(seatOf);
    const minSeat = Math.min(...seats);
    const maxSeat = Math.max(...seats);
    return {
      root,
      members,
      codes,
      capacity: members.reduce((s, m) => s + m.capacity, 0),
      minSeat,
      maxSeat,
      span: maxSeat - minSeat + 1,
    };
  }

  const segmentsByRow = useMemo(() => {
    const rows = new Map<number, FloorSegment[]>();
    for (const row of FLOOR_ROWS) {
      const consumed = new Set<string>();
      const segments: FloorSegment[] = [];
      for (const seat of FLOOR_SEATS) {
        const table = byCode.get(row * 10 + seat);
        if (!table || consumed.has(table.id)) continue;
        const root = resolveRoot(table);
        if (consumed.has(root.id)) continue;
        const segment = buildSegment(root);
        // Only place when this seat is the leftmost of the segment
        if (segment.minSeat !== seat) continue;
        for (const m of segment.members) consumed.add(m.id);
        segments.push(segment);
      }
      rows.set(row, segments);
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers close over byId/byParent
  }, [byCode, byId, byParent]);

  const allSegments = useMemo(
    () => FLOOR_ROWS.flatMap((r) => segmentsByRow.get(r) ?? []),
    [segmentsByRow],
  );

  function segmentMatchesFilter(seg: FloorSegment): boolean {
    const status = displayStatus(seg.root);
    if (filter === "free") {
      return status === "AVAILABLE" || status === "CLEANING";
    }
    if (filter === "occupied") {
      return status === "OCCUPIED" || status === "RESERVED";
    }
    if (filter === "pay") {
      return status === "AWAITING_PAYMENT" || seg.root.unpaidCount > 0;
    }
    return true;
  }

  const counts = {
    all: allSegments.length,
    free: allSegments.filter((s) => {
      const st = displayStatus(s.root);
      return st === "AVAILABLE" || st === "CLEANING";
    }).length,
    occupied: allSegments.filter((s) => {
      const st = displayStatus(s.root);
      return st === "OCCUPIED" || st === "RESERVED";
    }).length,
    pay: allSegments.filter(
      (s) =>
        displayStatus(s.root) === "AWAITING_PAYMENT" || s.root.unpaidCount > 0,
    ).length,
  };

  const filterButtons: Array<{ id: TableFilter; label: string }> = [
    { id: "all", label: `Todas (${counts.all})` },
    { id: "free", label: `Libres (${counts.free})` },
    { id: "occupied", label: `Ocupadas (${counts.occupied})` },
    { id: "pay", label: `Por cobrar (${counts.pay})` },
  ];

  function markAvailable(tableId: string) {
    startTransition(async () => {
      const result = await setTableStatusAction({
        tableId,
        status: "AVAILABLE",
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Mesa disponible");
    });
  }

  function joinPair(tableId: string, partnerId: string) {
    startTransition(async () => {
      const result = await joinTablesAction({ tableId, partnerId });
      if (!result.ok) toast.error(result.error);
      else toast.success("Mesas juntadas");
    });
  }

  function separatePair(tableId: string, satelliteId?: string) {
    startTransition(async () => {
      const result = await separateTablesAction({ tableId, satelliteId });
      if (!result.ok) toast.error(result.error);
      else toast.success("Mesas separadas en 2");
    });
  }

  function isFreeRoot(seg: FloorSegment) {
    return (
      !seg.root.openOrderId &&
      (seg.root.status === "AVAILABLE" || seg.root.status === "RESERVED")
    );
  }

  /** Join with the next segment to the right if adjacent and free. */
  function joinTarget(seg: FloorSegment, rowSegments: FloorSegment[]): FloorSegment | null {
    const next = rowSegments.find((s) => s.minSeat === seg.maxSeat + 1);
    if (!next) return null;
    if (!isFreeRoot(seg) || !isFreeRoot(next)) return null;
    return next;
  }

  function directSatellites(rootId: string): TableCardData[] {
    return byParent.get(rootId) ?? [];
  }

  function renderCard(seg: FloorSegment) {
    const status = displayStatus(seg.root);
    const occupied = Boolean(seg.root.openOrderId);
    const label = formatGroupLabel(seg.codes);
    const joined = seg.members.length > 1;

    return (
      <div
        className={cn(
          "flex h-full min-h-[100px] flex-col justify-between rounded-xl border-2 p-3 text-left transition-shadow active:scale-[0.99] hover:shadow-sm",
          STATUS_BORDER[status] ?? "border-border bg-surface",
          joined && "border-dashed",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-semibold tracking-tight tabular-nums">
              {label}
            </p>
            <p className="text-xs text-muted-foreground">
              {seg.capacity} lugares
              {joined ? " · juntadas" : ""}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {TABLE_STATUS_LABELS[status] ?? status}
          </Badge>
        </div>

        {occupied ? (
          <div className="mt-2 space-y-0.5 text-xs">
            <p className="font-medium">
              {seg.root.partySize ?? "—"} personas · $
              {seg.root.checkTotal ?? "0.00"}
            </p>
            <p className="text-muted-foreground">
              {seg.root.openMinutes != null
                ? `${seg.root.openMinutes} min`
                : "—"}
              {seg.root.waiterName ? ` · ${seg.root.waiterName}` : ""}
            </p>
          </div>
        ) : seg.root.status === "CLEANING" ? (
          <p className="mt-2 text-xs text-muted-foreground">En limpieza</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Disponible</p>
        )}
      </div>
    );
  }

  function segmentActions(seg: FloorSegment, rowSegments: FloorSegment[]) {
    const occupied = Boolean(seg.root.openOrderId);
    const buttons: ReactNode[] = [];

    if (seg.root.status === "CLEANING" && !occupied) {
      buttons.push(
        <Button
          key="free"
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          disabled={pending}
          onClick={() => markAvailable(seg.root.id)}
        >
          Marcar libre
        </Button>,
      );
    }

    const sats = directSatellites(seg.root.id);
    for (const sat of sats) {
      const a = parseTableCode(seg.root.name);
      const b = parseTableCode(sat.name);
      const label =
        a != null && b != null
          ? `Separar en ${Math.min(a, b)} y ${Math.max(a, b)}`
          : "Separar en 2";
      buttons.push(
        <Button
          key={`sep-${sat.id}`}
          size="sm"
          variant={occupied ? "ghost" : "default"}
          className={cn(
            "h-8 flex-1 text-xs",
            !occupied &&
              "bg-[var(--pub-blue)] text-white hover:bg-[var(--pub-blue)]/90",
          )}
          disabled={pending || occupied}
          title={
            occupied
              ? "Cierra la cuenta para separar en 2 mesas"
              : label
          }
          onClick={() => {
            if (occupied) {
              toast.message("Cierra la cuenta para separar en 2 mesas");
              return;
            }
            separatePair(seg.root.id, sat.id);
          }}
        >
          {label}
        </Button>,
      );
    }

    const target = joinTarget(seg, rowSegments);
    if (target && !occupied && seg.root.status !== "CLEANING") {
      buttons.push(
        <Button
          key="join"
          size="sm"
          variant="outline"
          className="h-8 flex-1 text-xs"
          disabled={pending}
          onClick={() => joinPair(seg.root.id, target.root.id)}
        >
          Juntar con {formatGroupLabel(target.codes)}
        </Button>,
      );
    }

    if (buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">{buttons}</div>
    );
  }

  function wrapSegment(
    seg: FloorSegment,
    rowSegments: FloorSegment[],
    placeInGrid: boolean,
  ) {
    const occupied = Boolean(seg.root.openOrderId);
    const href = occupied ? `/pos/tables/${seg.root.id}` : undefined;
    // grid: col1 = row label, cols 2-5 = seats 0-3
    const gridStyle = placeInGrid
      ? { gridColumn: `${seg.minSeat + 2} / span ${seg.span}` }
      : undefined;

    return (
      <div
        key={seg.root.id}
        className="flex min-w-0 flex-col gap-1.5"
        style={gridStyle}
      >
        {href ? (
          <Link href={href} className="block w-full">
            {renderCard(seg)}
          </Link>
        ) : (
          <button
            type="button"
            className="block w-full"
            disabled={seg.root.status === "CLEANING"}
            onClick={() => {
              if (seg.root.status === "CLEANING") return;
              setOpening({ ...seg.root, capacity: seg.capacity });
            }}
          >
            {renderCard(seg)}
          </button>
        )}
        {segmentActions(seg, rowSegments)}
      </div>
    );
  }

  const legacy = tables.filter((t) => parseTableCode(t.name) == null && !t.joinedToId);

  const groupCapacity = (tableId: string) => {
    const root = byId.get(tableId);
    if (!root) return 2;
    return buildSegment(resolveRoot(root)).capacity;
  };

  const groupLabel = (tableId: string) => {
    const root = byId.get(tableId);
    if (!root) return "";
    return formatGroupLabel(buildSegment(resolveRoot(root)).codes);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Mesas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Piso 8×4 · 11→10+11 · 12→12+13 · también se juntan 11+12
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterButtons.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-[var(--pub-blue)] text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-secondary/40 p-3 sm:p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <div className="mb-1 grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="w-6" />
            <span className="text-center">·0</span>
            <span className="text-center">·1</span>
            <span className="text-center">·2</span>
            <span className="text-center">·3</span>
          </div>

          {FLOOR_ROWS.map((row) => {
            const segments = (segmentsByRow.get(row) ?? []).filter(
              segmentMatchesFilter,
            );
            if (filter !== "all" && segments.length === 0) return null;

            return (
              <div
                key={row}
                className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-stretch gap-2"
              >
                <div className="flex w-6 items-center justify-center text-xs font-medium text-muted-foreground">
                  {row}
                </div>
                {filter === "all"
                  ? (segmentsByRow.get(row) ?? []).map((seg) =>
                      wrapSegment(seg, segmentsByRow.get(row) ?? [], true),
                    )
                  : segments.map((seg) =>
                      wrapSegment(seg, segmentsByRow.get(row) ?? [], false),
                    )}
              </div>
            );
          })}
        </div>
      </div>

      {legacy.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Otras mesas
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {legacy.map((table) => (
              <div key={table.id} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  className="block w-full"
                  disabled={table.status === "CLEANING"}
                  onClick={() => setOpening(table)}
                >
                  {renderCard(buildSegment(table))}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {opening ? (
        <OpenTableDrawer
          open={Boolean(opening)}
          onOpenChange={(v) => {
            if (!v) setOpening(null);
          }}
          tableId={opening.id}
          tableName={groupLabel(opening.id) || opening.name}
          defaultPartySize={Math.min(groupCapacity(opening.id), 8)}
          waiters={waiters}
          currentUserId={currentUserId}
        />
      ) : null}
    </div>
  );
}
