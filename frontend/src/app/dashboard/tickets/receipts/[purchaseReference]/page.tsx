import { TicketReceiptPageClient } from "./ticket-receipt-page-client";

interface TicketReceiptPageProps {
  params: Promise<{ purchaseReference: string }>;
}

export default async function TicketReceiptPage({
  params,
}: TicketReceiptPageProps) {
  const { purchaseReference } = await params;

  return (
    <TicketReceiptPageClient purchaseReference={purchaseReference} />
  );
}
