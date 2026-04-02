'use client';

import { Loader2, Shield } from 'lucide-react';
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

interface TwoFactorLoginStepProps {
  pendingEmail: string;
  mode: 'code' | 'recovery';
  code: string;
  recoveryCode: string;
  onModeChange: (mode: 'code' | 'recovery') => void;
  onCodeChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  loading: boolean;
  errorMsg?: string | null;
  notice?: string | null;
}

export function TwoFactorLoginStep({
  pendingEmail,
  mode,
  code,
  recoveryCode,
  onModeChange,
  onCodeChange,
  onRecoveryCodeChange,
  onSubmit,
  onBack,
  loading,
  errorMsg,
  notice,
}: TwoFactorLoginStepProps) {
  const isCodeMode = mode === 'code';
  const canSubmit = isCodeMode ? code.length === 6 : recoveryCode.trim().length > 0;

  return (
    <div className="min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="container mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,430px)] lg:items-stretch">
          <div className="bg-mesh hidden overflow-hidden rounded-[2.5rem] border border-border/80 p-8 shadow-panel lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <p className="editorial-kicker text-primary">LUK / 2FA</p>
              <div className="space-y-4">
                <h1 className="font-display text-5xl leading-[0.9] text-balance xl:text-6xl">
                  Autenticación en dos pasos
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Completá el segundo factor para entrar con{' '}
                  <span className="font-semibold text-foreground">{pendingEmail}</span>
                </p>
              </div>
            </div>
          </div>

          <Card className="w-full max-w-none">
            <CardHeader>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-primary text-primary-foreground shadow-lift">
                <Shield className="h-6 w-6" />
              </div>
              <CardTitle className="text-3xl">Autenticación en dos pasos</CardTitle>
              <CardDescription className="text-base">
                Completá el segundo factor para entrar con{' '}
                <span className="font-semibold text-foreground">{pendingEmail}</span>
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={isCodeMode ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => onModeChange('code')}
            >
              App autenticadora
            </Button>
            <Button
              type="button"
              variant={!isCodeMode ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => onModeChange('recovery')}
            >
              Recovery code
            </Button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {isCodeMode ? (
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Código de autenticación</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => {
                    onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  className="text-center font-mono text-xl tracking-[0.35em] sm:text-2xl sm:tracking-[0.5em]"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Ingresá el código de 6 dígitos de tu app autenticadora.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="recoveryCode">Código de recuperación</Label>
                <Input
                  id="recoveryCode"
                  type="text"
                  placeholder="ABCD-1234"
                  value={recoveryCode}
                  onChange={(event) => {
                    onRecoveryCodeChange(event.target.value.toUpperCase());
                  }}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Usá uno de los códigos que guardaste al activar 2FA.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Continuar'
              )}
            </Button>
          </form>
            </CardContent>

            <CardFooter className="justify-center">
              <Button variant="link" onClick={onBack}>
                Volver al login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
