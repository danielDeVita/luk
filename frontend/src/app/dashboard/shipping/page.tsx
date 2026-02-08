'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2, Plus, Trash2, Star, Edit2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { GET_MY_SHIPPING_ADDRESSES } from '@/lib/graphql/queries';
import {
  CREATE_SHIPPING_ADDRESS,
  UPDATE_SHIPPING_ADDRESS,
  DELETE_SHIPPING_ADDRESS,
  SET_DEFAULT_SHIPPING_ADDRESS,
} from '@/lib/graphql/mutations';

interface ShippingAddress {
  id: string;
  label: string;
  recipientName: string;
  street: string;
  number: string;
  apartment?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string;
  instructions?: string;
  isDefault: boolean;
}

interface AddressFormData {
  label: string;
  recipientName: string;
  street: string;
  number: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string;
  instructions: string;
}

const initialFormData: AddressFormData = {
  label: '',
  recipientName: '',
  street: '',
  number: '',
  apartment: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Argentina',
  phone: '',
  instructions: '',
};

const PROVINCIAS_ARGENTINA = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Cordoba', 'Corrientes',
  'Entre Rios', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquen', 'Rio Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucuman'
];

export default function ShippingAddressesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(initialFormData);
  const confirm = useConfirmDialog();

  const { data, loading, refetch } = useQuery<{ myShippingAddresses: ShippingAddress[] }>(
    GET_MY_SHIPPING_ADDRESSES,
    { skip: !isAuthenticated }
  );

  const [createAddress, { loading: creating }] = useMutation(CREATE_SHIPPING_ADDRESS, {
    onCompleted: () => {
      toast.success('Dirección creada');
      setIsDialogOpen(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [updateAddress, { loading: updating }] = useMutation(UPDATE_SHIPPING_ADDRESS, {
    onCompleted: () => {
      toast.success('Dirección actualizada');
      setIsDialogOpen(false);
      setEditingAddress(null);
      setFormData(initialFormData);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [deleteAddress, { loading: deleting }] = useMutation(DELETE_SHIPPING_ADDRESS, {
    onCompleted: () => {
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });


  const [setDefault, { loading: settingDefault }] = useMutation(SET_DEFAULT_SHIPPING_ADDRESS, {
    onCompleted: () => {
      toast.success('Dirección predeterminada actualizada');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) return null;

  const addresses = data?.myShippingAddresses || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      label: formData.label,
      recipientName: formData.recipientName,
      street: formData.street,
      number: formData.number,
      apartment: formData.apartment || undefined,
      city: formData.city,
      province: formData.province,
      postalCode: formData.postalCode,
      country: formData.country,
      phone: formData.phone,
      instructions: formData.instructions || undefined,
    };

    if (editingAddress) {
      updateAddress({ variables: { id: editingAddress.id, input } });
    } else {
      createAddress({ variables: { input } });
    }
  };

  const handleEdit = (address: ShippingAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      recipientName: address.recipientName,
      street: address.street,
      number: address.number,
      apartment: address.apartment || '',
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
      instructions: address.instructions || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '¿Eliminar dirección?',
      description: 'Esta acción no se puede deshacer. La dirección será eliminada permanentemente.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (confirmed) {
      deleteAddress({ variables: { id } });
    }
  };

  const handleNewAddress = () => {
    setEditingAddress(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const isSaving = creating || updating;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Direcciones de Envío</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewAddress}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Dirección
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="label">Etiqueta (ej: Casa, Trabajo)</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="recipientName">Nombre del destinatario</Label>
                  <Input
                    id="recipientName"
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <Label htmlFor="street">Calle</Label>
                  <Input
                    id="street"
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="apartment">Depto/Piso (opcional)</Label>
                  <Input
                    id="apartment"
                    value={formData.apartment}
                    onChange={(e) => setFormData({ ...formData, apartment: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="province">Provincia</Label>
                  <Select
                    value={formData.province}
                    onValueChange={(value) => setFormData({ ...formData, province: value })}
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
                </div>
                <div>
                  <Label htmlFor="postalCode">Código Postal</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="instructions">Instrucciones de entrega (opcional)</Label>
                  <Input
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Ej: Tocar timbre 2B, dejar con portero..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAddress ? 'Guardar Cambios' : 'Crear Dirección'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-20">
          <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No tenés direcciones guardadas</h2>
          <p className="text-muted-foreground mb-4">
            Agregá una dirección para recibir tus premios
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className={address.isDefault ? 'border-primary border-2' : ''}
            >
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {address.label}
                    {address.isDefault && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Predeterminada
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{address.recipientName}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(address)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(address.id)}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p>
                    {address.street} {address.number}
                    {address.apartment && `, ${address.apartment}`}
                  </p>
                  <p>
                    {address.city}, {address.province}
                  </p>
                  <p>
                    {address.postalCode}, {address.country}
                  </p>
                  <p className="text-muted-foreground">{address.phone}</p>
                  {address.instructions && (
                    <p className="text-muted-foreground italic">{address.instructions}</p>
                  )}
                </div>
                {!address.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setDefault({ variables: { id: address.id } })}
                    disabled={settingDefault}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Hacer predeterminada
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
