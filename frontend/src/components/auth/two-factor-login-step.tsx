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
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Autenticación en dos pasos</CardTitle>
          <CardDescription>
            Completá el segundo factor para entrar con{' '}
            <span className="font-medium text-foreground">{pendingEmail}</span>
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

          <div className="flex gap-2">
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
                  className="text-center text-2xl tracking-[0.5em] font-mono"
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  );
}
