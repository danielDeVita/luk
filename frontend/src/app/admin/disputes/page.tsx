'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ListChecks,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const GET_PENDING_DISPUTES = gql`
  query GetPendingDisputes {
    pendingDisputes {
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
        email
        nombre
      }
      raffle {
        id
        titulo
        deliveryStatus
        precioPorTicket
        ticketsVendidos
        seller {
          email
          nombre
        }
        winner {
          email
          nombre
        }
        product {
          imagenes
        }
      }
    }
  }
`;

const RESOLVE_DISPUTE = gql`
  mutation ResolveDispute($disputeId: String!, $input: ResolveDisputeInput!) {
    resolveDispute(disputeId: $disputeId, input: $input) {
      id
      estado
      resolucion
    }
  }
`;

const BULK_RESOLVE_DISPUTES = gql`
  mutation BulkResolveDisputes($disputeIds: [String!]!, $decision: String!, $resolucion: String!, $adminNotes: String) {
    bulkResolveDisputes(disputeIds: $disputeIds, decision: $decision, resolucion: $resolucion, adminNotes: $adminNotes) {
      successCount
      failedCount
      failedIds
      errors
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
  reporter: { email: string; nombre: string };
  raffle: {
    id: string;
    titulo: string;
    deliveryStatus: string;
    precioPorTicket?: number;
    ticketsVendidos?: number;
    seller: { email: string; nombre: string };
    winner?: { email: string; nombre: string };
    product?: { imagenes?: string[] };
  };
}

interface PendingDisputesResult {
  pendingDisputes: Dispute[];
}

interface BulkResolveResult {
  bulkResolveDisputes: {
    successCount: number;
    failedCount: number;
    failedIds: string[];
    errors: string[];
  };
}

const STATUS_LABELS: Record<string, string> = {
  ABIERTA: 'Abierta',
  ESPERANDO_RESPUESTA_VENDEDOR: 'Esperando Respuesta',
  EN_MEDIACION: 'En Mediación',
};

const TYPE_LABELS: Record<string, string> = {
  NO_LLEGO: 'No recibido',
  DANADO: 'Dañado',
  DIFERENTE: 'Diferente',
  VENDEDOR_NO_RESPONDE: 'Sin respuesta',
  OTRO: 'Otro',
};

type StatusFilter = 'ALL' | 'ABIERTA' | 'ESPERANDO_RESPUESTA_VENDEDOR' | 'EN_MEDIACION';
type TypeFilter = 'ALL' | 'NO_LLEGO' | 'DANADO' | 'DIFERENTE' | 'VENDEDOR_NO_RESPONDE' | 'OTRO';
type DecisionType = 'RESUELTA_COMPRADOR' | 'RESUELTA_VENDEDOR' | 'RESUELTA_PARCIAL';

const DECISION_LABELS: Record<DecisionType, string> = {
  RESUELTA_COMPRADOR: 'A favor del Comprador (Reembolso)',
  RESUELTA_VENDEDOR: 'A favor del Vendedor (Liberar Pago)',
  RESUELTA_PARCIAL: 'Resolución Parcial',
};

export default function AdminDisputesPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  // Single resolve state
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [decision, setDecision] = useState<DecisionType>('RESUELTA_COMPRADOR');
  const [montoReembolsado, setMontoReembolsado] = useState('');
  const [montoPagadoVendedor, setMontoPagadoVendedor] = useState('');

  // Expanded cards
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'REFUND' | 'RELEASE' | null>(null);
  const [bulkResolution, setBulkResolution] = useState('');

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      toast.error('Acceso denegado. Se requieren permisos de administrador.');
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router, hasHydrated]);

  const isAuthorized = hasHydrated && isAuthenticated && user?.role === 'ADMIN';

  const { data, loading, refetch, error } = useQuery<PendingDisputesResult>(GET_PENDING_DISPUTES, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
  });

  const [resolveDispute, { loading: resolving }] = useMutation(RESOLVE_DISPUTE, {
    onCompleted: () => {
      toast.success('Disputa resuelta correctamente');
      setSelectedDispute(null);
      setResolutionText('');
      setAdminNotes('');
      setDecision('RESUELTA_COMPRADOR');
      setMontoReembolsado('');
      setMontoPagadoVendedor('');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [bulkResolveDisputes, { loading: bulkResolving }] = useMutation<BulkResolveResult>(BULK_RESOLVE_DISPUTES, {
    onCompleted: (data) => {
      const result = data.bulkResolveDisputes;
      if (result.failedCount === 0) {
        toast.success(`${result.successCount} disputas resueltas correctamente`);
      } else {
        toast.warning(`${result.successCount} resueltas, ${result.failedCount} fallaron`);
        result.errors.forEach(err => console.error(err));
      }
      setBulkDialogOpen(false);
      setBulkResolution('');
      setBulkAction(null);
      setSelectedIds(new Set());
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const disputes = useMemo(() => data?.pendingDisputes || [], [data?.pendingDisputes]);

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      if (statusFilter !== 'ALL' && d.estado !== statusFilter) return false;
      if (typeFilter !== 'ALL' && d.tipo !== typeFilter) return false;
      return true;
    });
  }, [disputes, statusFilter, typeFilter]);

  if (!hasHydrated || !isAuthorized) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive">
        Error al cargar disputas: {error.message}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto" />
      </div>
    );
  }

  const blockNonNumericKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
  };

  const handleMoneyChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setter(val);
  };

  const handleResolve = () => {
    if (!selectedDispute || resolutionText.length < 20) return;

    const input: Record<string, unknown> = {
      decision,
      resolucion: resolutionText,
      adminNotes: adminNotes || undefined,
    };

    if (decision === 'RESUELTA_PARCIAL') {
      if (montoReembolsado) input.montoReembolsado = parseFloat(montoReembolsado);
      if (montoPagadoVendedor) input.montoPagadoVendedor = parseFloat(montoPagadoVendedor);
    }

    resolveDispute({
      variables: {
        disputeId: selectedDispute.id,
        input,
      },
    });
  };

  const handleBulkResolve = () => {
    if (selectedIds.size === 0 || !bulkAction) return;

    const bulkDecision = bulkAction === 'REFUND' ? 'RESUELTA_COMPRADOR' : 'RESUELTA_VENDEDOR';

    bulkResolveDisputes({
      variables: {
        disputeIds: Array.from(selectedIds),
        decision: bulkDecision,
        resolucion: bulkResolution,
        adminNotes: `Bulk resolved via Admin Panel as ${bulkAction}`,
      },
    });
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDisputes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDisputes.map(d => d.id)));
    }
  };

  const openBulkDialog = (actionType: 'REFUND' | 'RELEASE') => {
    setBulkAction(actionType);
    setBulkDialogOpen(true);
  };

  const openResolveDialog = (dispute: Dispute, preset: DecisionType) => {
    setSelectedDispute(dispute);
    setDecision(preset);
    setResolutionText('');
    setAdminNotes('');
    setMontoReembolsado('');
    setMontoPagadoVendedor('');
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          Disputas Pendientes ({filteredDisputes.length})
        </h1>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedIds.size} seleccionadas</Badge>
            <Button variant="outline" size="sm" onClick={() => openBulkDialog('REFUND')}>
              <XCircle className="w-4 h-4 mr-2" />
              Reembolsar Todos
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openBulkDialog('RELEASE')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Liberar Todos
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted rounded-lg">
        <div className="space-y-1">
          <label className="text-sm font-medium">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="ABIERTA">Abierta</option>
            <option value="ESPERANDO_RESPUESTA_VENDEDOR">Esperando Respuesta</option>
            <option value="EN_MEDIACION">En Mediación</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="ALL">Todos</option>
            <option value="NO_LLEGO">No recibido</option>
            <option value="DANADO">Dañado</option>
            <option value="DIFERENTE">Diferente</option>
            <option value="VENDEDOR_NO_RESPONDE">Sin respuesta</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        {(statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('ALL');
              setTypeFilter('ALL');
            }}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Select All */}
      {filteredDisputes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
          <Checkbox
            checked={selectedIds.size === filteredDisputes.length && filteredDisputes.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Seleccionar todas ({filteredDisputes.length})
          </span>
          <ListChecks className="h-4 w-4 text-muted-foreground ml-auto" />
        </div>
      )}

      <div className="space-y-4">
        {filteredDisputes.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground">No hay disputas pendientes de revision.</p>
          </div>
        )}

        {filteredDisputes.map((dispute) => {
          const isExpanded = expandedId === dispute.id;

          return (
            <Card
              key={dispute.id}
              className={`border-l-4 ${
                dispute.estado === 'EN_MEDIACION'
                  ? 'border-l-blue-500'
                  : dispute.estado === 'ESPERANDO_RESPUESTA_VENDEDOR'
                  ? 'border-l-orange-500'
                  : 'border-l-yellow-500'
              } ${selectedIds.has(dispute.id) ? 'ring-2 ring-primary' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedIds.has(dispute.id)}
                    onCheckedChange={() => toggleSelect(dispute.id)}
                    className="mt-1"
                  />
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{dispute.titulo}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Rifa: {dispute.raffle.titulo} - Reportado por: {dispute.reporter.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{TYPE_LABELS[dispute.tipo] || dispute.tipo}</Badge>
                        <Badge
                          variant={
                            dispute.estado === 'EN_MEDIACION'
                              ? 'default'
                              : 'destructive'
                          }
                          className="flex items-center gap-1"
                        >
                          {dispute.estado === 'ABIERTA' && <AlertTriangle className="h-3 w-3" />}
                          {dispute.estado === 'ESPERANDO_RESPUESTA_VENDEDOR' && <Clock className="h-3 w-3" />}
                          {dispute.estado === 'EN_MEDIACION' && <MessageSquare className="h-3 w-3" />}
                          {STATUS_LABELS[dispute.estado] || dispute.estado}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pl-12 space-y-4">
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
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
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
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
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

                  {/* Timeline */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Historial</h4>
                    <div className="space-y-3 ml-2">
                      <TimelineItem label="Reclamo abierto" date={dispute.createdAt} active />
                      {dispute.fechaRespuestaVendedor && (
                        <TimelineItem label="Vendedor respondió" date={dispute.fechaRespuestaVendedor} active />
                      )}
                      {dispute.estado === 'EN_MEDIACION' && (
                        <TimelineItem label="En mediación (admin revisando)" active />
                      )}
                      <TimelineItem label="Pendiente de resolución" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Vendedor: {dispute.raffle.seller.email}</span>
                    <span>Ganador: {dispute.raffle.winner?.email}</span>
                    <span>Creado: {new Date(dispute.createdAt).toLocaleDateString('es-AR')}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => openResolveDialog(dispute, 'RESUELTA_COMPRADOR')}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reembolsar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openResolveDialog(dispute, 'RESUELTA_PARCIAL')}>
                      Resolución Parcial
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openResolveDialog(dispute, 'RESUELTA_VENDEDOR')}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Liberar Pago
                    </Button>
                  </div>
                </CardContent>
              )}

              {/* Collapsed actions */}
              {!isExpanded && (
                <CardContent className="pl-12">
                  <div className="bg-muted p-3 rounded-md mb-4 text-sm line-clamp-2">
                    {dispute.descripcion}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>Vendedor: {dispute.raffle.seller.email}</span>
                    <span>Ganador: {dispute.raffle.winner?.email}</span>
                    <Link href={`/raffle/${dispute.raffle.id}`} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Ver Rifa
                    </Link>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => openResolveDialog(dispute, 'RESUELTA_COMPRADOR')}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reembolsar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openResolveDialog(dispute, 'RESUELTA_PARCIAL')}>
                      Resolución Parcial
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openResolveDialog(dispute, 'RESUELTA_VENDEDOR')}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Liberar Pago
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Single Resolve Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolver Disputa</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Decisión</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as DecisionType)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="RESUELTA_COMPRADOR">{DECISION_LABELS.RESUELTA_COMPRADOR}</option>
                <option value="RESUELTA_VENDEDOR">{DECISION_LABELS.RESUELTA_VENDEDOR}</option>
                <option value="RESUELTA_PARCIAL">{DECISION_LABELS.RESUELTA_PARCIAL}</option>
              </select>
            </div>

            {(() => {
              const maxRefund = selectedDispute?.raffle.precioPorTicket && selectedDispute?.raffle.ticketsVendidos
                ? selectedDispute.raffle.precioPorTicket * selectedDispute.raffle.ticketsVendidos
                : undefined;
              const maxRefundStr = maxRefund ? `$${maxRefund.toFixed(2)}` : undefined;

              return (
                <>
                  {decision === 'RESUELTA_COMPRADOR' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Monto a reembolsar al comprador ($)</label>
                      <Input
                        type="number"
                        min="0"
                        max={maxRefund}
                        step="0.01"
                        value={montoReembolsado}
                        onKeyDown={blockNonNumericKeys}
                        onChange={handleMoneyChange(setMontoReembolsado)}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Monto total que se devolverá al comprador{maxRefundStr && ` (máximo: ${maxRefundStr})`}
                      </p>
                    </div>
                  )}

                  {decision === 'RESUELTA_PARCIAL' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Monto reembolsado ($)</label>
                        <Input
                          type="number"
                          min="0"
                          max={maxRefund}
                          step="0.01"
                          value={montoReembolsado}
                          onKeyDown={blockNonNumericKeys}
                          onChange={handleMoneyChange(setMontoReembolsado)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Monto al vendedor ($)</label>
                        <Input
                          type="number"
                          min="0"
                          max={maxRefund}
                          step="0.01"
                          value={montoPagadoVendedor}
                          onKeyDown={blockNonNumericKeys}
                          onChange={handleMoneyChange(setMontoPagadoVendedor)}
                          placeholder="0.00"
                        />
                      </div>
                      {maxRefundStr && (
                        <p className="text-xs text-muted-foreground col-span-2">
                          La suma de ambos montos no puede superar {maxRefundStr}
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium">Resolución / Justificación</label>
              <Textarea
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Explica la decisión final..."
                className="min-h-[80px] max-h-[200px] overflow-y-auto overflow-x-hidden [field-sizing:fixed] [overflow-wrap:break-word] [word-break:break-word]"
                minLength={20}
              />
              <p className="text-xs text-muted-foreground text-right">
                {resolutionText.length}/20 caracteres mínimo
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas admin (interno, opcional)</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas internas para referencia..."
                className="min-h-[60px] max-h-[200px] overflow-y-auto overflow-x-hidden [field-sizing:fixed] [overflow-wrap:break-word] [word-break:break-word]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedDispute(null)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={resolving || resolutionText.length < 20}>
              {resolving ? <Loader2 className="animate-spin" /> : 'Confirmar Resolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Resolve Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolver {selectedIds.size} Disputas</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 rounded border text-sm">
              Resolviendo <strong>{selectedIds.size}</strong> disputas a favor de:{' '}
              <strong>{bulkAction === 'REFUND' ? 'COMPRADOR (Reembolso)' : 'VENDEDOR (Liberar Pago)'}</strong>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Resolución / Justificación (para todas)</label>
              <Textarea
                value={bulkResolution}
                onChange={(e) => setBulkResolution(e.target.value)}
                placeholder="Explica la decisión final aplicada a todas las disputas seleccionadas..."
                className="min-h-[80px] max-h-[200px] overflow-y-auto overflow-x-hidden [field-sizing:fixed] [overflow-wrap:break-word] [word-break:break-word]"
                minLength={20}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkResolve} disabled={bulkResolving || bulkResolution.length < 20}>
              {bulkResolving ? <Loader2 className="animate-spin" /> : `Resolver ${selectedIds.size} Disputas`}
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
