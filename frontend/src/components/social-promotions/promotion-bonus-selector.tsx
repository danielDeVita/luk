'use client';

import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MY_PROMOTION_BONUS_GRANTS = gql`
  query MyPromotionBonusGrants($status: PromotionBonusGrantStatus) {
    myPromotionBonusGrants(status: $status) {
      id
      discountPercent
      maxDiscountAmount
      expiresAt
      status
    }
  }
`;

const PREVIEW_PROMOTION_BONUS = gql`
  query PreviewPromotionBonus($raffleId: String!, $cantidad: Float!, $bonusGrantId: String!) {
    previewPromotionBonus(raffleId: $raffleId, cantidad: $cantidad, bonusGrantId: $bonusGrantId) {
      bonusGrantId
      grossSubtotal
      discountApplied
      mpChargeAmount
    }
  }
`;

interface PromotionBonusGrant {
  id: string;
  discountPercent: number;
  maxDiscountAmount: number;
  expiresAt: string;
}

interface PromotionBonusPreview {
  bonusGrantId: string;
  grossSubtotal: number;
  discountApplied: number;
  mpChargeAmount: number;
}

interface Props {
  raffleId: string;
  quantity: number;
  sellerId?: string;
  selectedBonusGrantId: string | null;
  onSelectedBonusGrantIdChange: (bonusGrantId: string | null) => void;
  onPreviewChange: (preview: PromotionBonusPreview | null) => void;
}

export function PromotionBonusSelector({
  raffleId,
  quantity,
  sellerId,
  selectedBonusGrantId,
  onSelectedBonusGrantIdChange,
  onPreviewChange,
}: Props) {
  const { data } = useQuery<{ myPromotionBonusGrants: PromotionBonusGrant[] }>(
    MY_PROMOTION_BONUS_GRANTS,
    {
      variables: { status: 'AVAILABLE' },
      skip: !sellerId,
    },
  );

  const { data: previewData } = useQuery<{
    previewPromotionBonus: PromotionBonusPreview;
  }>(PREVIEW_PROMOTION_BONUS, {
    variables: {
      raffleId,
      cantidad: quantity,
      bonusGrantId: selectedBonusGrantId,
    },
    skip: !selectedBonusGrantId,
  });

  useEffect(() => {
    onPreviewChange(previewData?.previewPromotionBonus ?? null);
  }, [onPreviewChange, previewData]);

  const grants = data?.myPromotionBonusGrants || [];
  const eligibleGrants = grants.filter((grant) => grant.id && sellerId);

  if (!sellerId || eligibleGrants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Bonificación promocional</p>
      <Select
        value={selectedBonusGrantId ?? 'NONE'}
        onValueChange={(value) =>
          onSelectedBonusGrantIdChange(value === 'NONE' ? null : value)
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Elegí una bonificación" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">No usar bonificación</SelectItem>
          {eligibleGrants.map((grant) => (
            <SelectItem key={grant.id} value={grant.id}>
              {grant.discountPercent}% off hasta ${grant.maxDiscountAmount}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Las bonificaciones promocionales solo aplican en rifas de otros vendedores.
      </p>
    </div>
  );
}
