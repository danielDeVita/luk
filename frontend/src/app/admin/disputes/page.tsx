'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ListChecks } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';

const GET_PENDING_DISPUTES = gql`
  query GetPendingDisputes {
    pendingDisputes {
      id
      titulo
      descripcion
      tipo
      estado
      createdAt
      reporter {
        email
        nombre
      }
      raffle {
        id
        titulo
        deliveryStatus
        seller {
            email
            nombre
        }
        winner {
            email
            nombre
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
  createdAt: string;
  reporter: { email: string; nombre: string };
  raffle: {
    id: string;
    titulo: string;
    deliveryStatus: string;
    seller: { email: string; nombre: string };
    winner?: { email: string; nombre: string };
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

export default function AdminDisputesPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [action, setAction] = useState<'REFUND' | 'RELEASE' | null>(null);

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
    } else {
        setIsAuthorized(true);
    }
  }, [isAuthenticated, user, router, hasHydrated]);

  const { data, loading, refetch, error } = useQuery<PendingDisputesResult>(GET_PENDING_DISPUTES, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
  });

  const [resolveDispute, { loading: resolving }] = useMutation(RESOLVE_DISPUTE, {
    onCompleted: () => {
      toast.success('Disputa resuelta correctamente');
      setSelectedDispute(null);
      setResolutionText('');
      setAction(null);
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

  const disputes = data?.pendingDisputes || [];

  const handleResolve = () => {
    if (!selectedDispute || !action) return;

    const decision = action === 'REFUND' ? 'RESUELTA_COMPRADOR' : 'RESUELTA_VENDEDOR';

    const input: { decision: string; resolucion: string; adminNotes: string } = {
      decision,
      resolucion: resolutionText,
      adminNotes: `Resolved via Admin Panel as ${action}`
    };

    resolveDispute({
      variables: {
        disputeId: selectedDispute.id,
        input
      }
    });
  };

  const handleBulkResolve = () => {
    if (selectedIds.size === 0 || !bulkAction) return;

    const decision = bulkAction === 'REFUND' ? 'RESUELTA_COMPRADOR' : 'RESUELTA_VENDEDOR';

    bulkResolveDisputes({
      variables: {
        disputeIds: Array.from(selectedIds),
        decision,
        resolucion: bulkResolution,
        adminNotes: `Bulk resolved via Admin Panel as ${bulkAction}`
      }
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
    if (selectedIds.size === disputes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(disputes.map(d => d.id)));
    }
  };

  const openBulkDialog = (actionType: 'REFUND' | 'RELEASE') => {
    setBulkAction(actionType);
    setBulkDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-yellow-500" />
          Disputas Pendientes ({disputes.length})
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

      {/* Select All */}
      {disputes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
          <Checkbox
            checked={selectedIds.size === disputes.length && disputes.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Seleccionar todas ({disputes.length})
          </span>
          <ListChecks className="h-4 w-4 text-muted-foreground ml-auto" />
        </div>
      )}

      <div className="space-y-4">
        {disputes.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-muted-foreground">No hay disputas pendientes de revision.</p>
          </div>
        )}

        {disputes.map((dispute) => (
          <Card key={dispute.id} className={`border-l-4 border-l-yellow-500 ${selectedIds.has(dispute.id) ? 'ring-2 ring-primary' : ''}`}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={selectedIds.has(dispute.id)}
                  onCheckedChange={() => toggleSelect(dispute.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{dispute.titulo}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Rifa: {dispute.raffle.titulo} - Reportado por: {dispute.reporter.email}
                      </p>
                    </div>
                    <Badge variant="outline">{dispute.tipo}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pl-12">
              <div className="bg-muted p-4 rounded-md mb-4 text-sm">
                &quot;{dispute.descripcion}&quot;
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                 <span>Vendedor: {dispute.raffle.seller.email}</span>
                 <span>Ganador: {dispute.raffle.winner?.email}</span>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                    setSelectedDispute(dispute);
                    setAction('REFUND');
                }}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reembolsar Comprador
                </Button>
                <Button onClick={() => {
                    setSelectedDispute(dispute);
                    setAction('RELEASE');
                }} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Liberar Pago a Vendedor
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Single Resolve Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Disputa</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
             <div className="p-3 rounded border text-sm">
                Resolviendo a favor de: <strong>{action === 'REFUND' ? 'COMPRADOR (Reembolso)' : 'VENDEDOR (Liberar Pago)'}</strong>
             </div>

             <div className="space-y-2">
                 <label className="text-sm font-medium">Resolución / Justificación</label>
                 <Textarea
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="Explica la decision final..."
                    minLength={20}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver {selectedIds.size} Disputas</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
             <div className="p-3 rounded border text-sm">
                Resolviendo <strong>{selectedIds.size}</strong> disputas a favor de: <strong>{bulkAction === 'REFUND' ? 'COMPRADOR (Reembolso)' : 'VENDEDOR (Liberar Pago)'}</strong>
             </div>

             <div className="space-y-2">
                 <label className="text-sm font-medium">Resolución / Justificación (para todas)</label>
                 <Textarea
                    value={bulkResolution}
                    onChange={(e) => setBulkResolution(e.target.value)}
                    placeholder="Explica la decision final aplicada a todas las disputas seleccionadas..."
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
