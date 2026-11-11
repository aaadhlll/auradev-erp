from pathlib import Path
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'Mercantile_Project_Documentation.docx'

GREEN = '176B58'
LIGHT_GREEN = 'E8F3EF'
LIGHT_GRAY = 'F4F5F6'
BORDER = 'D9D9D9'


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), fill)
    tc_pr.append(shd)


def set_cell_border(cell, color=BORDER):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in('w:tcBorders')
    if borders is None:
        borders = OxmlElement('w:tcBorders')
        tc_pr.append(borders)
    for edge in ('top', 'left', 'bottom', 'right'):
        tag = 'w:' + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn('w:val'), 'single')
        element.set(qn('w:sz'), '6')
        element.set(qn('w:color'), color)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement('w:tblHeader')
    tbl_header.set(qn('w:val'), 'true')
    tr_pr.append(tbl_header)


def set_width(cell, inches):
    cell.width = Inches(inches)
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn('w:tcW'))
    if tc_w is None:
        tc_w = OxmlElement('w:tcW')
        tc_pr.append(tc_w)
    tc_w.set(qn('w:w'), str(int(inches * 1440)))
    tc_w.set(qn('w:type'), 'dxa')


def set_run(run, size=10.5, bold=False, color='202124'):
    run.font.name = 'Aptos'
    run._element.rPr.rFonts.set(qn('w:ascii'), 'Aptos')
    run._element.rPr.rFonts.set(qn('w:hAnsi'), 'Aptos')
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def add_text(doc, text, style=None, size=10.5, bold=False, color='202124'):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.18
    run = p.add_run(text)
    set_run(run, size, bold, color)
    return p


def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet' if level == 0 else 'List Bullet 2')
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.12
    set_run(p.add_run(text), 10.25)
    return p


def heading(doc, text, level=1):
    p = doc.add_paragraph(style=f'Heading {level}')
    p.paragraph_format.space_before = Pt(16 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    set_run(run, 15 if level == 1 else 12, True, '000000')
    return p


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = 'Table Grid'
    hdr = t.rows[0]
    set_repeat_table_header(hdr)
    for i, value in enumerate(headers):
        cell = hdr.cells[i]
        set_cell_shading(cell, GREEN)
        set_cell_border(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_run(p.add_run(value), 9.5, True, 'FFFFFF')
        if widths: set_width(cell, widths[i])
    for r_idx, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cell = cells[i]
            set_cell_border(cell)
            if r_idx % 2 == 1: set_cell_shading(cell, LIGHT_GRAY)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            set_run(p.add_run(str(value)), 9.25)
            if widths: set_width(cell, widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def add_footer(section):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    set_run(p.add_run('Mercantile Project Documentation  |  AuraDev'), 8.5, False, '6B7280')


doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)
add_footer(section)

styles = doc.styles
styles['Normal'].font.name = 'Aptos'
styles['Normal']._element.rPr.rFonts.set(qn('w:ascii'), 'Aptos')
styles['Normal']._element.rPr.rFonts.set(qn('w:hAnsi'), 'Aptos')

# Cover
p = doc.add_paragraph(style='Title')
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
p.paragraph_format.space_before = Pt(62)
p.paragraph_format.space_after = Pt(12)
set_run(p.add_run('Mercantile Project Documentation'), 28, True, '000000')
sub = doc.add_paragraph()
sub.paragraph_format.space_after = Pt(28)
set_run(sub.add_run('Implementation handover and product record'), 14, False, '4B5563')

cover = doc.add_table(rows=4, cols=2)
cover.alignment = WD_TABLE_ALIGNMENT.LEFT
cover.autofit = False
for i, (label, value) in enumerate([
    ('Product', 'Mercantile retail and grocery ERP'),
    ('Prepared for', 'AuraDev'),
    ('Scope', 'Frontend, backend, database, operations, and Qatar localisation'),
    ('Status', 'Active development handover'),
]):
    set_width(cover.rows[i].cells[0], 1.45)
    set_width(cover.rows[i].cells[1], 4.9)
    for j, text in enumerate((label, value)):
        cell = cover.rows[i].cells[j]
        set_cell_border(cell)
        if j == 0: set_cell_shading(cell, LIGHT_GREEN)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(3)
        set_run(p.add_run(text), 10.5, j == 0, GREEN if j == 0 else '202124')

doc.add_paragraph()
add_text(doc, 'This document records the application built so far, the decisions behind it, how it is started locally, and the next work needed before a Qatar grocery rollout. It is intended to be the working handover for AuraDev and future developers.', size=11)

heading(doc, 'Executive summary')
add_text(doc, 'Mercantile is a modular retail ERP for grocery operations. It has a Next.js web application, a Spring Boot API, PostgreSQL storage, role-based access, POS billing, inventory, procurement foundations, administration controls, returns, customer credit settlement, and tenant-aware module access. The latest work localises the product for Qatar by using QAR, commercial registration terminology, a disabled-by-default tax setting, and grocery batch and expiry tracking.', size=10.75)

heading(doc, 'Current status')
table(doc, ['Area', 'Current position'], [
    ('Frontend', 'Next.js 16 and React 19 application with TypeScript and React Query.'),
    ('Backend', 'Spring Boot 3.3 Java 21 API with Flyway migrations and PostgreSQL.'),
    ('Retail workflows', 'POS, sales bills, returns, customer credit settlement, item master, and stock transactions are implemented.'),
    ('Qatar readiness', 'QAR display, CR TIN terminology, disabled-by-default tax, batch and expiry receipt tracking are implemented.'),
    ('Verification', 'TypeScript type check and Maven compile checks passed after the latest changes.'),
], [1.4, 5.0])

doc.add_page_break()
heading(doc, 'System architecture')
table(doc, ['Layer', 'Technology', 'Responsibility'], [
    ('Web client', 'Next.js 16, React 19, TypeScript', 'Mercantile user interface, module hub, POS, settings, reports, and role-aware navigation.'),
    ('Client data', 'TanStack React Query', 'Fetches, caches, invalidates, and refreshes API data after mutations.'),
    ('API', 'Spring Boot 3.3, Java 21', 'Authentication, permissions, tenancy, business rules, reporting endpoints, and file uploads.'),
    ('Database', 'PostgreSQL and Flyway', 'Tenant data, users, catalogue, inventory, bills, payments, returns, settings, and audit history.'),
    ('Containerisation', 'Docker', 'Produces a repeatable Java API build and runtime image for deployment.'),
], [1.05, 1.9, 3.45])
add_text(doc, 'The frontend communicates with the API through its configured API base URL. The backend uses JWT authentication and stores tenant-specific operational data in PostgreSQL. Flyway migration files are applied in version order whenever the backend starts against the database.', size=10.5)

heading(doc, 'Why Docker is included')
add_text(doc, 'Docker is used for the backend deployment path. It builds the Spring Boot application with Java 21 and runs the packaged application in a consistent lightweight runtime. This avoids differences between developer laptops and hosting platforms. Docker does not replace PostgreSQL; the database remains a separate service. For local development, the backend can also be run directly with Maven.', size=10.5)

heading(doc, 'Project folders')
table(doc, ['Folder', 'Purpose'], [
    ('auradev-erp', 'Frontend repository. Contains app routes, Mercantile components, data APIs, UI styles, and tests.'),
    ('auradev-erp-backend', 'Backend repository. Contains Spring Boot source, Flyway migrations, environment examples, Dockerfile, and uploads.'),
    ('frontend app', 'Next.js App Router entry points and module routes.'),
    ('frontend components erp', 'Mercantile screens including POS, inventory, settings, module hub, bills, and dashboard.'),
    ('backend db migration', 'Versioned schema and data migrations. Never modify already-applied migration files.'),
], [1.75, 4.65])

heading(doc, 'Local startup')
add_text(doc, 'Prerequisites: Node.js with npm, Java 21, Maven, PostgreSQL, and Docker Desktop only when using containers. The default local backend configuration expects PostgreSQL on port 5433 with database auradev_erp and the credentials defined in the backend .env file.', size=10.5)
table(doc, ['Step', 'Command or action'], [
    ('Database', 'Start PostgreSQL and create or start the configured auradev_erp database.'),
    ('Backend', 'In auradev-erp-backend, run: mvn spring-boot:run'),
    ('Frontend', 'In auradev-erp, run: npm run dev'),
    ('Open', 'Use http://localhost:3000 for Mercantile. The API defaults to http://localhost:8080.'),
    ('After new migrations', 'Restart the backend. Flyway applies pending V12 and V13 migrations automatically.'),
], [1.45, 4.95])

doc.add_page_break()
heading(doc, 'Completed product work')
heading(doc, 'Navigation and modular workspace', 2)
add_bullet(doc, 'Created the Mercantile module hub to act as the application switcher for Overview, Point of Sale, Inventory, Procurement, and Administration.')
add_bullet(doc, 'Added role-based module access. Tenant administrators can decide which modules are visible for each role, such as POS-only access for a cashier.')
add_bullet(doc, 'Kept the module hub consistent with the main application shell, including notification and theme controls, without a separate profile card or splash screen.')
add_bullet(doc, 'Added a small transition loader for module changes rather than a full splash screen.')

heading(doc, 'Administration and security', 2)
add_bullet(doc, 'Redesigned Administration as a settings workspace with its subsections in the left sidebar: Store profile, Billing and POS, Receipt output, Team access, Module access, and Activity log.')
add_bullet(doc, 'Added user management, role permissions, module enablement, and audit logging foundations.')
add_bullet(doc, 'Store profile includes store identity, phone, address, logo, bill prefix, footer, and Qatar-facing CR or TIN terminology.')

heading(doc, 'POS, sales, and customers', 2)
add_bullet(doc, 'Improved the payment dialog so the due amount can be inserted into the tendered amount field.')
add_bullet(doc, 'Added customer search and typed selection at POS rather than a fixed-only customer selector.')
add_bullet(doc, 'Added held bills, split payments, partial payment flows, sales bill detail, customer credit settlement, repayment history, and audit visibility.')
add_bullet(doc, 'Implemented sales returns with return status and reporting so returned quantities and amounts can be reviewed.')

heading(doc, 'Inventory organisation', 2)
add_bullet(doc, 'Reorganised inventory into Item master and Transactions.')
add_bullet(doc, 'Added distinct stock transaction workflows: Opening stock, Stock receipt, Stock adjustment, Physical count, and Damage and wastage.')
add_bullet(doc, 'Each transaction writes a stock movement and can be reviewed through an item movement history.')
add_bullet(doc, 'Added item master create and edit flows, product exports, inventory summaries, reorder levels, weighted item support, and stock status indicators.')

heading(doc, 'Grocery batch and expiry tracking', 2)
add_bullet(doc, 'Product master includes a Track batches and expiry dates option. It should be enabled for date-sensitive grocery products.')
add_bullet(doc, 'When the option is enabled, Stock receipt requires a batch or lot number and accepts an expiry date.')
add_bullet(doc, 'The backend saves the stock receipt and its inventory batch in one transaction. An expired batch cannot be received into saleable stock.')
add_bullet(doc, 'Movement history shows each saved batch, quantity on hand, received date, expiry date, and an expires-soon indication.')
add_text(doc, 'Important current boundary: batches are recorded and visible, but POS has not yet allocated sold stock by FEFO or automatically blocked expired batches. That is the next expiry-control phase.', size=10.5, bold=True, color='7C2D12')

doc.add_page_break()
heading(doc, 'Qatar localisation')
add_text(doc, 'The project has been moved away from India-specific presentation for the Qatar grocery client. The internal data model retains some legacy GST field names for backward compatibility, but user-facing terminology is being presented as generic tax.', size=10.5)
table(doc, ['Change', 'Implemented behaviour'], [
    ('Currency', 'Core money display, receipt export, purchase export, and audit amounts use QAR formatting.'),
    ('Business registration', 'Store profile labels the identifier as Commercial registration or TIN.'),
    ('Tax default', 'New product tax rate defaults to 0 percent.'),
    ('Tax setting', 'Billing and POS has an Enable tax calculation switch. It defaults to disabled for Qatar.'),
    ('POS when disabled', 'Tax badge, tax scheme selector, line rates, and tax total are hidden.'),
    ('Backend enforcement', 'When tax is disabled, the API calculates zero tax for new bills even if historic product rates exist.'),
    ('Future readiness', 'If a future applicable tax rule is introduced, an administrator can enable tax and configure rates without redesigning POS.'),
], [1.55, 4.85])

heading(doc, 'Database migrations added during this work')
table(doc, ['Migration', 'Purpose'], [
    ('V8', 'Role-based module access.'),
    ('V9', 'Sales returns.'),
    ('V10', 'Customer credit payments and settlement history.'),
    ('V11', 'Additional stock movement types for inventory transactions.'),
    ('V12', 'Product expiry tracking and tenant inventory batches.'),
    ('V13', 'Billing tax enabled setting, defaulted off for existing tenants.'),
], [1.05, 5.35])

heading(doc, 'Operational rules')
add_bullet(doc, 'Do not rename, delete, or edit an already-applied Flyway migration. Add a new versioned migration for each database change.')
add_bullet(doc, 'Restart the backend after pulling backend changes so Flyway can apply pending migrations.')
add_bullet(doc, 'Keep tax disabled for the Qatar grocery tenant unless a qualified local compliance decision requires it.')
add_bullet(doc, 'Use batches for any product that has an expiry date. Use damage and wastage when stock is no longer saleable.')

heading(doc, 'Verification completed')
table(doc, ['Check', 'Result'], [
    ('Frontend type check', 'npx tsc --noEmit passed.'),
    ('Backend compile', 'mvn test -DskipTests passed; test sources are currently absent, so this confirms build compilation rather than behavioural test coverage.'),
    ('Migration readiness', 'V12 and V13 are present and will be applied by Flyway on backend restart.'),
], [1.7, 4.7])

doc.add_page_break()
heading(doc, 'Recommended next implementation phases')
table(doc, ['Priority', 'Work item', 'Reason'], [
    ('1', 'FEFO and expired batch control', 'Allocate stock from the earliest expiry batch first, warn on near expiry, and block expired batches at POS.'),
    ('2', 'Goods receipt against purchase orders', 'Connect procurement receiving, supplier invoices, costs, and batch creation in one audited workflow.'),
    ('3', 'Qatar excise products', 'Add an excise flag and compliance reporting for relevant tobacco and beverage categories without applying tax to normal grocery items.'),
    ('4', 'Arabic interface', 'Add Arabic translations and right-to-left layout support for customer-facing and staff workflows.'),
    ('5', 'Multi-branch inventory', 'Introduce stores or branches, stock transfers, branch-level users, and consolidated reporting.'),
    ('6', 'Cash register shifts', 'Opening float, shift close, expected versus counted cash, variance, and cashier accountability.'),
    ('7', 'Reports', 'Daily sales, margin, stock valuation, near-expiry, wastage, returns, supplier purchase, and customer credit reports.'),
    ('8', 'Automated testing', 'Add API service tests and end-to-end POS tests for bills, returns, credit, tax disabled, and stock movement rules.'),
], [0.65, 2.15, 3.6])

heading(doc, 'Release checklist')
add_bullet(doc, 'Configure production database credentials, JWT secret, CORS origins, public API URL, and persistent uploads directory through environment variables.')
add_bullet(doc, 'Run a clean database migration on a staging environment before client data is imported.')
add_bullet(doc, 'Confirm Qatar business registration and receipt wording with the client before production go-live.')
add_bullet(doc, 'Import and validate item master data, barcodes, opening stock, reorder levels, and batch-expiry items.')
add_bullet(doc, 'Create user accounts and assign POS, inventory, procurement, and administration modules by role.')
add_bullet(doc, 'Test a complete sale, return, credit sale, repayment, stock receipt, batch receipt, count, and wastage transaction before launch.')

heading(doc, 'Known limitations')
add_bullet(doc, 'Batch quantities are not yet decremented by individual sale allocation; batch records are currently receipt and visibility controls.')
add_bullet(doc, 'The existing backend uses some legacy GST-named API fields internally. This does not show in the normal Qatar UI when tax is disabled, but can be renamed in a later API version if desired.')
add_bullet(doc, 'Automated tests are not yet present in the backend test source tree. Build checks pass, but coverage should be added before production scale-up.')

heading(doc, 'Quick handover')
add_text(doc, 'For daily use, open Mercantile, select the role-appropriate module, and perform catalogue changes in Item master and stock changes in Inventory Transactions. For Qatar, leave Tax Calculation disabled in Administration and use batch tracking for date-sensitive items. For deployment and any schema update, restart the backend and confirm Flyway completed successfully in the logs.', size=10.75)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.core_properties.title = 'Mercantile Project Documentation'
doc.core_properties.author = 'AuraDev'
doc.save(OUT)
print(OUT)
