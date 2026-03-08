import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
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
  title = 'Aviso legal sobre la operatoria',
  tone = 'default',
}: ComplianceNoticeProps) {
  const subtle = tone === 'subtle';

  return (
    <div
      className={cn(
        subtle
          ? 'rounded-xl border border-border/70 bg-muted/30 p-3 text-left shadow-none'
          : 'rounded-2xl border border-amber-300/70 bg-amber-50/90 p-4 text-left shadow-sm dark:border-amber-800 dark:bg-amber-950/30',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 rounded-full p-2',
            subtle
              ? 'bg-muted text-muted-foreground'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
          )}
        >
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="space-y-2">
          <p
            className={cn(
              'text-sm font-semibold',
              subtle
                ? 'text-foreground/80'
                : 'text-amber-900 dark:text-amber-100',
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-amber-900/90 dark:text-amber-100/90',
            )}
          >
            La publicacion y participacion en rifas estan sujetas a la legalidad
            aplicable en cada jurisdiccion. Cada organizador debe contar con las
            autorizaciones, licencias o permisos que correspondan.
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-amber-900/90 dark:text-amber-100/90',
            )}
          >
            {LEGAL_OPERATOR_NAME} actua como intermediario tecnologico y no
            comercializa fichas, saldo, creditos, monedas virtuales ni valores
            utilizables fuera de este sitio. Consulta los{' '}
            <Link
              href="/legal/terminos"
              className={cn(
                'font-medium underline underline-offset-4',
                subtle ? 'text-foreground/80' : undefined,
              )}
            >
              terminos y condiciones
            </Link>{' '}
            o escribi a{' '}
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
