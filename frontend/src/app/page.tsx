import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, Users, Shield, Zap, Star, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { HeroCTA, SellerCTA } from '@/components/home/hero-cta';
import { FeaturedRaffles } from '@/components/home/featured-raffles';
import { ComplianceNotice } from '@/components/legal/compliance-notice';
import {
  BRAND_NAME,
  BRAND_DESCRIPTION,
  BRAND_TAGLINE,
} from '@/lib/brand';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-mesh">
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-24 left-[12%] w-16 h-16 animate-float delay-1 opacity-40">
            <div className="w-full h-full rounded-2xl bg-primary/20 rotate-12" />
          </div>
          <div className="absolute top-40 right-[18%] w-12 h-12 animate-float delay-2 opacity-30">
            <div className="w-full h-full rounded-full bg-secondary/25" />
          </div>
          <div className="absolute bottom-36 left-[22%] w-10 h-10 animate-float delay-3 opacity-35">
            <Star className="w-full h-full text-secondary/40" />
          </div>
          <div className="absolute top-1/3 right-[10%] w-20 h-20 animate-float delay-4 opacity-25">
            <div className="w-full h-full rounded-3xl bg-primary/10 -rotate-12" />
          </div>
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 mb-8 animate-fade-up delay-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{BRAND_NAME} | {BRAND_TAGLINE}</span>
            </div>

            {/* Main heading */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 animate-fade-up delay-2 text-balance">
              <span className="block text-foreground">Tu suerte</span>
              <span className="block text-primary">empieza acá</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto animate-fade-up delay-3 text-balance">
              {BRAND_DESCRIPTION}{' '}
              <span className="text-foreground font-medium"> 100% seguro y transparente.</span>
            </p>

            {/* CTA Buttons */}
            <HeroCTA />

            {/* Value Props */}
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto animate-fade-up delay-5">
              <div className="text-center">
                <p className="font-display text-2xl md:text-3xl text-primary">100%</p>
                <p className="text-sm text-muted-foreground mt-1">Seguro</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl md:text-3xl text-secondary">24/7</p>
                <p className="text-sm text-muted-foreground mt-1">Disponible</p>
              </div>
              <div className="text-center">
                <p className="font-display text-2xl md:text-3xl text-primary">0%</p>
                <p className="text-sm text-muted-foreground mt-1">Comisión al comprar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl mb-4">
              Por qué <span className="text-primary">elegir {BRAND_NAME}</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {BRAND_NAME} conecta tickets accesibles con premios de alto valor en una experiencia segura y transparente.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Ticket className="h-6 w-6" />}
              title="Fácil de usar"
              description="Comprá tickets en segundos con pagos seguros por Mercado Pago"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="100% seguro"
              description="Todos los pagos están protegidos y los sorteos son verificables"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Comunidad activa"
              description="Conectate con otros usuarios y participá en rifas todos los días"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Sorteos rápidos"
              description="Resultados instantáneos cuando se venden todos los tickets"
            />
          </div>
        </div>
      </section>

      {/* Featured Raffles */}
      <section className="py-24 bg-muted/40 pattern-dots">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
            <div>
              <h2 className="font-display text-3xl md:text-4xl mb-2">
                Rifas <span className="text-primary">destacadas</span>
              </h2>
              <p className="text-muted-foreground">Los premios más codiciados de esta semana</p>
            </div>
            <Link href="/search">
              <Button variant="outline" className="group btn-press">
                Ver todas
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <FeaturedRaffles />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 pattern-dots opacity-[0.08]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 mb-6">
              <Sparkles className="w-4 h-4 text-white/90" />
              <span className="text-sm font-medium text-white/90">Empezá a vender hoy</span>
            </div>

            <h2 className="font-display text-3xl md:text-5xl text-white mb-6 text-balance">
              ¿Tenés algo que rifar?
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-lg mx-auto">
              Creá tu propia rifa, establecé el precio y dejá que nuestra comunidad participe.
              Recibí los pagos directamente en tu cuenta.
            </p>
            <SellerCTA />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Pagos seguros</p>
                <p className="text-sm text-muted-foreground">Powered by Mercado Pago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-secondary/15 flex items-center justify-center">
                <Star className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-medium text-sm">Sorteos transparentes</p>
                <p className="text-sm text-muted-foreground">100% verificables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Ganadores reales</p>
                <p className="text-sm text-muted-foreground">Sorteos al azar</p>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <ComplianceNotice tone="subtle" />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="group card-hover card-shine border hover:border-primary/20 transition-colors">
      <CardHeader className="pb-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform duration-300">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
