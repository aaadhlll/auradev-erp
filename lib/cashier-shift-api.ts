import { apiFetch } from './api'
export interface CashierShift { id:string; status:'OPEN'|'OVERDUE'|'CLOSED'; openingCash:number; openedAt:string; closedAt?:string|null; expectedCash?:number|null; expectedUpi?:number|null; expectedCard?:number|null; expectedCredit?:number|null; countedCash?:number|null; variance?:number|null; closingNote?:string|null }
export interface CashierShiftReport extends CashierShift { cashierId:string; cashierName:string }
export function fetchCurrentShift(){ return apiFetch<CashierShift | null>('/api/v1/cashier-shifts/current') }
export function fetchShiftHistory(limit = 100){ return apiFetch<CashierShiftReport[]>(`/api/v1/cashier-shifts/history?limit=${limit}`) }
export function fetchShiftReport(id:string){ return apiFetch<CashierShiftReport>(`/api/v1/cashier-shifts/history/${id}`) }
export function openCashierShift(openingCash:number){ return apiFetch<CashierShift>('/api/v1/cashier-shifts/open',{method:'POST',body:JSON.stringify({openingCash})}) }
export function closeCashierShift(countedCash:number,note?:string){ return apiFetch<CashierShift>('/api/v1/cashier-shifts/close',{method:'POST',body:JSON.stringify({countedCash,note})}) }
export function forceCloseCashierShift(id:string,countedCash:number,note:string){ return apiFetch<CashierShift>(`/api/v1/cashier-shifts/history/${id}/force-close`,{method:'POST',body:JSON.stringify({countedCash,note})}) }
