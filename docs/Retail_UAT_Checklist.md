# Mercantile Retail UAT Checklist

Use a **separate test tenant and database**. Do not run these cases against a client’s live store.

## Release gate

- [ ] Frontend production build succeeds.
- [ ] Backend build succeeds and Flyway migrations apply to the test database.
- [ ] A full database backup is created and restored successfully in the test environment.
- [ ] Test accounts exist for Tenant Admin, Manager, Cashier, Inventory Staff and Procurement Staff.
- [ ] A real receipt printer and barcode scanner are connected for hardware checks.

## POS and sales

- [ ] Open a cashier shift with a float amount. Billing is blocked before a shift opens.
- [ ] Scan a barcode, search a product, and enter quantity manually.
- [ ] Confirm stock shown at POS matches Inventory and blocks a quantity above available stock.
- [ ] Complete cash, card, UPI, credit and split-payment bills.
- [ ] Confirm tax is absent from the screen and receipt when tax is disabled; enable it and confirm the calculation is correct.
- [ ] Verify the receipt number, customer, cashier, line quantities, tendered amount, change and each split payment method.
- [ ] Hold a bill, restore it, then complete it once only.
- [ ] Create a full return and partial return. Returned quantity must never exceed sold minus already returned quantity.
- [ ] Confirm every sale/return updates stock, Sales Bills, Sales Returns, dashboard totals and audit activity exactly once.

## Customer credit and shifts

- [ ] Create a credit sale for a named customer and verify it appears in customer credit.
- [ ] Settle part of the balance, then settle the remainder. Confirm ledger history, dates and payment method are correct.
- [ ] Close a shift with the exact cash amount: variance is QAR 0.00.
- [ ] Close a second shift with a higher and lower count: positive and negative variance display correctly.
- [ ] Verify manager shift history, cashier/date filters and printed end-of-shift report.

## Inventory

- [ ] Add a product with barcode, category, price, unit and opening stock.
- [ ] Record opening stock with multiple lines; each line saves and the total quantity is correct.
- [ ] Record stock receipt, adjustment, physical count and damage/wastage.
- [ ] Use Stock movements to select one item and verify its complete movement journey and balances.
- [ ] Verify a sale decreases stock and a return restores stock.
- [ ] Verify batches/expiry where the product is expiry-tracked.

## Procurement

- [ ] Add and search for a supplier.
- [ ] Record a purchase order and ensure it remains visible after completion.
- [ ] Receive its GRN/purchase receipt; stock must increase only after receipt, not when the order is created.
- [ ] Record purchase return and confirm stock and supplier balance update correctly.
- [ ] Create five bills for one supplier, make a partial settlement, and allocate a later payment across multiple bills.
- [ ] Verify each bill’s paid amount, due amount and supplier settlement history.
- [ ] Import a purchase spreadsheet with valid and invalid lines; verify the import summary and error handling.

## Access, reliability and security

- [ ] Cashier can bill and manage own shift but cannot manage products, suppliers, users or settings.
- [ ] Procurement staff can manage suppliers/purchases but cannot bill or change administration settings.
- [ ] Inventory staff can manage inventory but cannot open administration settings.
- [ ] Admin role/module access changes take effect after a fresh sign-in.
- [ ] Attempt protected API requests using a cashier token; unauthorized operations return 403.
- [ ] Log out, refresh the browser, and confirm no protected data remains visible.
- [ ] Test two cashier sessions attempting to sell the final unit. Only one sale may complete.
- [ ] Simulate a lost internet connection during billing; confirm the operator sees a clear failure and does not assume the bill saved.

## Sign-off

Record the test date, build version, test tenant, tester, issue ID and outcome for each failed case. The client should receive the system only after every required case passes and the backup restore has been verified.
