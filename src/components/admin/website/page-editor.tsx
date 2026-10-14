"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { ExternalLink, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { BLOCK_LABELS, newBlockId, pageDraftSchema, type Block, type BlockType, type PageDraft } from "@/cms/schema";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FieldError, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  deletePageAction,
  discardDraftAction,
  publishPageAction,
  saveDraftAction,
} from "@/lib/actions/admin-website";
import { AddBlockDialog } from "@/components/admin/website/add-block-dialog";
import { BlockCard } from "@/components/admin/website/block-card";
import { duplicateBlock, newBlock } from "@/components/admin/website/block-config";
import { MarkdownHint } from "@/components/admin/website/block-fields";
import { ConfirmDialog, type ConfirmRequest } from "@/components/admin/website/dialog";
import { normalizeDraft, setIn, type Path } from "@/components/admin/website/draft-utils";
import { EditorContext, fieldDomId, type EditorContextValue, type MediaPickerRequest } from "@/components/admin/website/editor-context";
import { groupIssues, issuesFromZod, type GroupedIssues } from "@/components/admin/website/issues";
import { MediaPicker } from "@/components/admin/website/media-picker";
import type { EditorIssue, LinkTarget, MediaItem, PlaceholderInfo, SaveResult } from "@/components/admin/website/types";

export type EditorPage = {
  id: string;
  slug: string;
  path: string;
  system: boolean;
  published: boolean;
  publishedAt: string | null;
  hasDraft: boolean;
  updatedAt: string;
  usesDefaults: boolean;
};

type Props = {
  page: EditorPage;
  initial: PageDraft;
  media: MediaItem[];
  linkTargets: LinkTarget[];
  placeholders: PlaceholderInfo[];
  /** Hauptdomain für die Anzeige der Adresse, z. B. "hertlin.de" */
  siteHost: string;
  isNew?: boolean;
  mediaAccept: string;
  mediaUploadHint: string;
  /** Formular „Menü und Sichtbarkeit“ (gilt sofort) */
  settings: ReactNode;
};

type ServerStatus = { hasDraft: boolean; published: boolean; publishedAt: string | null; updatedAt: string };
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type Mode = "draft" | "publish";

const DESCRIPTION_RECOMMENDED = 160;
const LEAVE_WARNING = "Sie haben ungespeicherte Änderungen. Seite trotzdem verlassen? Die Änderungen gehen dabei verloren.";

/** Doppelte Modul-ids (z. B. aus alten Daten) ersetzen, damit jede Karte eindeutig ist. */
function withUniqueIds(draft: PageDraft): PageDraft {
  const seen = new Set<string>();
  let changed = false;
  const blocks = draft.blocks.map((b) => {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      return b;
    }
    changed = true;
    const id = newBlockId();
    seen.add(id);
    return { ...b, id };
  });
  return changed ? { ...draft, blocks } : draft;
}

function errorFocusIds(grouped: GroupedIssues): string[] {
  const first = grouped.summary[0];
  if (!first) return [];
  if (!first.blockId) return [first.fieldKey === "description" ? "page-description" : "page-title"];
  const path = first.fieldKey ? first.fieldKey.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [];
  const ids = [fieldDomId(first.blockId, path)];
  // Link-Felder: Fehler am Objekt → Beschriftung fokussieren
  if (path.length > 0) ids.push(fieldDomId(first.blockId, [...path, "label"]));
  ids.push(fieldDomId(first.blockId, ["toggle"]));
  return ids;
}

export function PageEditor({
  page,
  initial,
  media,
  linkTargets,
  placeholders,
  siteHost,
  isNew = false,
  mediaAccept,
  mediaUploadHint,
  settings,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState<PageDraft>(() => withUniqueIds(initial));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(normalizeDraft(initial)));
  const [status, setStatus] = useState<ServerStatus>({
    hasDraft: page.hasDraft,
    published: page.published,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
  });
  // Nach router.refresh() (z. B. geänderte Einstellungen) den Stand vom Server übernehmen
  const [serverStamp, setServerStamp] = useState(page.updatedAt);
  if (serverStamp !== page.updatedAt) {
    setServerStamp(page.updatedAt);
    setStatus({ hasDraft: page.hasDraft, published: page.published, publishedAt: page.publishedAt, updatedAt: page.updatedAt });
  }

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initial.blocks.length <= 2 ? initial.blocks.map((b) => b.id) : []),
  );
  const [issues, setIssues] = useState<GroupedIssues | null>(null);
  const [notice, setNotice] = useState<Notice>(
    isNew
      ? {
          tone: "info",
          text: "Die Seite ist angelegt, aber noch nicht auf der Website zu sehen. Passen Sie die Module an und klicken Sie dann auf „Veröffentlichen“.",
        }
      : null,
  );
  const [conflict, setConflict] = useState<{ mode: Mode; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"draft" | "publish" | "discard" | "delete" | null>(null);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [picker, setPicker] = useState<MediaPickerRequest | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>(media);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const normalized = useMemo(() => normalizeDraft(content), [content]);
  const currentJson = useMemo(() => JSON.stringify(normalized), [normalized]);
  const dirty = currentJson !== savedJson;
  const previewUrl = `/vorschau/${page.id}`;

  /* ---------------- Hilfen für Kinder-Komponenten ---------------- */

  const focusLater = useCallback((...ids: string[]) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el && !(el as HTMLButtonElement).disabled) {
            el.focus({ preventScroll: true });
            // Mittig scrollen, damit nichts unter der festen Aktionsleiste verschwindet
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            return;
          }
        }
      }),
    );
  }, []);

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current?.(false);
      confirmResolver.current = resolve;
      setConfirmRequest(request);
    });
  }, []);

  const answerConfirm = (ok: boolean) => {
    confirmResolver.current?.(ok);
    confirmResolver.current = null;
    setConfirmRequest(null);
  };

  const ctx = useMemo<EditorContextValue>(
    () => ({
      media: mediaList,
      openMediaPicker: (request) => setPicker(request),
      linkListId: "cms-link-targets",
      confirm,
      focusLater,
    }),
    [mediaList, confirm, focusLater],
  );

  /* ---------------- Ungespeicherte Änderungen ---------------- */

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(LEAVE_WARNING)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  /* ---------------- Fehleranzeige ---------------- */

  const showIssues = useCallback(
    (list: EditorIssue[], blocks: Block[]) => {
      const grouped = groupIssues(list, blocks);
      setIssues(grouped);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of Object.keys(grouped.blocks)) next.add(id);
        return next;
      });
      const n = grouped.summary.length;
      setNotice({
        tone: "error",
        text: n === 1 ? "Bitte prüfen Sie das markierte Feld." : `Bitte prüfen Sie die ${n} markierten Felder.`,
      });
      focusLater(...errorFocusIds(grouped));
    },
    [focusLater],
  );

  const clearIssue = useCallback((blockId: string | null, fieldKey: string) => {
    setIssues((prev) => {
      if (!prev) return prev;
      const related = (k: string) => k === fieldKey || fieldKey.startsWith(`${k}.`) || k.startsWith(`${fieldKey}.`);
      if (blockId === null) {
        if (!prev.page[fieldKey]) return prev;
        const page = { ...prev.page };
        delete page[fieldKey];
        return { ...prev, page, summary: prev.summary.filter((s) => !(s.blockId === null && s.fieldKey === fieldKey)) };
      }
      const current = prev.blocks[blockId];
      if (!current || !Object.keys(current).some(related)) return prev;
      const nextBlock = Object.fromEntries(Object.entries(current).filter(([k]) => !related(k)));
      const blocks = { ...prev.blocks };
      if (Object.keys(nextBlock).length) blocks[blockId] = nextBlock;
      else delete blocks[blockId];
      return {
        ...prev,
        blocks,
        summary: prev.summary.filter((s) => !(s.blockId === blockId && related(s.fieldKey))),
      };
    });
  }, []);

  /* ---------------- Module bearbeiten ---------------- */

  const updateBlocks = useCallback((fn: (blocks: Block[]) => Block[]) => {
    setContent((c) => ({ ...c, blocks: fn(c.blocks) }));
  }, []);

  const changeField = useCallback(
    (id: string, path: Path, value: unknown) => {
      updateBlocks((blocks) => blocks.map((b) => (b.id === id ? setIn(b, path, value) : b)));
      clearIssue(id, path.join("."));
    },
    [updateBlocks, clearIssue],
  );

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Aktueller Stand für Event-Handler, ohne die Callbacks bei jeder Eingabe neu zu erzeugen
  const blocksRef = useRef<Block[]>(content.blocks);
  useEffect(() => {
    blocksRef.current = content.blocks;
  });

  const moveBlock = useCallback(
    (id: string, dir: -1 | 1) => {
      const current = blocksRef.current;
      const from = current.findIndex((b) => b.id === id);
      const to = from + dir;
      if (from === -1 || to < 0 || to >= current.length) return;
      updateBlocks((blocks) => {
        const i = blocks.findIndex((b) => b.id === id);
        const j = i + dir;
        if (i === -1 || j < 0 || j >= blocks.length) return blocks;
        const next = [...blocks];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      setAnnouncement(`${BLOCK_LABELS[current[from].type]?.label ?? "Modul"} steht jetzt an Position ${to + 1} von ${current.length}.`);
      focusLater(fieldDomId(id, [dir < 0 ? "up" : "down"]), fieldDomId(id, [dir < 0 ? "down" : "up"]), fieldDomId(id, ["toggle"]));
    },
    [updateBlocks, focusLater],
  );

  const duplicate = useCallback(
    (id: string) => {
      const current = blocksRef.current;
      const source = current.find((b) => b.id === id);
      if (!source) return;
      if (current.length >= 60) {
        setNotice({ tone: "error", text: "Eine Seite kann höchstens 60 Module haben." });
        return;
      }
      const copy = duplicateBlock(source);
      updateBlocks((blocks) => {
        const index = blocks.findIndex((b) => b.id === id);
        if (index === -1) return blocks;
        const next = [...blocks];
        next.splice(index + 1, 0, copy);
        return next;
      });
      setExpanded((prev) => new Set(prev).add(copy.id));
      setAnnouncement("Modul dupliziert. Die Kopie steht direkt darunter.");
      focusLater(fieldDomId(copy.id, ["toggle"]));
    },
    [updateBlocks, focusLater],
  );

  const toggleHidden = useCallback(
    (id: string) => {
      updateBlocks((blocks) => blocks.map((b) => (b.id === id ? ({ ...b, hidden: b.hidden ? undefined : true } as Block) : b)));
    },
    [updateBlocks],
  );

  const removeBlock = useCallback(
    async (id: string) => {
      const current = blocksRef.current;
      const index = current.findIndex((b) => b.id === id);
      const block = current[index];
      if (!block) return;
      const label = BLOCK_LABELS[block.type]?.label ?? "Modul";
      const ok = await confirm({
        title: "Modul löschen?",
        message: (
          <>
            Das Modul „{label}“ an Position {index + 1} wird mit allen Inhalten entfernt. Solange Sie nicht speichern, lässt sich das mit
            „Änderungen zurücksetzen“ rückgängig machen.
          </>
        ),
        confirmLabel: "Modul löschen",
      });
      if (!ok) return;
      const latest = blocksRef.current;
      const at = latest.findIndex((b) => b.id === id);
      const neighbour = latest[at + 1] ?? latest[at - 1];
      updateBlocks((blocks) => blocks.filter((b) => b.id !== id));
      setIssues((prev) => {
        if (!prev?.blocks[id]) return prev;
        const blocks = { ...prev.blocks };
        delete blocks[id];
        return { ...prev, blocks, summary: prev.summary.filter((s) => s.blockId !== id) };
      });
      setAnnouncement(`Modul „${label}“ gelöscht.`);
      focusLater(neighbour ? fieldDomId(neighbour.id, ["toggle"]) : "add-block");
    },
    [confirm, updateBlocks, focusLater],
  );

  const removeBlockSync = useCallback((id: string) => void removeBlock(id), [removeBlock]);

  const addBlock = (type: BlockType) => {
    const at = addAt ?? content.blocks.length;
    if (content.blocks.length >= 60) {
      setNotice({ tone: "error", text: "Eine Seite kann höchstens 60 Module haben." });
      setAddAt(null);
      return;
    }
    const block = newBlock(type);
    updateBlocks((blocks) => {
      const next = [...blocks];
      next.splice(Math.min(at, next.length), 0, block);
      return next;
    });
    setExpanded((prev) => new Set(prev).add(block.id));
    setAddAt(null);
    setAnnouncement(`Modul „${BLOCK_LABELS[type].label}“ an Position ${Math.min(at, content.blocks.length) + 1} eingefügt.`);
    focusLater(fieldDomId(block.id, ["toggle"]));
  };

  const openAdd = useCallback((at: number) => setAddAt(at), []);

  /* ---------------- Speichern, Veröffentlichen, Verwerfen ---------------- */

  const runSave = (mode: Mode, force = false): Promise<boolean> => {
    const draft = normalized;
    const local = pageDraftSchema.safeParse(draft);
    if (!local.success) {
      showIssues(issuesFromZod(local.error), draft.blocks);
      return Promise.resolve(false);
    }
    const sentJson = JSON.stringify(draft);
    setNotice(null);
    setConflict(null);
    setBusy(mode);
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        let result: SaveResult;
        try {
          const action = mode === "publish" ? publishPageAction : saveDraftAction;
          result = await action(page.id, draft, { baseUpdatedAt: status.updatedAt, force });
        } catch (error) {
          // Weiterleitungen (z. B. abgelaufene Anmeldung) an Next.js durchreichen
          unstable_rethrow(error);
          result = {
            ok: false,
            message: "Keine Verbindung zum Server. Bitte prüfen Sie die Internetverbindung und versuchen Sie es noch einmal.",
          };
        }
        setBusy(null);
        if (!result.ok) {
          if (result.issues?.length) showIssues(result.issues, draft.blocks);
          if (result.conflict) setConflict({ mode, message: result.message });
          else if (!result.issues?.length) setNotice({ tone: "error", text: result.message });
          resolve(false);
          return;
        }
        setSavedJson(sentJson);
        setIssues(null);
        setStatus({
          hasDraft: result.hasDraft,
          published: result.published,
          publishedAt: result.publishedAt,
          updatedAt: result.updatedAt,
        });
        setNotice({ tone: "success", text: result.message });
        router.refresh();
        resolve(true);
      });
    });
  };

  // Strg+S / Cmd+S speichert den Entwurf
  const saveRef = useRef(runSave);
  useEffect(() => {
    saveRef.current = runSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current("draft");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Hinweis „neu angelegt“ nur einmal zeigen: ?neu=1 aus der Adresse entfernen
  useEffect(() => {
    if (isNew && window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [isNew]);

  const discard = async () => {
    const ok = await confirm({
      title: "Entwurf verwerfen?",
      message:
        "Alle Änderungen seit dem letzten Veröffentlichen gehen verloren – gespeicherte und ungespeicherte. Die Website bleibt, wie sie ist.",
      confirmLabel: "Entwurf verwerfen",
    });
    if (!ok) return;
    setBusy("discard");
    startTransition(async () => {
      const result = await discardDraftAction(page.id).catch((error: unknown) => {
        unstable_rethrow(error);
        return { ok: false as const, message: "Keine Verbindung zum Server. Bitte versuchen Sie es noch einmal." };
      });
      setBusy(null);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.message });
        return;
      }
      const restored = withUniqueIds(result.content);
      setContent(restored);
      setSavedJson(JSON.stringify(normalizeDraft(restored)));
      setStatus((s) => ({ ...s, hasDraft: false, updatedAt: result.updatedAt }));
      setIssues(null);
      setConflict(null);
      setNotice({ tone: "success", text: result.message });
      router.refresh();
    });
  };

  const resetLocal = async () => {
    const ok = await confirm({
      title: "Änderungen zurücksetzen?",
      message: "Alle Änderungen seit dem letzten Speichern gehen verloren.",
      confirmLabel: "Zurücksetzen",
    });
    if (!ok) return;
    try {
      const restored = JSON.parse(savedJson) as PageDraft;
      setContent(restored);
      setIssues(null);
      setNotice({ tone: "info", text: "Die Änderungen wurden zurückgesetzt." });
    } catch {
      window.location.reload();
    }
  };

  const removePage = async () => {
    const ok = await confirm({
      title: "Seite löschen?",
      message: (
        <>
          Die Seite „{content.title || page.path}“ wird mit allen Modulen gelöscht und ist unter <strong>{page.path}</strong> nicht mehr
          erreichbar. Links, die auf diese Adresse zeigen, führen dann ins Leere. Das lässt sich nicht rückgängig machen.
        </>
      ),
      confirmLabel: "Endgültig löschen",
    });
    if (!ok) return;
    setBusy("delete");
    startTransition(async () => {
      // Bei Erfolg leitet die Action zur Übersicht weiter (unstable_rethrow reicht die Weiterleitung durch)
      const result = await deletePageAction(page.id).catch((error: unknown) => {
        unstable_rethrow(error);
        return { ok: false as const, message: "Keine Verbindung zum Server. Bitte versuchen Sie es noch einmal." };
      });
      setBusy(null);
      if (!result.ok) setNotice({ tone: "error", text: result.message });
    });
  };

  const openPreview = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!dirty) return;
    e.preventDefault();
    // Fenster sofort öffnen (sonst blockiert der Browser das Popup), Adresse nach dem Speichern setzen
    const win = window.open("", "_blank");
    void runSave("draft").then((ok) => {
      if (!win) {
        if (ok) window.open(previewUrl, "_blank", "noopener");
        return;
      }
      if (ok) {
        win.opener = null;
        win.location.href = previewUrl;
      } else {
        win.close();
      }
    });
  };

  /* ---------------- Darstellung ---------------- */

  const blocks = content.blocks;
  const allExpanded = blocks.length > 0 && blocks.every((b) => expanded.has(b.id));
  const neverPublished = !page.system && !status.publishedAt;
  const canDiscard = status.hasDraft && !neverPublished;
  const descriptionLength = (content.description ?? "").length;
  const titleError = issues?.page.title;
  const descriptionError = issues?.page.description;
  const pageLevelError = issues?.page.blocks ?? issues?.page._page;

  let liveBadge: ReactNode;
  if (status.published) liveBadge = <Badge tone="green">Veröffentlicht</Badge>;
  else if (neverPublished) liveBadge = <Badge tone="gray">Noch nicht veröffentlicht</Badge>;
  else liveBadge = <Badge tone="gray">Ausgeblendet</Badge>;

  return (
    <EditorContext.Provider value={ctx}>
      <PageHeader
        breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: content.title || "Ohne Titel" }]}
        title={content.title || "Ohne Titel"}
        description={
          <>
            Adresse:{" "}
            {status.published ? (
              <a href={page.path} target="_blank" rel="noopener" className="font-semibold text-brand-700 underline underline-offset-2">
                {siteHost}
                {page.path}
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </a>
            ) : (
              <span className="font-semibold">
                {siteHost}
                {page.path}
              </span>
            )}
            {page.system ? <span className="text-ink-muted"> · Kernseite</span> : null}
          </>
        }
        actions={
          !page.system ? (
            <Button variant="danger" size="sm" onClick={() => void removePage()} disabled={pending}>
              <Trash2 className="size-4" aria-hidden />
              {busy === "delete" ? "Wird gelöscht …" : "Seite löschen"}
            </Button>
          ) : undefined
        }
        meta={
          <>
            {liveBadge}
            {status.hasDraft ? <Badge tone="amber">Entwurf mit Änderungen</Badge> : null}
            {page.usesDefaults && !status.publishedAt ? <Badge tone="blue">Standardinhalt</Badge> : null}
            {status.publishedAt ? (
              <span className="text-xs text-ink-muted">Zuletzt veröffentlicht: {formatDateTime(status.publishedAt)}</span>
            ) : null}
          </>
        }
      />

      {/* Aktionsleiste – mobil kompakt (Status in einer Zeile, Knöpfe in einer Zeile), damit beim Bearbeiten Platz bleibt */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-y border-line bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 sm:py-3 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-y-3">
          <p className="min-w-0 flex-1 text-sm max-sm:basis-full max-sm:truncate" role="status" aria-live="polite">
            {busy === "draft" ? (
              <span className="text-ink-soft">Wird gespeichert …</span>
            ) : busy === "publish" ? (
              <span className="text-ink-soft">Wird veröffentlicht …</span>
            ) : dirty ? (
              <span className="font-semibold text-orange-700">Ungespeicherte Änderungen</span>
            ) : status.hasDraft ? (
              <span className="text-ink-soft">Entwurf gespeichert – noch nicht veröffentlicht</span>
            ) : (
              <span className="text-ink-muted">Alles gespeichert</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={() => void resetLocal()} disabled={pending} className="max-sm:px-2.5">
                <Undo2 className="size-4" aria-hidden />
                <span className="max-sm:sr-only">Änderungen zurücksetzen</span>
              </Button>
            ) : null}
            {canDiscard ? (
              <Button variant="ghost" size="sm" onClick={() => void discard()} disabled={pending}>
                Entwurf verwerfen
              </Button>
            ) : null}
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener"
              onClick={openPreview}
              className={buttonClasses("secondary", "sm", cn("max-sm:px-2.5", pending && "pointer-events-none opacity-55"))}
              aria-disabled={pending || undefined}
            >
              <ExternalLink className="size-4" aria-hidden />
              <span className="max-sm:sr-only">{dirty ? "Speichern und Vorschau" : "Vorschau"}</span>
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
            <Button variant="secondary" size="sm" onClick={() => void runSave("draft")} disabled={pending}>
              <Save className="size-4" aria-hidden />
              {busy === "draft" ? (
                "Wird gespeichert …"
              ) : (
                <>
                  <span className="sm:hidden">Speichern</span>
                  <span className="max-sm:hidden">Entwurf speichern</span>
                </>
              )}
            </Button>
            <Button size="sm" onClick={() => void runSave("publish")} disabled={pending}>
              {busy === "publish" ? "Wird veröffentlicht …" : "Veröffentlichen"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6">
        {conflict ? (
          <Alert tone="warning" title="Die Seite wurde zwischenzeitlich geändert">
            <p>{conflict.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="dark" onClick={() => void runSave(conflict.mode, true)} disabled={pending}>
                Trotzdem {conflict.mode === "publish" ? "veröffentlichen" : "speichern"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                Seite neu laden
              </Button>
            </div>
          </Alert>
        ) : null}

        {notice ? (
          <Alert tone={notice.tone}>
            <p>{notice.text}</p>
            {notice.tone === "error" && issues && issues.summary.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.summary.slice(0, 12).map((s, i) => (
                  <li key={`${s.blockId}-${s.fieldKey}-${i}`}>
                    <button
                      type="button"
                      className="text-left underline underline-offset-2 hover:no-underline"
                      onClick={() => {
                        if (s.blockId) setExpanded((prev) => new Set(prev).add(s.blockId!));
                        focusLater(...errorFocusIds({ page: {}, blocks: {}, summary: [s] }));
                      }}
                    >
                      {s.text}
                    </button>
                  </li>
                ))}
                {issues.summary.length > 12 ? <li>… und {issues.summary.length - 12} weitere</li> : null}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        {/* Titel und Beschreibung gehören zum Entwurf */}
        <Card>
          <CardHeader title="Seite" description="Titel und Beschreibung werden mit dem Entwurf gespeichert und beim Veröffentlichen übernommen." />
          <CardBody className="space-y-5">
            <div>
              <Label htmlFor="page-title" className="mb-1.5">
                Seitentitel
              </Label>
              <Input
                id="page-title"
                value={content.title}
                maxLength={120}
                required
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? "page-title-error" : "page-title-hint"}
                onChange={(e) => {
                  const value = e.target.value;
                  setContent((c) => ({ ...c, title: value }));
                  clearIssue(null, "title");
                }}
              />
              {titleError ? (
                <FieldError id="page-title-error">{titleError}</FieldError>
              ) : (
                <Hint id="page-title-hint">Erscheint im Browser-Tab und in Suchergebnissen. Kurz und eindeutig, z. B. „AGB“.</Hint>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <Label htmlFor="page-description">Beschreibung für Suchmaschinen</Label>
                <span className="text-xs text-ink-muted">optional</span>
              </div>
              <Textarea
                id="page-description"
                rows={3}
                maxLength={300}
                value={content.description ?? ""}
                aria-invalid={descriptionError ? true : undefined}
                aria-describedby="page-description-count page-description-hint"
                onChange={(e) => {
                  const value = e.target.value;
                  setContent((c) => ({ ...c, description: value === "" ? undefined : value }));
                  clearIssue(null, "description");
                }}
              />
              <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p id="page-description-hint" className="text-sm text-ink-muted">
                  Ein bis zwei Sätze, die in Google unter dem Titel stehen.
                </p>
                <p
                  id="page-description-count"
                  className={cn("text-xs tabular-nums", descriptionLength > DESCRIPTION_RECOMMENDED ? "font-semibold text-amber-700" : "text-ink-muted")}
                >
                  {descriptionLength} / {DESCRIPTION_RECOMMENDED} Zeichen
                  {descriptionLength > DESCRIPTION_RECOMMENDED ? " – wird in Suchergebnissen wahrscheinlich gekürzt" : ""}
                </p>
              </div>
              <FieldError id="page-description-error">{descriptionError}</FieldError>
            </div>
          </CardBody>
        </Card>

        {/* Module */}
        <section aria-labelledby="modules-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="modules-heading" className="text-lg font-bold tracking-tight text-ink">
                Module
              </h2>
              <p className="text-sm text-ink-muted">
                Die Seite besteht aus Abschnitten, die von oben nach unten angezeigt werden. Klicken Sie auf ein Modul, um es zu bearbeiten.
              </p>
            </div>
            {blocks.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(blocks.map((b) => b.id)))}
              >
                {allExpanded ? "Alle zuklappen" : "Alle aufklappen"}
              </Button>
            ) : null}
          </div>

          <FieldError>{pageLevelError}</FieldError>

          <details className="rounded-2xl border border-line bg-white px-5 py-4 text-sm shadow-card">
            <summary className="cursor-pointer font-semibold text-ink select-none">Hilfe: Formatierung und Platzhalter</summary>
            <div className="mt-3 space-y-4 text-ink-soft">
              <div>
                <p className="mb-1 font-semibold text-ink">Formatierung in Textfeldern</p>
                <MarkdownHint />
              </div>
              <div>
                <p className="mb-2 font-semibold text-ink">Platzhalter</p>
                <p className="mb-2">
                  Diese Platzhalter können Sie in allen Textfeldern verwenden. Auf der Website erscheint dann der aktuelle Wert aus den
                  Firmendaten – ändert sich z. B. die Telefonnummer, stimmt sie automatisch überall.
                </p>
                <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
                  {placeholders.map((p) => (
                    <div key={p.token} className="contents">
                      <dt>
                        <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs text-ink ring-1 ring-line">{p.token}</code>
                      </dt>
                      <dd className="text-ink-soft">
                        {p.label}
                        {p.value ? <span className="text-ink-muted"> – derzeit „{p.value}“</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </details>

          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-white px-6 py-10 text-center">
              <p className="font-semibold text-ink">Diese Seite hat noch keine Module.</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                Beginnen Sie z. B. mit einem Kopfbereich und einem Textabschnitt.
              </p>
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Module der Seite">
              {blocks.map((block, index) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  index={index}
                  total={blocks.length}
                  expanded={expanded.has(block.id)}
                  errors={issues?.blocks[block.id]}
                  onToggle={toggle}
                  onChange={changeField}
                  onMove={moveBlock}
                  onDuplicate={duplicate}
                  onToggleHidden={toggleHidden}
                  onRemove={removeBlockSync}
                  onInsertBelow={openAdd}
                />
              ))}
            </ol>
          )}

          <Button id="add-block" variant="secondary" onClick={() => setAddAt(blocks.length)} disabled={blocks.length >= 60}>
            <Plus className="size-4" aria-hidden />
            Modul hinzufügen
          </Button>
        </section>

        {settings}

      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <datalist id="cms-link-targets">
        {linkTargets.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </datalist>

      <AddBlockDialog
        open={addAt !== null}
        position={addAt ?? blocks.length}
        total={blocks.length}
        onAdd={addBlock}
        onClose={() => setAddAt(null)}
      />
      <MediaPicker
        request={picker}
        media={mediaList}
        accept={mediaAccept}
        uploadHint={mediaUploadHint}
        onUploaded={(item) => setMediaList((list) => [item, ...list.filter((m) => m.id !== item.id)])}
        onClose={() => setPicker(null)}
      />
      <ConfirmDialog request={confirmRequest} onAnswer={answerConfirm} />
    </EditorContext.Provider>
  );
}
