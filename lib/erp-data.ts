// AuraDev Commerce ERP — Mock data (Nenjankod Supermarket, Karnataka, India)

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  cat: string
  categoryId?: string | null
  unit: 'kg' | 'pcs'
  mrp: number
  price: number
  cost: number
  tax: number
  stock: number
  reorder: number
}

export interface Customer {
  id: string
  name: string
  phone: string
  type: 'walkin' | 'b2c' | 'b2b'
  points?: number
  balance?: number
}

export interface Bill {
  no: string
  cust: string
  cashier: string
  items: number
  total: number
  pay: string
  status: string
  time: string
}

export interface Supplier {
  id: string
  name: string
  cat: string
  gstin: string
  phone: string
}

export interface PurchaseLine {
  item: string
  qty: number
  rate: number
}

export interface Purchase {
  no: string
  sup: string
  date: string
  due: string
  items: number
  sub: number
  gst: number
  status: 'paid' | 'billed' | 'pending' | 'draft'
  lines: [string, number, number][]
  total?: number
}

export interface SalesDay {
  d: string
  cur: number
  prev: number
}

export interface TopProduct {
  name: string
  qty: number
  rev: number
}

export interface ActivityItem {
  who: string
  act: string
  detail: string
  icon: string
  time: string
  tone: string
}

export interface User {
  name: string
  email: string
  role: string
  status: string
  last: string
}

export interface AuditEntry {
  act: string
  user: string
  ts: string
  ip: string
}

export const CATEGORIES = ['Grains', 'Dairy', 'Beverages', 'Personal Care', 'Snacks']

export const CAT_TONE: Record<string, string> = {
  Grains: 'tile-warning',
  Dairy: 'tile-info',
  Beverages: 'tile-primary',
  'Personal Care': 'tile-success',
  Snacks: 'tile-danger',
}

export const CAT_ICON: Record<string, string> = {
  Grains: 'wheat',
  Dairy: 'milk',
  Beverages: 'cup-soda',
  'Personal Care': 'sparkles',
  Snacks: 'cookie',
}

export const PRODUCTS: Product[] = [
  // Grains
  { id: 'P001', name: 'Sona Masoori Rice', sku: 'GRN-RICE-25', barcode: '8901234500011', cat: 'Grains', unit: 'kg', mrp: 78, price: 68, cost: 58, tax: 5, stock: 320, reorder: 80 },
  { id: 'P002', name: 'Toor Dal (Arhar)', sku: 'GRN-TOOR-01', barcode: '8901234500028', cat: 'Grains', unit: 'kg', mrp: 145, price: 132, cost: 118, tax: 5, stock: 64, reorder: 70 },
  { id: 'P003', name: 'Whole Wheat Atta', sku: 'GRN-ATTA-05', barcode: '8901234500035', cat: 'Grains', unit: 'kg', mrp: 56, price: 49, cost: 42, tax: 5, stock: 210, reorder: 60 },
  { id: 'P004', name: 'Sunflower Oil', sku: 'GRN-OIL-1L', barcode: '8901234500042', cat: 'Grains', unit: 'pcs', mrp: 165, price: 149, cost: 132, tax: 5, stock: 96, reorder: 40 },
  { id: 'P005', name: 'Idli Rava', sku: 'GRN-RAVA-01', barcode: '8901234500059', cat: 'Grains', unit: 'kg', mrp: 62, price: 54, cost: 46, tax: 5, stock: 38, reorder: 40 },
  { id: 'P006', name: 'Chana Dal', sku: 'GRN-CHAN-01', barcode: '8901234500066', cat: 'Grains', unit: 'kg', mrp: 98, price: 88, cost: 76, tax: 5, stock: 0, reorder: 50 },
  // Dairy
  { id: 'P007', name: 'Nandini Toned Milk 500ml', sku: 'DRY-MILK-05', barcode: '8901234500073', cat: 'Dairy', unit: 'pcs', mrp: 26, price: 25, cost: 23, tax: 0, stock: 142, reorder: 60 },
  { id: 'P008', name: 'Amul Butter 100g', sku: 'DRY-BUTR-01', barcode: '8901234500080', cat: 'Dairy', unit: 'pcs', mrp: 58, price: 56, cost: 50, tax: 12, stock: 44, reorder: 30 },
  { id: 'P009', name: 'Curd 400g', sku: 'DRY-CURD-04', barcode: '8901234500097', cat: 'Dairy', unit: 'pcs', mrp: 40, price: 36, cost: 30, tax: 5, stock: 58, reorder: 40 },
  { id: 'P010', name: 'Paneer 200g', sku: 'DRY-PANR-02', barcode: '8901234500103', cat: 'Dairy', unit: 'pcs', mrp: 89, price: 82, cost: 71, tax: 5, stock: 22, reorder: 25 },
  { id: 'P011', name: 'Ghee 500ml', sku: 'DRY-GHEE-05', barcode: '8901234500110', cat: 'Dairy', unit: 'pcs', mrp: 320, price: 298, cost: 268, tax: 12, stock: 36, reorder: 20 },
  // Beverages
  { id: 'P012', name: 'Tata Tea Gold 250g', sku: 'BEV-TEA-25', barcode: '8901234500127', cat: 'Beverages', unit: 'pcs', mrp: 145, price: 138, cost: 122, tax: 5, stock: 72, reorder: 40 },
  { id: 'P013', name: 'Bru Coffee 100g', sku: 'BEV-COF-01', barcode: '8901234500134', cat: 'Beverages', unit: 'pcs', mrp: 195, price: 182, cost: 160, tax: 18, stock: 41, reorder: 30 },
  { id: 'P014', name: 'Coca-Cola 750ml', sku: 'BEV-COK-75', barcode: '8901234500141', cat: 'Beverages', unit: 'pcs', mrp: 45, price: 42, cost: 35, tax: 18, stock: 128, reorder: 60 },
  { id: 'P015', name: 'Bisleri Water 1L', sku: 'BEV-WTR-1L', barcode: '8901234500158', cat: 'Beverages', unit: 'pcs', mrp: 20, price: 19, cost: 14, tax: 18, stock: 240, reorder: 100 },
  { id: 'P016', name: 'Real Mixed Fruit 1L', sku: 'BEV-JUI-1L', barcode: '8901234500165', cat: 'Beverages', unit: 'pcs', mrp: 120, price: 110, cost: 94, tax: 12, stock: 14, reorder: 30 },
  // Personal Care
  { id: 'P017', name: 'Lifebuoy Soap 125g', sku: 'PC-SOAP-12', barcode: '8901234500172', cat: 'Personal Care', unit: 'pcs', mrp: 38, price: 34, cost: 28, tax: 18, stock: 186, reorder: 80 },
  { id: 'P018', name: 'Colgate Strong 200g', sku: 'PC-PAST-20', barcode: '8901234500189', cat: 'Personal Care', unit: 'pcs', mrp: 112, price: 104, cost: 90, tax: 18, stock: 53, reorder: 40 },
  { id: 'P019', name: 'Clinic Plus Shampoo', sku: 'PC-SHMP-01', barcode: '8901234500196', cat: 'Personal Care', unit: 'pcs', mrp: 165, price: 152, cost: 132, tax: 18, stock: 8, reorder: 30 },
  { id: 'P020', name: 'Dettol Handwash 200ml', sku: 'PC-HWSH-02', barcode: '8901234500202', cat: 'Personal Care', unit: 'pcs', mrp: 99, price: 89, cost: 74, tax: 18, stock: 61, reorder: 30 },
  // Snacks
  { id: 'P021', name: 'Parle-G Biscuits', sku: 'SNK-PRLG-01', barcode: '8901234500219', cat: 'Snacks', unit: 'pcs', mrp: 10, price: 10, cost: 8, tax: 18, stock: 412, reorder: 150 },
  { id: 'P022', name: 'Lays Classic 52g', sku: 'SNK-LAYS-52', barcode: '8901234500226', cat: 'Snacks', unit: 'pcs', mrp: 20, price: 20, cost: 15, tax: 18, stock: 168, reorder: 80 },
  { id: 'P023', name: 'Haldiram Bhujia 200g', sku: 'SNK-BHUJ-20', barcode: '8901234500233', cat: 'Snacks', unit: 'pcs', mrp: 62, price: 56, cost: 47, tax: 12, stock: 47, reorder: 40 },
  { id: 'P024', name: 'Britannia Cake 60g', sku: 'SNK-CAKE-06', barcode: '8901234500240', cat: 'Snacks', unit: 'pcs', mrp: 30, price: 28, cost: 22, tax: 18, stock: 3, reorder: 30 },
  { id: 'P025', name: 'Cadbury Dairy Milk 50g', sku: 'SNK-CDBR-50', barcode: '8901234500257', cat: 'Snacks', unit: 'pcs', mrp: 45, price: 42, cost: 34, tax: 18, stock: 94, reorder: 50 },
  { id: 'P026', name: 'Maggi Noodles 4-pack', sku: 'SNK-MAGG-04', barcode: '8901234500264', cat: 'Snacks', unit: 'pcs', mrp: 56, price: 52, cost: 44, tax: 18, stock: 132, reorder: 60 },
  { id: 'P027', name: 'Good Day Cookies', sku: 'SNK-GDAY-01', barcode: '8901234500271', cat: 'Snacks', unit: 'pcs', mrp: 35, price: 32, cost: 26, tax: 18, stock: 76, reorder: 50 },
  { id: 'P028', name: 'MTR Rava Idli Mix', sku: 'GRN-MTR-01', barcode: '8901234500288', cat: 'Grains', unit: 'pcs', mrp: 72, price: 66, cost: 56, tax: 12, stock: 29, reorder: 30 },
  { id: 'P029', name: 'Eggs (Tray of 30)', sku: 'DRY-EGGS-30', barcode: '8901234500295', cat: 'Dairy', unit: 'pcs', mrp: 210, price: 195, cost: 172, tax: 0, stock: 18, reorder: 20 },
  { id: 'P030', name: 'Horlicks 500g', sku: 'BEV-HRLK-50', barcode: '8901234500301', cat: 'Beverages', unit: 'pcs', mrp: 285, price: 264, cost: 232, tax: 18, stock: 33, reorder: 25 },
]

export function stockStatus(p: Product): 'in' | 'low' | 'out' {
  if (p.stock <= 0) return 'out'
  if (p.stock <= p.reorder) return 'low'
  return 'in'
}

export const CUSTOMERS: Customer[] = [
  { id: 'C001', name: 'Walk-in Customer', phone: '', type: 'walkin' },
  { id: 'C002', name: 'Ramesh Gowda', phone: '98452 11003', type: 'b2c', points: 480, balance: 0 },
  { id: 'C003', name: 'Lakshmi Stores', phone: '99016 77254', type: 'b2b', points: 0, balance: 4250 },
  { id: 'C004', name: 'Anitha Reddy', phone: '90080 45517', type: 'b2c', points: 1260, balance: 0 },
  { id: 'C005', name: 'Suresh Kumar', phone: '94488 32109', type: 'b2c', points: 95, balance: 320 },
  { id: 'C006', name: 'Sri Annapurna Mess', phone: '97315 60042', type: 'b2b', points: 0, balance: 8900 },
]

export const BILLS: Bill[] = [
  { no: 'NJK-2025-04412', cust: 'Walk-in Customer', cashier: 'Priya N.', items: 7, total: 842, pay: 'UPI', status: 'paid', time: '6:48 PM' },
  { no: 'NJK-2025-04411', cust: 'Ramesh Gowda', cashier: 'Priya N.', items: 3, total: 318, pay: 'Cash', status: 'paid', time: '6:41 PM' },
  { no: 'NJK-2025-04410', cust: 'Lakshmi Stores', cashier: 'Manoj R.', items: 22, total: 5640, pay: 'Credit', status: 'credit', time: '6:33 PM' },
  { no: 'NJK-2025-04409', cust: 'Walk-in Customer', cashier: 'Deepa S.', items: 2, total: 96, pay: 'Cash', status: 'paid', time: '6:25 PM' },
  { no: 'NJK-2025-04408', cust: 'Anitha Reddy', cashier: 'Priya N.', items: 11, total: 1284, pay: 'Card', status: 'paid', time: '6:14 PM' },
  { no: 'NJK-2025-04407', cust: 'Walk-in Customer', cashier: 'Manoj R.', items: 5, total: 410, pay: 'UPI', status: 'paid', time: '6:02 PM' },
  { no: 'NJK-2025-04406', cust: 'Suresh Kumar', cashier: 'Deepa S.', items: 4, total: 268, pay: 'Split', status: 'paid', time: '5:51 PM' },
  { no: 'NJK-2025-04405', cust: 'Walk-in Customer', cashier: 'Priya N.', items: 9, total: 1130, pay: 'UPI', status: 'paid', time: '5:39 PM' },
  { no: 'NJK-2025-04404', cust: 'Sri Annapurna Mess', cashier: 'Manoj R.', items: 31, total: 9420, pay: 'Credit', status: 'credit', time: '5:22 PM' },
  { no: 'NJK-2025-04403', cust: 'Walk-in Customer', cashier: 'Deepa S.', items: 6, total: 556, pay: 'Cash', status: 'paid', time: '5:08 PM' },
]

export const SALES_7D: SalesDay[] = [
  { d: 'Mon', cur: 58200, prev: 51400 },
  { d: 'Tue', cur: 61800, prev: 55900 },
  { d: 'Wed', cur: 54300, prev: 58100 },
  { d: 'Thu', cur: 67400, prev: 60200 },
  { d: 'Fri', cur: 78900, prev: 71500 },
  { d: 'Sat', cur: 89600, prev: 82300 },
  { d: 'Sun', cur: 72100, prev: 69800 },
]

export const TOP_PRODUCTS: TopProduct[] = [
  { name: 'Sona Masoori Rice', qty: 184, rev: 12512 },
  { name: 'Nandini Milk 500ml', qty: 312, rev: 7800 },
  { name: 'Parle-G Biscuits', qty: 642, rev: 6420 },
  { name: 'Sunflower Oil', qty: 41, rev: 6109 },
  { name: 'Tata Tea Gold', qty: 38, rev: 5244 },
]

export const ACTIVITY: ActivityItem[] = [
  { who: 'Priya N.', act: 'created bill', detail: 'NJK-2025-04412 · ₹842', icon: 'receipt', time: '2m ago', tone: 'primary' },
  { who: 'Manoj R.', act: 'adjusted stock', detail: 'Toor Dal +40 kg · GRN received', icon: 'package-plus', time: '14m ago', tone: 'success' },
  { who: 'System', act: 'low stock alert', detail: 'Clinic Plus Shampoo · 8 left', icon: 'alert-triangle', time: '26m ago', tone: 'warning' },
  { who: 'Deepa S.', act: 'created bill', detail: 'NJK-2025-04409 · ₹96', icon: 'receipt', time: '38m ago', tone: 'primary' },
  { who: 'Anitha (Admin)', act: 'added product', detail: 'Horlicks 500g · BEV-HRLK-50', icon: 'plus-circle', time: '1h ago', tone: 'info' },
  { who: 'System', act: 'out of stock', detail: 'Chana Dal · reorder 50 kg', icon: 'x-circle', time: '1h ago', tone: 'danger' },
  { who: 'Manoj R.', act: 'created bill', detail: 'NJK-2025-04410 · ₹5,640 (credit)', icon: 'receipt', time: '2h ago', tone: 'primary' },
  { who: 'Priya N.', act: 'opened register', detail: 'Counter 1 · ₹2,000 float', icon: 'lock-open', time: '8h ago', tone: 'neutral' },
]

export const SUPPLIERS: Supplier[] = [
  { id: 'S01', name: 'Sri Venkateshwara Distributors', cat: 'Grains', gstin: '29AAFCS1234K1Z2', phone: '0820 256 7711' },
  { id: 'S02', name: 'Nandini Dairy Depot', cat: 'Dairy', gstin: '29AAACK3456M1Z9', phone: '0820 252 3300' },
  { id: 'S03', name: 'Coastal Beverages Co.', cat: 'Beverages', gstin: '29AABCB7788Q1Z4', phone: '0824 244 1190' },
  { id: 'S04', name: 'HUL Distributor — Udupi', cat: 'Personal Care', gstin: '29AAACH1199L1Z7', phone: '0820 257 8821' },
  { id: 'S05', name: 'Britannia & Parle Agencies', cat: 'Snacks', gstin: '29AAGCB4521N1Z3', phone: '0820 259 4410' },
]

export const PURCHASES: Purchase[] = [
  { no: 'PB-2025-00231', sup: 'Sri Venkateshwara Distributors', date: '01 Jun 2025', due: '16 Jun 2025', items: 8, sub: 41200, gst: 2060, status: 'billed', lines: [['Sona Masoori Rice', 300, 58], ['Toor Dal (Arhar)', 80, 118], ['Whole Wheat Atta', 200, 42], ['Sunflower Oil', 60, 132]] },
  { no: 'PB-2025-00230', sup: 'Nandini Dairy Depot', date: '01 Jun 2025', due: '08 Jun 2025', items: 6, sub: 18640, gst: 1490, status: 'billed', lines: [['Nandini Toned Milk 500ml', 240, 23], ['Amul Butter 100g', 60, 50], ['Paneer 200g', 40, 71], ['Ghee 500ml', 24, 268]] },
  { no: 'PB-2025-00229', sup: 'Coastal Beverages Co.', date: '31 May 2025', due: '15 Jun 2025', items: 5, sub: 22760, gst: 4097, status: 'paid', lines: [['Coca-Cola 750ml', 120, 35], ['Bisleri Water 1L', 240, 14], ['Tata Tea Gold 250g', 40, 122], ['Bru Coffee 100g', 30, 160]] },
  { no: 'PB-2025-00228', sup: 'Britannia & Parle Agencies', date: '30 May 2025', due: '14 Jun 2025', items: 9, sub: 15880, gst: 2858, status: 'billed', lines: [['Parle-G Biscuits', 600, 8], ['Lays Classic 52g', 160, 15], ['Maggi Noodles 4-pack', 80, 44], ['Cadbury Dairy Milk 50g', 90, 34]] },
  { no: 'PB-2025-00227', sup: 'HUL Distributor — Udupi', date: '29 May 2025', due: '13 Jun 2025', items: 7, sub: 19420, gst: 3496, status: 'paid', lines: [['Lifebuoy Soap 125g', 180, 28], ['Colgate Strong 200g', 60, 90], ['Clinic Plus Shampoo', 40, 132], ['Dettol Handwash 200ml', 60, 74]] },
  { no: 'PB-2025-00226', sup: 'Sri Venkateshwara Distributors', date: '28 May 2025', due: '12 Jun 2025', items: 4, sub: 9680, gst: 484, status: 'paid', lines: [['Chana Dal', 50, 76], ['Idli Rava', 40, 46], ['MTR Rava Idli Mix', 30, 56]] },
  { no: 'PB-2025-00225', sup: 'Nandini Dairy Depot', date: '27 May 2025', due: '03 Jun 2025', items: 3, sub: 12400, gst: 620, status: 'pending', lines: [['Eggs (Tray of 30)', 40, 172], ['Curd 400g', 60, 30]] },
  { no: 'PB-2025-00224', sup: 'Coastal Beverages Co.', date: '26 May 2025', due: '10 Jun 2025', items: 5, sub: 16320, gst: 2938, status: 'billed', lines: [['Horlicks 500g', 30, 232], ['Real Mixed Fruit 1L', 30, 94], ['Coca-Cola 750ml', 120, 35]] },
  { no: 'PB-2025-00223', sup: 'Britannia & Parle Agencies', date: '25 May 2025', due: '09 Jun 2025', items: 6, sub: 11240, gst: 2023, status: 'paid', lines: [['Good Day Cookies', 120, 26], ['Britannia Cake 60g', 90, 22], ['Haldiram Bhujia 200g', 60, 47]] },
  { no: 'PB-2025-00222', sup: 'HUL Distributor — Udupi', date: '24 May 2025', due: '08 Jun 2025', items: 4, sub: 8600, gst: 1548, status: 'draft', lines: [['Dettol Handwash 200ml', 40, 74], ['Lifebuoy Soap 125g', 120, 28]] },
]

export const USERS: User[] = [
  { name: 'Anitha Reddy', email: 'anitha@nenjankod.in', role: 'Tenant Admin', status: 'active', last: 'Just now' },
  { name: 'Priya Narayan', email: 'priya@nenjankod.in', role: 'Cashier', status: 'active', last: '2 min ago' },
  { name: 'Manoj Rao', email: 'manoj@nenjankod.in', role: 'Manager', status: 'active', last: '12 min ago' },
  { name: 'Deepa Shetty', email: 'deepa@nenjankod.in', role: 'Cashier', status: 'active', last: '40 min ago' },
  { name: 'Kiran Bhat', email: 'kiran@nenjankod.in', role: 'Inventory Staff', status: 'inactive', last: '3 days ago' },
]

export const AUDIT: AuditEntry[] = [
  { act: 'Bill voided', user: 'Manoj Rao', ts: 'Today 6:12 PM', ip: '10.0.4.18' },
  { act: 'Tax rate changed (Snacks 12→18%)', user: 'Anitha Reddy', ts: 'Today 4:30 PM', ip: '10.0.4.2' },
  { act: 'User deactivated (Kiran Bhat)', user: 'Anitha Reddy', ts: 'Today 11:08 AM', ip: '10.0.4.2' },
  { act: 'Bulk stock import (128 rows)', user: 'Manoj Rao', ts: 'Yesterday 7:51 PM', ip: '10.0.4.18' },
  { act: 'Login success', user: 'Priya Narayan', ts: 'Yesterday 9:02 AM', ip: '10.0.4.31' },
  { act: 'Printer settings updated', user: 'Anitha Reddy', ts: '28 May 5:44 PM', ip: '10.0.4.2' },
]

export const money = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN')
export const money2 = (n: number): string => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
