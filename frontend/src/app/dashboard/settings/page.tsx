'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Lock, CreditCard, CheckCircle2, XCircle, ExternalLink, Shield, AlertTriangle, Clock, FileCheck, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';

// Types
interface MpStatusData {
  me: {
    id: string;
    avatarUrl?: string;
    mpConnectStatus: string;
    mpUserId?: string;
    kycStatus: string;
    documentType?: string;
    documentNumber?: string;
    street?: string;
    streetNumber?: string;
    apartment?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    phone?: string;
    cuitCuil?: string;
    termsAcceptedAt?: string;
    termsVersion?: string;
  };
}

interface UpdateAvatarData {
  updateAvatar: {
    id: string;
    avatarUrl: string;
  };
}

interface DeleteAvatarData {
  deleteAvatar: {
    id: string;
    avatarUrl: string | null;
  };
}

// Queries
const GET_USER_DATA = gql`
  query GetCurrentUser {
    me {
      id
      avatarUrl
      mpConnectStatus
      mpUserId
      kycStatus
      documentType
      documentNumber
      street
      streetNumber
      apartment
      city
      province
      postalCode
      phone
      cuitCuil
      termsAcceptedAt
      termsVersion
    }
  }
`;

// Mutations
const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      nombre
      apellido
      phone
    }
  }
`;

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      id
    }
  }
`;

const UPDATE_KYC = gql`
  mutation UpdateKyc($input: UpdateKycInput!) {
    updateKyc(input: $input) {
      id
      kycStatus
      documentType
      documentNumber
      street
      streetNumber
      apartment
      city
      province
      postalCode
      phone
      cuitCuil
    }
  }
`;

const UPDATE_AVATAR = gql`
  mutation UpdateAvatar($input: UpdateAvatarInput!) {
    updateAvatar(input: $input) {
      id
      avatarUrl
    }
  }
`;

const DELETE_AVATAR = gql`
  mutation DeleteAvatar {
    deleteAvatar {
      id
      avatarUrl
    }
  }
`;

// Schemas
const profileSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Al menos una mayúscula')
    .regex(/[a-z]/, 'Al menos una minúscula')
    .regex(/[0-9]/, 'Al menos un número'),
});

const kycSchema = z.object({
  documentType: z.enum(['DNI', 'PASSPORT', 'CUIT_CUIL'], { message: 'Seleccioná un tipo de documento' }),
  documentNumber: z.string().min(7, 'Número de documento inválido').max(20),
  street: z.string().min(2, 'Calle requerida'),
  streetNumber: z.string().min(1, 'Número requerido'),
  apartment: z.string().optional(),
  city: z.string().min(2, 'Ciudad requerida'),
  province: z.string().min(2, 'Provincia requerida'),
  postalCode: z.string().min(4, 'Código postal inválido'),
  phone: z.string().optional(),
  cuitCuil: z.string().regex(/^\d{2}-\d{8}-\d$/, 'Formato: XX-XXXXXXXX-X').optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type KycForm = z.infer<typeof kycSchema>;

const PROVINCIAS_ARGENTINA = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Cordoba', 'Corrientes',
  'Entre Rios', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquen', 'Rio Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucuman'
];

function KycStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'VERIFIED':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Verificado
        </Badge>
      );
    case 'PENDING_REVIEW':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          En revisión
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Rechazado
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <AlertTriangle className="h-3 w-3 mr-1" />
          No enviado
        </Badge>
      );
  }
}

function SettingsContent() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const searchParams = useSearchParams();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  // All hooks must be called unconditionally, before any early returns
  const { data: userData, loading: userLoading, refetch: refetchUserData } = useQuery<MpStatusData>(GET_USER_DATA, {
    fetchPolicy: 'network-only',
  });

  const { register: registerProfile, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors, isSubmitting: isProfileSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre: user?.nombre || '',
      apellido: user?.apellido || '',
      phone: userData?.me?.phone || '',
    },
  });

  const { register: registerPass, handleSubmit: handlePassSubmit, reset: resetPass, formState: { errors: passErrors, isSubmitting: isPassSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const { register: registerKyc, handleSubmit: handleKycSubmit, setValue: setKycValue, watch: watchKyc, formState: { errors: kycErrors, isSubmitting: isKycSubmitting } } = useForm<KycForm>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      documentType: (userData?.me?.documentType as 'DNI' | 'PASSPORT' | 'CUIT_CUIL') || undefined,
      documentNumber: userData?.me?.documentNumber || '',
      street: userData?.me?.street || '',
      streetNumber: userData?.me?.streetNumber || '',
      apartment: userData?.me?.apartment || '',
      city: userData?.me?.city || '',
      province: userData?.me?.province || '',
      postalCode: userData?.me?.postalCode || '',
      phone: userData?.me?.phone || '',
      cuitCuil: userData?.me?.cuitCuil || '',
    },
  });

  const [updateProfile] = useMutation(UPDATE_PROFILE, {
    onCompleted: () => {
      toast.success('Perfil actualizado correctamente');
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al actualizar perfil');
    }
  });

  const [changePassword] = useMutation(CHANGE_PASSWORD, {
    onCompleted: () => {
      toast.success('Contraseña actualizada correctamente');
      resetPass();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al cambiar contraseña');
    }
  });

  const [updateKyc] = useMutation(UPDATE_KYC, {
    onCompleted: () => {
      toast.success('Datos de verificación enviados. Serán revisados pronto.');
      refetchUserData();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al enviar verificación');
    }
  });

  const [updateAvatar] = useMutation<UpdateAvatarData>(UPDATE_AVATAR, {
    onCompleted: (data) => {
      toast.success('Avatar actualizado');
      if (data?.updateAvatar?.avatarUrl) {
        updateUser({ avatarUrl: data.updateAvatar.avatarUrl });
      }
      refetchUserData();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al actualizar avatar');
    }
  });

  const [deleteAvatar] = useMutation<DeleteAvatarData>(DELETE_AVATAR, {
    onCompleted: () => {
      toast.success('Avatar eliminado');
      updateUser({ avatarUrl: undefined });
      refetchUserData();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar avatar');
    }
  });

  // Auth redirect effect
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  // Handle query params for MP connection result
  useEffect(() => {
    const mpConnected = searchParams.get('mp_connected');
    const mpError = searchParams.get('mp_error');

    if (mpConnected === 'true') {
      toast.success('Mercado Pago conectado exitosamente');
      refetchUserData();
      window.history.replaceState({}, '', '/dashboard/settings');
    } else if (mpError) {
      toast.error(`Error al conectar Mercado Pago: ${mpError}`);
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [searchParams, refetchUserData]);

  // Update KYC form when data loads
  useEffect(() => {
    if (userData?.me) {
      const me = userData.me;
      if (me.documentType) setKycValue('documentType', me.documentType as 'DNI' | 'PASSPORT' | 'CUIT_CUIL');
      if (me.documentNumber) setKycValue('documentNumber', me.documentNumber);
      if (me.street) setKycValue('street', me.street);
      if (me.streetNumber) setKycValue('streetNumber', me.streetNumber);
      if (me.apartment) setKycValue('apartment', me.apartment);
      if (me.city) setKycValue('city', me.city);
      if (me.province) setKycValue('province', me.province);
      if (me.postalCode) setKycValue('postalCode', me.postalCode);
      if (me.phone) setKycValue('phone', me.phone);
      if (me.cuitCuil) setKycValue('cuitCuil', me.cuitCuil);
    }
  }, [userData, setKycValue]);

  // Now the early return check (after all hooks are declared)
  if (!isAuthenticated) return null;

  const mpStatus = userData?.me?.mpConnectStatus || 'NOT_CONNECTED';
  const mpUserId = userData?.me?.mpUserId;
  const isConnected = mpStatus === 'CONNECTED';
  const kycStatus = userData?.me?.kycStatus || 'NOT_SUBMITTED';
  const isKycVerified = kycStatus === 'VERIFIED';
  const isKycPending = kycStatus === 'PENDING_REVIEW';

  const watchedDocType = watchKyc('documentType');
  const watchedProvince = watchKyc('province');

  const onProfileSubmit = (data: ProfileForm) => {
    updateProfile({ variables: { input: data } });
  };

  const onPassSubmit = (data: PasswordForm) => {
    changePassword({ variables: { input: data } });
  };

  const onKycSubmit = (data: KycForm) => {
    updateKyc({ variables: { input: data } });
  };

  const handleConnectMP = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    window.location.href = `${backendUrl}/mp/connect`;
  };

  const handleDisconnectMP = async () => {
    if (!confirm('¿Estás seguro de desconectar tu cuenta de Mercado Pago? No podrás recibir pagos hasta que la conectes de nuevo.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      const response = await fetch(`${backendUrl}/mp/connect/disconnect`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly auth cookie
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Mercado Pago desconectado');
        refetchUserData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al desconectar');
      }
    } catch {
      toast.error('Error al desconectar Mercado Pago');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }

    setAvatarUploading(true);
    try {
      // Get signature from backend
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const sigResponse = await fetch(`${backendUrl}/uploads/signature/avatar`, {
        credentials: 'include', // Send httpOnly auth cookie
      });
      const sigData = await sigResponse.json();

      if (sigData.mock) {
        // Mock mode - just use a placeholder
        const mockUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`;
        await updateAvatar({ variables: { input: { avatarUrl: mockUrl } } });
        return;
      }

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp.toString());
      formData.append('signature', sigData.signature);
      formData.append('folder', sigData.folder);
      if (sigData.transformation) {
        formData.append('transformation', sigData.transformation);
      }

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadResponse.json();

      if (uploadData.secure_url) {
        await updateAvatar({ variables: { input: { avatarUrl: uploadData.secure_url } } });
      } else {
        throw new Error('Upload failed');
      }
    } catch {
      toast.error('Error al subir imagen');
    } finally {
      setAvatarUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('¿Eliminar tu foto de perfil?')) return;
    setAvatarDeleting(true);
    try {
      await deleteAvatar();
    } finally {
      setAvatarDeleting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Configuración de Cuenta</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="kyc">
            <Shield className="h-4 w-4 mr-2" />
            Verificación
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualizá tu nombre y apellido. Estos datos son visibles cuando vendés rifas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6 pb-6 border-b">
                <div className="relative">
                  {user?.avatarUrl || userData?.me?.avatarUrl ? (
                    <Image
                      src={getOptimizedImageUrl(user?.avatarUrl || userData?.me?.avatarUrl || '', CLOUDINARY_PRESETS.avatar)}
                      alt="Avatar"
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-primary/20">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Foto de Perfil</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG o WebP. Máximo 5MB.
                  </p>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={avatarUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarUploading}
                        asChild
                      >
                        <span>
                          <Camera className="w-4 h-4 mr-2" />
                          Cambiar
                        </span>
                      </Button>
                    </label>
                    {(user?.avatarUrl || userData?.me?.avatarUrl) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteAvatar}
                        disabled={avatarDeleting}
                        className="text-destructive hover:text-destructive"
                      >
                        {avatarDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input id="nombre" {...registerProfile('nombre')} />
                    {profileErrors.nombre && (
                      <p className="text-xs text-destructive">{profileErrors.nombre.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido</Label>
                    <Input id="apellido" {...registerProfile('apellido')} />
                    {profileErrors.apellido && (
                      <p className="text-xs text-destructive">{profileErrors.apellido.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profilePhone">Teléfono</Label>
                  <Input id="profilePhone" placeholder="+54 11 1234-5678" {...registerProfile('phone')} />
                </div>

                <Button type="submit" disabled={isProfileSubmitting}>
                  {isProfileSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Verificación de Identidad (KYC)</CardTitle>
                  <CardDescription>
                    Cumplimiento con normativas legales argentinas para rifas y juegos de azar.
                  </CardDescription>
                </div>
                <KycStatusBadge status={kycStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Alert */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <FileCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">¿Por qué pedimos esta información?</p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                    <li>- Verificación de edad mínima (18 años) - Ley N° 18.226</li>
                    <li>- Prevención de lavado de activos - Ley 25.246 (UIF)</li>
                    <li>- Trazabilidad fiscal - Resolución ARCA 5791/2025</li>
                    <li>- Entrega de premios y cumplimiento legal</li>
                  </ul>
                </div>
              </div>

              {isKycVerified ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Identidad Verificada</h3>
                  <p className="text-muted-foreground">
                    Tu identidad ha sido verificada exitosamente. Podés participar en rifas y vender sin restricciones.
                  </p>
                </div>
              ) : isKycPending ? (
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Verificación en Proceso</h3>
                  <p className="text-muted-foreground">
                    Estamos revisando tu información. Este proceso puede tomar hasta 24-48 horas.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleKycSubmit(onKycSubmit)} className="space-y-6">
                  {/* Document Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Documento de Identidad</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Documento</Label>
                        <Select
                          value={watchedDocType}
                          onValueChange={(value) => setKycValue('documentType', value as 'DNI' | 'PASSPORT' | 'CUIT_CUIL')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DNI">DNI</SelectItem>
                            <SelectItem value="PASSPORT">Pasaporte</SelectItem>
                            <SelectItem value="CUIT_CUIL">CUIT/CUIL</SelectItem>
                          </SelectContent>
                        </Select>
                        {kycErrors.documentType && (
                          <p className="text-xs text-destructive">{kycErrors.documentType.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="documentNumber">Número de Documento</Label>
                        <Input id="documentNumber" placeholder="12345678" {...registerKyc('documentNumber')} />
                        {kycErrors.documentNumber && (
                          <p className="text-xs text-destructive">{kycErrors.documentNumber.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Domicilio</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="street">Calle</Label>
                        <Input id="street" placeholder="Av. Corrientes" {...registerKyc('street')} />
                        {kycErrors.street && (
                          <p className="text-xs text-destructive">{kycErrors.street.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="streetNumber">Número</Label>
                        <Input id="streetNumber" placeholder="1234" {...registerKyc('streetNumber')} />
                        {kycErrors.streetNumber && (
                          <p className="text-xs text-destructive">{kycErrors.streetNumber.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="apartment">Depto/Piso (opcional)</Label>
                        <Input id="apartment" placeholder="3B" {...registerKyc('apartment')} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input id="city" placeholder="Buenos Aires" {...registerKyc('city')} />
                        {kycErrors.city && (
                          <p className="text-xs text-destructive">{kycErrors.city.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Código Postal</Label>
                        <Input id="postalCode" placeholder="C1043" {...registerKyc('postalCode')} />
                        {kycErrors.postalCode && (
                          <p className="text-xs text-destructive">{kycErrors.postalCode.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Provincia</Label>
                      <Select
                        value={watchedProvince}
                        onValueChange={(value) => setKycValue('province', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar provincia..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVINCIAS_ARGENTINA.map((prov) => (
                            <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {kycErrors.province && (
                        <p className="text-xs text-destructive">{kycErrors.province.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact & Tax Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Contacto e Información Fiscal</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="kycPhone">Teléfono</Label>
                        <Input id="kycPhone" placeholder="+54 11 1234-5678" {...registerKyc('phone')} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cuitCuil">CUIT/CUIL (para vendedores)</Label>
                        <Input id="cuitCuil" placeholder="20-12345678-9" {...registerKyc('cuitCuil')} />
                        {kycErrors.cuitCuil && (
                          <p className="text-xs text-destructive">{kycErrors.cuitCuil.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Requerido para recibir pagos y facturación.</p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isKycSubmitting}>
                    {isKycSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enviar para Verificación
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Mercado Pago</CardTitle>
              <CardDescription>
                Conectá tu cuenta de Mercado Pago para recibir pagos cuando vendas rifas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isConnected ? 'Cuenta conectada' : 'No conectado'}
                    </p>
                    {isConnected && mpUserId && (
                      <p className="text-sm text-muted-foreground">
                        ID: {mpUserId}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              {/* Action Buttons */}
              {isConnected ? (
                <Button
                  variant="outline"
                  onClick={handleDisconnectMP}
                  disabled={isDisconnecting}
                  className="w-full"
                >
                  {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Desconectar Mercado Pago
                </Button>
              ) : (
                <Button
                  onClick={handleConnectMP}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar Mercado Pago
                </Button>
              )}

              {/* Info */}
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Importante:</strong> Necesitás conectar tu cuenta de Mercado Pago para:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Crear rifas y recibir pagos</li>
                  <li>Los pagos se retienen hasta que el ganador confirme la entrega</li>
                  <li>Podrás ver tus ventas en tu cuenta de Mercado Pago</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Cambiar Contraseña</CardTitle>
              <CardDescription>
                Asegurate de usar una contraseña segura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePassSubmit(onPassSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Contraseña Actual</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    {...registerPass('oldPassword')}
                  />
                  {passErrors.oldPassword && (
                    <p className="text-xs text-destructive">{passErrors.oldPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...registerPass('newPassword')}
                  />
                  {passErrors.newPassword && (
                    <p className="text-xs text-destructive">{passErrors.newPassword.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={isPassSubmitting}>
                  {isPassSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Actualizar Contraseña
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
