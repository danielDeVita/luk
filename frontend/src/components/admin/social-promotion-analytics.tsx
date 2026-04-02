'use client';

import { useState } from 'react';
import { gql } from '@apollo/client/core';
import { useQuery } from '@apollo/client/react';
import { BarChart3, Loader2, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SOCIAL_PROMOTION_ANALYTICS = gql`
  query SocialPromotionAnalytics {
    socialPromotionAnalytics {
      postId
      raffleId
      raffleTitle
      sellerId
      sellerEmail
      network
      status
      submittedPermalink
      canonicalPermalink
      submittedAt
      validatedAt
      settledAt
      likesCount
      commentsCount
      repostsOrSharesCount
      viewsCount
      clicksAttributed
      registrationsAttributed
      ticketPurchasesAttributed
      engagementScore
      conversionScore
      totalScore
      grantIssued
      grantStatus
      grantDiscountPercent
      grantMaxDiscountAmount
    }
  }
`;

type SocialPromotionNetwork = 'FACEBOOK' | 'INSTAGRAM' | 'X';
type SocialPromotionStatus =
  | 'PENDING_VALIDATION'
  | 'ACTIVE'
  | 'TECHNICAL_REVIEW'
  | 'DISQUALIFIED'
  | 'SETTLED';
type PromotionBonusGrantStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'USED'
  | 'EXPIRED'
  | 'REVERSED';

interface SocialPromotionAnalyticsRow {
  postId: string;
  raffleId: string;
  raffleTitle: string;
  sellerId: string;
  sellerEmail: string;
  network: SocialPromotionNetwork;
  status: SocialPromotionStatus;
  submittedPermalink: string;
  canonicalPermalink?: string | null;
  submittedAt: string;
  validatedAt?: string | null;
  settledAt?: string | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  repostsOrSharesCount?: number | null;
  viewsCount?: number | null;
  clicksAttributed?: number | null;
  registrationsAttributed?: number | null;
  ticketPurchasesAttributed?: number | null;
  engagementScore?: number | null;
  conversionScore?: number | null;
  totalScore?: number | null;
  grantIssued: boolean;
  grantStatus?: PromotionBonusGrantStatus | null;
  grantDiscountPercent?: number | null;
  grantMaxDiscountAmount?: number | null;
}

interface SocialPromotionAnalyticsData {
  socialPromotionAnalytics: SocialPromotionAnalyticsRow[];
}

const NETWORK_LABELS: Record<SocialPromotionNetwork, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  X: 'X',
};

const STATUS_LABELS: Record<SocialPromotionStatus, string> = {
  PENDING_VALIDATION: 'Pendiente de validación',
  ACTIVE: 'Activa',
  TECHNICAL_REVIEW: 'Revisión técnica',
  DISQUALIFIED: 'Descalificada',
  SETTLED: 'Liquidada',
};

const GRANT_STATUS_LABELS: Record<PromotionBonusGrantStatus, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Reservado',
  USED: 'Usado',
  EXPIRED: 'Expirado',
  REVERSED: 'Revertido',
};

function formatCount(value?: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-AR').format(value);
}

function formatCurrency(value?: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatScore(value?: number | null): string {
  if (value == null) return '—';
  return value.toFixed(1);
}

function formatRate(numerator?: number | null, denominator?: number | null): string {
  if (!denominator) return '—';
  return `${((Number(numerator ?? 0) / Number(denominator)) * 100).toFixed(1)}%`;
}

function formatTicketsPerRegistration(
  tickets?: number | null,
  registrations?: number | null,
): string {
  if (!registrations) return '—';
  return (Number(tickets ?? 0) / Number(registrations)).toFixed(2);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-AR');
}

export function SocialPromotionAnalytics() {
  const [networkFilter, setNetworkFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch, networkStatus } =
    useQuery<SocialPromotionAnalyticsData>(SOCIAL_PROMOTION_ANALYTICS, {
      notifyOnNetworkStatusChange: true,
    });

  const rows = data?.socialPromotionAnalytics ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (networkFilter !== 'ALL' && row.network !== networkFilter) {
      return false;
    }

    if (statusFilter !== 'ALL' && row.status !== statusFilter) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      row.raffleTitle.toLowerCase().includes(normalizedSearch) ||
      row.sellerEmail.toLowerCase().includes(normalizedSearch)
    );
  });

  const summary = {
    totalPosts: filteredRows.length,
    settledPosts: filteredRows.filter((row) => Boolean(row.settledAt)).length,
    grantIssuedPosts: filteredRows.filter((row) => row.grantIssued).length,
    totalClicks: filteredRows.reduce(
      (sum, row) => sum + Number(row.clicksAttributed ?? 0),
      0,
    ),
    totalRegistrations: filteredRows.reduce(
      (sum, row) => sum + Number(row.registrationsAttributed ?? 0),
      0,
    ),
    totalTickets: filteredRows.reduce(
      (sum, row) => sum + Number(row.ticketPurchasesAttributed ?? 0),
      0,
    ),
  };
  const refreshing = networkStatus === 4;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics de promociones sociales
            </CardTitle>
            <CardDescription>
              CLICK = acceso al tracking link. REGISTRATION = usuario registrado y verificado. PURCHASE = tickets atribuidos.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total de posts
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.totalPosts)}
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Posts liquidados
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.settledPosts)}
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Posts con grant
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.grantIssuedPosts)}
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Clicks atribuidos
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.totalClicks)}
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Registros atribuidos
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.totalRegistrations)}
              </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="flex min-h-[124px] items-center !p-5">
              <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tickets atribuidos
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCount(summary.totalTickets)}
              </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por rifa o seller"
              className="pl-9"
            />
          </div>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Red" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las redes</SelectItem>
              {Object.entries(NETWORK_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando analytics...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            No se pudieron cargar los analytics de promociones sociales.
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay publicaciones que coincidan con los filtros actuales.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredRows.length} de {rows.length} publicaciones.
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-[1400px] w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-3 font-medium">Rifa</th>
                    <th className="p-3 font-medium">Seller</th>
                    <th className="p-3 font-medium">Red</th>
                    <th className="p-3 font-medium">Estado</th>
                    <th className="p-3 font-medium">Visibilidad</th>
                    <th className="p-3 font-medium">Clicks atribuidos</th>
                    <th className="p-3 font-medium">Registros atribuidos</th>
                    <th className="p-3 font-medium">Tickets atribuidos</th>
                    <th className="p-3 font-medium">Ratios</th>
                    <th className="p-3 font-medium">Score conv.</th>
                    <th className="p-3 font-medium">Score total</th>
                    <th className="p-3 font-medium">Grant</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const permalink =
                      row.canonicalPermalink ?? row.submittedPermalink;

                    return (
                      <tr key={row.postId} className="border-t align-top">
                        <td className="p-3">
                          <div className="space-y-1">
                            <p className="font-medium">{row.raffleTitle}</p>
                            <a
                              href={permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="block break-all text-xs text-primary underline-offset-4 hover:underline"
                            >
                              {permalink}
                            </a>
                            <p className="text-xs text-muted-foreground">
                              Enviado: {formatDate(row.submittedAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Liquidado: {formatDate(row.settledAt)}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <p className="font-medium">{row.sellerEmail}</p>
                            <p className="text-xs text-muted-foreground">
                              Seller ID: {row.sellerId}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">{NETWORK_LABELS[row.network]}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {STATUS_LABELS[row.status]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>Views: {formatCount(row.viewsCount)}</p>
                            <p>Likes: {formatCount(row.likesCount)}</p>
                            <p>Comentarios: {formatCount(row.commentsCount)}</p>
                            <p>Shares: {formatCount(row.repostsOrSharesCount)}</p>
                          </div>
                        </td>
                        <td className="p-3">{formatCount(row.clicksAttributed)}</td>
                        <td className="p-3">{formatCount(row.registrationsAttributed)}</td>
                        <td className="p-3">{formatCount(row.ticketPurchasesAttributed)}</td>
                        <td className="p-3">
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>
                              Reg/click:{' '}
                              {formatRate(
                                row.registrationsAttributed,
                                row.clicksAttributed,
                              )}
                            </p>
                            <p>
                              Tickets/click:{' '}
                              {formatRate(
                                row.ticketPurchasesAttributed,
                                row.clicksAttributed,
                              )}
                            </p>
                            <p>
                              Tickets/reg:{' '}
                              {formatTicketsPerRegistration(
                                row.ticketPurchasesAttributed,
                                row.registrationsAttributed,
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">{formatScore(row.conversionScore)}</td>
                        <td className="p-3">
                          {row.totalScore == null ? (
                            <span className="text-xs text-muted-foreground">
                              Sin settlement todavía
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-medium">
                                {formatScore(row.totalScore)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Engagement: {formatScore(row.engagementScore)}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {row.grantIssued ? (
                            <div className="space-y-1">
                              <Badge variant="secondary">
                                {row.grantStatus
                                  ? GRANT_STATUS_LABELS[row.grantStatus]
                                  : 'Grant emitido'}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {row.grantDiscountPercent}% hasta{' '}
                                {formatCurrency(row.grantMaxDiscountAmount)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Sin grant
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
