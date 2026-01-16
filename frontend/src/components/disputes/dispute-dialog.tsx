import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';

const OPEN_DISPUTE = gql`
  mutation OpenDispute($input: OpenDisputeInput!) {
    openDispute(input: $input) {
      id
      estado
      raffle {
        id
        deliveryStatus
      }
    }
  }
`;

interface DisputeDialogProps {
  raffleId: string;
  raffleTitle: string;
  onDisputeOpened?: () => void;
  trigger?: React.ReactNode;
}

export function DisputeDialog({ raffleId, raffleTitle, onDisputeOpened, trigger }: DisputeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tipo, setTipo] = useState<string>('PRODUCTO_NO_RECIBIDO');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const [openDispute, { loading }] = useMutation(OPEN_DISPUTE, {
    onCompleted: () => {
      toast.success('Disputa abierta correctamente. Un administrador revisará el caso.');
      setIsOpen(false);
      if (onDisputeOpened) onDisputeOpened();
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    openDispute({
      variables: {
        input: {
          raffleId,
          tipo,
          titulo,
          descripcion,
          evidencias: [], // TODO: Cloudinary Upload
        }
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Reportar Problema
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reportar Problema</DialogTitle>
          <DialogDescription>
            Inicia una disputa para la rifa "{raffleTitle}". El pago se retendrá hasta que se resuelva el caso.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Problema</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná el motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCTO_NO_RECIBIDO">No recibí el producto</SelectItem>
                <SelectItem value="PRODUCTO_HACIA_FALTA">Producto incompleto o dañado</SelectItem>
                <SelectItem value="PRODUCTO_Malo">Producto no coincide con la descripción</SelectItem>
                <SelectItem value="OTRO">Otro problema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título del Reclamo</Label>
            <Input 
              id="titulo" 
              placeholder="Ej: El producto llegó roto" 
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              minLength={10}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción Detallada</Label>
            <Textarea 
              id="descripcion" 
              placeholder="Explica detalladamente qué sucedió..." 
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="min-h-[100px]"
              minLength={50}
              required
            />
            <p className="text-xs text-muted-foreground text-right">Mínimo 50 caracteres</p>
          </div>

          {/* TODO: Evidence Upload */}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} type="button">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="destructive">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Abrir Disputa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
