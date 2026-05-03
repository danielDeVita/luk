import { WalletReceiptPageClient } from "./wallet-receipt-page-client";

interface WalletReceiptPageProps {
  params: Promise<{ topUpSessionId: string }>;
}

export default async function WalletReceiptPage({
  params,
}: WalletReceiptPageProps) {
  const { topUpSessionId } = await params;

  return <WalletReceiptPageClient topUpSessionId={topUpSessionId} />;
}
