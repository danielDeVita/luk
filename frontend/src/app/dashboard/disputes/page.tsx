'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ImageUpload';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';

const MY_DISPUTES = gql`
  query MyDisputes {
    myDisputes {
      id
      titulo
      descripcion
      tipo
      estado
      evidencias
      respuestaVendedor
      evidenciasVendedor
      adminNotes
      resolucion
      montoReembolsado
      montoPagadoVendedor
      fechaRespuestaVendedor
      resolvedAt
      createdAt
      reporter {
        id
        email
        nombre
      }
      raffle {
        id
        titulo
        deliveryStatus
        sellerId
        product {
          imagenes
        }
      }
    }
  }
`;

const RESPOND_DISPUTE = gql`
  mutation RespondDispute($disputeId: String!, $input: RespondDisputeInput!) {
    respondDispute(disputeId: $disputeId, input: $input) {
      id
      estado
      respuestaVendedor
      evidenciasVendedor
      fechaRespuestaVendedor
    }
  }
`;

interface Dispute {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  estado: string;
  evidencias: string[];
  respuestaVendedor?: string;
  evidenciasVendedor?: string[];
  adminNotes?: string;
  resolucion?: string;
  montoReembolsado?: number;
  montoPagadoVendedor?: number;
  fechaRespuestaVendedor?: string;
  resolvedAt?: string;
  createdAt: string;
  reporter: {
    id: string;
    email: string;
    nombre: string;
  };
  raffle: {
    id: string;
    titulo: string;
    deliveryStatus: string;
    sellerId: string;
    product?: { imagenes?: string[] };
  };
}

type StatusFilter = 'ALL' | 'ABIERTA' | 'ESPERANDO_RESPUESTA_VENDEDOR' | 'EN_MEDIACION' | 'RESUELTA_COMPRADOR' | 'RESUELTA_VENDEDOR' | 'RESUELTA_PARCIAL';

const STATUS_LABELS: Record<string, string> = {
  ABIERTA: 'Abierta',
  ESPERANDO_RESPUESTA_VENDEDOR: 'Esperando Respuesta',
  EN_MEDIACION: 'En Mediación',
  RESUELTA_COMPRADOR: 'Resuelta (Comprador)',
  RESUELTA_VENDEDOR: 'Resuelta (Vendedor)',
  RESUELTA_PARCIAL: 'Resuelta (Parcial)',
};

const TYPE_LABELS: Record<string, string> = {
  NO_LLEGO: 'No recibido',
  DANADO: 'Dañado',
  DIFERENTE: 'Diferente',
  VENDEDOR_NO_RESPONDE: 'Sin respuesta',
  OTRO: 'Otro',
};

function getStatusVariant(estado: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (estado) {
    case 'ABIERTA':
    case 'ESPERANDO_RESPUESTA_VENDEDOR':
      return 'destructive';
    case 'EN_MEDIACION':
      return 'default';
    case 'RESUELTA_COMPRADOR':
    case 'RESUELTA_VENDEDOR':
    case 'RESUELTA_PARCIAL':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getStatusIcon(estado: string) {
  switch (estado) {
    case 'ABIERTA':
      return <AlertTriangle className="h-4 w-4" />;
    case 'ESPERANDO_RESPUESTA_VENDEDOR':
      return <Clock className="h-4 w-4" />;
    case 'EN_MEDIACION':
      return <MessageSquare className="h-4 w-4" />;
    case 'RESUELTA_COMPRADOR':
      return <CheckCircle className="h-4 w-4" />;
    case 'RESUELTA_VENDEDOR':
      return <CheckCircle className="h-4 w-4" />;
    case 'RESUELTA_PARCIAL':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return null;
  }
}

export default function MyDisputesPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, user } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Respond dialog state
  const [respondingDispute, setRespondingDispute] = useState<Dispute | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [evidenciasRespuesta, setEvidenciasRespuesta] = useState<string[]>([]);

  const { data, loading, refetch } = useQuery<{ myDisputes: Dispute[] }>(MY_DISPUTES, {
    skip: !hasHydrated || !isAuthenticated,
  });

  const [respondDispute, { loading: responding }] = useMutation(RESPOND_DISPUTE, {
    onCompleted: () => {
      toast.success('Respuesta enviada correctamente');
      setRespondingDispute(null);
      setRespuesta('');
      setEvidenciasRespuesta([]);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  const disputes = useMemo(() => data?.myDisputes || [], [data?.myDisputes]);

  const filteredDisputes = useMemo(() => {
    if (statusFilter === 'ALL') return disputes;
    return disputes.filter((d) => d.estado === statusFilter);
  }, [disputes, statusFilter]);

  if (!hasHydrated || !isAuthenticated) return null;

  const handleRespond = () => {
    if (!respondingDispute || respuesta.length < 20) return;
    respondDispute({
      variables: {
        disputeId: respondingDispute.id,
        input: {
          respuesta,
          evidencias: evidenciasRespuesta.length > 0 ? evidenciasRespuesta : undefined,
        },
      },
    });
  };

  const getUserRole = (dispute: Dispute): 'buyer' | 'seller' => {
    return dispute.reporter.id === user?.id ? 'buyer' : 'seller';
  };

  const canRespond = (dispute: Dispute): boolean => {
    const role = getUserRole(dispute);
    return (
      role === 'seller' &&
      (dispute.estado === 'ABIERTA' || dispute.estado === 'ESPERANDO_RESPUESTA_VENDEDOR') &&
      !dispute.respuestaVendedor
    );
  };

  const activeCount = disputes.filter(
    (d) => !d.estado.startsWith('RESUELTA'),
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            Mis Reclamos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {disputes.length} reclamo{disputes.length !== 1 ? 's' : ''} total{disputes.length !== 1 ? 'es' : ''}
            {activeCount > 0 && ` — ${activeCount} activo${activeCount !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="ABIERTA">Abierta</option>
            <option value="ESPERANDO_RESPUESTA_VENDEDOR">Esperando Respuesta</option>
            <option value="EN_MEDIACION">En Mediación</option>
            <option value="RESUELTA_COMPRADOR">Resuelta (Comprador)</option>
            <option value="RESUELTA_VENDEDOR">Resuelta (Vendedor)</option>
            <option value="RESUELTA_PARCIAL">Resuelta (Parcial)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
          <h2 className="text-xl font-semibold mb-2">Sin reclamos</h2>
          <p className="text-muted-foreground mb-4">No tenés ningún reclamo abierto ni resuelto</p>
          <Link href="/dashboard/tickets">
            <Button variant="outline">Ir a Mis Tickets</Button>
          </Link>
        </div>
      ) : filteredDisputes.length === 0 ? (
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Sin resultados</h2>
          <p className="text-muted-foreground mb-4">No hay reclamos con el filtro seleccionado</p>
          <Button variant="outline" onClick={() => setStatusFilter('ALL')}>
            Ver todos
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((dispute) => {
            const role = getUserRole(dispute);
            const isExpanded = expandedId === dispute.id;

            return (
              <Card
                key={dispute.id}
                className={`border-l-4 ${
                  dispute.estado.startsWith('RESUELTA')
                    ? 'border-l-green-500'
                    : dispute.estado === 'EN_MEDIACION'
                    ? 'border-l-blue-500'
                    : 'border-l-yellow-500'
                }`}
              >
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{dispute.titulo}</CardTitle>
                        <Badge variant={role === 'buyer' ? 'default' : 'secondary'}>
                          {role === 'buyer' ? 'Comprador' : 'Vendedor'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Rifa: {dispute.raffle.titulo}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline">{TYPE_LABELS[dispute.tipo] || dispute.tipo}</Badge>
                      <Badge variant={getStatusVariant(dispute.estado)} className="flex items-center gap-1">
                        {getStatusIcon(dispute.estado)}
                        {STATUS_LABELS[dispute.estado] || dispute.estado}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    {/* Description */}
                    <div>
                      <h4 className="text-sm font-medium mb-1">Descripción del reclamo</h4>
                      <div className="bg-muted p-4 rounded-md text-sm">
                        {dispute.descripcion}
                      </div>
                    </div>

                    {/* Buyer evidence */}
                    {dispute.evidencias && dispute.evidencias.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <ImageIcon className="h-4 w-4" />
                          Evidencia del comprador ({dispute.evidencias.length})
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {dispute.evidencias.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <div className="aspect-square rounded-md overflow-hidden bg-muted border hover:border-primary transition-colors">
                                <Image src={url} alt={`Evidencia ${i + 1}`} width={120} height={120} className="object-cover w-full h-full" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seller response */}
                    {dispute.respuestaVendedor && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Respuesta del vendedor</h4>
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-md text-sm">
                          {dispute.respuestaVendedor}
                        </div>
                        {dispute.fechaRespuestaVendedor && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Respondido el {new Date(dispute.fechaRespuestaVendedor).toLocaleDateString('es-AR')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Seller evidence */}
                    {dispute.evidenciasVendedor && dispute.evidenciasVendedor.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <ImageIcon className="h-4 w-4" />
                          Evidencia del vendedor ({dispute.evidenciasVendedor.length})
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {dispute.evidenciasVendedor.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <div className="aspect-square rounded-md overflow-hidden bg-muted border hover:border-primary transition-colors">
                                <Image src={url} alt={`Evidencia vendedor ${i + 1}`} width={120} height={120} className="object-cover w-full h-full" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution */}
                    {dispute.resolucion && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Resolución</h4>
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-md text-sm">
                          {dispute.resolucion}
                        </div>
                        {(dispute.montoReembolsado !== undefined && dispute.montoReembolsado !== null) && (
                          <p className="text-sm mt-1">
                            Monto reembolsado: <strong>${dispute.montoReembolsado.toFixed(2)}</strong>
                          </p>
                        )}
                        {dispute.resolvedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Resuelto el {new Date(dispute.resolvedAt).toLocaleDateString('es-AR')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Historial</h4>
                      <div className="space-y-3 ml-2">
                        <TimelineItem
                          label="Reclamo abierto"
                          date={dispute.createdAt}
                          active
                        />
                        {dispute.fechaRespuestaVendedor && (
                          <TimelineItem
                            label="Vendedor respondió"
                            date={dispute.fechaRespuestaVendedor}
                            active
                          />
                        )}
                        {dispute.estado === 'EN_MEDIACION' && (
                          <TimelineItem
                            label="En mediación (admin revisando)"
                            active
                          />
                        )}
                        {dispute.resolvedAt && (
                          <TimelineItem
                            label={`Resuelto: ${STATUS_LABELS[dispute.estado] || dispute.estado}`}
                            date={dispute.resolvedAt}
                            active
                          />
                        )}
                        {!dispute.resolvedAt && !dispute.estado.startsWith('RESUELTA') && (
                          <TimelineItem
                            label="Pendiente de resolución"
                          />
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2 border-t">
                      <Link href={`/raffle/${dispute.raffle.id}`}>
                        <Button variant="outline" size="sm">Ver Rifa</Button>
                      </Link>
                      {canRespond(dispute) && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRespondingDispute(dispute);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Responder
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Respond Dialog */}
      <Dialog open={!!respondingDispute} onOpenChange={(open) => !open && setRespondingDispute(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Responder Reclamo</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 rounded border text-sm bg-muted">
              <strong>Reclamo:</strong> {respondingDispute?.titulo}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tu respuesta</label>
              <Textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Explica tu versión de los hechos con el mayor detalle posible..."
                className="min-h-[120px]"
                minLength={20}
              />
              <p className="text-xs text-muted-foreground text-right">
                {respuesta.length}/20 caracteres mínimo
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Evidencia (opcional)</label>
              <ImageUpload
                images={evidenciasRespuesta}
                onImagesChange={setEvidenciasRespuesta}
                maxImages={10}
              />
              <p className="text-xs text-muted-foreground">
                Subí fotos del comprobante de envío, producto embalado, o cualquier evidencia relevante
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRespondingDispute(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRespond} disabled={responding || respuesta.length < 20}>
              {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Respuesta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  active,
}: {
  label: string;
  date?: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
      <div>
        <p className={`text-sm ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </p>
        {date && (
          <p className="text-xs text-muted-foreground">
            {new Date(date).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
