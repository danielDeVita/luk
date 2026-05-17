"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addOnboardingDismissal,
  type OnboardingNudgeId,
  readOnboardingDismissals,
} from "@/lib/onboarding";

export function useOnboardingDismissals(userId?: string | null) {
  const [optimisticDismissals, setOptimisticDismissals] = useState<
    Record<string, OnboardingNudgeId[]>
  >({});

  const storedDismissals = useMemo(() => {
    if (!userId || typeof window === "undefined") return [];

    return readOnboardingDismissals(userId, window.localStorage);
  }, [userId]);

  const dismissals = useMemo(() => {
    if (!userId) return [];

    return Array.from(
      new Set([
        ...storedDismissals,
        ...(optimisticDismissals[userId] ?? []),
      ]),
    );
  }, [optimisticDismissals, storedDismissals, userId]);

  const dismiss = useCallback(
    (nudgeId: OnboardingNudgeId) => {
      if (!userId || typeof window === "undefined") return;
      const nextDismissals = addOnboardingDismissal(
        userId,
        nudgeId,
        window.localStorage,
      );
      setOptimisticDismissals((currentDismissals) => ({
        ...currentDismissals,
        [userId]: nextDismissals,
      }));
    },
    [userId],
  );

  const isDismissed = useCallback(
    (nudgeId: OnboardingNudgeId) => !userId || dismissals.includes(nudgeId),
    [dismissals, userId],
  );

  return {
    dismiss,
    isDismissed,
  };
}
