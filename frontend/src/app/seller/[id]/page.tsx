'use client';

import { use } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { User, Calendar, Loader2, Ticket, BadgeCheck } from 'lucide-react';
import { RaffleCard } from '@/components/raffle/raffle-card';

const GET_SELLER_PROFILE = gql`
  query GetSellerProfile($id: String!) {
    sellerProfile(id: $id) {
      id
      nombre
      apellido
      createdAt
      totalVentas
      nivelVendedor
      isVerified
      raffles {
        id
        titulo
        descripcion
        totalTickets
        precioPorTicket
        estado
        fechaLimiteSorteo
        createdAt
        product {
          imagenes
        }
      }
    }
  }
`;

interface SellerRaffle {
  id: string;
  titulo: string;
  precioPorTicket: number;
  totalTickets: number;
  ticketsVendidos: number;
  fechaLimiteSorteo: string;
  estado: string;
  lastPriceDropAt?: string;
  product?: {
    nombre: string;
    imagenes: string[];
    condicion: string;
  };
  seller?: {
    nombre: string;
    apellido: string;
  };
}

interface SellerProfileData {
  sellerProfile: {
    id: string;
    nombre: string;
    apellido: string;
    createdAt: string;
    totalVentas: number;
    nivelVendedor: string;
    isVerified: boolean;
    raffles: SellerRaffle[];
  };
}

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, loading, error } = useQuery<SellerProfileData>(GET_SELLER_PROFILE, {
    variables: { id },
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
      {/* Header */}
      <div className="flex flex-col items-center justify-center mb-12 text-center space-y-4">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>
        
        <div>
          <h1 className="text-3xl font-bold mb-2">{profile.nombre} {profile.apellido}</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Miembro desde {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Reputation Badges */}
        <div className="flex flex-wrap gap-3 justify-center">
          {profile.isVerified && (
            <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 border border-green-200 dark:border-green-800">
              <BadgeCheck className="h-4 w-4" />
              Vendedor Verificado
            </div>
          )}
          <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-yellow-200 dark:border-yellow-800">
            ⭐ Nivel: {profile.nivelVendedor}
          </div>
          <div className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-blue-200 dark:border-blue-800">
            🤝 {profile.totalVentas} Ventas
          </div>
        </div>
      </div>

      {/* Raffles */}
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Rifas Publicadas
        </h2>
        
        {profile.raffles.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Este usuario no tiene rifas públicas activas.</p>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {profile.raffles.map((raffle) => (
              <RaffleCard key={raffle.id} raffle={raffle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
