'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroCTA() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="flex flex-col gap-4 sm:flex-row animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
      <Link href="/search">
        <Button size="lg" className="group min-w-[220px] btn-press">
          Explorar Rifas
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </Link>
      {isAuthenticated ? (
        <Link href="/dashboard/create">
          <Button size="lg" variant="outline" className="group min-w-[220px] btn-press">
            <Sparkles className="h-5 w-5" />
            Crear una Rifa
          </Button>
        </Link>
      ) : (
        <Link href="/auth/register">
          <Button size="lg" variant="outline" className="min-w-[220px] btn-press">
            Creá tu Cuenta Gratis
          </Button>
        </Link>
      )}
    </div>
  );
}

export function SellerCTA() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Link href={isAuthenticated ? "/dashboard/create" : "/auth/register"}>
      <Button size="lg" variant="secondary" className="group w-full btn-press">
        {isAuthenticated ? "Crear mi Rifa" : "Empezar a Vender"}
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Button>
    </Link>
  );
}
