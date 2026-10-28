import { formatMoney, type Totals } from './money'

/** Subtotal, VAT per rate and grand total. Used by the live editor and the invoice view. */
export function InvoiceTotals({ totals }: { totals: Totals }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-6">
        <dt className="text-slate-500">Subtotal (excl. VAT)</dt>
        <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
      </div>
      {totals.vat_breakdown.map((row) => (
        <div key={row.rate} className="flex justify-between gap-6">
          <dt className="text-slate-500">
            {row.label}
            {row.taxable !== totals.subtotal && (
              <span className="text-slate-400"> on {formatMoney(row.taxable)}</span>
            )}
          </dt>
          <dd className="tabular-nums">{formatMoney(row.vat)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-6 border-t border-slate-200 pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
      </div>
    </dl>
  )
}
