'use client';

import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MY_PROMOTION_BONUS_GRANTS = gql`
  query MyPromotionBonusGrants {
    myPromotionBonusGrants {
      id
      discountPercent
      maxDiscountAmount
      expiresAt
      status
      usedAt
    }
  }
`;

interface PromotionBonusGrant {
  id: string;
  discountPercent: number;
  maxDiscountAmount: number;
  expiresAt: string;
  status: string;
  usedAt?: string;
}

export function PromotionBonusGrantsCard() {
  const { data } = useQuery<{ myPromotionBonusGrants: PromotionBonusGrant[] }>(
    MY_PROMOTION_BONUS_GRANTS,
  );

  const grants = data?.myPromotionBonusGrants || [];

  if (grants.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Bonificaciones promocionales
        </CardTitle>
        <CardDescription>
          Beneficios ganados por mantener publicaciones promocionales públicas y válidas hasta el cierre de una rifa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {grants.map((grant) => (
          <div key={grant.id} className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">
                {grant.discountPercent}% off hasta ${grant.maxDiscountAmount}
              </p>
              <p className="text-sm text-muted-foreground">
                Estado: {grant.status} · Vence {new Date(grant.expiresAt).toLocaleDateString('es-AR')}
              </p>
            </div>
            {grant.usedAt && (
              <p className="text-xs text-muted-foreground">
                Usada el {new Date(grant.usedAt).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
