'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { toast } from 'sonner';
import {
  Megaphone,
  Copy,
  Loader2,
  ArrowLeft,
  Link2,
  BadgeCheck,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getOptimizedImageUrl, CLOUDINARY_PRESETS } from '@/lib/cloudinary';

const START_SOCIAL_PROMOTION_DRAFT = gql`
  mutation StartSocialPromotionDraft($raffleId: String!, $network: SocialPromotionNetwork!) {
    startSocialPromotionDraft(raffleId: $raffleId, network: $network) {
      id
      trackingUrl
      promotionToken
      suggestedCopy
      expiresAt
      network
    }
  }
`;

const SUBMIT_SOCIAL_PROMOTION_POST = gql`
  mutation SubmitSocialPromotionPost($draftId: String!, $permalink: String!) {
    submitSocialPromotionPost(draftId: $draftId, permalink: $permalink) {
      id
      status
      canonicalPermalink
      disqualificationReason
    }
  }
`;

const NETWORK_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  X: 'X',
  THREADS: 'Threads',
};

const NETWORK_PERMALINK_PLACEHOLDERS: Record<string, string> = {
  FACEBOOK: 'https://www.facebook.com/share/p/...',
  INSTAGRAM: 'https://www.instagram.com/p/...',
  X: 'https://x.com/tu-usuario/status/...',
  THREADS: 'https://www.threads.net/@tu-usuario/post/...',
};

const INSTAGRAM_ASSET_DIMENSIONS = {
  width: 1080,
  height: 1350,
};

interface PromotionSnapshot {
  checkedAt: string;
  likesCount?: number;
  commentsCount?: number;
  repostsOrSharesCount?: number;
  viewsCount?: number;
}

export interface PromotionPost {
  id: string;
  network: string;
  status: string;
  canonicalPermalink?: string;
  submittedPermalink: string;
  disqualificationReason?: string;
  snapshots?: PromotionSnapshot[];
}

interface DraftResult {
  startSocialPromotionDraft: {
    id: string;
    trackingUrl: string;
    promotionToken: string;
    suggestedCopy?: string;
    expiresAt: string;
    network: string;
  };
}

interface SubmitResult {
  submitSocialPromotionPost: {
    id: string;
    status: string;
    canonicalPermalink?: string;
    disqualificationReason?: string;
  };
}

interface Props {
  raffleId: string;
  raffleTitle: string;
  raffleImages: string[];
  ticketPrice: number;
  posts: PromotionPost[];
  onChanged: () => Promise<unknown> | void;
  helperText?: string;
  showSummary?: boolean;
  showHelperText?: boolean;
}

export function SocialPromotionPostsSummary({
  posts,
  className,
}: {
  posts: PromotionPost[];
  className?: string;
}) {
  const latestPosts = [...posts].sort((a, b) => a.network.localeCompare(b.network));

  if (latestPosts.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Publicaciones registradas</p>
        <p className="text-xs text-muted-foreground">
          {latestPosts.length} {latestPosts.length === 1 ? 'post' : 'posts'}
        </p>
      </div>
      <div className="space-y-2">
        {latestPosts.map((post) => {
          const latestSnapshot = post.snapshots?.[0];
          return (
            <div key={post.id} className="rounded-md border bg-background px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {NETWORK_LABELS[post.network] || post.network}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {post.canonicalPermalink || post.submittedPermalink}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border bg-muted px-2 py-1 text-[11px] font-medium">
                  {post.status}
                </span>
              </div>
              {(post.disqualificationReason || latestSnapshot) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {post.disqualificationReason ? (
                    <p className="text-destructive">{post.disqualificationReason}</p>
                  ) : (
                    <p>
                      {latestSnapshot?.likesCount ?? 0} likes · {latestSnapshot?.commentsCount ?? 0} comentarios ·{' '}
                      {latestSnapshot?.repostsOrSharesCount ?? 0} shares · {latestSnapshot?.viewsCount ?? 0} views
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildPromotionAssetUrl({
  title,
  price,
  imageUrl,
  network,
  brand = 'LUK',
}: {
  title: string;
  price: number;
  imageUrl: string;
  network: string;
  brand?: string;
}) {
  const params = new URLSearchParams({
    title,
    price: String(price),
    imageUrl,
    network,
    brand,
  });

  return `/api/social-promotions/instagram-asset?${params.toString()}`;
}

export function SocialPromotionManager({
  raffleId,
  raffleTitle,
  raffleImages,
  ticketPrice,
  posts,
  onChanged,
  helperText,
  showSummary = true,
  showHelperText = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [network, setNetwork] = useState('FACEBOOK');
  const [draft, setDraft] = useState<DraftResult['startSocialPromotionDraft'] | null>(null);
  const [permalink, setPermalink] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [startDraft, { loading: creatingDraft }] = useMutation<DraftResult>(
    START_SOCIAL_PROMOTION_DRAFT,
  );
  const [submitPost, { loading: submittingPost }] = useMutation<SubmitResult>(
    SUBMIT_SOCIAL_PROMOTION_POST,
  );

  const permalinkPlaceholder =
    NETWORK_PERMALINK_PLACEHOLDERS[network] || 'https://...';
  const isDraftStep = Boolean(draft);
  const hasPromotionImages = raffleImages.length > 0;
  const safeSelectedImageIndex =
    raffleImages.length === 0
      ? 0
      : Math.min(selectedImageIndex, raffleImages.length - 1);
  const selectedImageUrl = raffleImages[safeSelectedImageIndex] || '';
  const promotionAssetUrl = useMemo(() => {
    if (!selectedImageUrl) return '';
    return buildPromotionAssetUrl({
      title: raffleTitle,
      price: ticketPrice,
      imageUrl: selectedImageUrl,
      network,
    });
  }, [raffleTitle, ticketPrice, selectedImageUrl, network]);
  const selectedNetworkLabel = NETWORK_LABELS[network] || network;
  const activeNetwork = draft?.network || network;
  const activeNetworkLabel = NETWORK_LABELS[activeNetwork] || activeNetwork;
  const copyLabel = activeNetwork === 'INSTAGRAM' ? 'Caption' : 'Copy';
  const shouldShowAssetKit = Boolean(selectedImageUrl);

  const resetComposer = () => {
    setDraft(null);
    setPermalink('');
    setSelectedImageIndex(0);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetComposer();
    }
  };

  const handleGenerateDraft = async () => {
    if (network === 'INSTAGRAM' && !hasPromotionImages) {
      toast.error('Instagram requiere al menos una foto cargada en la rifa.');
      return;
    }

    try {
      const result = await startDraft({
        variables: { raffleId, network },
      });

      if (result.data?.startSocialPromotionDraft) {
        setDraft(result.data.startSocialPromotionDraft);
        toast.success('Borrador promocional generado');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el borrador');
    }
  };

  const handleSubmitPost = async () => {
    if (!draft || !permalink.trim()) return;

    try {
      await submitPost({
        variables: {
          draftId: draft.id,
          permalink: permalink.trim(),
        },
      });
      toast.success('Publicación registrada. Entrará en validación automática.');
      resetComposer();
      setOpen(false);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la publicación');
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error(`No se pudo copiar ${label.toLowerCase()}`);
    }
  };

  return (
    <>
      <div className="space-y-1">
        <Button
          className="w-full h-auto min-h-9 whitespace-normal px-3 py-2 text-center leading-snug"
          onClick={() => setOpen(true)}
        >
          <Megaphone className="mr-2 h-4 w-4" />
          Promocionar y medir
        </Button>
        {showHelperText && helperText && (
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
        {showSummary && <SocialPromotionPostsSummary posts={posts} />}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="grid h-[min(92vh,920px)] max-h-[92vh] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-4 py-4 pr-12">
            <DialogTitle>
              {isDraftStep ? 'Registrar publicación promocional' : 'Promocionar rifa'}
            </DialogTitle>
            <DialogDescription>
              Generá un link rastreable para <span className="font-medium">{raffleTitle}</span>, publicalo en tu red y pegá el permalink para que Luk pueda validarlo y medirlo.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-4 py-4">
            {!isDraftStep ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Paso 1 de 2</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Elegí la red social y generá el borrador con el link rastreable.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="promotion-network-select">Red social</Label>
                    <Select value={network} onValueChange={setNetwork}>
                      <SelectTrigger id="promotion-network-select" className="w-full" aria-label="Red social">
                        <SelectValue placeholder="Elegí una red" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NETWORK_LABELS).map(([value, label]) => (
                          <SelectItem
                            key={value}
                            value={value}
                            disabled={value === 'INSTAGRAM' && !hasPromotionImages}
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!hasPromotionImages && (
                      <p className="text-xs text-muted-foreground">
                        Instagram requiere al menos una foto cargada en la rifa.
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">Cómo funciona</p>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium text-foreground">1. Generá</p>
                        <p>Armás el copy con token, link rastreable y, si querés, una pieza descargable.</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium text-foreground">2. Publicá</p>
                        <p>Compartís la pieza y el texto en tu cuenta pública de la red elegida.</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium text-foreground">3. Registrá</p>
                        <p>Pegás el permalink para que Luk lo valide y mida.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {hasPromotionImages && (
                  <div className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Elegí la foto del producto</p>
                        <p className="text-sm text-muted-foreground">
                          Luk arma una pieza descargable con una sola imagen para {selectedNetworkLabel}. Si después querés cambiarla, podés volver a este paso.
                        </p>
                      </div>
                    </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {raffleImages.map((image, index) => {
                        const isSelected = index === safeSelectedImageIndex;
                        return (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            className={cn(
                              'overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                            )}
                            onClick={() => setSelectedImageIndex(index)}
                            aria-pressed={isSelected}
                            aria-label={`Usar foto ${index + 1}`}
                          >
                            <img
                              src={getOptimizedImageUrl(image, CLOUDINARY_PRESETS.galleryFull)}
                              alt={`Foto ${index + 1} del producto`}
                              className="h-40 w-full object-cover"
                            />
                            <div className="flex items-center justify-between px-3 py-2 text-sm">
                              <span>Foto {index + 1}</span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-primary">
                                  <Check className="h-4 w-4" /> Seleccionada
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Usar foto</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {raffleImages.length === 1 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Usaremos esta foto para armar la pieza descargable.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Paso 2 de 2</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeNetwork === 'INSTAGRAM'
                      ? 'Descargá la pieza para Instagram, publicá un post o reel público con el caption y después pegá el permalink final.'
                      : `Descargá la pieza para ${activeNetworkLabel}, compartila junto con el copy y después pegá el permalink final.`}
                  </p>
                </div>

                {shouldShowAssetKit ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Pieza promocional</p>
                            <p className="text-xs text-muted-foreground">
                              Formato {INSTAGRAM_ASSET_DIMENSIONS.width}×{INSTAGRAM_ASSET_DIMENSIONS.height} con la foto elegida y el precio por ticket.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <a href={promotionAssetUrl} download={`luk-promocion-${activeNetwork.toLowerCase()}-${raffleId}.png`}>
                                <Download className="mr-2 h-4 w-4" /> Descargar imagen
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <a href={promotionAssetUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" /> Abrir imagen
                              </a>
                            </Button>
                          </div>
                        </div>
                        <div className="flex max-h-[46vh] min-h-[280px] items-center justify-center overflow-hidden rounded-xl border bg-muted/20 p-3">
                          {promotionAssetUrl ? (
                            <img
                              src={promotionAssetUrl}
                              alt="Preview de pieza promocional"
                              className="mx-auto h-auto max-h-[calc(46vh-1.5rem)] w-auto max-w-full rounded-lg object-contain shadow-sm"
                            />
                          ) : (
                            <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                              Elegí una imagen para generar la pieza.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{copyLabel} sugerido</p>
                            <p className="text-xs text-muted-foreground">
                              Copialo completo para conservar el link y el token visibles.
                            </p>
                          </div>
                          {draft!.suggestedCopy && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(draft!.suggestedCopy || '', copyLabel)}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copiar {copyLabel.toLowerCase()}
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={draft!.suggestedCopy || ''}
                          readOnly
                          rows={4}
                          placeholder="Generá un borrador para ver el caption sugerido"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="promotion-permalink">Permalink de la publicación</Label>
                        <Input
                          id="promotion-permalink"
                          placeholder={permalinkPlaceholder}
                          value={permalink}
                          onChange={(event) => setPermalink(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {activeNetwork === 'INSTAGRAM'
                            ? 'Publicá un post o reel público, conservá el caption con el link o token de Luk y luego pegá el permalink acá.'
                            : `Compartí el post en ${activeNetworkLabel}, conservá el copy con el link o token de Luk y luego pegá el permalink acá.`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Red y foto elegida
                        </p>
                        <p className="mt-2 text-sm font-medium">{activeNetworkLabel}</p>
                        {selectedImageUrl ? (
                          <img
                            src={getOptimizedImageUrl(selectedImageUrl, CLOUDINARY_PRESETS.detail)}
                            alt="Foto elegida para la promoción"
                            className="mt-3 h-40 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No hay foto disponible para generar la pieza.
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-medium">Detalles de validación</p>
                        <div className="mt-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">Tracking URL</p>
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                {draft!.trackingUrl}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleCopy(draft!.trackingUrl, 'tracking URL')}
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">Token</p>
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                {draft!.promotionToken}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleCopy(draft!.promotionToken, 'token')}
                            >
                              <BadgeCheck className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Red elegida
                        </p>
                        <p className="mt-2 text-sm font-medium">
                          {NETWORK_LABELS[draft!.network] || draft!.network}
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Tracking URL</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {draft!.trackingUrl}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => handleCopy(draft!.trackingUrl, 'tracking URL')}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Token</p>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              {draft!.promotionToken}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => handleCopy(draft!.promotionToken, 'token')}
                          >
                            <BadgeCheck className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Copy sugerido</p>
                            <p className="text-xs text-muted-foreground">
                              Incluye tu link rastreable y token visible para validación.
                            </p>
                          </div>
                          {draft!.suggestedCopy && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(draft!.suggestedCopy || '', 'copy')}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Copiar
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={draft!.suggestedCopy || ''}
                          readOnly
                          rows={4}
                          placeholder="Generá un borrador para ver el copy sugerido"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="promotion-permalink">Permalink de la publicación</Label>
                        <Input
                          id="promotion-permalink"
                          placeholder={permalinkPlaceholder}
                          value={permalink}
                          onChange={(event) => setPermalink(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          El post debe ser público, persistente y conservar el link o token de Luk durante toda la rifa.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t bg-background px-4 py-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
            {isDraftStep ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDraft(null)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
                <Button
                  onClick={handleSubmitPost}
                  disabled={!draft || !permalink.trim() || submittingPost}
                >
                  {submittingPost ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Registrar publicación'
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleGenerateDraft}
                disabled={creatingDraft || (network === 'INSTAGRAM' && !hasPromotionImages)}
              >
                {creatingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Generar borrador'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
