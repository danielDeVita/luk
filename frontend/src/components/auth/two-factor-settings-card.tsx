'use client';

import { useMemo, useState } from 'react';
import { gql } from '@apollo/client/core';
import { useMutation } from '@apollo/client/react';
import { Loader2, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BEGIN_TWO_FACTOR_SETUP = gql`
  mutation BeginTwoFactorSetup($currentPassword: String!) {
    beginTwoFactorSetup(currentPassword: $currentPassword) {
      setupToken
      manualEntryKey
      otpauthUrl
      qrCodeDataUrl
    }
  }
`;

const ENABLE_TWO_FACTOR = gql`
  mutation EnableTwoFactor($setupToken: String!, $code: String!) {
    enableTwoFactor(setupToken: $setupToken, code: $code) {
      recoveryCodes
      user {
        id
        twoFactorEnabled
        twoFactorEnabledAt
      }
    }
  }
`;

const DISABLE_TWO_FACTOR = gql`
  mutation DisableTwoFactor($currentPassword: String!, $code: String, $recoveryCode: String) {
    disableTwoFactor(currentPassword: $currentPassword, code: $code, recoveryCode: $recoveryCode)
  }
`;

interface BeginTwoFactorSetupData {
  beginTwoFactorSetup: {
    setupToken: string;
    manualEntryKey: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  };
}

interface EnableTwoFactorData {
  enableTwoFactor: {
    recoveryCodes: string[];
    user: {
      id: string;
      twoFactorEnabled: boolean;
      twoFactorEnabledAt?: string | null;
    };
  };
}

interface DisableTwoFactorData {
  disableTwoFactor: boolean;
}

interface TwoFactorSettingsCardProps {
  twoFactorEnabled: boolean;
  twoFactorEnabledAt?: string | null;
  onStatusChanged: () => Promise<unknown> | void;
}

function formatEnabledAt(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function TwoFactorSettingsCard({
  twoFactorEnabled,
  twoFactorEnabledAt,
  onStatusChanged,
}: TwoFactorSettingsCardProps) {
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupData, setSetupData] = useState<BeginTwoFactorSetupData['beginTwoFactorSetup'] | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableRecoveryCode, setDisableRecoveryCode] = useState('');
  const [disableMode, setDisableMode] = useState<'code' | 'recovery'>('code');

  const [beginTwoFactorSetup, { loading: isStartingSetup }] =
    useMutation<BeginTwoFactorSetupData>(BEGIN_TWO_FACTOR_SETUP, {
      onCompleted: (data) => {
        setSetupData(data.beginTwoFactorSetup);
        setSetupCode('');
        toast.success('Escaneá el QR y confirmá el código para activar 2FA.');
      },
      onError: (error) => {
        toast.error(
          error.message || 'No pudimos iniciar la configuración de 2FA.',
        );
      },
    });

  const [enableTwoFactor, { loading: isEnabling }] =
    useMutation<EnableTwoFactorData>(ENABLE_TWO_FACTOR, {
      onError: (error) => {
        toast.error(
          error.message || 'No pudimos activar la autenticación en dos pasos.',
        );
      },
    });

  const [disableTwoFactor, { loading: isDisabling }] =
    useMutation<DisableTwoFactorData>(DISABLE_TWO_FACTOR, {
      onError: (error) => {
        toast.error(
          error.message || 'No pudimos desactivar la autenticación en dos pasos.',
        );
      },
    });

  const enabledAtLabel = useMemo(
    () => formatEnabledAt(twoFactorEnabledAt),
    [twoFactorEnabledAt],
  );

  const handleBeginSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setupPassword.trim()) {
      toast.error('Ingresá tu contraseña actual para continuar.');
      return;
    }

    setRecoveryCodes(null);
    await beginTwoFactorSetup({
      variables: {
        currentPassword: setupPassword,
      },
    });
  };

  const handleEnableTwoFactor = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!setupData) return;

    if (setupCode.length !== 6) {
      toast.error('Ingresá el código de 6 dígitos de tu app autenticadora.');
      return;
    }

    const result = await enableTwoFactor({
      variables: {
        setupToken: setupData.setupToken,
        code: setupCode,
      },
    });

    if (result.data?.enableTwoFactor) {
      setRecoveryCodes(result.data.enableTwoFactor.recoveryCodes);
      setSetupPassword('');
      setSetupCode('');
      setSetupData(null);
      await onStatusChanged();
      toast.success('2FA activado correctamente.');
    }
  };

  const handleDisableTwoFactor = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!disablePassword.trim()) {
      toast.error('Ingresá tu contraseña actual para continuar.');
      return;
    }

    if (disableMode === 'code' && disableCode.length !== 6) {
      toast.error('Ingresá el código de 6 dígitos de tu app autenticadora.');
      return;
    }

    if (disableMode === 'recovery' && !disableRecoveryCode.trim()) {
      toast.error('Ingresá un recovery code para continuar.');
      return;
    }

    const result = await disableTwoFactor({
      variables: {
        currentPassword: disablePassword,
        code: disableMode === 'code' ? disableCode : null,
        recoveryCode:
          disableMode === 'recovery' ? disableRecoveryCode.trim() : null,
      },
    });

    if (result.data?.disableTwoFactor) {
      setDisablePassword('');
      setDisableCode('');
      setDisableRecoveryCode('');
      setDisableMode('code');
      await onStatusChanged();
      toast.success('2FA desactivado correctamente.');
    }
  };

  const isShowingRecoveryCodes = Boolean(recoveryCodes?.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Autenticación en dos pasos
            </CardTitle>
            <CardDescription>
              Agregá un segundo factor con una app autenticadora. Esta versión
              funciona para cuentas con contraseña.
            </CardDescription>
          </div>

          <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
            {twoFactorEnabled ? 'Activa' : 'Inactiva'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isShowingRecoveryCodes ? (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="font-medium">Guardá estos recovery codes ahora.</p>
              <p className="text-sm text-muted-foreground">
                Se muestran una sola vez. Cada código sirve para un único acceso.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {recoveryCodes?.map((recoveryCode) => (
                <div
                  key={recoveryCode}
                  className="rounded-md border bg-background px-3 py-2 font-mono text-sm"
                >
                  {recoveryCode}
                </div>
              ))}
            </div>

            <Button
              type="button"
              onClick={() => setRecoveryCodes(null)}
              className="w-full"
            >
              Ya los guardé
            </Button>
          </div>
        ) : null}

        {!twoFactorEnabled && !setupData ? (
          <form onSubmit={handleBeginSetup} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Si activás 2FA, al entrar con email y contraseña vas a necesitar
              además el código de tu app autenticadora o un recovery code.
            </div>

            <div className="space-y-2">
              <Label htmlFor="twoFactorCurrentPassword">
                Contraseña actual
              </Label>
              <Input
                id="twoFactorCurrentPassword"
                type="password"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                placeholder="Ingresá tu contraseña"
              />
            </div>

            <Button type="submit" disabled={isStartingSetup}>
              {isStartingSetup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Configurar 2FA
                </>
              )}
            </Button>
          </form>
        ) : null}

        {!twoFactorEnabled && setupData ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Escaneá este código QR con Google Authenticator, 1Password, Authy
              o una app compatible, y después confirmá el código de 6 dígitos.
            </div>

            <div className="flex justify-center">
              <Image
                src={setupData.qrCodeDataUrl}
                alt="Código QR para configurar 2FA"
                width={192}
                height={192}
                unoptimized
                className="h-48 w-48 rounded-[1.35rem] border border-border/80 bg-card p-3 shadow-panel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manualEntryKey">Clave manual</Label>
              <Input
                id="manualEntryKey"
                readOnly
                value={setupData.manualEntryKey}
                className="font-mono text-sm"
              />
            </div>

            <form onSubmit={handleEnableTwoFactor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twoFactorActivationCode">
                  Código de autenticación
                </Label>
                <Input
                  id="twoFactorActivationCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={setupCode}
                  onChange={(event) =>
                    setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isEnabling} className="flex-1">
                  {isEnabling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activando...
                    </>
                  ) : (
                    'Activar 2FA'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSetupData(null);
                    setSetupCode('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {twoFactorEnabled ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
              <p className="font-medium">2FA activo</p>
              <p>
                Cada nuevo login con email y contraseña va a pedir un segundo
                factor.
                {enabledAtLabel ? ` Activado el ${enabledAtLabel}.` : ''}
              </p>
            </div>

            <form onSubmit={handleDisableTwoFactor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disableCurrentPassword">Contraseña actual</Label>
                <Input
                  id="disableCurrentPassword"
                  type="password"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                  placeholder="Ingresá tu contraseña"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={disableMode === 'code' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setDisableMode('code')}
                >
                  Código TOTP
                </Button>
                <Button
                  type="button"
                  variant={disableMode === 'recovery' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setDisableMode('recovery')}
                >
                  Recovery code
                </Button>
              </div>

              {disableMode === 'code' ? (
                <div className="space-y-2">
                  <Label htmlFor="disableTotpCode">Código de autenticación</Label>
                  <Input
                    id="disableTotpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={disableCode}
                    onChange={(event) =>
                      setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="disableRecoveryCode">Recovery code</Label>
                  <Input
                    id="disableRecoveryCode"
                    type="text"
                    placeholder="ABCD-1234"
                    value={disableRecoveryCode}
                    onChange={(event) =>
                      setDisableRecoveryCode(event.target.value.toUpperCase())
                    }
                    className="font-mono uppercase"
                  />
                </div>
              )}

              <Button type="submit" variant="destructive" disabled={isDisabling}>
                {isDisabling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Desactivando...
                  </>
                ) : (
                  <>
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Desactivar 2FA
                  </>
                )}
              </Button>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
