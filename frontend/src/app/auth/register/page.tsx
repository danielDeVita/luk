'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, AlertTriangle, Gift, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!, $nombre: String!, $apellido: String!, $fechaNacimiento: String!, $acceptTerms: Boolean!, $referralCode: String) {
    register(input: { email: $email, password: $password, nombre: $nombre, apellido: $apellido, fechaNacimiento: $fechaNacimiento, acceptTerms: $acceptTerms, referralCode: $referralCode }) {
      user {
        id
        email
        nombre
      }
      requiresVerification
      message
    }
  }
`;

const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($userId: String!, $code: String!, $referralCode: String) {
    verifyEmail(userId: $userId, code: $code, referralCode: $referralCode) {
      token
      refreshToken
      user {
        id
        email
        nombre
        apellido
        role
        emailVerified
      }
    }
  }
`;

const RESEND_CODE_MUTATION = gql`
  mutation ResendVerificationCode($userId: String!) {
    resendVerificationCode(userId: $userId)
  }
`;

// Calculate minimum date (18 years ago)
const getMaxBirthDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date.toISOString().split('T')[0];
};

const registerSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres'),
  email: z.string().email('Email inválido'),
  fechaNacimiento: z.string().refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }, 'Debés ser mayor de 18 años'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Debés aceptar los términos y condiciones',
  }),
  referralCode: z.string().max(20).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

interface RegisterResult {
  register: {
    user: {
      id: string;
      email: string;
      nombre: string;
    };
    requiresVerification: boolean;
    message?: string;
  };
}

interface VerifyEmailResult {
  verifyEmail: {
    token: string;
    refreshToken?: string;
    user: {
      id: string;
      email: string;
      nombre: string;
      apellido: string;
      role: 'USER' | 'ADMIN' | 'BANNED';
      emailVerified: boolean;
    };
  };
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two-step flow state
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      acceptTerms: false,
      referralCode: refCode || '',
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const password = watch('password', '');
  const confirmPassword = watch('confirmPassword', '');

  const [registerMutation, { loading: registering }] = useMutation<RegisterResult>(REGISTER_MUTATION);
  const [verifyEmailMutation, { loading: verifying }] = useMutation<VerifyEmailResult>(VERIFY_EMAIL_MUTATION);
  const [resendCodeMutation, { loading: resending }] = useMutation(RESEND_CODE_MUTATION);

  const onRegisterSubmit = async (formData: RegisterForm) => {
    setErrorMsg(null);
    const { confirmPassword: _, referralCode, ...registerData } = formData;

    try {
      const result = await registerMutation({ variables: { ...registerData, referralCode } });

      if (result.data?.register.requiresVerification) {
        setPendingUserId(result.data.register.user.id);
        setPendingEmail(result.data.register.user.email);
        setStoredReferralCode(referralCode || null);
        setStep('verify');
        toast.success('Te enviamos un código de verificación a tu email');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrarse');
    }
  };

  const onVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUserId || verificationCode.length !== 6) return;

    setErrorMsg(null);
    try {
      const result = await verifyEmailMutation({
        variables: {
          userId: pendingUserId,
          code: verificationCode,
          referralCode: storedReferralCode,
        },
      });

      if (result.data?.verifyEmail) {
        setAuth(result.data.verifyEmail.user, result.data.verifyEmail.token, result.data.verifyEmail.refreshToken);
        toast.success('¡Email verificado! Bienvenido');
        router.push('/');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Código inválido');
    }
  };

  const handleResendCode = async () => {
    if (!pendingUserId) return;

    try {
      await resendCodeMutation({ variables: { userId: pendingUserId } });
      toast.success('Nuevo código enviado a tu email');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reenviar código');
    }
  };

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Verification step UI
  if (step === 'verify') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Verificá tu Email</CardTitle>
            <CardDescription>
              Enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{pendingEmail}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {errorMsg}
              </div>
            )}

            <form onSubmit={onVerifySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificación</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  'Verificar Email'
                )}
              </Button>
            </form>

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendCode}
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
            <Button
              variant="link"
              onClick={() => {
                setStep('register');
                setVerificationCode('');
                setErrorMsg(null);
              }}
            >
              Volver al registro
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
          <CardDescription>
            Unite para participar en rifas y ganar premios
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Age Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              La participación en rifas está reservada exclusivamente a mayores de 18 años. Al registrarte, declarás bajo juramento ser mayor de edad.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onRegisterSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Juan"
                  {...register('nombre')}
                />
                {errors.nombre && (
                  <p className="text-xs text-destructive">{errors.nombre.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  placeholder="Perez"
                  {...register('apellido')}
                />
                {errors.apellido && (
                  <p className="text-xs text-destructive">{errors.apellido.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
              <Input
                id="fechaNacimiento"
                type="date"
                max={getMaxBirthDate()}
                {...register('fechaNacimiento')}
              />
              {errors.fechaNacimiento && (
                <p className="text-xs text-destructive">{errors.fechaNacimiento.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Debés ser mayor de 18 años para registrarte</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="juan@email.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                {...register('password')}
              />

              {/* Password strength */}
              <div className="grid grid-cols-2 gap-1 text-xs">
                <PasswordCheck valid={hasMinLength} text="8+ caracteres" />
                <PasswordCheck valid={hasUppercase} text="Una mayúscula" />
                <PasswordCheck valid={hasLowercase} text="Una minúscula" />
                <PasswordCheck valid={hasNumber} text="Un número" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="********"
                {...register('confirmPassword')}
              />
              {confirmPassword.length > 0 && (
                <div className="flex items-center space-x-1 text-xs">
                  <Check className={`h-3 w-3 ${passwordsMatch ? 'text-green-600' : 'text-destructive opacity-30'}`} />
                  <span className={passwordsMatch ? 'text-green-600' : 'text-destructive'}>
                    {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </span>
                </div>
              )}
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="acceptTerms"
                className="mt-1 rounded border-input"
                {...register('acceptTerms')}
              />
              <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug">
                Declaro ser mayor de 18 años y acepto los{' '}
                <Link href="/legal/terminos" className="text-primary hover:underline" target="_blank">
                  términos y condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/legal/privacidad" className="text-primary hover:underline" target="_blank">
                  política de privacidad
                </Link>
              </Label>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
            )}

            {/* Referral Code */}
            <div className="space-y-2">
              <Label htmlFor="referralCode" className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                Codigo de referido (opcional)
              </Label>
              <Input
                id="referralCode"
                placeholder="ABCD1234"
                {...register('referralCode')}
                className="uppercase"
              />
              {refCode && (
                <p className="text-xs text-green-600">
                  Fuiste invitado por un amigo
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={registering || isSubmitting}>
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear Cuenta'
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">O continua con</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/auth/google`;
            }}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Al registrarte con Google, también aceptás los términos y condiciones y debés ser mayor de 18 años.
          </p>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/auth/login" className="text-primary hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function PasswordCheck({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className={`flex items-center space-x-1 ${valid ? 'text-green-600' : 'text-muted-foreground'}`}>
      <Check className={`h-3 w-3 ${valid ? 'opacity-100' : 'opacity-30'}`} />
      <span>{text}</span>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
