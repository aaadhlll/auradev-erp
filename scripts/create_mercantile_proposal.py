from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path

ROOT=Path(r'C:\Users\HP\Documents\GitHub\auradev-erp'); IMG=Path(r'C:\Users\HP\Desktop\Mercantile\ss'); OUT=ROOT/'output'/'Mercantile_AuraDev_Client_Proposal.docx'; OUT.parent.mkdir(exist_ok=True)
GREEN='0F4A3C'; MINT='EAF5F0'; INK='17211D'; MUTED='61706A'
def shade(cell,c):
 p=cell._tc.get_or_add_tcPr(); x=OxmlElement('w:shd'); x.set(qn('w:fill'),c); p.append(x)
def set_bg(sec,c):
 bg=OxmlElement('w:background'); bg.set(qn('w:color'),c); sec._sectPr.getparent().insert(0,bg)
def p(doc,text='',size=11,bold=False,color=INK,align=None,space=6):
 x=doc.add_paragraph(); x.paragraph_format.space_after=Pt(space)
 if align: x.alignment=align
 r=x.add_run(text); r.font.name='Aptos'; r.font.size=Pt(size); r.bold=bold; r.font.color.rgb=RGBColor.from_string(color); return x
def pic(doc,file,caption):
 x=doc.add_paragraph(); x.alignment=WD_ALIGN_PARAGRAPH.CENTER; x.add_run().add_picture(str(IMG/file),width=Inches(6.7))
 p(doc,caption,9,False,MUTED,WD_ALIGN_PARAGRAPH.CENTER,12)
def page(doc): doc.add_page_break()

d=Document(); s=d.sections[0]; s.top_margin=s.bottom_margin=Inches(.65); s.left_margin=s.right_margin=Inches(.78)
styles=d.styles; styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(11)
# Cover
p(d,'AURADEV',13,True,GREEN,space=24); p(d,'Mercantile',38,True,GREEN,space=8); p(d,'Retail operations platform',21,False,INK,space=26)
p(d,'A modern workspace for grocery retail teams to sell faster, control stock, manage purchasing and stay ready for every business day.',15,False,INK,space=50)
p(d,'POINT OF SALE  •  INVENTORY  •  PROCUREMENT  •  ADMINISTRATION',10,True,GREEN,space=120); p(d,'Client proposal  |  Prepared by AuraDev',10,False,MUTED)
page(d)
# Reset visual with white page header
for sec in d.sections: sec.top_margin=Inches(.58)
p(d,'Mercantile at a glance',26,True); p(d,'One connected system for the work that keeps a retail store moving.',13,False,MUTED,space=20)
table=d.add_table(rows=2,cols=2); table.style='Table Grid'
cards=[('Fast checkout','Barcode-ready POS, customer selection, split payments, credit sales and cashier shifts.'),('Accurate stock','Item master, stock receipts, counts, adjustments, low-stock alerts and batch/expiry control.'),('Disciplined purchasing','Suppliers, purchase orders, GRNs, returns and supplier payment tracking.'),('Clear oversight','Live dashboard, bill history, role access, receipts, audit trail and reports.')]
for cell,(h,b) in zip([c for row in table.rows for c in row.cells],cards):
 shade(cell,MINT); p0=cell.paragraphs[0]; r=p0.add_run(h); r.bold=True; r.font.size=Pt(14); r.font.color.rgb=RGBColor.from_string(GREEN); cell.add_paragraph(b)
pic(d,'1.png','A single workspace that brings core retail functions together.')
page(d); p(d,'Make decisions with live store visibility',25,True); p(d,'The dashboard surfaces sales, collections, customer credit and stock attention points without forcing managers to chase spreadsheets.',12,False,MUTED,space=16); pic(d,'download (1).png','Live operational dashboard with sales, collections and low-stock attention.')
page(d); p(d,'Counter speed without losing control',25,True); p(d,'Mercantile POS supports fast item search, barcode workflows, visible stock, held bills, discounts, customer selection and shift-controlled checkout.',12,False,MUTED,space=16); pic(d,'Sculpt-JobPost.png','Point of Sale workspace built for practical daily billing.')
page(d); p(d,'Every sale stays traceable',25,True); p(d,'Sales history keeps completed bills, receipt access, customer transactions and controlled returns in one searchable place.',12,False,MUTED,space=16); pic(d,'Screenshot 2026-11-16 025114.png','Sales bill history for better customer service and accountability.')
page(d); p(d,'Protect availability and reduce stock loss',25,True); p(d,'The inventory workspace makes stock levels, reorder thresholds and product status visible. Batch and expiry tracking can be enabled for sensitive items.',12,False,MUTED,space=16); pic(d,'Screenshot 2026-11-16 025141.png','Inventory control with current stock and low-stock alerts.')
page(d); p(d,'Purchase with confidence',25,True); p(d,'Procurement connects suppliers, purchase orders, receiving, GRNs, returns and payment follow-up so stock arrives with a clear audit trail.',12,False,MUTED,space=16); pic(d,'Screenshot 2026-11-16 025159.png','Purchase order management with supplier and status visibility.')
page(d); p(d,'Built for the way your store operates',25,True); p(d,'Administrators manage store identity, currency, receipt rules, team roles, module access, shift history and audit activity from one controlled workspace.',12,False,MUTED,space=16); pic(d,'Screenshot 2026-11-16 025243.png','Administration controls for store setup, receipt output and team access.')
page(d); p(d,'A practical rollout with AuraDev',26,True); p(d,'AuraDev supports the complete onboarding journey:',13,False,MUTED,space=18)
for n,t in [('01','Store setup and configuration'),('02','Opening stock and master-data preparation'),('03','Hardware and receipt workflow validation'),('04','Team training and go-live acceptance')]: p(d,f'{n}   {t}',15,True,GREEN,space=14)
p(d,'Mercantile is available for cloud deployment or as a Windows desktop application for local shop operation. The final configuration is tailored to the store’s selected workflows.',12,False,INK,space=38)
p(d,'Ready to simplify daily retail operations.',21,True,GREEN,space=12); p(d,'AuraDev  |  auradev.in',11,False,MUTED)
d.save(OUT)
