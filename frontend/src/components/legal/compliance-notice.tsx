import Link from 'next/link';
import { Shield } from 'lucide-react';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_OPERATOR_NAME,
} from '@/lib/legal';
import { cn } from '@/lib/utils';

interface ComplianceNoticeProps {
  className?: string;
  title?: string;
  tone?: 'default' | 'subtle';
}

export function ComplianceNotice({
  className,
  title = 'Información importante',
  tone = 'default',
}: ComplianceNoticeProps) {
  const subtle = tone === 'subtle';

  return (
    <div
      className={cn(
        subtle
          ? 'rounded-xl border border-primary/15 bg-primary/5 p-4 text-left shadow-none'
          : 'rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 rounded-full p-2',
            subtle
              ? 'bg-primary/10 text-primary'
              : 'bg-primary/10 text-primary',
          )}
        >
          <Shield className="h-4 w-4" />
        </div>
        <div className="space-y-2">
          <p
            className={cn(
              'text-sm font-semibold',
              subtle
                ? 'text-foreground/80'
                : 'text-foreground dark:text-foreground',
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-foreground/86 dark:text-foreground/86',
            )}
          >
            Las rifas publicadas en LUK deben cumplir con la normativa aplicable
            en cada jurisdicción.
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-foreground/86 dark:text-foreground/86',
            )}
          >
            {LEGAL_OPERATOR_NAME} actúa como intermediario tecnológico y
            gestiona herramientas y pagos internos dentro de la plataforma. El
            saldo interno y las bonificaciones promocionales se utilizan
            únicamente dentro de LUK según los términos vigentes.
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-foreground/86 dark:text-foreground/86',
            )}
          >
            Consulta los{' '}
            <Link
              href="/legal/terminos"
              className={cn(
                'font-medium underline underline-offset-4',
                subtle ? 'text-foreground/80' : undefined,
              )}
            >
              términos y condiciones
            </Link>{' '}
            o escribí a{' '}
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className={cn(
                'font-medium underline underline-offset-4',
                subtle ? 'text-foreground/80' : undefined,
              )}
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
