'use client';

import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { User, Calendar, Loader2, Ticket, BadgeCheck, Star } from 'lucide-react';
import { RaffleCard } from '@/components/raffle/raffle-card';
import {
  GET_SELLER_PROFILE_QUERY,
  type SellerProfileQueryData,
} from './seller-profile.shared';

const GET_SELLER_PROFILE = gql(GET_SELLER_PROFILE_QUERY);

export function SellerProfileContent({ sellerId }: { sellerId: string }) {
  const { data, loading, error } = useQuery<SellerProfileQueryData>(GET_SELLER_PROFILE, {
    variables: { id: sellerId },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.sellerProfile) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
        Vendedor no encontrado
      </div>
    );
  }

  const profile = data.sellerProfile;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center mb-12 text-center space-y-4">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">
            {profile.nombre} {profile.apellido}
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Miembro desde {new Date(profile.createdAt).toLocaleDateString('es-AR')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {profile.isVerified && (
            <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 border border-green-200 dark:border-green-800">
              <BadgeCheck className="h-4 w-4" />
              Vendedor verificado
            </div>
          )}
          <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-yellow-200 dark:border-yellow-800">
            Nivel: {profile.nivelVendedor}
          </div>
          <div className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-blue-200 dark:border-blue-800">
            {profile.totalVentas} ventas
          </div>
          <div className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 border border-amber-200 dark:border-amber-800">
            <Star className="h-4 w-4 fill-current" />
            {profile.reputation ? profile.reputation.toFixed(1) : 'Sin rating'} · {profile.reviewCount} reseñas
          </div>
        </div>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          Reseñas del vendedor
        </h2>

        {profile.reviews.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Este vendedor todavía no tiene reseñas públicas.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-1 text-amber-500" aria-label={`${review.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${index < review.rating ? 'fill-current' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {review.comentario || 'Sin comentario escrito.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {review.reviewerName} · {review.raffleTitle}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Rifas publicadas
        </h2>

        {profile.raffles.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Este usuario no tiene rifas públicas activas.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {profile.raffles.map((raffle) => (
              <RaffleCard
                key={raffle.id}
                raffle={{
                  ...raffle,
                  product: raffle.product ?? undefined,
                  seller: raffle.seller ?? undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
