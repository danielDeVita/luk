import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Rifas digitales seguras y transparentes',
  description: BRAND_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
    type: 'website',
    url: '/',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
    description: BRAND_DESCRIPTION,
  },
};

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden pb-12 pt-8 sm:pt-12">
        <div className="container mx-auto px-4">
          <div className="bg-mesh overflow-hidden rounded-[2.5rem] border border-border/80 px-5 py-8 shadow-panel sm:px-8 sm:py-10 lg:px-10 lg:py-14">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-end">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 animate-fade-up delay-1">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {BRAND_NAME} | {BRAND_TAGLINE}
                  </span>
                </div>

                <div className="space-y-5">
                  <h1 className="font-display text-5xl leading-[0.92] tracking-[-0.07em] text-balance text-foreground sm:text-6xl lg:text-[6.3rem] animate-fade-up delay-2">
                    <span className="block">Tu suerte</span>
                    <span className="block text-primary">empieza acá</span>
                  </h1>
                  <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl animate-fade-up delay-3">
                    {BRAND_DESCRIPTION}{' '}
                    <span className="font-semibold text-foreground">
                      100% seguro y transparente.
                    </span>
                  </p>
                </div>

                <HeroCTA />

                <div className="grid gap-4 sm:grid-cols-3 animate-fade-up delay-5">
                  <div className="rounded-[1.6rem] border border-border/80 bg-card/88 p-5 shadow-lift">
                    <p className="editorial-kicker text-muted-foreground">Seguro</p>
                    <p className="mt-3 font-display text-4xl text-primary">100%</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-border/80 bg-card/88 p-5 shadow-lift">
                    <p className="editorial-kicker text-muted-foreground">Disponible</p>
                    <p className="mt-3 font-display text-4xl text-secondary">24/7</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-border/80 bg-card/88 p-5 shadow-lift">
                    <p className="editorial-kicker text-muted-foreground">Comisión al comprar</p>
                    <p className="mt-3 font-display text-4xl text-primary">0%</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:pb-2">
                <Card className="bg-card/95">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-3xl">
                      Elegí una rifa, comprá tu ticket y seguí todo el proceso sin vueltas.
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[1.35rem] border border-border/80 bg-background/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Compra</p>
                        <p className="mt-3 font-display text-3xl text-foreground">Simple</p>
                      </div>
                      <div className="rounded-[1.35rem] border border-border/80 bg-background/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Seguimiento</p>
                        <p className="mt-3 font-display text-3xl text-secondary">Claro</p>
                      </div>
                    </div>
                    <div className="rounded-[1.35rem] border border-border/80 bg-primary p-5 text-primary-foreground shadow-lift">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/80">Transparencia</p>
                      <p className="mt-3 text-base leading-relaxed">
                        Pagos protegidos, reglas claras y rifas verificables en una sola plataforma.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.6rem] border border-border/80 bg-secondary p-5 text-secondary-foreground shadow-lift">
                    <Star className="h-5 w-5" />
                    <p className="mt-5 font-display text-2xl">Comunidad activa</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-border/80 bg-accent p-5 text-accent-foreground shadow-lift">
                    <Sparkles className="h-5 w-5" />
                    <p className="mt-5 font-display text-2xl">Premios reales</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="mb-14 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-end">
            <div>
              <p className="editorial-kicker text-primary">Por qué elegir {BRAND_NAME}</p>
              <h2 className="mt-4 font-display text-4xl leading-none text-balance sm:text-5xl">
                A veces, algo grande empieza con una entrada chica.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Participá por premios reales, seguí el avance de cada rifa y comprá con pagos protegidos de punta a punta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              icon={<Ticket className="h-6 w-6" />}
              title="Fácil de usar"
              description="Comprá tickets en segundos con pagos seguros integrados"
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

      <section className="pattern-dots py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-end">
            <div className="rounded-[2rem] border border-border/80 bg-card/90 p-6 shadow-panel">
              <p className="editorial-kicker text-primary">Rifas destacadas</p>
              <h2 className="mt-4 font-display text-4xl leading-none">Los premios más codiciados de esta semana</h2>
              <Link href="/search" className="mt-6 inline-flex">
                <Button variant="outline" className="group btn-press">
                  Ver todas
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
            <div className="rounded-[2rem] border border-dashed border-border/80 px-6 py-6 text-sm leading-relaxed text-muted-foreground">
              Explorá rifas activas con tickets accesibles, progreso visible y tiempos claros.
            </div>
          </div>

          <FeaturedRaffles />
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-[2.5rem] border border-border/80 bg-primary shadow-panel">
            <div className="grid gap-8 px-6 py-10 text-primary-foreground sm:px-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:py-14">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/8 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-primary-foreground/90" />
                  <span className="text-sm font-semibold text-primary-foreground/90">Empezá a vender hoy</span>
                </div>
                <div className="space-y-4">
                  <h2 className="font-display text-4xl leading-none text-balance sm:text-5xl">
                    ¿Tenés algo que rifar?
                  </h2>
                  <p className="max-w-2xl text-lg leading-relaxed text-primary-foreground/82">
                    Creá tu propia rifa, establecé el precio y dejá que nuestra comunidad participe. Recibí los pagos directamente en tu cuenta.
                  </p>
                </div>
              </div>
              <div className="rounded-[2rem] border border-primary-foreground/20 bg-primary-foreground/10 p-6 backdrop-blur-sm">
                <SellerCTA />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-card/90 shadow-lift">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Pagos seguros</p>
                <p className="text-sm text-muted-foreground">Pagos seguros integrados</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-card/90 shadow-lift">
                <Star className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Sorteos transparentes</p>
                <p className="text-sm text-muted-foreground">100% verificables</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-card/90 shadow-lift">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Ganadores reales</p>
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
    <Card className="group card-hover card-shine overflow-hidden border-border/80 transition-colors hover:border-primary/30">
      <CardHeader className="pb-4">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-border/80 bg-background/70 text-primary transition-transform duration-300 group-hover:-translate-y-1">
          {icon}
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
