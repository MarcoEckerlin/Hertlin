"use client";

import { BLOCK_LABELS, type BlockType } from "@/cms/schema";
import { Button } from "@/components/ui/button";
import { BLOCK_GROUPS } from "@/components/admin/website/block-config";
import { Modal } from "@/components/admin/website/dialog";

/** Auswahl des Modultyps beim Hinzufügen. */
export function AddBlockDialog({
  open,
  position,
  total,
  onAdd,
  onClose,
}: {
  open: boolean;
  /** Index, an dem das neue Modul eingefügt wird */
  position: number;
  total: number;
  onAdd: (type: BlockType) => void;
  onClose: () => void;
}) {
  const where =
    position >= total ? "Das neue Modul wird am Ende der Seite eingefügt." : `Das neue Modul wird an Position ${position + 1} eingefügt.`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modul hinzufügen"
      description={where}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Abbrechen
        </Button>
      }
    >
      <div className="space-y-6">
        {BLOCK_GROUPS.map((group, gi) => (
          <section key={group.label} aria-labelledby={`add-group-${gi}`}>
            <h3 id={`add-group-${gi}`} className="mb-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
              {group.label}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.types.map((type, i) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onAdd(type)}
                    data-autofocus={gi === 0 && i === 0 ? true : undefined}
                    className="flex h-full w-full flex-col items-start gap-0.5 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span className="font-semibold text-ink">{BLOCK_LABELS[type].label}</span>
                    <span className="text-sm leading-snug text-ink-muted">{BLOCK_LABELS[type].description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
