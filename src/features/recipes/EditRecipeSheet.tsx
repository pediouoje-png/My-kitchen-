"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { Recipe } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";

/** 내 레시피 수정: 이름 · 메모 · 조리 시간 · 조리 순서 */
export function EditRecipeSheet({ recipe, open, onClose }: { recipe: Recipe; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="레시피 수정" description="재료는 식단에서 쓴 양으로 저장돼요">
      {open && <EditBody recipe={recipe} onDone={onClose} />}
    </Sheet>
  );
}

function EditBody({ recipe, onDone }: { recipe: Recipe; onDone: () => void }) {
  const { dispatch } = useKitchen();
  const toast = useToast();
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description);
  const [minutes, setMinutes] = useState(recipe.cookMinutes > 0 ? String(recipe.cookMinutes) : "");
  const [steps, setSteps] = useState(recipe.steps.join("\n"));

  const field = "w-full rounded-xl border border-line px-4 outline-none placeholder:text-mute focus:border-green";

  const save = () => {
    dispatch({
      type: "updateRecipe",
      id: recipe.id,
      patch: {
        title: title.trim() || recipe.title,
        description: description.trim(),
        cookMinutes: Math.max(0, Math.round(Number(minutes) || 0)),
        steps: steps
          .split("\n")
          .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
          .filter(Boolean),
      },
    });
    toast("레시피를 저장했어요");
    onDone();
  };

  return (
    <div className="space-y-4 pt-2">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">이름</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} h-12`} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">메모 (선택)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 김치가 시면 설탕 조금"
          className={`${field} h-12`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">조리 시간 (분, 선택)</span>
        <input
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="-"
          className={`${field} h-12`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">조리 순서 (한 줄에 한 단계)</span>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={5}
          placeholder={"두부 물기를 뺀다\n김치를 볶는다\n두부를 넣고 마무리한다"}
          className={`${field} py-3 leading-relaxed`}
        />
      </label>
      <Button variant="primary" size="lg" block onClick={save}>
        저장
      </Button>
    </div>
  );
}
