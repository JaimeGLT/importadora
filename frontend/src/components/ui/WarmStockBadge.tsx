export function WarmStockBadge({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
  const sinStock = stock === 0
  const bajo = stock > 0 && stock <= stockMinimo

  if (sinStock) return (
    <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.03em] whitespace-nowrap border bg-[#FEE2E2] text-[#B22234] border-[rgba(178,34,52,0.3)]">
      <span className="w-[6px] h-[6px] rounded-full bg-current shrink-0" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }} />
      Sin stock
    </span>
  )
  if (bajo) return (
    <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.03em] whitespace-nowrap border bg-[#FEF3C7] text-[#B45309] border-[rgba(180,83,9,0.25)]">
      <span className="w-[6px] h-[6px] rounded-full bg-current shrink-0" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }} />
      Stock bajo
    </span>
  )
  return (
    <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.03em] whitespace-nowrap border bg-[#D1FAE5] text-[#047857] border-[rgba(4,120,87,0.25)]">
      <span className="w-[6px] h-[6px] rounded-full bg-current shrink-0" style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }} />
      En stock
    </span>
  )
}
