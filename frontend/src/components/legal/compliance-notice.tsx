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
          : 'rounded-2xl border border-secondary/35 bg-secondary/14 p-4 text-left shadow-sm dark:border-secondary/28 dark:bg-secondary/12',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 rounded-full p-2',
            subtle
              ? 'bg-muted text-muted-foreground'
              : 'bg-secondary/20 text-secondary-foreground dark:bg-secondary/18 dark:text-secondary',
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
            La publicacion y participacion en rifas estan sujetas a la legalidad
            aplicable en cada jurisdiccion. Cada organizador debe contar con las
            autorizaciones, licencias o permisos que correspondan.
          </p>
          <p
            className={cn(
              'text-sm leading-relaxed',
              subtle
                ? 'text-muted-foreground'
                : 'text-foreground/86 dark:text-foreground/86',
            )}
          >
            {LEGAL_OPERATOR_NAME} actua como intermediario tecnologico y no
            comercializa fichas, saldo, monedas virtuales ni valores
            utilizables fuera de este sitio. La plataforma puede otorgar
            bonificaciones promocionales internas, no transferibles y
            utilizables solo dentro de Luk segun los terminos vigentes.
            Consulta los{' '}
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
