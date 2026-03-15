'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

const SOCIAL_PROMOTION_REVIEW_QUEUE = gql`
  query SocialPromotionReviewQueue {
    socialPromotionReviewQueue {
      id
      raffleId
      sellerId
      network
      status
      submittedPermalink
      disqualificationReason
      snapshots {
        checkedAt
        failureReason
      }
    }
  }
`;

const ADMIN_RETRY_SOCIAL_PROMOTION_POST = gql`
  mutation AdminRetrySocialPromotionPost($postId: String!) {
    adminRetrySocialPromotionPost(postId: $postId) {
      id
      status
    }
  }
`;

const ADMIN_DISQUALIFY_SOCIAL_PROMOTION_POST = gql`
  mutation AdminDisqualifySocialPromotionPost($postId: String!, $reason: String!) {
    adminDisqualifySocialPromotionPost(postId: $postId, reason: $reason) {
      id
      status
      disqualificationReason
    }
  }
`;

interface QueuePost {
  id: string;
  raffleId: string;
  sellerId: string;
  network: string;
  status: string;
  submittedPermalink: string;
  disqualificationReason?: string;
  snapshots?: Array<{
    checkedAt: string;
    failureReason?: string;
  }>;
}

export function SocialPromotionReview() {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const { data, loading, refetch } = useQuery<{ socialPromotionReviewQueue: QueuePost[] }>(
    SOCIAL_PROMOTION_REVIEW_QUEUE,
  );
  const [retryPost, { loading: retrying }] = useMutation(
    ADMIN_RETRY_SOCIAL_PROMOTION_POST,
  );
  const [disqualifyPost, { loading: disqualifying }] = useMutation(
    ADMIN_DISQUALIFY_SOCIAL_PROMOTION_POST,
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando cola de revisión...
      </div>
    );
  }

  const posts = data?.socialPromotionReviewQueue || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promoción social: revisión técnica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay publicaciones en revisión técnica.</p>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium">{post.network} · {post.status}</p>
                  <p className="text-xs text-muted-foreground break-all">{post.submittedPermalink}</p>
                  <p className="text-xs text-muted-foreground">Rifa: {post.raffleId} · Seller: {post.sellerId}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={retrying}
                    onClick={async () => {
                      try {
                        await retryPost({ variables: { postId: post.id } });
                        toast.success('La publicación volvió a la cola de validación');
                        await refetch();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'No se pudo reintentar');
                      }
                    }}
                  >
                    Reintentar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={disqualifying || !reasons[post.id]?.trim()}
                    onClick={async () => {
                      try {
                        await disqualifyPost({
                          variables: { postId: post.id, reason: reasons[post.id] },
                        });
                        toast.success('Publicación descalificada');
                        await refetch();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'No se pudo descalificar');
                      }
                    }}
                  >
                    Descalificar
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Motivo de descalificación"
                value={reasons[post.id] || ''}
                onChange={(event) =>
                  setReasons((current) => ({
                    ...current,
                    [post.id]: event.target.value,
                  }))
                }
              />
              {post.snapshots?.[0]?.failureReason && (
                <p className="text-xs text-muted-foreground">
                  Último error: {post.snapshots[0].failureReason}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
