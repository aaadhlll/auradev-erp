from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "Mercantile_Offline_Multi_Terminal_Deployment_Guide.docx"

INK = "171B1A"
MUTED = "5D6761"
GREEN = "0F493B"
MINT = "EAF3EE"
LINE = "D9DED9"
WHITE = "FFFFFF"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_border(cell, color=LINE):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "6")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=110, start=130, bottom=110, end=130):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_font(run, size=10.5, bold=False, color=INK, italic=False):
    run.font.name = "Segoe UI"
    run._element.rPr.rFonts.set(qn("w:ascii"), "Segoe UI")
    run._element.rPr.rFonts.set(qn("w:hAnsi"), "Segoe UI")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def para(doc, text="", size=10.5, bold=False, color=INK, space_after=7, style=None, italic=False):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.16
    r = p.add_run(text)
    set_font(r, size, bold, color, italic)
    return p


def heading(doc, text, level=1):
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.space_before = Pt(18 if level == 1 else 11)
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    set_font(r, 17 if level == 1 else 12.5, True, INK)
    return p


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.1
    r = p.add_run(text)
    set_font(r, 10.3, False, INK)
    return p


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    if widths:
        for i, width in enumerate(widths):
            t.columns[i].width = Inches(width)
    for i, header in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.width = Inches(widths[i]) if widths else cell.width
        set_cell_shading(cell, GREEN)
        set_cell_border(cell)
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(header)
        set_font(r, 9.2, True, WHITE)
    for row_index, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cell = cells[i]
            cell.width = Inches(widths[i]) if widths else cell.width
            if row_index % 2 == 1:
                set_cell_shading(cell, MINT)
            set_cell_border(cell)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.08
            r = p.add_run(str(value))
            set_font(r, 9.2, False, INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    d = Document()
    sec = d.sections[0]
    sec.top_margin = Inches(0.78)
    sec.bottom_margin = Inches(0.7)
    sec.left_margin = Inches(0.82)
    sec.right_margin = Inches(0.82)

    styles = d.styles
    styles["Normal"].font.name = "Segoe UI"
    styles["Normal"]._element.rPr.rFonts.set(qn("w:ascii"), "Segoe UI")
    styles["Normal"]._element.rPr.rFonts.set(qn("w:hAnsi"), "Segoe UI")
    styles["Normal"].font.size = Pt(10.5)
    for name in ("Title", "Heading 1", "Heading 2"):
        styles[name].font.name = "Segoe UI"
        styles[name]._element.rPr.rFonts.set(qn("w:ascii"), "Segoe UI")
        styles[name]._element.rPr.rFonts.set(qn("w:hAnsi"), "Segoe UI")
        styles[name].font.color.rgb = RGBColor.from_string(INK)

    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = footer.add_run("AuraDev  |  Mercantile Offline Deployment Guide")
    set_font(fr, 8.5, False, MUTED)

    # Cover
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(88)
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run("AURADEV")
    set_font(r, 13, True, GREEN)
    title = d.add_paragraph(style="Title")
    title.paragraph_format.space_before = Pt(6)
    title.paragraph_format.space_after = Pt(14)
    run = title.add_run("Mercantile Offline Multi Terminal Deployment Guide")
    set_font(run, 31, True, INK)
    sub = d.add_paragraph()
    sub.paragraph_format.space_after = Pt(32)
    r = sub.add_run("A practical guide for installing one local Mercantile system across a grocery store server, cashier counters and manager computers")
    set_font(r, 15, False, MUTED)
    para(d, "Purpose", 12, True, GREEN, 8)
    para(d, "This guide explains the recommended offline deployment model. One computer hosts the shared database and backend. Every counter connects through the store network, so stock, sales, shifts, purchases and customer balances remain consistent across the shop.", 11.5, False, INK, 14)
    table(d, ["Deployment model", "Suitable for"], [["Local server with connected desktop terminals", "A single grocery store that prefers local data and can keep one server PC powered on during business hours"]], [2.7, 3.8])
    para(d, "Document status  Proposed implementation guide", 9, False, MUTED, 0)
    d.add_page_break()

    heading(d, "1  Scope and operating model")
    para(d, "Mercantile runs as one shared store system. Cashiers do not maintain their own copy of the database. They sign in from registered terminals and work against the same local server.")
    table(d, ["Component", "Where it runs", "Purpose"], [
        ["Mercantile database", "Server PC", "Stores bills, stock, customers, purchases, shifts and audit history."],
        ["Mercantile backend", "Server PC", "Applies business rules and provides the local API to all terminals."],
        ["Mercantile desktop app", "Cashier and manager PCs", "Provides POS and back-office screens for each approved terminal."],
        ["Store network", "Router, switch or Wi-Fi", "Connects every terminal to the server without needing cloud access."],
    ], [1.55, 1.55, 3.4])
    heading(d, "Recommended layout", 2)
    para(d, "The server receives a stable local address, for example 192.168.1.10. Each terminal is configured to use that address. Do not use localhost on cashier computers, because localhost points to that cashier computer rather than the shared server.")
    table(d, ["Device", "Example name", "Connection"], [
        ["Server PC", "MRC SERVER", "Database and backend run locally. Static or reserved IP: 192.168.1.10."],
        ["Cashier PC 1", "Main Counter", "Mercantile desktop app connects to http://192.168.1.10:8080."],
        ["Cashier PC 2", "Express Counter", "Mercantile desktop app connects to http://192.168.1.10:8080."],
        ["Manager PC", "Back Office", "Mercantile desktop app connects to the same server and has manager permissions."],
    ], [1.35, 1.6, 3.55])
    d.add_page_break()

    heading(d, "2  Hardware and network requirements")
    para(d, "Choose stable equipment before software installation. The server is the most important device because all terminals depend on it.")
    table(d, ["Area", "Recommended minimum", "Notes"], [
        ["Server PC", "Modern Core i5 or equivalent, 16 GB RAM, 512 GB SSD", "Use a dedicated PC where possible. Keep it switched on while the shop operates."],
        ["Power protection", "UPS for server, router and network switch", "Prevents abrupt shutdowns and protects the database during a power outage."],
        ["Network", "Wired LAN preferred, business-grade router", "Use Wi-Fi only where cabling is impractical. Reserve the server IP in the router."],
        ["Cashier terminal", "Windows PC, barcode scanner, receipt printer and cash drawer", "Each counter needs its own approved terminal registration."],
        ["Backup storage", "Encrypted external drive or approved local NAS", "Keep at least one backup copy away from the server PC."],
    ], [1.4, 2.3, 2.8])
    heading(d, "Network rules", 2)
    bullet(d, "Allow cashier terminals to reach only the Mercantile backend port on the server. Do not expose the database port to the public internet.")
    bullet(d, "Use a DHCP reservation for the server address instead of relying on a manually chosen IP that can later conflict with another device.")
    bullet(d, "Use strong Windows passwords and separate an administrator account from daily cashier accounts.")
    bullet(d, "Record the router login, server administrator password and backup location in a secure handover record.")
    d.add_page_break()

    heading(d, "3  Server installation procedure")
    para(d, "AuraDev or an authorised installer completes the server setup before any cashier terminal is connected.")
    table(d, ["Step", "Installer action", "Acceptance check"], [
        ["1", "Prepare the Windows server account, security updates and UPS connection.", "Server restarts normally and remains on the store network."],
        ["2", "Install PostgreSQL and create the Mercantile database with a dedicated application user.", "Database is reachable locally by the backend and not exposed publicly."],
        ["3", "Install the Mercantile backend as a Windows service.", "Backend starts automatically after a server restart."],
        ["4", "Configure the store profile, currency, receipt settings, users and permitted modules.", "Administrator can sign in and see the correct store configuration."],
        ["5", "Set the server address and firewall rule for store terminals.", "A test terminal can reach the backend at the reserved local address."],
        ["6", "Enable encrypted daily backups and perform one restore test.", "A backup file exists and restores into a test database successfully."],
    ], [0.45, 3.55, 2.5])
    heading(d, "Server configuration record", 2)
    table(d, ["Field", "Record during installation"], [
        ["Server hostname", "____________________________"],
        ["Reserved IP address", "____________________________"],
        ["Backend address", "http://____________________:8080"],
        ["Backup location", "____________________________"],
        ["Installer and date", "____________________________"],
    ], [2.0, 4.5])
    d.add_page_break()

    heading(d, "4  Cashier terminal onboarding")
    para(d, "Each cashier computer receives the Mercantile desktop app but does not run its own backend or database. The first launch connects the terminal to the store server and registers the device.")
    table(d, ["Step", "Terminal action", "Expected result"], [
        ["1", "Install the Mercantile desktop app.", "The app opens the local connection setup screen."],
        ["2", "Enter the approved server address.", "The app verifies connection to the store server."],
        ["3", "Enter a clear terminal name such as Main Counter.", "The app creates a permanent Terminal ID stored on that computer."],
        ["4", "Administrator approves the terminal in Devices and Counters.", "The terminal receives its permitted POS role and counter name."],
        ["5", "Sign in with a cashier account and open a shift.", "The cashier can create bills only from the assigned counter."],
        ["6", "Print a test receipt and complete a test sale and return.", "Receipt printer, stock update and audit entries work as expected."],
    ], [0.45, 3.6, 2.45])
    heading(d, "Terminal tracking", 2)
    para(d, "The system should store a generated Terminal ID rather than relying only on a hardware serial number. The registration record should include the terminal name, device name, counter, first activated date, last active time and approval status. This allows the administrator to replace a damaged PC without losing the history of the old counter.")
    table(d, ["Terminal", "Counter", "Status", "Last active"], [
        ["POS 01", "Main Counter", "Approved", "Just now"],
        ["POS 02", "Express Counter", "Approved", "Two minutes ago"],
        ["MANAGER 01", "Back Office", "Approved", "Today"],
    ], [1.55, 1.7, 1.35, 1.9])
    d.add_page_break()

    heading(d, "5  Offline licensing and terminal limits")
    para(d, "A Mercantile licence identifies the client store, enabled modules, number of branches, number of POS terminals and support period. AuraDev issues a signed licence file after installation or renewal.")
    table(d, ["Licence field", "Example", "Purpose"], [
        ["Store", "ABC Grocery Qatar", "Limits the licence to the named client."],
        ["Licence ID", "MRC QA 2026 001", "Provides a traceable commercial record."],
        ["POS terminals", "2", "Allows Main Counter and Express Counter."],
        ["Enabled modules", "POS, Inventory, Procurement", "Controls the agreed product scope."],
        ["Support until", "15 November 2027", "Defines the included support and update period."],
    ], [1.35, 2.0, 3.2])
    heading(d, "Activation workflow", 2)
    para(d, "When a new terminal is installed, Mercantile creates an activation request using its generated Terminal ID. The administrator approves the device only if the permitted terminal count has not been reached. If a computer is replaced, the administrator deactivates the old terminal before approving the replacement.")
    bullet(d, "Do not store AuraDev's private signing key inside the client application or on the client server.")
    bullet(d, "When support expires, retain read-only access and exporting. Do not prevent the client from accessing their own historical business records.")
    bullet(d, "Show renewal reminders before support expiry. Avoid interrupting a live retail counter without warning.")
    d.add_page_break()

    heading(d, "6  Backup, recovery and support")
    para(d, "Offline data remains the client’s business data, so the deployment must include a tested recovery process. A backup that has never been restored is not yet proven reliable.")
    table(d, ["Frequency", "Action", "Owner"], [
        ["Daily", "Create encrypted database backup after business hours.", "Automated server task"],
        ["Weekly", "Copy latest backup to approved external storage or local NAS.", "Store manager"],
        ["Monthly", "Restore a backup into a test database and verify recent bills and stock records.", "AuraDev support or trained administrator"],
        ["Before updates", "Create a manual backup and confirm the service can restart.", "Installer"],
    ], [1.2, 3.8, 1.55])
    heading(d, "Support boundaries", 2)
    para(d, "The support agreement should state response times, remote support method, backup responsibilities, hardware responsibilities and the process for new features. Hardware failures, a damaged router or an unlicensed Windows installation are separate from Mercantile software support unless the contract includes them.")
    heading(d, "Go live checklist", 2)
    bullet(d, "Server starts after a power restart and each approved terminal reconnects.")
    bullet(d, "Every cashier has a named user account and understands shift opening and closing.")
    bullet(d, "Barcode scanner, receipt printer, cash drawer and network connection pass a test at each counter.")
    bullet(d, "A sale, split payment, customer credit sale, return, purchase receipt and stock movement are tested.")
    bullet(d, "The first backup completes and its location is recorded.")
    bullet(d, "The client signs off on the store profile, currency, bill numbering and receipt layout.")

    d.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
