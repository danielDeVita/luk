'use client';

import { useQuery, useMutation } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Copy, Share2, Loader2, Gift, DollarSign, Check, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { gql } from '@apollo/client';

const GET_REFERRAL_STATS = gql`
  query GetMyReferralStats {
    myReferralStats {
      referralCode
      totalReferred
      totalEarned
      pendingCredits
      availableBalance
    }
  }
`;

const GET_REFERRED_USERS = gql`
  query GetMyReferredUsers {
    myReferredUsers {
      id
      nombre
      apellido
      createdAt
      hasPurchased
      earnedFromUser
    }
  }
`;

const GENERATE_REFERRAL_CODE = gql`
  mutation GenerateReferralCode {
    generateReferralCode
  }
`;

interface ReferralStats {
  referralCode: string | null;
  totalReferred: number;
  totalEarned: number;
  pendingCredits: number;
  availableBalance: number;
}

interface ReferredUser {
  id: string;
  nombre: string;
  apellido: string;
  createdAt: string;
  hasPurchased: boolean;
  earnedFromUser: number;
}

export default function ReferralsPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useQuery<{ myReferralStats: ReferralStats }>(
    GET_REFERRAL_STATS,
    { skip: !isAuthenticated }
  );

  const { data: usersData, loading: usersLoading } = useQuery<{ myReferredUsers: ReferredUser[] }>(
    GET_REFERRED_USERS,
    { skip: !isAuthenticated }
  );

  const [generateCode, { loading: generating }] = useMutation(GENERATE_REFERRAL_CODE, {
    onCompleted: () => {
      toast.success('Codigo de referido generado');
      refetchStats();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) return null;

  const stats = statsData?.myReferralStats;
  const referredUsers = usersData?.myReferredUsers || [];
  const referralLink = stats?.referralCode
    ? `${window.location.origin}/auth/register?ref=${stats.referralCode}`
    : null;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Error al copiar');
    }
  };

  const shareViaWhatsApp = () => {
    if (!referralLink) return;
    const text = encodeURIComponent(`Unite a la plataforma de rifas usando mi codigo: ${stats?.referralCode}\n${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareViaTwitter = () => {
    if (!referralLink) return;
    const text = encodeURIComponent(`Unite a la plataforma de rifas usando mi codigo: ${stats?.referralCode}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  if (statsLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Programa de Referidos</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Amigos invitados</CardDescription>
            <CardTitle className="text-3xl">{stats?.totalReferred || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <UserPlus className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total ganado</CardDescription>
            <CardTitle className="text-3xl text-green-600">${stats?.totalEarned?.toFixed(2) || '0.00'}</CardTitle>
          </CardHeader>
          <CardContent>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balance disponible</CardDescription>
            <CardTitle className="text-3xl text-primary">${stats?.availableBalance?.toFixed(2) || '0.00'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Gift className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credito pendiente</CardDescription>
            <CardTitle className="text-3xl text-amber-600">${stats?.pendingCredits?.toFixed(2) || '0.00'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Loader2 className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tu codigo de referido</CardTitle>
          <CardDescription>
            Comparte tu codigo y gana el 5% de la primera compra de cada amigo que invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.referralCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-muted p-4 rounded-lg text-center">
                  <span className="text-2xl font-mono font-bold tracking-widest">{stats.referralCode}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(stats.referralCode!)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink || ''}
                  className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(referralLink!)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={shareViaWhatsApp} className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button variant="outline" onClick={shareViaTwitter} className="flex-1">
                  <Share2 className="h-4 w-4 mr-2" />
                  Twitter
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">Todavia no tenes un codigo de referido.</p>
              <Button onClick={() => generateCode()} disabled={generating}>
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                Generar mi codigo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referred Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Tus invitados</CardTitle>
          <CardDescription>
            Lista de amigos que se registraron con tu codigo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : referredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Todavia no invitaste a nadie.</p>
              <p className="text-sm">Comparte tu codigo para empezar a ganar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {user.nombre.charAt(0)}{user.apellido.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{user.nombre} {user.apellido}</p>
                      <p className="text-sm text-muted-foreground">
                        Se unio el {new Date(user.createdAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {user.hasPurchased ? (
                      <div>
                        <p className="text-green-600 font-medium">+${user.earnedFromUser.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">ganado</p>
                      </div>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
