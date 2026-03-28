-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'BANNED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DNI', 'PASSPORT', 'CUIT_CUIL');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RaffleStatus" AS ENUM ('ACTIVA', 'COMPLETADA', 'SORTEADA', 'EN_ENTREGA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'DISPUTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NUEVO', 'USADO_COMO_NUEVO', 'USADO_BUEN_ESTADO', 'USADO_ACEPTABLE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('RESERVADO', 'PAGADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('COMPRA_TICKET', 'REEMBOLSO', 'PAGO_VENDEDOR', 'COMISION_PLATAFORMA', 'FEE_MP', 'SUBSIDIO_PROMOCIONAL_PLATAFORMA', 'REVERSION_BONIFICACION_PROMOCIONAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('NO_LLEGO', 'DIFERENTE', 'DANADO', 'VENDEDOR_NO_RESPONDE', 'OTRO');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION', 'RESUELTA_COMPRADOR', 'RESUELTA_VENDEDOR', 'RESUELTA_PARCIAL');

-- CreateEnum
CREATE TYPE "SellerLevel" AS ENUM ('NUEVO', 'BRONCE', 'PLATA', 'ORO');

-- CreateEnum
CREATE TYPE "MpConnectStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'CONNECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_BANNED', 'USER_UNBANNED', 'RAFFLE_HIDDEN', 'RAFFLE_UNHIDDEN', 'DISPUTE_RESOLVED', 'REPORT_REVIEWED', 'PAYOUT_RELEASED', 'REFUND_ISSUED', 'KYC_APPROVED', 'KYC_REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPromotionNetwork" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'X', 'THREADS');

-- CreateEnum
CREATE TYPE "SocialPromotionStatus" AS ENUM ('PENDING_VALIDATION', 'ACTIVE', 'TECHNICAL_REVIEW', 'DISQUALIFIED', 'SETTLED');

-- CreateEnum
CREATE TYPE "PromotionBonusGrantStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PromotionBonusRedemptionStatus" AS ENUM ('RESERVED', 'USED', 'RELEASED', 'REVERSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentsProvider" AS ENUM ('MERCADOPAGO', 'MOCK');

-- CreateEnum
CREATE TYPE "MockPaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REFUNDED_FULL', 'REFUNDED_PARTIAL');

-- CreateEnum
CREATE TYPE "MockPaymentEventType" AS ENUM ('APPROVE', 'PEND', 'REJECT', 'REFUND_FULL', 'REFUND_PARTIAL', 'EXPIRE');

-- CreateEnum
CREATE TYPE "SocialPromotionAttributionEventType" AS ENUM ('CLICK', 'REGISTRATION', 'PURCHASE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('USER_REGISTERED', 'USER_LOGGED_IN', 'USER_LOGGED_IN_GOOGLE', 'PASSWORD_CHANGED', 'RAFFLE_CREATED', 'RAFFLE_PUBLISHED', 'RAFFLE_COMPLETED', 'RAFFLE_CANCELLED', 'RAFFLE_DRAWN', 'RAFFLE_DEADLINE_EXTENDED', 'RAFFLE_WINNER_REJECTED', 'TICKETS_PURCHASED', 'TICKETS_REFUNDED', 'DELIVERY_SHIPPED', 'DELIVERY_CONFIRMED', 'DISPUTE_OPENED', 'DISPUTE_RESPONDED', 'DISPUTE_RESOLVED', 'PAYMENT_RECEIVED', 'PAYOUT_RELEASED', 'PROFILE_UPDATED', 'SHIPPING_ADDRESS_ADDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "google_id" TEXT,
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "mp_user_id" TEXT,
    "mp_access_token" TEXT,
    "mp_refresh_token" TEXT,
    "mp_connect_status" "MpConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "terms_accepted_at" TIMESTAMP(3),
    "terms_version" TEXT,
    "fecha_nacimiento" TIMESTAMP(3),
    "document_type" "DocumentType",
    "document_number" TEXT,
    "document_front_url" TEXT,
    "document_back_url" TEXT,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "kyc_submitted_at" TIMESTAMP(3),
    "kyc_verified_at" TIMESTAMP(3),
    "kyc_rejected_reason" TEXT,
    "street" TEXT,
    "street_number" TEXT,
    "apartment" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal_code" TEXT,
    "country" TEXT DEFAULT 'Argentina',
    "phone" TEXT,
    "cuit_cuil" TEXT,
    "default_sender_address_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffles" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "total_tickets" INTEGER NOT NULL,
    "precio_por_ticket" DECIMAL(10,2) NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_limite_sorteo" TIMESTAMP(3) NOT NULL,
    "estado" "RaffleStatus" NOT NULL DEFAULT 'ACTIVA',
    "winner_id" TEXT,
    "fecha_sorteo_real" TIMESTAMP(3),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_number" TEXT,
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "payment_released_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "last_price_drop_at" TIMESTAMP(3),
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,

    CONSTRAINT "raffles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion_detallada" TEXT NOT NULL,
    "categoria" TEXT,
    "condicion" "ProductCondition" NOT NULL,
    "imagenes" TEXT[],
    "especificaciones_tecnicas" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "numero_ticket" INTEGER NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "precio_pagado" DECIMAL(10,2) NOT NULL,
    "mp_payment_id" TEXT,
    "mp_external_reference" TEXT,
    "estado" "TicketStatus" NOT NULL DEFAULT 'RESERVADO',
    "fecha_compra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "tipo" "TransactionType" NOT NULL,
    "user_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "gross_amount" DECIMAL(10,2),
    "promotion_discount_amount" DECIMAL(10,2),
    "cash_charged_amount" DECIMAL(10,2),
    "comision_plataforma" DECIMAL(10,2),
    "fee_procesamiento" DECIMAL(10,2),
    "monto_neto" DECIMAL(10,2),
    "mp_payment_id" TEXT,
    "mp_merchant_order_id" TEXT,
    "estado" "TransactionStatus" NOT NULL DEFAULT 'PENDIENTE',
    "metadata" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_reductions" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "precio_anterior" DECIMAL(10,2) NOT NULL,
    "precio_sugerido" DECIMAL(10,2) NOT NULL,
    "porcentaje_reduccion" DECIMAL(5,2) NOT NULL,
    "tickets_vendidos_al_momento" INTEGER NOT NULL,
    "fecha_sugerencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptada" BOOLEAN,
    "fecha_respuesta" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "price_reductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "previous_price" DECIMAL(10,2) NOT NULL,
    "new_price" DECIMAL(10,2) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "tipo" "DisputeType" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "evidencias" TEXT[],
    "estado" "DisputeStatus" NOT NULL DEFAULT 'ABIERTA',
    "respuesta_vendedor" TEXT,
    "evidencias_vendedor" TEXT[],
    "admin_notes" TEXT,
    "resolucion" TEXT,
    "monto_reembolsado" DECIMAL(10,2),
    "monto_pagado_vendedor" DECIMAL(10,2),
    "fecha_respuesta_vendedor" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reputations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_ventas_completadas" INTEGER NOT NULL DEFAULT 0,
    "total_compras_completadas" INTEGER NOT NULL DEFAULT 0,
    "total_rifas_ganadas" INTEGER NOT NULL DEFAULT 0,
    "total_tickets_comprados" INTEGER NOT NULL DEFAULT 0,
    "disputas_como_vendedor_ganadas" INTEGER NOT NULL DEFAULT 0,
    "disputas_como_vendedor_perdidas" INTEGER NOT NULL DEFAULT 0,
    "disputas_como_comprador_abiertas" INTEGER NOT NULL DEFAULT 0,
    "rating_promedio_vendedor" DECIMAL(3,2),
    "nivel_vendedor" "SellerLevel" NOT NULL DEFAULT 'NUEVO',
    "max_rifas_simultaneas" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_results" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "winning_ticket_id" TEXT NOT NULL,
    "winner_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'RANDOM_INDEX',
    "total_participants" INTEGER NOT NULL,
    "random_seed" TEXT,

    CONSTRAINT "draw_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mp_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "mp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_at" TIMESTAMP(3),
    "admin_notes" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "icono" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Principal',
    "recipient_name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Argentina',
    "phone" TEXT,
    "instructions" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "platform_subsidy_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "processing_fee" DECIMAL(10,2) NOT NULL,
    "net_amount" DECIMAL(10,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "mp_payout_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "ActivityType" NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "device_info" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_promotion_drafts" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "network" "SocialPromotionNetwork" NOT NULL,
    "tracking_url" TEXT NOT NULL,
    "promotion_token" TEXT NOT NULL,
    "suggested_copy" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_promotion_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_promotion_posts" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "network" "SocialPromotionNetwork" NOT NULL,
    "submitted_permalink" TEXT NOT NULL,
    "canonical_permalink" TEXT,
    "canonical_post_id" TEXT,
    "status" "SocialPromotionStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "published_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "next_check_at" TIMESTAMP(3),
    "disqualified_at" TIMESTAMP(3),
    "disqualification_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_promotion_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_promotion_metric_snapshots" (
    "id" TEXT NOT NULL,
    "social_promotion_post_id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_accessible" BOOLEAN NOT NULL DEFAULT false,
    "token_present" BOOLEAN NOT NULL DEFAULT false,
    "likesCount" INTEGER,
    "comments_count" INTEGER,
    "reposts_or_shares_count" INTEGER,
    "views_count" INTEGER,
    "clicks_attributed" INTEGER NOT NULL DEFAULT 0,
    "registrations_attributed" INTEGER NOT NULL DEFAULT 0,
    "ticket_purchases_attributed" INTEGER NOT NULL DEFAULT 0,
    "raw_evidence_meta" JSONB,
    "parser_version" TEXT,
    "failure_reason" TEXT,

    CONSTRAINT "social_promotion_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_score_settlements" (
    "id" TEXT NOT NULL,
    "social_promotion_post_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "base_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "engagement_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "conversion_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "settlement_status" "SocialPromotionStatus" NOT NULL DEFAULT 'SETTLED',
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_score_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_bonus_grants" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "source_settlement_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "max_discount_amount" DECIMAL(10,2) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "PromotionBonusGrantStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "promotion_bonus_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_bonus_redemptions" (
    "id" TEXT NOT NULL,
    "promotion_bonus_grant_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "gross_subtotal" DECIMAL(10,2) NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL,
    "mp_charge_amount" DECIMAL(10,2) NOT NULL,
    "mp_payment_id" TEXT,
    "status" "PromotionBonusRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "promotion_bonus_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_promotion_attribution_events" (
    "id" TEXT NOT NULL,
    "social_promotion_post_id" TEXT NOT NULL,
    "event_type" "SocialPromotionAttributionEventType" NOT NULL,
    "user_id" TEXT,
    "ticket_count" INTEGER,
    "amount" DECIMAL(10,2),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_promotion_attribution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_payments" (
    "id" TEXT NOT NULL,
    "public_token" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "gross_subtotal" DECIMAL(10,2) NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL,
    "cash_charged_amount" DECIMAL(10,2) NOT NULL,
    "promotion_bonus_grant_id" TEXT,
    "promotion_bonus_redemption_id" TEXT,
    "provider_reference" TEXT NOT NULL,
    "merchant_order_id" TEXT NOT NULL,
    "external_reference" TEXT,
    "status" "MockPaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "status_detail" TEXT,
    "approved_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refunded_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_payment_events" (
    "id" TEXT NOT NULL,
    "mock_payment_id" TEXT NOT NULL,
    "event_type" "MockPaymentEventType" NOT NULL,
    "status" "MockPaymentStatus",
    "amount" DECIMAL(10,2),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_questions" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "asker_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raffle_answers" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_mp_user_id_key" ON "users"("mp_user_id");

-- CreateIndex
CREATE INDEX "users_is_deleted_created_at_idx" ON "users"("is_deleted", "created_at");

-- CreateIndex
CREATE INDEX "raffles_seller_id_idx" ON "raffles"("seller_id");

-- CreateIndex
CREATE INDEX "raffles_estado_idx" ON "raffles"("estado");

-- CreateIndex
CREATE INDEX "raffles_fecha_limite_sorteo_idx" ON "raffles"("fecha_limite_sorteo");

-- CreateIndex
CREATE INDEX "raffles_is_deleted_created_at_idx" ON "raffles"("is_deleted", "created_at");

-- CreateIndex
CREATE INDEX "raffles_category_id_idx" ON "raffles"("category_id");

-- CreateIndex
CREATE INDEX "raffles_estado_fecha_limite_sorteo_idx" ON "raffles"("estado", "fecha_limite_sorteo");

-- CreateIndex
CREATE UNIQUE INDEX "products_raffle_id_key" ON "products"("raffle_id");

-- CreateIndex
CREATE INDEX "tickets_raffle_id_idx" ON "tickets"("raffle_id");

-- CreateIndex
CREATE INDEX "tickets_buyer_id_idx" ON "tickets"("buyer_id");

-- CreateIndex
CREATE INDEX "tickets_estado_idx" ON "tickets"("estado");

-- CreateIndex
CREATE INDEX "tickets_is_deleted_created_at_idx" ON "tickets"("is_deleted", "created_at");

-- CreateIndex
CREATE INDEX "tickets_mp_payment_id_idx" ON "tickets"("mp_payment_id");

-- CreateIndex
CREATE INDEX "tickets_raffle_id_estado_idx" ON "tickets"("raffle_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_raffle_id_numero_ticket_key" ON "tickets"("raffle_id", "numero_ticket");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_raffle_id_idx" ON "transactions"("raffle_id");

-- CreateIndex
CREATE INDEX "transactions_tipo_idx" ON "transactions"("tipo");

-- CreateIndex
CREATE INDEX "transactions_is_deleted_created_at_idx" ON "transactions"("is_deleted", "created_at");

-- CreateIndex
CREATE INDEX "transactions_mp_payment_id_idx" ON "transactions"("mp_payment_id");

-- CreateIndex
CREATE INDEX "transactions_estado_created_at_idx" ON "transactions"("estado", "created_at");

-- CreateIndex
CREATE INDEX "price_reductions_raffle_id_idx" ON "price_reductions"("raffle_id");

-- CreateIndex
CREATE INDEX "price_reductions_is_deleted_fecha_sugerencia_idx" ON "price_reductions"("is_deleted", "fecha_sugerencia");

-- CreateIndex
CREATE INDEX "price_history_raffle_id_changed_at_idx" ON "price_history"("raffle_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_raffle_id_key" ON "disputes"("raffle_id");

-- CreateIndex
CREATE INDEX "disputes_estado_idx" ON "disputes"("estado");

-- CreateIndex
CREATE INDEX "disputes_is_deleted_created_at_idx" ON "disputes"("is_deleted", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_reputations_user_id_key" ON "user_reputations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_raffle_id_key" ON "reviews"("raffle_id");

-- CreateIndex
CREATE INDEX "reviews_seller_id_idx" ON "reviews"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "draw_results_raffle_id_key" ON "draw_results"("raffle_id");

-- CreateIndex
CREATE UNIQUE INDEX "mp_events_event_id_key" ON "mp_events"("event_id");

-- CreateIndex
CREATE INDEX "reports_raffle_id_idx" ON "reports"("raffle_id");

-- CreateIndex
CREATE INDEX "reports_reviewed_idx" ON "reports"("reviewed");

-- CreateIndex
CREATE UNIQUE INDEX "reports_raffle_id_reporter_id_key" ON "reports"("raffle_id", "reporter_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE UNIQUE INDEX "categories_nombre_key" ON "categories"("nombre");

-- CreateIndex
CREATE INDEX "categories_is_active_orden_idx" ON "categories"("is_active", "orden");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE INDEX "favorites_raffle_id_idx" ON "favorites"("raffle_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_raffle_id_key" ON "favorites"("user_id", "raffle_id");

-- CreateIndex
CREATE INDEX "shipping_addresses_user_id_is_default_idx" ON "shipping_addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_raffle_id_key" ON "conversations"("raffle_id");

-- CreateIndex
CREATE INDEX "conversations_user1_id_idx" ON "conversations"("user1_id");

-- CreateIndex
CREATE INDEX "conversations_user2_id_idx" ON "conversations"("user2_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_raffle_id_key" ON "payouts"("raffle_id");

-- CreateIndex
CREATE INDEX "payouts_seller_id_idx" ON "payouts"("seller_id");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "payouts_scheduled_for_idx" ON "payouts"("scheduled_for");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_target_type_target_id_idx" ON "activity_logs"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_promotion_drafts_promotion_token_key" ON "social_promotion_drafts"("promotion_token");

-- CreateIndex
CREATE INDEX "social_promotion_drafts_seller_id_created_at_idx" ON "social_promotion_drafts"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "social_promotion_drafts_raffle_id_network_idx" ON "social_promotion_drafts"("raffle_id", "network");

-- CreateIndex
CREATE UNIQUE INDEX "social_promotion_posts_draft_id_key" ON "social_promotion_posts"("draft_id");

-- CreateIndex
CREATE INDEX "social_promotion_posts_status_next_check_at_idx" ON "social_promotion_posts"("status", "next_check_at");

-- CreateIndex
CREATE INDEX "social_promotion_posts_seller_id_status_idx" ON "social_promotion_posts"("seller_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "social_promotion_posts_raffle_id_seller_id_network_key" ON "social_promotion_posts"("raffle_id", "seller_id", "network");

-- CreateIndex
CREATE INDEX "social_promotion_metric_snapshots_social_promotion_post_id__idx" ON "social_promotion_metric_snapshots"("social_promotion_post_id", "checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_score_settlements_social_promotion_post_id_key" ON "promotion_score_settlements"("social_promotion_post_id");

-- CreateIndex
CREATE INDEX "promotion_score_settlements_seller_id_settled_at_idx" ON "promotion_score_settlements"("seller_id", "settled_at");

-- CreateIndex
CREATE INDEX "promotion_score_settlements_raffle_id_idx" ON "promotion_score_settlements"("raffle_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_bonus_grants_source_settlement_id_key" ON "promotion_bonus_grants"("source_settlement_id");

-- CreateIndex
CREATE INDEX "promotion_bonus_grants_seller_id_status_idx" ON "promotion_bonus_grants"("seller_id", "status");

-- CreateIndex
CREATE INDEX "promotion_bonus_grants_expires_at_idx" ON "promotion_bonus_grants"("expires_at");

-- CreateIndex
CREATE INDEX "promotion_bonus_redemptions_promotion_bonus_grant_id_status_idx" ON "promotion_bonus_redemptions"("promotion_bonus_grant_id", "status");

-- CreateIndex
CREATE INDEX "promotion_bonus_redemptions_buyer_id_created_at_idx" ON "promotion_bonus_redemptions"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "promotion_bonus_redemptions_reservation_id_idx" ON "promotion_bonus_redemptions"("reservation_id");

-- CreateIndex
CREATE INDEX "social_promotion_attribution_events_social_promotion_post_i_idx" ON "social_promotion_attribution_events"("social_promotion_post_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "social_promotion_attribution_events_user_id_event_type_idx" ON "social_promotion_attribution_events"("user_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "mock_payments_public_token_key" ON "mock_payments"("public_token");

-- CreateIndex
CREATE INDEX "mock_payments_buyer_id_created_at_idx" ON "mock_payments"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "mock_payments_raffle_id_status_idx" ON "mock_payments"("raffle_id", "status");

-- CreateIndex
CREATE INDEX "mock_payments_reservation_id_idx" ON "mock_payments"("reservation_id");

-- CreateIndex
CREATE INDEX "mock_payment_events_mock_payment_id_created_at_idx" ON "mock_payment_events"("mock_payment_id", "created_at");

-- CreateIndex
CREATE INDEX "raffle_questions_raffle_id_created_at_idx" ON "raffle_questions"("raffle_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "raffle_answers_question_id_key" ON "raffle_answers"("question_id");

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_expires_at_idx" ON "email_verification_codes"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "email_verification_codes_code_is_used_idx" ON "email_verification_codes"("code", "is_used");

-- AddForeignKey
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reductions" ADD CONSTRAINT "price_reductions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reputations" ADD CONSTRAINT "user_reputations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_drafts" ADD CONSTRAINT "social_promotion_drafts_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_drafts" ADD CONSTRAINT "social_promotion_drafts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_posts" ADD CONSTRAINT "social_promotion_posts_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "social_promotion_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_posts" ADD CONSTRAINT "social_promotion_posts_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_posts" ADD CONSTRAINT "social_promotion_posts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_metric_snapshots" ADD CONSTRAINT "social_promotion_metric_snapshots_social_promotion_post_id_fkey" FOREIGN KEY ("social_promotion_post_id") REFERENCES "social_promotion_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_score_settlements" ADD CONSTRAINT "promotion_score_settlements_social_promotion_post_id_fkey" FOREIGN KEY ("social_promotion_post_id") REFERENCES "social_promotion_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_score_settlements" ADD CONSTRAINT "promotion_score_settlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_score_settlements" ADD CONSTRAINT "promotion_score_settlements_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bonus_grants" ADD CONSTRAINT "promotion_bonus_grants_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bonus_grants" ADD CONSTRAINT "promotion_bonus_grants_source_settlement_id_fkey" FOREIGN KEY ("source_settlement_id") REFERENCES "promotion_score_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bonus_redemptions" ADD CONSTRAINT "promotion_bonus_redemptions_promotion_bonus_grant_id_fkey" FOREIGN KEY ("promotion_bonus_grant_id") REFERENCES "promotion_bonus_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bonus_redemptions" ADD CONSTRAINT "promotion_bonus_redemptions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_bonus_redemptions" ADD CONSTRAINT "promotion_bonus_redemptions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_attribution_events" ADD CONSTRAINT "social_promotion_attribution_events_social_promotion_post__fkey" FOREIGN KEY ("social_promotion_post_id") REFERENCES "social_promotion_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_promotion_attribution_events" ADD CONSTRAINT "social_promotion_attribution_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_payment_events" ADD CONSTRAINT "mock_payment_events_mock_payment_id_fkey" FOREIGN KEY ("mock_payment_id") REFERENCES "mock_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_questions" ADD CONSTRAINT "raffle_questions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "raffles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_questions" ADD CONSTRAINT "raffle_questions_asker_id_fkey" FOREIGN KEY ("asker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_answers" ADD CONSTRAINT "raffle_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "raffle_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raffle_answers" ADD CONSTRAINT "raffle_answers_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search helpers for raffle and product search
CREATE OR REPLACE FUNCTION raffle_search_vector(titulo TEXT, descripcion TEXT)
RETURNS tsvector AS $$
BEGIN
    RETURN (
        setweight(to_tsvector('spanish', COALESCE(titulo, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(descripcion, '')), 'B')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE INDEX IF NOT EXISTS idx_raffles_fulltext_search
ON "raffles"
USING GIN (
    raffle_search_vector(titulo, descripcion)
);

CREATE INDEX IF NOT EXISTS idx_products_fulltext_search
ON "products"
USING GIN (
    to_tsvector('spanish', COALESCE(nombre, '') || ' ' || COALESCE(descripcion_detallada, ''))
);
