'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ImageUpload';
import { Loader2, AlertCircle } from 'lucide-react';
import { handleError, showSuccess } from '@/lib/error-handler';
import { toast } from 'sonner';

const GET_KYC_STATUS = gql`
  query GetKycStatus {
    me {
      id
      kycStatus
    }
  }
`;

const CREATE_RAFFLE = gql`
  mutation CreateRaffle($input: CreateRaffleInput!) {
    createRaffle(input: $input) {
      id
      titulo
    }
  }
`;

const createRaffleSchema = z.object({
  titulo: z.string().min(10, 'Mínimo 10 caracteres').max(100, 'Máximo 100 caracteres'),
  descripcion: z.string().min(50, 'Mínimo 50 caracteres').max(5000, 'Máximo 5000 caracteres'),
  totalTickets: z.number().min(10, 'Mínimo 10 tickets').max(10000, 'Máximo 10,000 tickets'),
  precioPorTicket: z.number().min(1, 'Mínimo $1').max(1000000, 'Máximo $1,000,000'),
  fechaLimite: z.string().min(1, 'Fecha requerida'),
  // Product
  nombreProducto: z.string().min(3, 'Mínimo 3 caracteres').max(100),
  descripcionProducto: z.string().min(20, 'Mínimo 20 caracteres').max(2000),
  categoria: z.string().min(1, 'Categoría requerida'),
  condicion: z.enum(['NUEVO', 'USADO_COMO_NUEVO', 'USADO_BUEN_ESTADO', 'USADO_ACEPTABLE']),
});

type CreateRaffleForm = z.infer<typeof createRaffleSchema>;

const CATEGORIES = [
  'Electrónica',
  'Moda',
  'Hogar',
  'Deportes',
  'Arte',
  'Vehículos',
  'Experiencias',
  'Otro',
];

interface KycStatusData {
  me: {
    id: string;
    kycStatus: string;
  };
}

interface CreateRaffleResult {
  createRaffle: {
    id: string;
    titulo: string;
  };
}

export default function CreateRafflePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [images, setImages] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: kycData } = useQuery<KycStatusData>(GET_KYC_STATUS, {
    skip: !isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    } else if (kycData?.me?.kycStatus !== 'VERIFIED') {
      toast.error('Debes verificar tu identidad antes de crear rifas');
      router.push('/dashboard/settings?tab=kyc');
    }
  }, [isAuthenticated, kycData, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateRaffleForm>({
    resolver: zodResolver(createRaffleSchema),
    defaultValues: {
      totalTickets: 100,
      precioPorTicket: 10,
      condicion: 'NUEVO',
    },
  });

  const [createRaffle, { data, loading, error }] = useMutation<CreateRaffleResult>(CREATE_RAFFLE);

  // Handle success
  useEffect(() => {
    if (data?.createRaffle) {
      showSuccess('Rifa creada exitosamente');
      router.push(`/raffle/${data.createRaffle.id}`);
    }
  }, [data, router]);

  // Handle error
  useEffect(() => {
    if (error) {
      handleError(error);
      // Also show inline error for visibility
      const gqlError = error as { graphQLErrors?: Array<{ message: string; extensions?: { originalError?: { message?: string | string[] } } }> };
      const graphQLError = gqlError.graphQLErrors?.[0];
      const response = graphQLError?.extensions?.originalError;
      const message = response?.message;

      let displayMsg = error.message;
      if (Array.isArray(message)) {
        displayMsg = message.join(', ');
      } else if (typeof message === 'string') {
        displayMsg = message;
      }

      // Error sync from Apollo requires setState in effect
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorMsg(displayMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  const onSubmit = (formData: CreateRaffleForm) => {
    setErrorMsg(null);

    if (images.length === 0) {
      setErrorMsg('Debes agregar al menos 1 imagen del producto');
      return;
    }
    
    createRaffle({
      variables: {
        input: {
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          totalTickets: formData.totalTickets,
          precioPorTicket: formData.precioPorTicket,
          fechaLimite: new Date(formData.fechaLimite).toISOString(),
          productData: {
            nombre: formData.nombreProducto,
            descripcionDetallada: formData.descripcionProducto,
            categoria: formData.categoria,
            condicion: formData.condicion,
            imagenes: images,
          },
        },
      },
    });
  };



  if (!isAuthenticated) return null;

  const onError = () => {
    handleError('Por favor corrige los errores en el formulario');
    setErrorMsg('Por favor corrige los errores en el formulario');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Crear Nueva Rifa</h1>

      {errorMsg && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-8">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
            <CardDescription>Detalles principales de tu rifa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título de la Rifa</Label>
              <Input
                id="titulo"
                placeholder="Ej: iPhone 15 Pro Max 256GB"
                {...register('titulo')}
              />
              {errors.titulo && (
                <p className="text-sm text-destructive">{errors.titulo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <textarea
                id="descripcion"
                className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Describe tu rifa, las reglas y condiciones..."
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="text-sm text-destructive">{errors.descripcion.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalTickets">Total de Tickets</Label>
                <Input
                  id="totalTickets"
                  type="number"
                  {...register('totalTickets', { valueAsNumber: true })}
                />
                {errors.totalTickets && (
                  <p className="text-sm text-destructive">{errors.totalTickets.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="precioPorTicket">Precio por Ticket ($)</Label>
                <Input
                  id="precioPorTicket"
                  type="number"
                  step="0.01"
                  {...register('precioPorTicket', { valueAsNumber: true })}
                />
                {errors.precioPorTicket && (
                  <p className="text-sm text-destructive">{errors.precioPorTicket.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaLimite">Fecha Límite del Sorteo</Label>
              <Input
                id="fechaLimite"
                type="datetime-local"
                {...register('fechaLimite')}
              />
              {errors.fechaLimite && (
                <p className="text-sm text-destructive">{errors.fechaLimite.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card>
          <CardHeader>
            <CardTitle>Producto</CardTitle>
            <CardDescription>Información del premio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreProducto">Nombre del Producto</Label>
              <Input
                id="nombreProducto"
                placeholder="Ej: iPhone 15 Pro Max"
                {...register('nombreProducto')}
              />
              {errors.nombreProducto && (
                <p className="text-sm text-destructive">{errors.nombreProducto.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcionProducto">Descripción del Producto</Label>
              <textarea
                id="descripcionProducto"
                className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Especificaciones, características..."
                {...register('descripcionProducto')}
              />
              {errors.descripcionProducto && (
                <p className="text-sm text-destructive">{errors.descripcionProducto.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoría</Label>
                <select
                  id="categoria"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  {...register('categoria')}
                >
                  <option value="">Seleccionar...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {errors.categoria && (
                  <p className="text-sm text-destructive">{errors.categoria.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="condicion">Condición</Label>
                <select
                  id="condicion"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  {...register('condicion')}
                >
                  <option value="NUEVO">Nuevo</option>
                  <option value="USADO_COMO_NUEVO">Usado Como Nuevo</option>
                  <option value="USADO_BUEN_ESTADO">Usado - Buen Estado</option>
                  <option value="USADO_ACEPTABLE">Usado - Aceptable</option>
                </select>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Imágenes del Producto</Label>
              <ImageUpload
                images={images}
                onImagesChange={setImages}
                maxImages={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            'Crear Rifa'
          )}
        </Button>
      </form>
    </div>
  );
}
