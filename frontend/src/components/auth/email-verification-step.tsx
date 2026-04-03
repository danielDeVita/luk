'use client';

import type { ReactNode } from 'react';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface EmailVerificationStepProps {
  pendingEmail: string;
  verificationCode: string;
  onVerificationCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onResend: () => void;
  onBack: () => void;
  verifying: boolean;
  resending: boolean;
  errorMsg?: string | null;
  notice?: ReactNode;
  title?: string;
  description?: ReactNode;
  submitLabel?: string;
  backLabel?: string;
}

export function EmailVerificationStep({
  pendingEmail,
  verificationCode,
  onVerificationCodeChange,
  onSubmit,
  onResend,
  onBack,
  verifying,
  resending,
  errorMsg,
  notice,
  title = 'Verificá tu Email',
  description,
  submitLabel = 'Verificar Email',
  backLabel = 'Volver',
}: EmailVerificationStepProps) {
  return (
    <div className="min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="container mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,430px)] lg:items-stretch">
          <div
            aria-hidden="true"
            className="bg-mesh hidden overflow-hidden rounded-[2.5rem] border border-border/80 p-8 shadow-panel lg:flex lg:flex-col lg:justify-between"
          >
            <div className="space-y-6">
              <p className="editorial-kicker text-primary">LUK / Verificación</p>
              <div className="space-y-4">
                <h1 className="font-display text-5xl leading-[0.9] text-balance xl:text-6xl">{title}</h1>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  {description ?? (
                    <>
                      Enviamos un código de 6 dígitos a{' '}
                      <span className="font-semibold text-foreground">{pendingEmail}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <Card className="w-full max-w-none">
            <CardHeader>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-primary text-primary-foreground shadow-lift">
                <Mail className="h-6 w-6" />
              </div>
              <CardTitle className="text-3xl">{title}</CardTitle>
              <CardDescription className="text-base">
                {description ?? (
                  <>
                    Enviamos un código de 6 dígitos a{' '}
                    <span className="font-semibold text-foreground">{pendingEmail}</span>
                  </>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
          {notice ? (
            <div className="rounded-[1.3rem] border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
              {notice}
            </div>
          ) : null}

          {errorMsg ? (
            <div className="rounded-[1.3rem] border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMsg}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificación</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(event) => {
                  onVerificationCodeChange(
                    event.target.value.replace(/\D/g, '').slice(0, 6),
                  );
                }}
                className="text-center font-mono text-xl tracking-[0.35em] sm:text-2xl sm:tracking-[0.5em]"
              />
              <p className="text-xs text-muted-foreground text-center">
                El código expira en 15 minutos
              </p>
            </div>

            <Button
              type="submit"
              className="w-full btn-press"
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={resending}
              className="w-full sm:w-auto"
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reenviar código
                </>
              )}
            </Button>
          </div>
            </CardContent>

            <CardFooter className="justify-center">
              <Button variant="link" onClick={onBack}>
                {backLabel}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
