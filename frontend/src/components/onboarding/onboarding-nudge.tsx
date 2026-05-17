"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingDismissals } from "@/hooks/use-onboarding-dismissals";
import type { OnboardingNudgeId } from "@/lib/onboarding";

interface OnboardingNudgeProps {
  id: OnboardingNudgeId;
  userId?: string | null;
  title: string;
  description: string;
  href?: string;
  cta?: string;
  icon?: React.ReactNode;
  completed?: boolean;
}

export function OnboardingNudge({
  id,
  userId,
  title,
  description,
  href,
  cta,
  icon,
  completed = false,
}: OnboardingNudgeProps) {
  const { dismiss, isDismissed } = useOnboardingDismissals(userId);

  if (completed || isDismissed(id)) return null;

  return (
    <section className="mb-6 rounded-[1.6rem] border border-primary/20 bg-primary/8 p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
              {icon}
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {href && cta ? (
            <Link href={href}>
              <Button size="sm" className="gap-2">
                {cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => dismiss(id)}
          >
            <X className="h-4 w-4" />
            Ocultar
          </Button>
        </div>
      </div>
    </section>
  );
}
