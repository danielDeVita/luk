'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

interface CountdownProps {
  targetDate: string | Date;
  onComplete?: () => void;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showSeconds?: boolean;
}

/**
 * Real-time countdown timer component.
 *
 * Features:
 * - Updates every second
 * - Supports multiple display variants
 * - Calls onComplete when countdown reaches zero
 * - Displays urgency colors when time is running out
 */
export function Countdown({
  targetDate,
  onComplete,
  className,
  variant = 'default',
  showSeconds = true,
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const calculateTimeLeft = useCallback((): TimeLeft => {
    const target = new Date(targetDate).getTime();
    const now = Date.now();
    const total = target - now;

    if (total <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((total % (1000 * 60)) / 1000),
      total,
    };
  }, [targetDate]);

  useEffect(() => {
    // Initial calculation - intentionally setting state in effect for timer initialization
    const initialTimeLeft = calculateTimeLeft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(initialTimeLeft);

    if (initialTimeLeft.total <= 0) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    // Update every second - timer pattern requires setState in interval callback
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0) {
        setIsComplete(true);
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onComplete]);

  if (!timeLeft) {
    return null; // Loading state
  }

  if (isComplete) {
    return (
      <span className={cn('text-destructive font-medium', className)}>
        Finalizada
      </span>
    );
  }

  // Determine urgency level for styling
  const isUrgent = timeLeft.total < 24 * 60 * 60 * 1000; // Less than 24 hours
  const isCritical = timeLeft.total < 60 * 60 * 1000; // Less than 1 hour

  const urgencyClass = isCritical
    ? 'text-destructive'
    : isUrgent
    ? 'text-orange-500 dark:text-orange-400'
    : 'text-muted-foreground';

  // Compact variant: "2d 5h" or "5h 30m"
  if (variant === 'compact') {
    if (timeLeft.days > 0) {
      return (
        <span className={cn('text-sm font-medium', urgencyClass, className)}>
          {timeLeft.days}d {timeLeft.hours}h
        </span>
      );
    }
    if (timeLeft.hours > 0) {
      return (
        <span className={cn('text-sm font-medium', urgencyClass, className)}>
          {timeLeft.hours}h {timeLeft.minutes}m
        </span>
      );
    }
    return (
      <span className={cn('text-sm font-medium', urgencyClass, className)}>
        {timeLeft.minutes}m {showSeconds ? `${timeLeft.seconds}s` : ''}
      </span>
    );
  }

  // Detailed variant: separate boxes for each unit
  if (variant === 'detailed') {
    return (
      <div className={cn('flex gap-2', className)}>
        <TimeUnit value={timeLeft.days} label="Días" urgent={isUrgent} critical={isCritical} />
        <TimeUnit value={timeLeft.hours} label="Horas" urgent={isUrgent} critical={isCritical} />
        <TimeUnit value={timeLeft.minutes} label="Min" urgent={isUrgent} critical={isCritical} />
        {showSeconds && (
          <TimeUnit value={timeLeft.seconds} label="Seg" urgent={isUrgent} critical={isCritical} />
        )}
      </div>
    );
  }

  // Default variant: "2 días, 5 horas, 30 minutos"
  const parts: string[] = [];
  if (timeLeft.days > 0) {
    parts.push(`${timeLeft.days} ${timeLeft.days === 1 ? 'día' : 'días'}`);
  }
  if (timeLeft.hours > 0 || timeLeft.days > 0) {
    parts.push(`${timeLeft.hours}h`);
  }
  parts.push(`${timeLeft.minutes}m`);
  if (showSeconds && timeLeft.days === 0) {
    parts.push(`${timeLeft.seconds}s`);
  }

  return (
    <span className={cn('font-medium', urgencyClass, className)}>
      {parts.join(' ')}
    </span>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
  urgent?: boolean;
  critical?: boolean;
}

function TimeUnit({ value, label, urgent, critical }: TimeUnitProps) {
  const bgClass = critical
    ? 'bg-destructive/10 border-destructive/20'
    : urgent
    ? 'bg-orange-500/10 border-orange-500/20'
    : 'bg-muted border-border';

  const textClass = critical
    ? 'text-destructive'
    : urgent
    ? 'text-orange-500 dark:text-orange-400'
    : 'text-foreground';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border px-3 py-2 min-w-[60px]',
        bgClass
      )}
    >
      <span className={cn('text-xl font-bold tabular-nums', textClass)}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Hook to get countdown state for custom implementations.
 */
export function useCountdown(targetDate: string | Date) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft => {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const total = target - now;

      if (total <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
      }

      return {
        days: Math.floor(total / (1000 * 60 * 60 * 24)),
        hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((total % (1000 * 60)) / 1000),
        total,
      };
    };

    // Timer pattern requires setState in effect for initialization and interval
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return {
    timeLeft,
    isComplete: timeLeft?.total === 0,
    isUrgent: timeLeft ? timeLeft.total < 24 * 60 * 60 * 1000 : false,
    isCritical: timeLeft ? timeLeft.total < 60 * 60 * 1000 : false,
  };
}
