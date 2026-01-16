'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroCTA() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="flex flex-col sm:flex-row justify-center gap-4 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
      <Link href="/search">
        <Button size="lg" className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group">
          Explorar Rifas
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </Link>
      {isAuthenticated ? (
        <Link href="/dashboard/create">
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-xl border-2 hover:bg-primary/5 transition-all duration-300 group">
            <Sparkles className="mr-2 w-5 h-5" />
            Crear una Rifa
          </Button>
        </Link>
      ) : (
        <Link href="/auth/register">
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-xl border-2 hover:bg-primary/5 transition-all duration-300">
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
      <Button size="lg" variant="secondary" className="text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group">
        {isAuthenticated ? "Crear mi Rifa" : "Empezar a Vender"}
        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </Button>
    </Link>
  );
}
