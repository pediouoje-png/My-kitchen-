"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { KitchenNote, NoteTag } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { uid } from "@/lib/store/reducer";

const TAG_LABEL: Record<NoteTag, string> = { order: "주문", prep: "준비", etc: "기타" };
const TAG_CLASS: Record<NoteTag, string> = {
  order: "bg-warn-soft text-warn",
  prep: "bg-green-soft text-green",
  etc: "bg-subtle text-sub",
};
const TAG_OPTIONS: { value: NoteTag; label: string }[] = [
  { value: "order", label: "주문·장보기" },
  { value: "prep", label: "미리 준비" },
  { value: "etc", label: "기타" },
];
const COLLAPSED = 5;

/** 홈 메모: 주문할 것, 삶아두기·손질 같은 미리 할 일을 적어 두는 체크리스트 */
export function HomeMemo() {
  const { state, dispatch } = useKitchen();
  const toast = useToast();
  const [text, setText] = useState("");
  const [tag, setTag] = useState<NoteTag>("order");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<KitchenNote | null>(null);

  const { notes, open, done } = useMemo(() => {
    const all = state.notes ?? [];
    return {
      notes: all,
      open: all.filter((n) => !n.done).sort((a, b) => b.createdAt - a.createdAt),
      done: all.filter((n) => n.done).sort((a, b) => b.createdAt - a.createdAt),
    };
  }, [state.notes]);
  const visibleOpen = expanded ? open : open.slice(0, COLLAPSED);
  const hiddenCount = open.length - visibleOpen.length;

  const add = () => {
    const t = text.trim();
    if (!t) return;
    dispatch({ type: "addNote", note: { id: uid("note"), text: t, tag, done: false, createdAt: Date.now() } });
    setText("");
  };

  return (
    <section>
      <SectionHeader
        title="메모"
        right={
          done.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "clearDoneNotes" });
                toast(`완료한 메모 ${done.length}개를 지웠어요`);
              }}
              className="text-[14px] text-sub"
            >
              완료 지우기
            </button>
          ) : undefined
        }
      />
      <div className="rounded-[14px] border border-line">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="px-4 pt-3 pb-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="주문할 것, 삶아두기 같은 할 일"
              aria-label="메모 입력"
              enterKeyHint="done"
              className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-mute"
            />
            <button
              type="submit"
              aria-label="메모 추가"
              disabled={!text.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green text-white transition-colors active:bg-green-strong disabled:bg-line"
            >
              <Plus size={18} strokeWidth={2.2} />
            </button>
          </div>
          {text.trim() && (
            <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="메모 종류">
              {TAG_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={tag === o.value}
                  onClick={() => setTag(o.value)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[12.5px]",
                    tag === o.value ? "border-ink bg-ink font-semibold text-white" : "border-line text-sub",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </form>

        {notes.length > 0 && (
          <ul className="border-t border-line">
            {visibleOpen.map((n) => (
              <MemoRow key={n.id} note={n} onEdit={() => setEditing(n)} />
            ))}
            {hiddenCount > 0 && (
              <li>
                <button type="button" onClick={() => setExpanded(true)} className="h-11 w-full text-[13.5px] font-medium text-sub active:bg-subtle">
                  {hiddenCount}개 더 보기
                </button>
              </li>
            )}
            {done.map((n) => (
              <MemoRow key={n.id} note={n} onEdit={() => setEditing(n)} />
            ))}
          </ul>
        )}
      </div>

      <EditMemoSheet note={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function MemoRow({ note, onEdit }: { note: KitchenNote; onEdit: () => void }) {
  const { dispatch } = useKitchen();
  return (
    <li className="flex items-center gap-1 border-b border-line pr-2 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={note.done}
        aria-label={note.done ? "완료 취소" : "완료로 표시"}
        onClick={() => dispatch({ type: "updateNote", id: note.id, patch: { done: !note.done } })}
        className="flex h-12 w-12 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px]",
            note.done ? "border-green bg-green text-white" : "border-line-strong",
          )}
        >
          {note.done && <Check size={13} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left">
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold", note.done ? "bg-subtle text-mute" : TAG_CLASS[note.tag])}>
          {TAG_LABEL[note.tag]}
        </span>
        <span className={cn("min-w-0 flex-1 text-[15px] leading-snug break-words", note.done && "text-mute line-through")}>{note.text}</span>
      </button>
    </li>
  );
}

function EditMemoSheet({ note, onClose }: { note: KitchenNote | null; onClose: () => void }) {
  return (
    <Sheet open={!!note} onClose={onClose} title="메모 수정">
      {note && <EditMemoBody key={note.id} note={note} onDone={onClose} />}
    </Sheet>
  );
}

function EditMemoBody({ note, onDone }: { note: KitchenNote; onDone: () => void }) {
  const { dispatch } = useKitchen();
  const toast = useToast();
  const [text, setText] = useState(note.text);
  const [tag, setTag] = useState<NoteTag>(note.tag);

  return (
    <div className="space-y-4 pt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="메모 내용"
        className="w-full rounded-xl border border-line px-4 py-3 leading-relaxed outline-none focus:border-green"
      />
      <SegmentedControl label="메모 종류" options={TAG_OPTIONS} value={tag} onChange={setTag} />
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <Button
          variant="danger"
          size="lg"
          onClick={() => {
            dispatch({ type: "deleteNote", id: note.id });
            toast("메모를 지웠어요", {
              label: "되돌리기",
              onClick: () => dispatch({ type: "addNote", note }),
            });
            onDone();
          }}
        >
          삭제
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!text.trim()}
          onClick={() => {
            dispatch({ type: "updateNote", id: note.id, patch: { text: text.trim(), tag } });
            onDone();
          }}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
