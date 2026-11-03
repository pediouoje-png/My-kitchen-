"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { todayKST } from "@/lib/date";
import { guessCategory } from "@/lib/domain/category";
import { withReferenceNutrition } from "@/lib/domain/reference-nutrition";
import type { ISODate, KitchenState } from "@/lib/domain/types";
import { createSeedState } from "@/lib/mock/seed";
import { kitchenReducer, type KitchenAction } from "./reducer";

/**
 * Phase 1 전용 클라이언트 저장소.
 * - 데이터는 브라우저 localStorage에만 저장된다 (DB 미연결).
 * - Phase 2부터 같은 액션 인터페이스를 Supabase RPC 호출로 교체한다.
 */

const STORAGE_KEY = "my-kitchen:demo:v1";

interface KitchenContextValue {
  state: KitchenState;
  dispatch: (action: KitchenAction) => void;
  today: ISODate;
  ready: boolean;
  resetDemo: () => void;
}

const KitchenContext = createContext<KitchenContextValue | null>(null);

const EMPTY: KitchenState = {
  ingredients: [],
  lots: [],
  logs: [],
  meals: [],
  recipes: [],
  settings: { soonDays: 3 },
};

function readStorage(): KitchenState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: KitchenState };
    if (!parsed.state || !Array.isArray(parsed.state.lots)) return null;
    return migrate(parsed.state);
  } catch {
    return null;
  }
}

const REFERENCE_NUTRITION_VERSION = 1;

/**
 * 저장된 데이터 보정 (앱을 열 때 실행).
 * 1) 이전 버전에서 직접 등록한 재료는 분류가 모두 "기타"였다 → 이름으로 확실할 때만 바로잡는다.
 * 2) 영양 정보가 비어 있는 재료에 참고값을 한 번 채운다. 사용자가 나중에 지운 값은 다시 채우지 않는다.
 */
function migrate(state: KitchenState): KitchenState {
  const fillNutrition = (state.settings.referenceNutritionVersion ?? 0) < REFERENCE_NUTRITION_VERSION;
  return {
    ...state,
    settings: { ...state.settings, referenceNutritionVersion: REFERENCE_NUTRITION_VERSION },
    ingredients: state.ingredients.map((i) => {
      let next = i;
      if (next.category === "기타") {
        const guess = guessCategory(next.name);
        if (guess) next = { ...next, category: guess };
      }
      if (fillNutrition) next = withReferenceNutrition(next);
      return next;
    }),
  };
}

function writeStorage(state: KitchenState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, savedAt: Date.now() }));
  } catch {
    // 저장 실패(사파리 개인정보 보호 모드 등)는 무시 — 세션 동안은 메모리 상태로 동작
  }
}

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(kitchenReducer, EMPTY);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState<ISODate>("");
  const loaded = useRef(false);

  // 날짜와 저장 데이터는 브라우저에서만 결정한다 (서버 프리렌더와의 불일치 방지)
  useEffect(() => {
    const t = todayKST();
    const stored = readStorage();
    dispatch({ type: "replace", state: stored ?? migrate(createSeedState(t)) });
    loaded.current = true;
    // 마운트 직후 한 번만 실행되는 초기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    setReady(true);
  }, []);

  useEffect(() => {
    if (loaded.current) writeStorage(state);
  }, [state]);

  // 앱을 켜 둔 채 날짜가 바뀌는 경우 대비
  useEffect(() => {
    if (!ready) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") setToday(todayKST());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready]);

  const resetDemo = useCallback(() => {
    const t = todayKST();
    setToday(t);
    dispatch({ type: "replace", state: migrate(createSeedState(t)) });
  }, []);

  const value = useMemo(() => ({ state, dispatch, today, ready, resetDemo }), [state, today, ready, resetDemo]);
  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen(): KitchenContextValue {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error("useKitchen must be used within KitchenProvider");
  return ctx;
}
