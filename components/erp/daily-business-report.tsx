'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, ContentLoader, KpiCard, Modal } from './ui'
import { fetchDailyBusinessReport } from '@/lib/daily-report-api'
import { money } from '@/lib/erp-data'

function today() { return new Date().toLocaleDateString('en-CA') }

export function DailyBusinessReportModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(today)
  const report = useQuery({ queryKey: ['daily-business-report', date], queryFn: () => fetchDailyBusinessReport(date) })
  const data = report.data
  const collection = (data?.cash ?? 0) + (data?.upi ?? 0) + (data?.card ?? 0)

  function printReport() {
    if (!data) return
    const popup = window.open('', '_blank', 'width=920,height=720')
    if (!popup) return
    const businessDate = new Date(`${data.businessDate}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    popup.document.write(`<!doctype html><html><head><title>Daily Business Report · ${data.businessDate}</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#1b2924;font:12px/1.45 Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:100%;max-width:190mm;margin:0 auto}.hero{background:linear-gradient(120deg,#0f5b49,#23856b);border-radius:12px;padding:20px 22px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start}.brand{display:flex;gap:11px;align-items:center}.mark{display:grid;place-items:center;width:32px;height:32px;border:1px solid rgba(255,255,255,.45);border-radius:9px;font-weight:800}.eyebrow{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;opacity:.78}.title{font-size:24px;font-weight:700;line-height:1.1;margin-top:3px}.date{text-align:right;font-size:11px;line-height:1.6}.date b{font-size:13px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}.metric{border:1px solid #dce6e1;border-radius:9px;padding:12px;background:#fff}.metric .label{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#72827b}.metric .value{font-size:18px;font-weight:700;color:#13251e;margin-top:5px}.metric.primary{background:#edf7f3;border-color:#a8d9c7}.metric.warning{background:#fff7e9;border-color:#f0d19a}.columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{border:1px solid #dce6e1;border-radius:10px;overflow:hidden}.panel-head{padding:12px 14px 9px;background:#f7faf8;border-bottom:1px solid #dce6e1}.panel-head h2{font-size:13px;margin:0;color:#176851}.panel-head p{font-size:10px;color:#718078;margin:3px 0 0}.rows{padding:2px 14px}.row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #e9efec}.row:last-child{border-bottom:0}.row span{color:#66756e}.row b{font-size:12px}.attention{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.alert{border-radius:9px;padding:10px 12px;background:#fff7e9;border:1px solid #f0d19a}.alert.danger{background:#fff0ef;border-color:#efc1bd}.alert .label{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#7b6a4c}.alert .value{font-size:18px;font-weight:700;margin-top:2px}.footer{display:flex;justify-content:space-between;margin-top:16px;padding-top:10px;border-top:1px solid #dce6e1;color:#718078;font-size:10px}@media print{body{width:100%}}
    </style></head><body><main class="sheet"><header class="hero"><div class="brand"><div class="mark">M</div><div><div class="eyebrow">Mercantile Retail Operations</div><div class="title">Daily Business Report</div></div></div><div class="date">Business date<br><b>${businessDate}</b></div></header><section class="summary"><div class="metric primary"><div class="label">Net sales</div><div class="value">${money(data.sales)}</div></div><div class="metric"><div class="label">Bills completed</div><div class="value">${data.bills}</div></div><div class="metric"><div class="label">Items sold</div><div class="value">${data.itemsSold}</div></div><div class="metric warning"><div class="label">Collections</div><div class="value">${money(collection)}</div></div></section><section class="columns"><article class="panel"><div class="panel-head"><h2>Collections & returns</h2><p>Payment received and customer refunds</p></div><div class="rows"><div class="row"><span>Cash</span><b>${money(data.cash)}</b></div><div class="row"><span>UPI</span><b>${money(data.upi)}</b></div><div class="row"><span>Card</span><b>${money(data.card)}</b></div><div class="row"><span>Credit sales</span><b>${money(data.creditSales)}</b></div><div class="row"><span>Refunds · ${data.returnCount} return${data.returnCount === 1 ? '' : 's'}</span><b>${money(data.refundTotal)}</b></div></div></article><article class="panel"><div class="panel-head"><h2>Purchasing & cash control</h2><p>Supplier activity and cashier reconciliation</p></div><div class="rows"><div class="row"><span>Purchase value</span><b>${money(data.purchaseValue)}</b></div><div class="row"><span>Supplier payments</span><b>${money(data.purchasePayments)}</b></div><div class="row"><span>Closed cashier shifts</span><b>${data.closedShifts}</b></div><div class="row"><span>Shift variance</span><b>${money(data.shiftVariance)}</b></div></div></article></section><section class="attention"><div class="alert"><div class="label">Low-stock attention</div><div class="value">${data.lowStockCount} item${data.lowStockCount === 1 ? '' : 's'}</div></div><div class="alert danger"><div class="label">Near-expiry attention</div><div class="value">${data.expiringBatchCount} batch${data.expiringBatchCount === 1 ? '' : 'es'}</div></div></section><footer class="footer"><span>Generated by Mercantile</span><span>Prepared ${new Date().toLocaleString()}</span></footer></main><script>window.onload=()=>window.print()</script></body></html>`)
    popup.document.close()
  }

  return <Modal wide title="Daily business report" sub="Your one-page manager summary for sales, controls and store health" icon="file-bar-chart" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button variant="primary" icon="printer" disabled={!data} onClick={printReport}>Print report</Button></>}>
    <div style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-soft-border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <div><div style={{ fontWeight: 700, color: 'var(--primary-soft-fg)' }}>Choose a business date</div><div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Review the complete trading position, then print or share the summary.</div></div>
      <input className="input sm" style={{ width: 180, background: 'var(--surface)' }} type="date" value={date} onChange={event => setDate(event.target.value)} aria-label="Business date" />
    </div>
    {report.isLoading ? <ContentLoader /> : report.error ? <div className="empty" style={{ minHeight: 290, padding: '36px 16px' }}><div className="ei"><span style={{ fontSize: 20 }}>!</span></div><div style={{ fontWeight: 700, color: 'var(--danger-fg)', fontSize: 16 }}>Daily report service is unavailable</div><div style={{ maxWidth: 480 }}>Mercantile could not connect to the backend service that prepares this report.</div><div className="muted" style={{ fontSize: 12.5 }}>For local use, restart the backend. For the hosted app, deploy the latest backend release first.</div><Button size="sm" variant="outline" icon="refresh-cw" onClick={() => void report.refetch()}>Try again</Button></div> : data && <>
      <div className="kpi-grid procurement-status-grid">
        <KpiCard label="Net sales" value={money(data.sales)} icon="circle-dollar-sign" tone="tile-primary" />
        <KpiCard label="Bills completed" value={String(data.bills)} icon="receipt-text" tone="tile-info" />
        <KpiCard label="Items sold" value={String(data.itemsSold)} icon="shopping-basket" tone="tile-success" />
        <KpiCard label="Collections" value={money(collection)} icon="wallet" tone="tile-warning" />
      </div>
      <div className="two-col">
        <Card title="Collections & returns" sub="What the business collected from customers"><div style={{ display: 'grid', gap: 0 }}>
          {[["Cash", money(data.cash)], ["UPI", money(data.upi)], ["Card", money(data.card)], ["Credit sales", money(data.creditSales)], [`Refunds · ${data.returnCount} return${data.returnCount === 1 ? '' : 's'}`, money(data.refundTotal)]].map(([label, value]) => <div className="row" key={label} style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}><span className="muted">{label}</span><b className="tnum">{value}</b></div>)}
        </div></Card>
        <Card title="Purchasing & store controls" sub="Supplier activity, stock risk and cashier closure"><div style={{ display: 'grid', gap: 0 }}>
          {[["Purchase value", money(data.purchaseValue)], ["Supplier payments", money(data.purchasePayments)], ["Low-stock items", String(data.lowStockCount)], ["Near-expiry batches", String(data.expiringBatchCount)], ["Closed shifts / variance", `${data.closedShifts} · ${money(data.shiftVariance)}`]].map(([label, value]) => <div className="row" key={label} style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}><span className="muted">{label}</span><b className="tnum">{value}</b></div>)}
        </div></Card>
      </div>
    </>}
  </Modal>
}
