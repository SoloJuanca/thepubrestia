"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { openTableAction } from "@/features/pos/actions";
import { cn } from "@/lib/utils";

const QUICK = [1, 2, 3, 4, 5, 6, 8, 10];

type WaiterOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableName: string;
  defaultPartySize: number;
  waiters: WaiterOption[];
  currentUserId: string;
};

export function OpenTableDrawer({
  open,
  onOpenChange,
  tableId,
  tableName,
  defaultPartySize,
  waiters,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [waiterId, setWaiterId] = useState(currentUserId);
  const [notes, setNotes] = useState("");

  function submit() {
    startTransition(async () => {
      const result = await openTableAction({
        tableId,
        partySize,
        waiterId,
        notes: notes || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Mesa abierta");
      onOpenChange(false);
      router.push(`/pos/tables/${tableId}`);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Abrir {tableName}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5 p-1">
          <div className="space-y-2">
            <Label>Número de personas</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 min-w-12 text-xl"
                onClick={() => setPartySize((n) => Math.max(1, n - 1))}
              >
                −
              </Button>
              <span className="w-12 text-center text-2xl font-semibold">
                {partySize}
              </span>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 min-w-12 text-xl"
                onClick={() => setPartySize((n) => Math.min(40, n + 1))}
              >
                +
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    "min-h-11 min-w-11 rounded-xl border text-sm font-medium",
                    partySize === n
                      ? "border-[var(--pub-blue)] bg-[var(--pub-blue)] text-white"
                      : "border-border bg-surface",
                  )}
                  onClick={() => setPartySize(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mesero</Label>
            <select
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={waiterId}
              onChange={(e) => setWaiterId(e.target.value)}
            >
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cumpleaños, alergias…"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="min-h-12 flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="min-h-12 flex-1"
              disabled={pending}
              onClick={submit}
            >
              {pending ? "Abriendo…" : "Abrir mesa"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
