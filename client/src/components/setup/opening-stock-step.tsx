// ====================================================================================
// PHASE 1 SLOT: opening stock numbers in the setup wizard (/app/setup, step "stock")
//
// Phase 1 (stock reconciliation) fills this step: the farm's balance date and opening numbers
// per stock class, saved through the stock reconciliation API. Until then it only points to
// the stock reconciliation screen and can be skipped. The wizard (pages/OnboardingWizard.tsx)
// shows this component as is and passes `onDone` for when the numbers are saved.
// ====================================================================================

export interface OpeningStockStepProps {
  /** Call when the opening numbers are saved, to move the wizard on */
  onDone: () => void;
}

export function OpeningStockStep(_props: OpeningStockStepProps) {
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-dashed border-amber-400 bg-amber-50 p-4 text-amber-900">
        <p className="font-medium">Opening stock numbers: coming in the stock reconciliation update</p>
        <p className="mt-1">
          Soon you'll enter how many of each class of stock you had at your balance date, so Pulse can keep your stock
          reconciliation balanced from day one. For now, skip this step. You can record stock on the stock reconciliation
          screen at any time.
        </p>
      </div>
      <a className="underline" href="/app/stock-reconciliation">Open stock reconciliation</a>
    </div>
  );
}
