'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import {
  Loader2,
  Shield,
  Users,
  AlertTriangle,
  Eye,
  EyeOff,
  Ban,
  CheckCircle,
  XCircle,
  Ticket,
  DollarSign,
  TrendingUp,
  Activity,
  Search,
  UserX,
  UserCheck,
  History,
  Star,
} from 'lucide-react';
import { SocialPromotionAnalytics } from '@/components/admin/social-promotion-analytics';
import { SocialPromotionReview } from '@/components/admin/social-promotion-review';
import { PromotionGrantReversalLog } from '@/components/admin/promotion-grant-reversal-log';

// GraphQL queries - Split to avoid non-existent fields error
const GET_ADMIN_STATS = gql`
  query GetAdminStats {
    adminStats {
      totalUsers
      totalRaffles
      activeRaffles
      completedRaffles
      totalTransactions
      totalRevenue
      totalTicketsSold
      totalDisputes
      pendingDisputes
      recentMpEvents
      newUsersToday
      newRafflesToday
    }
  }
`;

const GET_RAFFLES = gql`
  query GetRaffles {
    raffles {
      id
      titulo
      estado
      isHidden
      hiddenReason
      totalTickets
      precioPorTicket
      createdAt
      seller {
        id
        nombre
        apellido
        email
      }
    }
  }
`;

const GET_REPORTS = gql`
  query GetReports($reviewed: Boolean) {
    getReports(reviewed: $reviewed)
  }
`;

const GET_ADMIN_USERS = gql`
  query GetAdminUsers($role: UserRole, $search: String, $includeDeleted: Boolean, $limit: Int, $offset: Int) {
    adminUsers(role: $role, search: $search, includeDeleted: $includeDeleted, limit: $limit, offset: $offset) {
      users {
        id
        email
        nombre
        apellido
        role
        mpConnectStatus
        kycStatus
        createdAt
        isDeleted
        rafflesCreated
        ticketsPurchased
        rafflesWon
        totalTicketsComprados
        totalRifasGanadas
        totalComprasCompletadas
        disputasComoCompradorAbiertas
        buyerRiskFlags
      }
      total
    }
  }
`;

const GET_ADMIN_REVIEWS = gql`
  query GetAdminReviews($includeHidden: Boolean, $limit: Int) {
    adminReviews(includeHidden: $includeHidden, limit: $limit) {
      reviews {
        id
        rating
        comentario
        createdAt
        reviewerName
        reviewerEmail
        sellerName
        sellerEmail
        raffleTitle
        commentHidden
        commentHiddenReason
      }
      total
    }
  }
`;

const GET_USER_ACTIVITY = gql`
  query GetUserActivity($userId: String!, $limit: Int) {
    adminUserActivity(userId: $userId, limit: $limit) {
      id
      action
      targetType
      targetId
      metadata
      ipAddress
      createdAt
    }
  }
`;

const REVIEW_REPORT = gql`
  mutation ReviewReport($reportId: String!, $adminNotes: String!, $action: String!) {
    reviewReport(reportId: $reportId, adminNotes: $adminNotes, action: $action)
  }
`;

const UNHIDE_RAFFLE = gql`
  mutation UnhideRaffle($raffleId: String!, $adminNotes: String!) {
    unhideRaffle(raffleId: $raffleId, adminNotes: $adminNotes)
  }
`;

const BAN_USER = gql`
  mutation BanUser($userId: String!, $reason: String!) {
    banUser(userId: $userId, reason: $reason) {
      id
      role
    }
  }
`;

const UNBAN_USER = gql`
  mutation UnbanUser($userId: String!, $reason: String!) {
    unbanUser(userId: $userId, reason: $reason) {
      id
      role
    }
  }
`;

const HIDE_REVIEW_COMMENT = gql`
  mutation HideReviewComment($reviewId: String!, $reason: String!) {
    hideReviewComment(reviewId: $reviewId, reason: $reason) {
      id
      commentHidden
      commentHiddenReason
    }
  }
`;

const GET_PENDING_KYC = gql`
  query GetPendingKyc($limit: Int, $offset: Int) {
    pendingKycSubmissions(limit: $limit, offset: $offset) {
      submissions {
        userId
        email
        nombre
        apellido
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
        kycSubmittedAt
        kycRejectedReason
        createdAt
      }
      total
    }
  }
`;

const APPROVE_KYC = gql`
  mutation ApproveKyc($userId: String!) {
    approveKyc(userId: $userId) {
      userId
      kycStatus
      success
      message
    }
  }
`;

const REJECT_KYC = gql`
  mutation RejectKyc($userId: String!, $reason: String!) {
    rejectKyc(userId: $userId, reason: $reason) {
      userId
      kycStatus
      success
      message
    }
  }
`;

interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: string;
  mpConnectStatus: string;
  kycStatus?: string;
  createdAt: string;
  isDeleted: boolean;
  rafflesCreated: number;
  ticketsPurchased: number;
  rafflesWon: number;
  totalTicketsComprados: number;
  totalRifasGanadas: number;
  totalComprasCompletadas: number;
  disputasComoCompradorAbiertas: number;
  buyerRiskFlags: string[];
}

interface AdminReview {
  id: string;
  rating: number;
  comentario?: string | null;
  createdAt: string;
  reviewerName: string;
  reviewerEmail: string;
  sellerName: string;
  sellerEmail: string;
  raffleTitle: string;
  commentHidden: boolean;
  commentHiddenReason?: string | null;
}

interface KycSubmission {
  userId: string;
  email: string;
  nombre: string;
  apellido: string;
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
  kycSubmittedAt?: string;
  kycRejectedReason?: string;
  createdAt: string;
}

interface UserActivity {
  id: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: string;
  ipAddress?: string;
  createdAt: string;
}

interface Raffle {
  id: string;
  titulo: string;
  estado: string;
  isHidden: boolean;
  hiddenReason?: string;
  totalTickets: number;
  precioPorTicket: number;
  createdAt: string;
  seller: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  };
}

interface Report {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; email: string; nombre: string };
  raffle: { id: string; titulo: string; isHidden: boolean };
}

interface AdminStats {
  totalUsers: number;
  totalRaffles: number;
  activeRaffles: number;
  completedRaffles: number;
  totalTransactions: number;
  totalRevenue: number;
  totalTicketsSold: number;
  totalDisputes: number;
  pendingDisputes: number;
  recentMpEvents: number;
  newUsersToday: number;
  newRafflesToday: number;
}

interface AdminUsersData {
  adminUsers: {
    users: AdminUser[];
    total: number;
  };
}

interface KycPendingData {
  pendingKycSubmissions: {
    submissions: KycSubmission[];
    total: number;
  };
}

interface UserActivityData {
  adminUserActivity: UserActivity[];
}

interface AdminReviewsData {
  adminReviews: {
    reviews: AdminReview[];
    total: number;
  };
}

function formatCompact(n: number | undefined | null, prefix = ''): string {
  if (n == null) return `${prefix}0`;
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n % 1 === 0 ? n : n.toFixed(2)}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('raffles');

  // User management state
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Debounce user search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [hideReviewDialogOpen, setHideReviewDialogOpen] = useState(false);
  const [hideReviewReason, setHideReviewReason] = useState('');

  // KYC state
  const [selectedKyc, setSelectedKyc] = useState<KycSubmission | null>(null);
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const confirmDialog = useConfirmDialog();

  // Parsed reports state
  const [reports, setReports] = useState<Report[]>([]);

  const { data: statsData, loading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<{ adminStats: AdminStats }>(GET_ADMIN_STATS, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
  });

  const { data: rafflesData, loading: rafflesLoading, refetch: refetchRaffles } = useQuery<{ raffles: Raffle[] }>(GET_RAFFLES, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
  });

  const { data: reportsData, loading: reportsLoading, refetch: refetchReports } = useQuery<{ getReports: string }>(GET_REPORTS, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
    variables: { reviewed: false },
  });

  // Parse reports data when it changes
  useEffect(() => {
    if (reportsData?.getReports) {
      try {
        const parsed = JSON.parse(reportsData.getReports);
        // JSON parsing requires setState since useMemo can't handle try/catch cleanly
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReports(parsed);
      } catch {
        setReports([]);
      }
    }
  }, [reportsData]);

  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useQuery<AdminUsersData>(GET_ADMIN_USERS, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
    fetchPolicy: 'cache-and-network',
    variables: {
      role: userRoleFilter === 'ALL' ? undefined : userRoleFilter,
      search: debouncedUserSearch.trim() || undefined,
      includeDeleted,
      limit: 50,
    },
  });

  const { data: reviewsData, loading: reviewsLoading, refetch: refetchReviews } = useQuery<AdminReviewsData>(GET_ADMIN_REVIEWS, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
    variables: { includeHidden: true, limit: 50 },
  });

  const { data: kycData, loading: kycLoading, refetch: refetchKyc } = useQuery<KycPendingData>(GET_PENDING_KYC, {
    skip: !hasHydrated || !isAuthenticated || user?.role !== 'ADMIN',
    variables: { limit: 50 },
  });

  const [getUserActivity, { data: activityData, loading: activityLoading }] = useLazyQuery<UserActivityData>(GET_USER_ACTIVITY);

  const [reviewReport, { loading: reviewingReport }] = useMutation(REVIEW_REPORT, {
    onCompleted: () => {
      toast.success('Reporte procesado');
      refetchReports();
      refetchRaffles();
    },
    onError: (err) => toast.error(err.message),
  });

  const [unhideRaffle, { loading: unhiding }] = useMutation(UNHIDE_RAFFLE, {
    onCompleted: () => {
      toast.success('Rifa visible nuevamente');
      refetchRaffles();
      refetchReports();
    },
    onError: (err) => toast.error(err.message),
  });

  const [banUser, { loading: banning }] = useMutation(BAN_USER, {
    onCompleted: () => {
      toast.success('Usuario baneado correctamente');
      setBanDialogOpen(false);
      setBanReason('');
      setSelectedUser(null);
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  const [unbanUser, { loading: unbanning }] = useMutation(UNBAN_USER, {
    onCompleted: () => {
      toast.success('Usuario desbaneado correctamente');
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  const [hideReviewComment, { loading: hidingReview }] = useMutation(HIDE_REVIEW_COMMENT, {
    onCompleted: () => {
      toast.success('Comentario ocultado');
      setHideReviewDialogOpen(false);
      setSelectedReview(null);
      setHideReviewReason('');
      refetchReviews();
    },
    onError: (err) => toast.error(err.message),
  });

  const [approveKyc, { loading: approving }] = useMutation(APPROVE_KYC, {
    onCompleted: () => {
      toast.success('KYC aprobado exitosamente');
      setKycDialogOpen(false);
      refetchKyc();
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  const [rejectKyc, { loading: rejecting }] = useMutation(REJECT_KYC, {
    onCompleted: () => {
      toast.success('KYC rechazado');
      setRejectDialogOpen(false);
      setRejectReason('');
      refetchKyc();
      refetchUsers();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  const isAuthorized = hasHydrated && isAuthenticated && user?.role === 'ADMIN';

  const handleHideRaffle = async (raffleId: string, reportId?: string) => {
    const reason = prompt('Razón para ocultar esta rifa:');
    if (!reason) return;

    if (reportId) {
      await reviewReport({ variables: { reportId, adminNotes: reason, action: 'HIDE_RAFFLE' } });
    } else {
      // If no reportId, we need to create a way to hide directly
      // For now, use reviewReport with a fake report or handle differently
      toast.error('Para ocultar una rifa, debe hacerlo desde un reporte');
    }
  };

  const handleUnhideRaffle = async (raffleId: string) => {
    const reason = prompt('Razón para mostrar esta rifa:');
    if (!reason) return;
    await unhideRaffle({ variables: { raffleId, adminNotes: reason } });
  };

  const handleDismissReport = async (reportId: string) => {
    await reviewReport({ variables: { reportId, adminNotes: 'Dismissed by admin', action: 'DISMISS' } });
  };

  const handleViewActivity = (u: AdminUser) => {
    setSelectedUser(u);
    getUserActivity({ variables: { userId: u.id, limit: 50 } });
    setActivityDialogOpen(true);
  };

  const handleBanClick = (u: AdminUser) => {
    setSelectedUser(u);
    setBanDialogOpen(true);
  };

  const handleBanUser = () => {
    if (!selectedUser || !banReason.trim()) return;
    banUser({ variables: { userId: selectedUser.id, reason: banReason } });
  };

  const handleHideReviewClick = (review: AdminReview) => {
    setSelectedReview(review);
    setHideReviewReason('');
    setHideReviewDialogOpen(true);
  };

  const handleHideReviewConfirm = () => {
    if (!selectedReview || !hideReviewReason.trim()) return;
    hideReviewComment({
      variables: {
        reviewId: selectedReview.id,
        reason: hideReviewReason.trim(),
      },
    });
  };

  const handleUnbanUser = async (u: AdminUser) => {
    const confirmed = await confirmDialog({
      title: '¿Desbanear usuario?',
      description: `El usuario ${u.email} podrá volver a usar la plataforma normalmente.`,
      confirmText: 'Desbanear',
      cancelText: 'Cancelar',
      variant: 'default',
    });
    if (confirmed) {
      unbanUser({ variables: { userId: u.id, reason: 'Admin unban' } });
    }
  };

  const handleViewKyc = (submission: KycSubmission) => {
    setSelectedKyc(submission);
    setKycDialogOpen(true);
  };

  const handleApproveKyc = async () => {
    if (!selectedKyc) return;
    const confirmed = await confirmDialog({
      title: '¿Aprobar verificación KYC?',
      description: `El usuario ${selectedKyc.email} quedará verificado y podrá operar sin restricciones.`,
      confirmText: 'Aprobar KYC',
      cancelText: 'Cancelar',
      variant: 'default',
    });
    if (!confirmed) return;
    approveKyc({ variables: { userId: selectedKyc.userId } });
  };

  const handleRejectKycClick = (submission: KycSubmission) => {
    setSelectedKyc(submission);
    setRejectDialogOpen(true);
  };

  const handleRejectKyc = () => {
    if (!selectedKyc || rejectReason.trim().length < 10) {
      toast.error('Razón debe tener al menos 10 caracteres');
      return;
    }
    rejectKyc({ variables: { userId: selectedKyc.userId, reason: rejectReason } });
  };

  if (!hasHydrated || !isAuthorized) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const loading = statsLoading || rafflesLoading || reportsLoading;
  const error = statsError;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p>Error loading admin data: {error.message}</p>
          <Button onClick={() => { refetchStats(); refetchRaffles(); refetchReports(); }} className="mt-4">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const users = usersData?.adminUsers?.users || [];
  const totalUsers = usersData?.adminUsers?.total || 0;
  const raffles = rafflesData?.raffles || [];
  const stats = statsData?.adminStats;

  const hiddenRaffles = raffles.filter((r) => r.isHidden);
  const activities: UserActivity[] = activityData?.adminUserActivity || [];
  const reviews: AdminReview[] = reviewsData?.adminReviews?.reviews || [];
  const totalReviews = reviewsData?.adminReviews?.total || 0;

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-[2.2rem] border border-border/80 bg-mesh px-6 py-7 shadow-panel sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-primary text-primary-foreground shadow-lift">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <p className="editorial-kicker text-primary">Admin / Control</p>
            <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Panel de Administracion</h1>
            <p className="mt-3 text-muted-foreground">Gestion de usuarios, rifas y reportes</p>
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{formatCompact(stats?.totalRevenue, '$')}</p>
                <p className="text-xs text-muted-foreground">Ingresos Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <Users className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Usuarios</p>
                {stats?.newUsersToday ? (
                  <p className="text-xs text-success">+{stats.newUsersToday} hoy</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <Ticket className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{formatCompact(stats?.totalTicketsSold)}</p>
                <p className="text-xs text-muted-foreground">Tickets Vendidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeRaffles || 0}</p>
                <p className="text-xs text-muted-foreground">Rifas Activas</p>
                {stats?.newRafflesToday ? (
                  <p className="text-xs text-success">+{stats.newRafflesToday} hoy</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <EyeOff className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{hiddenRaffles.length}</p>
                <p className="text-xs text-muted-foreground">Rifas Ocultas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex min-h-[120px] items-center !p-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.pendingDisputes || 0}</p>
                <p className="text-xs text-muted-foreground">Disputas Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="bg-muted/50">
          <CardContent className="flex min-h-[84px] items-center !p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Total Rifas</span>
              <span className="font-semibold">{stats?.totalRaffles || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="flex min-h-[84px] items-center !p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Completadas</span>
              <span className="font-semibold">{stats?.completedRaffles || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="flex min-h-[84px] items-center !p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Transacciones</span>
              <span className="font-semibold">{formatCompact(stats?.totalTransactions)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="flex min-h-[84px] items-center !p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Eventos MP (24h)</span>
              <span className="font-semibold flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {stats?.recentMpEvents || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="kyc">KYC ({kycData?.pendingKycSubmissions?.total || 0})</TabsTrigger>
          <TabsTrigger value="raffles">Rifas ({raffles.length})</TabsTrigger>
          <TabsTrigger value="reports">Reportes ({reports.length})</TabsTrigger>
          <TabsTrigger value="disputes">Disputas ({statsData?.adminStats?.pendingDisputes || 0})</TabsTrigger>
          <TabsTrigger value="users">Usuarios ({totalUsers})</TabsTrigger>
          <TabsTrigger value="reviews">Reseñas ({totalReviews})</TabsTrigger>
          <TabsTrigger value="social-promotions">Promoción Social</TabsTrigger>
        </TabsList>

        {/* KYC Tab */}
        <TabsContent value="kyc">
          <Card>
            <CardHeader>
              <CardTitle>Verificaciones KYC Pendientes</CardTitle>
              <CardDescription>Revisar y aprobar/rechazar solicitudes de verificación</CardDescription>
            </CardHeader>
            <CardContent>
              {kycLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (kycData?.pendingKycSubmissions?.submissions || []).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto mb-2 h-12 w-12 text-success" />
                  <p className="text-muted-foreground">No hay verificaciones KYC pendientes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(kycData?.pendingKycSubmissions?.submissions || []).map((submission: KycSubmission) => (
                    <div
                      key={submission.userId}
                      className="flex flex-col gap-3 rounded-[1.35rem] border border-primary/22 bg-primary/6 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <h3 className="font-medium">{submission.nombre} {submission.apellido}</h3>
                        <p className="text-sm text-muted-foreground">{submission.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Solicitado: {new Date(submission.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewKyc(submission)}
                        >
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raffles Tab */}
        <TabsContent value="raffles">
          <Card>
            <CardHeader>
              <CardTitle>Todas las Rifas</CardTitle>
              <CardDescription>Gestionar visibilidad de rifas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {raffles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No hay rifas</p>
                ) : (
                  raffles.map((raffle) => (
                    <div
                      key={raffle.id}
                      className={`rounded-[1.35rem] border p-4 ${
                        raffle.isHidden ? 'border-secondary/35 bg-secondary/12' : 'border-border/80'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{raffle.titulo}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              raffle.estado === 'ACTIVA'
                                ? 'bg-primary/15 text-primary'
                                : raffle.estado === 'SORTEADA'
                                ? 'bg-accent/15 text-accent'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {raffle.estado}
                          </span>
                          {raffle.isHidden && (
                            <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs text-secondary-foreground dark:text-secondary">
                              OCULTA
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Por: {raffle.seller.nombre} {raffle.seller.apellido} ({raffle.seller.email})
                        </p>
                        {raffle.hiddenReason && (
                          <p className="mt-1 text-xs text-secondary-foreground dark:text-secondary">Razon: {raffle.hiddenReason}</p>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2 sm:mt-0">
                        {raffle.isHidden && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnhideRaffle(raffle.id)}
                            disabled={unhiding}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Mostrar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reportes Pendientes</CardTitle>
              <CardDescription>Revisar y gestionar reportes de usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto mb-2 h-12 w-12 text-success" />
                    <p className="text-muted-foreground">No hay reportes pendientes</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded-[1.35rem] border border-destructive/30 bg-destructive/6 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-medium">Rifa: {report.raffle.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            Reportado por: {report.reporter.email}
                          </p>
                          <p className="text-sm mt-2">
                            <span className="font-medium">Razon:</span> {report.reason}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleHideRaffle(report.raffle.id, report.id)}
                            disabled={reviewingReport}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Ocultar Rifa
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissReport(report.id)}
                            disabled={reviewingReport}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Descartar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle>Resolución de Disputas</CardTitle>
              <CardDescription>Mediar y resolver disputas entre compradores y vendedores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Panel completo de resolución de disputas disponible
                </p>
                <Button onClick={() => router.push('/admin/disputes')} size="lg">
                  Abrir Panel de Disputas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Gestion de Usuarios</CardTitle>
              <CardDescription>Buscar, filtrar y gestionar usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por email, nombre..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="USER">Usuario</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="BANNED">Baneado</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={includeDeleted ? 'secondary' : 'outline'}
                  onClick={() => setIncludeDeleted(!includeDeleted)}
                  size="sm"
                >
                  {includeDeleted ? 'Ocultando eliminados' : 'Mostrar eliminados'}
                </Button>
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Mobile: Card layout */}
                  <div className="md:hidden space-y-3">
                    {users.map((u) => (
                      <div key={u.id} className={`space-y-2 rounded-[1.35rem] border p-4 ${u.role === 'BANNED' ? 'border-destructive/40 bg-destructive/6' : 'border-border/80'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate flex-1">{u.email}</span>
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                              u.role === 'ADMIN'
                                ? 'bg-accent/15 text-accent'
                                : u.role === 'BANNED'
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{u.nombre} {u.apellido}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Rifas: {u.rafflesCreated} | Tickets: {u.totalTicketsComprados} | Ganadas: {u.totalRifasGanadas} | Disputas: {u.disputasComoCompradorAbiertas}
                        </div>
                        {u.buyerRiskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {u.buyerRiskFlags.map((flag) => (
                              <span key={flag} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700">
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewActivity(u)}>
                            <History className="h-3 w-3 mr-1" />
                            Actividad
                          </Button>
                          {u.role === 'BANNED' ? (
                            <Button size="sm" variant="outline" onClick={() => handleUnbanUser(u)} disabled={unbanning}>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Desbanear
                            </Button>
                          ) : u.role !== 'ADMIN' ? (
                            <Button size="sm" variant="destructive" onClick={() => handleBanClick(u)}>
                              <UserX className="h-3 w-3 mr-1" />
                              Banear
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table layout */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Nombre</th>
                          <th className="text-left p-2">Rol</th>
                          <th className="text-left p-2">MP</th>
                          <th className="text-left p-2">Comprador</th>
                          <th className="text-left p-2">Registro</th>
                          <th className="text-left p-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id} className={`border-b hover:bg-muted/50 ${u.role === 'BANNED' ? 'bg-destructive/6' : ''}`}>
                            <td className="p-2">{u.email}</td>
                            <td className="p-2">
                              {u.nombre} {u.apellido}
                            </td>
                            <td className="p-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                  u.role === 'ADMIN'
                                    ? 'bg-accent/15 text-accent'
                                    : u.role === 'BANNED'
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`text-xs ${u.mpConnectStatus === 'CONNECTED' ? 'text-success' : 'text-muted-foreground'}`}>
                                {u.mpConnectStatus}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              <div>
                                T:{u.totalTicketsComprados} W:{u.totalRifasGanadas} C:{u.totalComprasCompletadas} D:{u.disputasComoCompradorAbiertas}
                              </div>
                              {u.buyerRiskFlags.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {u.buyerRiskFlags.map((flag) => (
                                    <span key={flag} className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700">
                                      {flag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleViewActivity(u)}>
                                  <History className="h-4 w-4" />
                                </Button>
                                {u.role === 'BANNED' ? (
                                  <Button size="sm" variant="ghost" onClick={() => handleUnbanUser(u)} disabled={unbanning}>
                                    <UserCheck className="h-4 w-4 text-success" />
                                  </Button>
                                ) : u.role !== 'ADMIN' ? (
                                  <Button size="sm" variant="ghost" onClick={() => handleBanClick(u)}>
                                    <UserX className="h-4 w-4 text-red-600" />
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-sm text-muted-foreground mt-4">
                    Mostrando {users.length} de {totalUsers} usuarios
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Moderación de reseñas</CardTitle>
              <CardDescription>
                Revisá comentarios públicos sin modificar el rating que impacta la reputación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay reseñas para mostrar.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{review.raffleTitle}</span>
                            <span className="flex items-center gap-1 text-amber-500 text-sm">
                              <Star className="h-4 w-4 fill-current" />
                              {review.rating}/5
                            </span>
                            {review.commentHidden && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                Comentario oculto
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Comprador: {review.reviewerName} ({review.reviewerEmail}) · Vendedor: {review.sellerName} ({review.sellerEmail})
                          </p>
                          <p className="text-sm">
                            {review.commentHidden
                              ? `Motivo: ${review.commentHiddenReason || 'Sin motivo registrado'}`
                              : review.comentario || 'Sin comentario escrito.'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleString('es-AR')}
                          </p>
                        </div>
                        {!review.commentHidden && review.comentario && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHideReviewClick(review)}
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Ocultar comentario
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social-promotions">
          <div className="space-y-6">
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  Performance visible, conversiones atribuidas y grants emitidos por post promocional.
                </p>
              </div>
              <SocialPromotionAnalytics />
            </section>
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Revisión técnica / Reversals
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cola técnica para moderación admin y log de grants revertidos.
                </p>
              </div>
              <SocialPromotionReview />
              <PromotionGrantReversalLog />
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Activity Dialog */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Actividad de {selectedUser?.email}</DialogTitle>
          </DialogHeader>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Sin actividad registrada</p>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {a.targetType && (
                      <p className="text-xs text-muted-foreground">
                        {a.targetType}: {a.targetId}
                      </p>
                    )}
                    {a.metadata && (
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                        {a.metadata}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Moderation Dialog */}
      <Dialog open={hideReviewDialogOpen} onOpenChange={setHideReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ocultar comentario de reseña</DialogTitle>
            <DialogDescription>
              Sólo se oculta el texto público; el rating se mantiene en la reputación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              El rating de {selectedReview?.rating}/5 se mantiene para la reputación. Sólo se oculta el texto público.
            </p>
            <Input
              placeholder="Motivo de moderación..."
              value={hideReviewReason}
              onChange={(event) => setHideReviewReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setHideReviewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleHideReviewConfirm}
              disabled={hidingReview || !hideReviewReason.trim()}
            >
              {hidingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ocultar comentario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Banear Usuario</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Baneando a: <strong>{selectedUser?.email}</strong>
            </p>
            <Input
              placeholder="Razon del ban..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBanUser} disabled={banning || !banReason.trim()}>
              {banning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Ban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC Review Dialog */}
      <Dialog open={kycDialogOpen} onOpenChange={setKycDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Verificación KYC</DialogTitle>
          </DialogHeader>
          {selectedKyc && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Nombre</span>
                  <p className="font-medium">{selectedKyc.nombre} {selectedKyc.apellido}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Email</span>
                  <p className="font-medium">{selectedKyc.email}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Tipo de Documento</span>
                  <p className="font-medium">{selectedKyc.documentType || 'No especificado'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Número de Documento</span>
                  <p className="font-medium">{selectedKyc.documentNumber || 'No especificado'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Dirección</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Calle</span>
                    <p>{selectedKyc.street || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Número</span>
                    <p>{selectedKyc.streetNumber || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Apartamento</span>
                    <p>{selectedKyc.apartment || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ciudad</span>
                    <p>{selectedKyc.city || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Provincia</span>
                    <p>{selectedKyc.province || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Código Postal</span>
                    <p>{selectedKyc.postalCode || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Información Adicional</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Teléfono</span>
                    <p>{selectedKyc.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CUIT/CUIL</span>
                    <p>{selectedKyc.cuitCuil || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKycDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setKycDialogOpen(false);
                handleRejectKycClick(selectedKyc!);
              }}
              disabled={rejecting}
            >
              Rechazar
            </Button>
            <Button
              onClick={handleApproveKyc}
              disabled={approving}
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Aprobar KYC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Verificación KYC</DialogTitle>
          </DialogHeader>
          {selectedKyc && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Rechazando solicitud de: <strong>{selectedKyc.email}</strong>
              </p>
              <Input
                placeholder="Razón del rechazo (mín. 10 caracteres)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {rejectReason.length} caracteres
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectDialogOpen(false); setRejectReason(''); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectKyc}
              disabled={rejecting || rejectReason.trim().length < 10}
            >
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
