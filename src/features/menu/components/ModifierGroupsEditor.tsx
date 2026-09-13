"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ModifierOptionDraft = {
  key: string;
  name: string;
  priceDelta: string;
  active: boolean;
  sortOrder: string;
};

export type ModifierGroupDraft = {
  key: string;
  name: string;
  required: boolean;
  minSelections: string;
  maxSelections: string;
  sortOrder: string;
  options: ModifierOptionDraft[];
};

type Props = {
  groups: ModifierGroupDraft[];
  onChange: (groups: ModifierGroupDraft[]) => void;
};

function newOption(sortOrder: number): ModifierOptionDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    priceDelta: "0",
    active: true,
    sortOrder: String(sortOrder),
  };
}

function newGroup(sortOrder: number): ModifierGroupDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    required: false,
    minSelections: "0",
    maxSelections: "1",
    sortOrder: String(sortOrder),
    options: [newOption(0)],
  };
}

export function ModifierGroupsEditor({ groups, onChange }: Props) {
  function updateGroup(key: string, patch: Partial<ModifierGroupDraft>) {
    onChange(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function updateOption(
    groupKey: string,
    optionKey: string,
    patch: Partial<ModifierOptionDraft>,
  ) {
    onChange(
      groups.map((g) =>
        g.key !== groupKey
          ? g
          : {
              ...g,
              options: g.options.map((o) =>
                o.key === optionKey ? { ...o, ...patch } : o,
              ),
            },
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Modificadores</h3>
          <p className="text-xs text-muted-foreground">
            Grupos requeridos/opcionales con precio adicional.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...groups, newGroup(groups.length)])}
        >
          Agregar grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin modificadores. Útil para extras, término o quitar ingredientes.
        </p>
      ) : null}

      {groups.map((group, index) => (
        <div
          key={group.key}
          className="space-y-3 rounded-xl border border-border p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Grupo {index + 1}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange(groups.filter((g) => g.key !== group.key))
              }
            >
              Quitar
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre del grupo</Label>
              <Input
                value={group.name}
                onChange={(e) =>
                  updateGroup(group.key, { name: e.target.value })
                }
                placeholder="Ej. Extras"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mín. selecciones</Label>
              <Input
                type="number"
                min={0}
                value={group.minSelections}
                onChange={(e) =>
                  updateGroup(group.key, { minSelections: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Máx. selecciones</Label>
              <Input
                type="number"
                min={1}
                value={group.maxSelections}
                onChange={(e) =>
                  updateGroup(group.key, { maxSelections: e.target.value })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={group.required}
              onChange={(e) =>
                updateGroup(group.key, { required: e.target.checked })
              }
            />
            Requerido
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Opciones</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateGroup(group.key, {
                    options: [
                      ...group.options,
                      newOption(group.options.length),
                    ],
                  })
                }
              >
                Agregar opción
              </Button>
            </div>
            {group.options.map((opt) => (
              <div
                key={opt.key}
                className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_120px_auto]"
              >
                <Input
                  placeholder="Nombre"
                  value={opt.name}
                  onChange={(e) =>
                    updateOption(group.key, opt.key, { name: e.target.value })
                  }
                  required
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="+$"
                  value={opt.priceDelta}
                  onChange={(e) =>
                    updateOption(group.key, opt.key, {
                      priceDelta: e.target.value,
                    })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={group.options.length <= 1}
                  onClick={() =>
                    updateGroup(group.key, {
                      options: group.options.filter((o) => o.key !== opt.key),
                    })
                  }
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function serializeModifierGroups(groups: ModifierGroupDraft[]) {
  return groups.map((g, gIndex) => ({
    name: g.name,
    required: g.required,
    minSelections: Number(g.minSelections) || 0,
    maxSelections: Number(g.maxSelections) || 1,
    sortOrder: Number(g.sortOrder) || gIndex,
    options: g.options.map((o, oIndex) => ({
      name: o.name,
      priceDelta: Number(o.priceDelta) || 0,
      active: o.active,
      sortOrder: Number(o.sortOrder) || oIndex,
    })),
  }));
}

export function groupsFromServer(
  groups: Array<{
    name: string;
    required: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: Array<{
      name: string;
      priceDelta: { toString(): string } | number;
      active: boolean;
      sortOrder: number;
    }>;
  }>,
): ModifierGroupDraft[] {
  return groups.map((g) => ({
    key: crypto.randomUUID(),
    name: g.name,
    required: g.required,
    minSelections: String(g.minSelections),
    maxSelections: String(g.maxSelections),
    sortOrder: String(g.sortOrder),
    options: g.options.map((o) => ({
      key: crypto.randomUUID(),
      name: o.name,
      priceDelta: String(o.priceDelta),
      active: o.active,
      sortOrder: String(o.sortOrder),
    })),
  }));
}
