"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TicketPurchaseReceiptDialogData {
  purchaseReference: string;
  raffleId: string;
  raffleTitle: string;
  ticketNumbers: number[];
  chargedAmount: number;
  grossSubtotal: number;
  baseQuantity: number;
  bonusQuantity: number;
  grantedQuantity: number;
  packApplied: boolean;
  discountApplied: number;
  selectionPremiumAmount: number;
}

interface TicketPurchaseReceiptDialogProps {
  open: boolean;
  receipt: TicketPurchaseReceiptDialogData | null;
  acknowledging: boolean;
  acknowledged: boolean;
  onOpenChange: (open: boolean) => void;
  onAcknowledge: () => void;
}

export function TicketPurchaseReceiptDialog({
  open,
  receipt,
  acknowledging,
  acknowledged,
  onOpenChange,
  onAcknowledge,
}: TicketPurchaseReceiptDialogProps) {
  if (!receipt) {
    return null;
  }

  const receiptHref = `/dashboard/tickets/receipts/${encodeURIComponent(receipt.purchaseReference)}`;
  const hasBonusTickets = receipt.packApplied && receipt.bonusQuantity > 0;
  const totalDiscount = receipt.discountApplied;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" showCloseButton={!acknowledging}>
        <DialogHeader>
          <div className="mb-2 flex justify-center sm:justify-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptText className="h-6 w-6" />
            </div>
          </div>
          <DialogTitle>Comprobante de compra emitido</DialogTitle>
          <DialogDescription>
            Revisá los números asignados y confirmá que los ves correctamente en
            tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Rifa</p>
            <p className="mt-1 font-semibold">{receipt.raffleTitle}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Referencia:{" "}
              <span className="font-mono">{receipt.purchaseReference}</span>
            </p>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm font-medium">Números asignados</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {receipt.ticketNumbers.join(", ")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-muted-foreground">Total cobrado</p>
              <p className="mt-2 text-2xl font-semibold">
                ${receipt.chargedAmount.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-muted-foreground">Emitidos</p>
              <p className="mt-2 text-2xl font-semibold">
                {receipt.grantedQuantity}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tickets pagados</span>
              <span>{receipt.baseQuantity}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Subtotal bruto</span>
              <span>${receipt.grossSubtotal.toFixed(2)}</span>
            </div>
            {hasBonusTickets && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Bonus emitido</span>
                <span>+{receipt.bonusQuantity} ticket(s)</span>
              </div>
            )}
            {totalDiscount > 0 && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Descuentos</span>
                <span>-${totalDiscount.toFixed(2)}</span>
              </div>
            )}
            {receipt.selectionPremiumAmount > 0 && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  Premium por selección
                </span>
                <span>+${receipt.selectionPremiumAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {acknowledged && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Confirmaste que ves tus números.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Link href={receiptHref} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              Ver comprobante completo
            </Button>
          </Link>
          <Button
            className="w-full sm:w-auto"
            onClick={onAcknowledge}
            disabled={acknowledging || acknowledged}
          >
            {acknowledging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : acknowledged ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirmado
              </>
            ) : (
              "Confirmar que veo mis números"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
