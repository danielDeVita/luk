'use client';

import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageUpload } from '@/components/ImageUpload';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  PlusCircle,
  Loader2,
  DollarSign,
  Ticket,
  Users,
  Truck,
  Download,
  TrendingUp,
  Eye,
  XCircle,
  Clock,
  BarChart3,
  CheckCircle2,
  User,
  CreditCard,
  MapPin,
  ArrowRight,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { toast } from 'sonner';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import Image from 'next/image';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';
import { getProhibitedRaffleContentMessage } from '@/lib/legal';
import {
  SocialPromotionManager,
  SocialPromotionPostsSummary,
} from '@/components/social-promotions/social-promotion-manager';

const MY_RAFFLES = gql`
  query MyRaffles {
    myRafflesAsSeller {
      id
      titulo
      descripcion
      totalTickets
      precioPorTicket
      estado
      deliveryStatus
      trackingNumber
      fechaLimiteSorteo
      createdAt
      viewCount
      winningTicketNumber
      winner {
        id
        nombre
        apellido
      }
      product {
        imagenes
      }
      tickets {
        id
        estado
      }
    }
  }
`;

const SELLER_DASHBOARD_STATS = gql`
  query SellerDashboardStats {
    sellerDashboardStats {
      totalRevenue
      totalTicketsSold
      activeRaffles
      completedRaffles
      totalViews
      conversionRate
      monthlyRevenue {
        year
        month
        revenue
        ticketsSold
        rafflesCompleted
      }
    }
  }
`;

const MARK_AS_SHIPPED = gql`
  mutation MarkAsShipped($raffleId: String!, $trackingNumber: String) {
    markAsShipped(raffleId: $raffleId, trackingNumber: $trackingNumber) {
      id
      deliveryStatus
      trackingNumber
    }
  }
`;

const BULK_CANCEL_RAFFLES = gql`
  mutation BulkCancelRaffles($raffleIds: [String!]!) {
    bulkCancelRaffles(raffleIds: $raffleIds) {
      successCount
      failedCount
      failedIds
      errors
    }
  }
`;

const BULK_EXTEND_RAFFLES = gql`
  mutation BulkExtendRaffles($raffleIds: [String!]!, $newDeadline: String!) {
    bulkExtendRaffles(raffleIds: $raffleIds, newDeadline: $newDeadline) {
      successCount
      failedCount
      failedIds
      errors
    }
  }
`;

const RELAUNCH_RAFFLE = gql`
  mutation RelaunchRaffle($input: RelaunchRaffleInput!) {
    relaunchRaffleWithSuggestedPrice(input: $input) {
      id
      titulo
      precioPorTicket
      estado
    }
  }
`;

const UPDATE_RAFFLE = gql`
  mutation UpdateRaffle($id: String!, $input: UpdateRaffleInput!) {
    updateRaffle(id: $id, input: $input) {
      id
      titulo
      descripcion
      product {
        imagenes
      }
    }
  }
`;

const GET_PRICE_REDUCTION = gql`
  query GetPriceReduction($priceReductionId: String!) {
    getPriceReduction(priceReductionId: $priceReductionId) {
      id
      raffleId
      precioSugerido
      raffleTitulo
      aceptada
    }
  }
`;

const GET_ONBOARDING_STATUS = gql`
  query GetOnboardingStatus {
    me {
      id
      nombre
      apellido
      phone
      mpConnectStatus
      kycStatus
      street
      city
      province
      postalCode
    }
  }
`;

const MY_SOCIAL_PROMOTION_POSTS = gql`
  query MySocialPromotionPosts {
    mySocialPromotionPosts {
      id
      raffleId
      network
      status
      submittedPermalink
      canonicalPermalink
      disqualificationReason
      snapshots {
        checkedAt
        likesCount
        commentsCount
        repostsOrSharesCount
        viewsCount
      }
    }
  }
`;

interface RaffleData {
  id: string;
  titulo: string;
  descripcion?: string;
  totalTickets: number;
  precioPorTicket: number;
  estado: string;
  deliveryStatus: string;
  trackingNumber?: string;
  fechaLimiteSorteo: string;
  createdAt: string;
  viewCount: number;
  winningTicketNumber?: number | null;
  winner?: { id: string; nombre: string; apellido: string };
  product?: { imagenes?: string[] };
  tickets?: { id: string; estado: string }[];
}

interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  ticketsSold: number;
  rafflesCompleted: number;
}

interface SellerDashboardStats {
  totalRevenue: number;
  totalTicketsSold: number;
  activeRaffles: number;
  completedRaffles: number;
  totalViews: number;
  conversionRate: number;
  monthlyRevenue: MonthlyRevenue[];
}

interface OnboardingData {
  me: {
    id: string;
    nombre: string;
    apellido: string;
    phone?: string;
    mpConnectStatus: string;
    kycStatus: string;
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
}

interface RelaunchRaffleResponse {
  relaunchRaffleWithSuggestedPrice: {
    id: string;
    titulo: string;
    precioPorTicket: number;
    estado: string;
  };
}

interface SocialPromotionPost {
  id: string;
  raffleId: string;
  network: string;
  status: string;
  submittedPermalink: string;
  canonicalPermalink?: string;
  disqualificationReason?: string;
  snapshots?: Array<{
    checkedAt: string;
    likesCount?: number;
    commentsCount?: number;
    repostsOrSharesCount?: number;
    viewsCount?: number;
  }>;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getChartLabelDensity(chartWidth: number | null): 'full' | 'compact' | 'sparse' {
  if (chartWidth === null) {
    return 'compact';
  }

  if (chartWidth < 640) {
    return 'sparse';
  }

  if (chartWidth < 980) {
    return 'compact';
  }

  return 'full';
}

function SalesDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [selectedRaffle, setSelectedRaffle] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isShipDialogOpen, setIsShipDialogOpen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState<number | null>(
    null,
  );

  // Bulk actions state
  const [selectedRaffleIds, setSelectedRaffleIds] = useState<string[]>([]);
  const [isBulkCancelDialogOpen, setIsBulkCancelDialogOpen] = useState(false);
  const [isBulkExtendDialogOpen, setIsBulkExtendDialogOpen] = useState(false);
  const [extendDeadline, setExtendDeadline] = useState('');

  // Relaunch state
  const [relaunchModalOpen, setRelaunchModalOpen] = useState(false);
  const [relaunchData, setRelaunchData] = useState<{
    raffleId: string;
    priceReductionId: string;
    raffleName: string;
    suggestedPrice: number;
  } | null>(null);
  const [relaunchDeadline, setRelaunchDeadline] = useState('');
  const [relaunchCustomPrice, setRelaunchCustomPrice] = useState('');

  // Edit raffle state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRaffle, setEditingRaffle] = useState<RaffleData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);

  const shouldSkipQueries = !isAuthenticated || !hasHydrated;

  const { data, loading, error, refetch } = useQuery<{ myRafflesAsSeller: RaffleData[] }>(MY_RAFFLES, {
    skip: shouldSkipQueries,
  });

  const { data: statsData } = useQuery<{ sellerDashboardStats: SellerDashboardStats }>(
    SELLER_DASHBOARD_STATS,
    { skip: shouldSkipQueries }
  );

  const { data: onboardingData, loading: onboardingLoading } = useQuery<OnboardingData>(GET_ONBOARDING_STATUS, {
    skip: shouldSkipQueries,
  });
  const { data: socialPromotionData, refetch: refetchSocialPromotions } = useQuery<{
    mySocialPromotionPosts: SocialPromotionPost[];
  }>(MY_SOCIAL_PROMOTION_POSTS, {
    skip: shouldSkipQueries,
  });

  const [markAsShipped, { loading: marking }] = useMutation(MARK_AS_SHIPPED, {
    onCompleted: () => {
      toast.success('Envío registrado correctamente');
      setIsShipDialogOpen(false);
      setTrackingNumber('');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [bulkCancelRaffles, { loading: bulkCancelling }] = useMutation<{
    bulkCancelRaffles: { successCount: number; failedCount: number; failedIds: string[]; errors: string[] };
  }>(BULK_CANCEL_RAFFLES, {
    onCompleted: (data) => {
      const result = data.bulkCancelRaffles;
      if (result.successCount > 0) {
        toast.success(
          result.successCount === 1
            ? '1 rifa cancelada correctamente'
            : `${result.successCount} rifas canceladas correctamente`
        );
      }
      if (result.failedCount > 0) {
        toast.error(
          result.failedCount === 1
            ? '1 rifa no pudo cancelarse'
            : `${result.failedCount} rifas no pudieron cancelarse`
        );
      }
      setIsBulkCancelDialogOpen(false);
      setSelectedRaffleIds([]);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [bulkExtendRaffles, { loading: bulkExtending }] = useMutation<{
    bulkExtendRaffles: { successCount: number; failedCount: number; failedIds: string[]; errors: string[] };
  }>(BULK_EXTEND_RAFFLES, {
    onCompleted: (data) => {
      const result = data.bulkExtendRaffles;
      if (result.successCount > 0) {
        toast.success(
          result.successCount === 1
            ? '1 rifa extendida correctamente'
            : `${result.successCount} rifas extendidas correctamente`
        );
      }
      if (result.failedCount > 0) {
        toast.error(
          result.failedCount === 1
            ? '1 rifa no pudo extenderse'
            : `${result.failedCount} rifas no pudieron extenderse`
        );
      }
      setIsBulkExtendDialogOpen(false);
      setSelectedRaffleIds([]);
      setExtendDeadline('');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [relaunchRaffle, { loading: relaunching }] = useMutation<RelaunchRaffleResponse>(
    RELAUNCH_RAFFLE,
    {
      onCompleted: (data) => {
        toast.success('¡Rifa relanzada exitosamente!');
        setRelaunchModalOpen(false);
        setRelaunchData(null);
        // Clear URL params after successful relaunch
        router.replace('/dashboard/sales');
        // Redirect to new raffle
        router.push(`/raffle/${data.relaunchRaffleWithSuggestedPrice.id}`);
      },
      onError: (err) => {
        toast.error(err.message || 'Error al relanzar la rifa');
      },
    }
  );

  const [updateRaffle, { loading: updating }] = useMutation(UPDATE_RAFFLE, {
    onCompleted: () => {
      toast.success('Rifa actualizada correctamente');
      setEditModalOpen(false);
      setEditingRaffle(null);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Error al actualizar la rifa');
    },
  });

  const openEditModal = (raffle: RaffleData) => {
    setEditingRaffle(raffle);
    setEditTitle(raffle.titulo);
    setEditDescription(raffle.descripcion || '');
    setEditImages(raffle.product?.imagenes || []);
    setEditModalOpen(true);
  };

  const handleUpdateRaffle = () => {
    if (!editingRaffle) return;

    const prohibitedContentMessage = getProhibitedRaffleContentMessage([
      editTitle,
      editDescription,
    ]);

    if (prohibitedContentMessage) {
      toast.error(prohibitedContentMessage);
      return;
    }

    updateRaffle({
      variables: {
        id: editingRaffle.id,
        input: {
          titulo: editTitle,
          descripcion: editDescription,
          imagenes: editImages,
        },
      },
    });
  };

  // Lazy query to fetch price reduction data from email link
  const [fetchPriceReduction] = useLazyQuery<{
    getPriceReduction: {
      id: string;
      raffleId: string;
      precioSugerido: number;
      raffleTitulo: string;
      aceptada: boolean | null;
    } | null;
  }>(GET_PRICE_REDUCTION, {
    fetchPolicy: 'network-only',
  });

  // Handle relaunch action from email link
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const action = searchParams.get('action');
    const priceReductionId = searchParams.get('priceReductionId');
    
    if (action === 'relaunch' && priceReductionId) {
      fetchPriceReduction({ variables: { priceReductionId } }).then(({ data, error }) => {
        if (error) {
          toast.error('Error al cargar la información de relaunch');
          router.replace('/dashboard/sales');
          return;
        }
        
        if (data?.getPriceReduction) {
          const pr = data.getPriceReduction;
          if (pr.aceptada) {
            toast.error('Esta sugerencia de precio ya fue utilizada');
            router.replace('/dashboard/sales');
            return;
          }
          setRelaunchData({
            raffleId: pr.raffleId,
            priceReductionId: pr.id,
            raffleName: pr.raffleTitulo,
            suggestedPrice: pr.precioSugerido,
          });
          setRelaunchModalOpen(true);
        } else {
          toast.error('La sugerencia de precio no existe o no te pertenece');
          router.replace('/dashboard/sales');
        }
      });
    }
  }, [isAuthenticated, searchParams, fetchPriceReduction, router]);

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setChartContainerWidth(entry.contentRect.width);
    });

    observer.observe(chartContainer);

    return () => {
      observer.disconnect();
    };
  }, []);


  // Get data from queries - wrapped in useMemo to prevent dependency issues
  const raffles = useMemo(() => data?.myRafflesAsSeller || [], [data?.myRafflesAsSeller]);
  const stats = statsData?.sellerDashboardStats;
  const chartLabelDensity = useMemo(
    () => getChartLabelDensity(chartContainerWidth),
    [chartContainerWidth],
  );

  // Chart data (useMemo before any returns)
  const chartData = useMemo(() => {
    if (!stats?.monthlyRevenue) return [];
    return stats.monthlyRevenue.map((m) => ({
      name: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
      monthLabel: MONTH_NAMES[m.month - 1],
      shortLabel: `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(-2)}`,
      revenue: m.revenue,
      tickets: m.ticketsSold,
    }));
  }, [stats]);

  // Onboarding checklist (useMemo before any returns)
  const onboardingSteps = useMemo(() => {
    const userData = onboardingData?.me;
    const hasRaffles = raffles.length > 0;

    const steps = [
      {
        id: 'profile',
        label: 'Completar perfil',
        description: 'Nombre y teléfono',
        completed: !!(userData?.nombre && userData?.apellido && userData?.phone),
        href: '/dashboard/settings',
        icon: User,
      },
      {
        id: 'mp',
        label: 'Conectar Mercado Pago',
        description: 'Para recibir pagos',
        completed: userData?.mpConnectStatus === 'CONNECTED',
        href: '/dashboard/settings?tab=payments',
        icon: CreditCard,
      },
      {
        id: 'kyc',
        label: 'Verificar identidad (KYC)',
        description: 'Requerido para crear rifas',
        completed: userData?.kycStatus === 'VERIFIED',
        href: '/dashboard/settings?tab=kyc',
        icon: User,
      },
      {
        id: 'address',
        label: 'Agregar dirección',
        description: 'Dirección de envío',
        completed: !!(userData?.street && userData?.city && userData?.province && userData?.postalCode),
        href: '/dashboard/settings?tab=kyc',
        icon: MapPin,
      },
      {
        id: 'raffle',
        label: 'Crear primera rifa',
        description: 'Empezá a vender',
        completed: hasRaffles,
        href: '/dashboard/create',
        icon: Ticket,
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const progress = (completedCount / steps.length) * 100;

    return { steps, completedCount, progress, allComplete: completedCount === steps.length };
  }, [onboardingData, raffles]);

  // Handler functions
  const handleMarkAsShipped = () => {
    if (!selectedRaffle) return;
    markAsShipped({
      variables: {
        raffleId: selectedRaffle,
        trackingNumber: trackingNumber || undefined,
      },
    });
  };

  const openShipDialog = (raffleId: string) => {
    setSelectedRaffle(raffleId);
    setTrackingNumber('');
    setIsShipDialogOpen(true);
  };

  const handleSelectRaffle = (raffleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRaffleIds((prev) => [...prev, raffleId]);
    } else {
      setSelectedRaffleIds((prev) => prev.filter((id) => id !== raffleId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeRaffleIds = raffles.filter((r) => r.estado === 'ACTIVA').map((r) => r.id);
      setSelectedRaffleIds(activeRaffleIds);
    } else {
      setSelectedRaffleIds([]);
    }
  };

  const handleBulkCancel = () => {
    if (selectedRaffleIds.length === 0) return;
    bulkCancelRaffles({ variables: { raffleIds: selectedRaffleIds } });
  };

  const handleBulkExtend = () => {
    if (selectedRaffleIds.length === 0 || !extendDeadline) return;
    bulkExtendRaffles({
      variables: {
        raffleIds: selectedRaffleIds,
        newDeadline: new Date(extendDeadline).toISOString(),
      },
    });
  };

  const exportToCSV = () => {
    if (!raffles.length) {
      toast.error('No hay datos para exportar');
      return;
    }

    const headers = [
      'Título',
      'Estado',
      'Tickets Vendidos',
      'Total Tickets',
      'Precio por Ticket',
      'Ingresos',
      'Vistas',
      'Conversión',
      'Estado Entrega',
      'Número Seguimiento',
      'Ganador',
      'Número Ganador',
      'Fecha Creación',
      'Fecha Límite',
    ];

    const rows = raffles.map((r) => {
      const soldTickets = r.tickets?.filter((t) => t.estado === 'PAGADO').length || 0;
      const revenue = soldTickets * Number(r.precioPorTicket);
      const winnerName = r.winner ? `${r.winner.nombre} ${r.winner.apellido}` : '-';
      const winningTicketNumber =
        r.winningTicketNumber !== null && r.winningTicketNumber !== undefined
          ? `#${r.winningTicketNumber}`
          : '-';
      const conversion = r.viewCount > 0 ? ((soldTickets / r.viewCount) * 100).toFixed(1) + '%' : '-';

      return [
        `"${r.titulo.replace(/"/g, '""')}"`,
        r.estado,
        soldTickets,
        r.totalTickets,
        r.precioPorTicket,
        revenue.toFixed(2),
        r.viewCount,
        conversion,
        r.deliveryStatus,
        r.trackingNumber || '-',
        winnerName,
        winningTicketNumber,
        new Date(r.createdAt).toLocaleDateString(),
        new Date(r.fechaLimiteSorteo).toLocaleDateString(),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mis-rifas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Archivo CSV descargado');
  };

  if (!hasHydrated || !isAuthenticated) return null;

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20 text-destructive">Error al cargar tus rifas: {error.message}</div>
      </div>
    );
  }

  const activeRafflesForSelection = raffles.filter((r) => r.estado === 'ACTIVA');
  const allActiveSelected =
    activeRafflesForSelection.length > 0 && activeRafflesForSelection.every((r) => selectedRaffleIds.includes(r.id));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">Panel de Vendedor</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportToCSV} disabled={!raffles.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Link href="/dashboard/create">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Crear Rifa
            </Button>
          </Link>
        </div>
      </div>

      {/* Onboarding Checklist - only show when data is loaded and onboarding is incomplete */}
      {!onboardingLoading && !onboardingSteps.allComplete && (
        <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Primeros pasos para vender</CardTitle>
                <CardDescription>
                  Completá estos pasos para empezar a crear rifas
                </CardDescription>
              </div>
              <span className="text-sm font-medium text-primary">
                {onboardingSteps.completedCount}/{onboardingSteps.steps.length} completados
              </span>
            </div>
            <Progress value={onboardingSteps.progress} className="h-2 mt-3" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {onboardingSteps.steps.map((step) => {
                const Icon = step.icon;
                return (
                  <Link
                    key={step.id}
                    href={step.href}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      step.completed
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                        : 'bg-background hover:bg-muted border-border hover:border-primary/50'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-full ${
                        step.completed
                          ? 'bg-green-100 dark:bg-green-900'
                          : 'bg-muted'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          step.completed ? 'text-green-700 dark:text-green-300' : ''
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </p>
                    </div>
                    {!step.completed && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Ingresos Totales
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  ${stats?.totalRevenue.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-blue-500/10 p-2">
                <Ticket className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Tickets Vendidos
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  {stats?.totalTicketsSold || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-purple-500/10 p-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Rifas Activas
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  {stats?.activeRaffles || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-orange-500/10 p-2">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Rifas Completadas
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  {stats?.completedRaffles || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-cyan-500/10 p-2">
                <Eye className="h-5 w-5 text-cyan-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Vistas Totales
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  {stats?.totalViews || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 rounded-full bg-pink-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-pink-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight text-muted-foreground">
                  Tasa Conversión
                </p>
                <p className="break-words text-2xl font-bold leading-tight tracking-tight">
                  {stats?.conversionRate.toFixed(1) || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Ingresos Mensuales
            </CardTitle>
            <CardDescription>Evolución de tus ingresos en los últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={chartContainerRef} className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 8, bottom: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey={
                      chartLabelDensity === 'full' ? 'shortLabel' : 'monthLabel'
                    }
                    className="text-xs"
                    tick={{
                      fill: 'currentColor',
                      fontSize: chartLabelDensity === 'sparse' ? 11 : 12,
                    }}
                    interval={chartLabelDensity === 'sparse' ? 1 : 0}
                    minTickGap={0}
                    tickMargin={10}
                    height={56}
                  />
                  <YAxis className="text-xs" tick={{ fill: 'currentColor' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(_, payload) => {
                      const entry = payload?.[0]?.payload as { name?: string } | undefined;
                      return entry?.name || '';
                    }}
                    formatter={(value, name) => [
                      name === 'revenue' ? `$${Number(value).toFixed(2)}` : value,
                      name === 'revenue' ? 'Ingresos' : 'Tickets',
                    ]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedRaffleIds.length > 0 && (
        <div className="mb-4 p-4 bg-muted rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="font-medium">{selectedRaffleIds.length} rifas seleccionadas</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkExtendDialogOpen(true)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Extender Fecha
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkCancelDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Seleccionadas
            </Button>
          </div>
        </div>
      )}

      {/* Raffles List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : raffles.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No tenés rifas</h2>
          <p className="text-muted-foreground mb-4">Creá tu primera rifa y empezá a vender</p>
          <Link href="/dashboard/create">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Crear Rifa
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All Header */}
          {activeRafflesForSelection.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="select-all"
                checked={allActiveSelected}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                Seleccionar todas las activas ({activeRafflesForSelection.length})
              </label>
            </div>
          )}

          {raffles.map((raffle) => {
            const soldTickets = raffle.tickets?.filter((t) => t.estado === 'PAGADO').length || 0;
            const progress = (soldTickets / raffle.totalTickets) * 100;
            const revenue = soldTickets * Number(raffle.precioPorTicket);
            const conversionRate = raffle.viewCount > 0 ? ((soldTickets / raffle.viewCount) * 100).toFixed(1) : '0';
            const isActive = raffle.estado === 'ACTIVA';
            const rafflePromotions =
              socialPromotionData?.mySocialPromotionPosts?.filter(
                (post) => post.raffleId === raffle.id,
              ) || [];
            const hasPromotionPosts = rafflePromotions.length > 0;

            return (
              <Card key={raffle.id} className={selectedRaffleIds.includes(raffle.id) ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    {/* Checkbox for active raffles */}
                    {isActive && (
                      <Checkbox
                        checked={selectedRaffleIds.includes(raffle.id)}
                        onCheckedChange={(checked) => handleSelectRaffle(raffle.id, checked as boolean)}
                      />
                    )}

                    <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {raffle.product?.imagenes?.[0] ? (
                        <Image
                          src={getOptimizedImageUrl(raffle.product.imagenes[0], CLOUDINARY_PRESETS.dashboardThumb)}
                          alt={raffle.titulo}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Ticket className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{raffle.titulo}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            raffle.estado === 'ACTIVA'
                              ? 'bg-green-500/20 text-green-600'
                              : raffle.estado === 'SORTEADA'
                              ? 'bg-purple-500/20 text-purple-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {raffle.estado}
                        </span>
                        {raffle.deliveryStatus !== 'PENDING' && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            {raffle.deliveryStatus === 'SHIPPED' ? 'Enviado' : 'Entregado'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2 flex-wrap">
                        {raffle.winner && (
                          <span className="text-green-600 font-medium">
                            Ganador: {raffle.winner.nombre} {raffle.winner.apellido}
                          </span>
                        )}
                        {raffle.winningTicketNumber !== null &&
                          raffle.winningTicketNumber !== undefined && (
                            <span className="font-medium text-primary">
                              Número ganador: #{raffle.winningTicketNumber}
                            </span>
                          )}
                        <span>
                          {soldTickets}/{raffle.totalTickets} vendidos
                        </span>
                        <span>${revenue.toFixed(2)} recaudado</span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {raffle.viewCount} vistas
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {conversionRate}% conversión
                        </span>
                      </div>

                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 md:w-72 md:shrink-0">
                      <Link href={`/raffle/${raffle.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          Ver Detalles
                        </Button>
                      </Link>

                      {raffle.estado === 'ACTIVA' && (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => openEditModal(raffle)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      )}

                      {raffle.estado === 'ACTIVA' && (
                        <SocialPromotionManager
                          raffleId={raffle.id}
                          raffleTitle={raffle.titulo}
                          raffleImages={raffle.product?.imagenes || []}
                          ticketPrice={raffle.precioPorTicket}
                          posts={rafflePromotions}
                          onChanged={refetchSocialPromotions}
                          showSummary={false}
                          showHelperText={false}
                        />
                      )}

                      {raffle.estado === 'SORTEADA' && raffle.deliveryStatus === 'PENDING' && (
                        <Button size="sm" onClick={() => openShipDialog(raffle.id)}>
                          <Truck className="w-4 h-4 mr-2" />
                          Marcar Enviado
                        </Button>
                      )}
                    </div>
                    </div>

                    {isActive && hasPromotionPosts && (
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold">Promoción social</h4>
                            <p className="text-xs text-muted-foreground">
                              Estado y métricas visibles de las publicaciones registradas para esta rifa.
                            </p>
                          </div>
                        </div>
                        <SocialPromotionPostsSummary posts={rafflePromotions} className="border-0 bg-background p-0 shadow-none" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ship Dialog */}
      <Dialog open={isShipDialogOpen} onOpenChange={setIsShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Enviado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tracking">Número de Seguimiento / Información de Envío</Label>
              <Input
                id="tracking"
                placeholder="Ej: Correo Arg CP123456789"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShipDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsShipped} disabled={marking}>
              {marking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Cancel Dialog */}
      <Dialog open={isBulkCancelDialogOpen} onOpenChange={setIsBulkCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Rifas</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés cancelar {selectedRaffleIds.length} rifas? Esta acción no se puede deshacer.
              Los compradores serán reembolsados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkCancelDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkCancel} disabled={bulkCancelling}>
              {bulkCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Extend Dialog */}
      <Dialog open={isBulkExtendDialogOpen} onOpenChange={setIsBulkExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extender Fecha Límite</DialogTitle>
            <DialogDescription>
              Seleccioná una nueva fecha límite para las {selectedRaffleIds.length} rifas seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extend-date">Nueva Fecha Límite</Label>
              <Input
                id="extend-date"
                type="datetime-local"
                value={extendDeadline}
                onChange={(e) => setExtendDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkExtendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkExtend} disabled={bulkExtending || !extendDeadline}>
              {bulkExtending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Extender Rifas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relaunch Confirmation Modal */}
      <Dialog open={relaunchModalOpen} onOpenChange={(open) => {
        setRelaunchModalOpen(open);
        if (!open) {
          setRelaunchDeadline('');
          setRelaunchCustomPrice('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relanzar Rifa con Precio Sugerido</DialogTitle>
          </DialogHeader>
          {relaunchData && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Se creará una nueva rifa con el mismo producto y el precio ajustado.
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Rifa:</strong> {relaunchData.raffleName}
                </p>
                {relaunchData.suggestedPrice > 0 && (
                  <p className="text-sm">
                    <strong>Precio sugerido:</strong> ${relaunchData.suggestedPrice.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="relaunch-custom-price">Precio final (opcional)</Label>
                <Input
                  id="relaunch-custom-price"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder={
                    relaunchData.suggestedPrice > 0
                      ? `Sugerido: $${relaunchData.suggestedPrice.toFixed(2)}`
                      : 'Precio personalizado'
                  }
                  value={relaunchCustomPrice}
                  onChange={(e) => setRelaunchCustomPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejás vacío, se usará el precio sugerido automáticamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relaunch-deadline">Fecha límite del sorteo</Label>
                <Input
                  id="relaunch-deadline"
                  type="datetime-local"
                  value={relaunchDeadline}
                  onChange={(e) => setRelaunchDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-muted-foreground">
                  Si no seleccionás una fecha, se usará 30 días a partir de hoy.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRelaunchModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!relaunchData) return;

                const parsedCustomPrice =
                  relaunchCustomPrice.trim() === ''
                    ? undefined
                    : Number.parseFloat(relaunchCustomPrice);

                if (
                  parsedCustomPrice !== undefined &&
                  (!Number.isFinite(parsedCustomPrice) || parsedCustomPrice <= 0)
                ) {
                  toast.error('El precio personalizado debe ser mayor a 0');
                  return;
                }

                relaunchRaffle({
                  variables: {
                    input: {
                      originalRaffleId: relaunchData.raffleId,
                      priceReductionId: relaunchData.priceReductionId,
                      ...(parsedCustomPrice !== undefined
                        ? { customPrice: parsedCustomPrice }
                        : {}),
                      ...(relaunchDeadline && { fechaLimite: new Date(relaunchDeadline).toISOString() }),
                    },
                  },
                });
              }}
              disabled={relaunching}
            >
              {relaunching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Relanzar Rifa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Raffle Modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => {
        setEditModalOpen(open);
        if (!open) {
          setEditingRaffle(null);
          setEditTitle('');
          setEditDescription('');
          setEditImages([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Rifa</DialogTitle>
            <DialogDescription>
              Podés modificar el título, descripción e imágenes de tu rifa.
            </DialogDescription>
          </DialogHeader>
          {editingRaffle && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Título de la rifa"
                  minLength={10}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  {editTitle.length}/100 caracteres (mínimo 10)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción detallada de la rifa..."
                  rows={5}
                  minLength={50}
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">
                  {editDescription.length}/5000 caracteres (mínimo 50)
                </p>
                <p className="text-xs text-muted-foreground">
                  No se permiten referencias a fichas, saldo, creditos, apuestas
                  ni valores utilizables fuera del sitio.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Imágenes del producto</Label>
                <ImageUpload
                  images={editImages}
                  onImagesChange={setEditImages}
                  maxImages={5}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateRaffle}
              disabled={updating || editTitle.length < 10 || editDescription.length < 50 || editImages.length === 0}
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MySalesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SalesDashboardContent />
    </Suspense>
  );
}
