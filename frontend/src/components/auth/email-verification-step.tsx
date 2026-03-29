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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>
            {description ?? (
              <>
                Enviamos un código de 6 dígitos a{' '}
                <span className="font-medium text-foreground">{pendingEmail}</span>
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {notice ? (
            <div className="p-3 text-sm text-primary bg-primary/10 rounded-md border border-primary/20">
              {notice}
            </div>
          ) : null}

          {errorMsg ? (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
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
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              <p className="text-xs text-muted-foreground text-center">
                El código expira en 15 minutos
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  );
}
