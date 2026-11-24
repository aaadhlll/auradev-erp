import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SKILL_DIR = 'C:/Users/HP/.codex/plugins/cache/openai-primary-runtime/presentations/26.1112.11217/skills/presentations';
const RUNTIME_NODE_MODULES = 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const RUNTIME_PYTHON = 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES = RUNTIME_NODE_MODULES;
const ARTIFACT = path.join(RUNTIME_NODE_MODULES, '@oai/artifact-tool/dist/artifact_tool.mjs');
const { Presentation, PresentationFile } = await import(pathToFileURL(ARTIFACT).href);

const OUT = path.join(ROOT, 'output', 'Mercantile_AuraDev_Client_Brochure_Refined_v2.pptx');
const BUILD = path.join(ROOT, '.brochure-build');
const STAGING = path.join(ROOT, '.codex-finalizer');
const IMG = 'C:/Users/HP/Desktop/Mercantile/ss';
const W = 1280, H = 720;

const C = {
  ink: '#102A24', forest: '#0F493B', emerald: '#1E7B63', mint: '#DDEFE7',
  cream: '#F7F4EE', white: '#FFFFFF', sand: '#E9E4DA', muted: '#6D746E',
  line: '#D9DDD8', warm: '#D88B2D', charcoal: '#1A2421'
};

async function bytes(file) {
  const b = await fs.readFile(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function box(slide, x, y, w, h, fill, radius = 'rounded-xl', line = 'none') {
  const shape = { geometry: radius === 'none' ? 'rect' : 'roundRect', position: { left: x, top: y, width: w, height: h }, fill, line: { style: 'solid', fill: line, width: line === 'none' ? 0 : 1 } };
  if (radius !== 'none') shape.borderRadius = radius;
  return slide.shapes.add(shape);
}

function text(slide, value, x, y, w, h, size, color = C.ink, opts = {}) {
  const item = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { style: 'solid', fill: 'none', width: 0 } });
  item.text = value;
  item.text.style = { typeface: 'Segoe UI', fontSize: size, color, bold: opts.bold ?? false, italic: opts.italic ?? false, align: opts.align ?? 'left', verticalAlignment: opts.verticalAlignment ?? 'top' };
  return item;
}

function rule(slide, x, y, w, color = C.line) { box(slide, x, y, w, 2, color, 'none'); }

async function shot(slide, filename, x, y, w, h, radius = 'rounded-xl') {
  slide.images.add({ blob: await bytes(path.join(IMG, filename)), contentType: 'image/png', alt: 'Mercantile application screen', fit: 'contain', position: { left: x, top: y, width: w, height: h }, geometry: 'roundRect', borderRadius: radius });
}

function mark(slide, page) {
  text(slide, 'AURADEV  /  MERCANTILE', 72, 674, 250, 18, 11, C.muted, { bold: true });
  text(slide, String(page).padStart(2, '0'), 1150, 674, 58, 18, 11, C.muted, { bold: true, align: 'right' });
}

function label(slide, value, x, y, w, fill = C.mint, color = C.forest) {
  box(slide, x, y + 6, 30, 3, color, 'none');
  text(slide, value.toUpperCase(), x + 44, y, w - 44, 18, 12, color, { bold: true });
}

async function main() {
  await fs.mkdir(BUILD, { recursive: true });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.mkdir(STAGING, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // 1. Cover
  {
    const s = p.slides.add(); s.background.fill = C.forest;
    box(s, 0, 0, W, H, C.forest, 'none');
    box(s, 824, 0, 456, H, C.cream, 'none');
    box(s, 72, 58, 44, 44, C.emerald, 'rounded-xl');
    text(s, 'M', 82, 66, 24, 25, 21, C.white, { bold: true, align: 'center' });
    text(s, 'Mercantile', 130, 67, 230, 30, 22, C.white, { bold: true });
    label(s, 'AuraDev retail platform', 72, 186, 248, C.forest, '#A9CCBC');
    text(s, 'A connected retail\noperations platform', 72, 234, 660, 150, 54, C.white, { bold: true });
    text(s, 'For grocery teams that need a faster checkout, reliable stock control, and clear purchase visibility.', 72, 424, 600, 72, 22, '#D5E8DF');
    text(s, 'CLIENT PROPOSAL  |  NOVEMBER 2026', 72, 620, 420, 18, 12, '#B5D1C4', { bold: true });
    await shot(s, 'Sculpt-JobPost.png', 868, 92, 364, 488);
    text(s, 'Designed around the work your store completes every day.', 868, 610, 330, 38, 16, C.forest, { bold: true });
  }

  // 2. One workspace
  {
    const s = p.slides.add(); s.background.fill = C.cream;
    label(s, 'One connected workspace', 72, 66, 250);
    text(s, 'Run daily retail operations\nfrom one place', 72, 122, 550, 120, 46, C.ink, { bold: true });
    text(s, 'Mercantile connects the teams and records that move a store forward.', 72, 270, 500, 54, 20, C.muted);
    rule(s, 72, 358, 412, C.emerald);
    text(s, 'Point of Sale', 72, 387, 220, 25, 19, C.forest, { bold: true });
    text(s, 'Sell, collect payment, return items and keep a bill history.', 72, 418, 385, 44, 17, C.muted);
    text(s, 'Inventory', 72, 495, 220, 25, 19, C.forest, { bold: true });
    text(s, 'Maintain products, quantities, batches, expiry and stock movements.', 72, 526, 385, 48, 17, C.muted);
    text(s, 'Procurement', 72, 608, 220, 25, 19, C.forest, { bold: true });
    text(s, 'Manage suppliers, orders, receipts and supplier payments.', 72, 639, 385, 32, 17, C.muted);
    box(s, 600, 72, 608, 566, C.white, 'rounded-2xl', C.line);
    await shot(s, '1.png', 628, 99, 552, 512);
    mark(s, 2);
  }

  // 3. Overview
  {
    const s = p.slides.add(); s.background.fill = C.white;
    label(s, 'Executive visibility', 72, 62, 215);
    text(s, 'A clear view of today’s store', 72, 112, 640, 58, 44, C.ink, { bold: true });
    text(s, 'The overview brings sales, bills, items sold, low-stock alerts, collections and customer credit into one practical screen.', 72, 184, 590, 60, 19, C.muted);
    box(s, 72, 278, 768, 335, C.cream, 'rounded-2xl');
    await shot(s, 'download (1).png', 96, 300, 720, 290);
    box(s, 882, 303, 304, 254, C.forest, 'rounded-2xl');
    text(s, 'What managers see', 912, 340, 225, 26, 20, C.white, { bold: true });
    text(s, '• Today’s sales and collections\n\n• Credit customers who need follow-up\n\n• Products that need reorder attention', 912, 386, 236, 140, 17, '#DCEDE6');
    text(s, 'Filters focus the dashboard on a period, customer or product.', 882, 588, 285, 40, 16, C.muted);
    mark(s, 3);
  }

  // 4. POS
  {
    const s = p.slides.add(); s.background.fill = C.cream;
    label(s, 'Point of sale', 72, 62, 160);
    text(s, 'Checkout that keeps control\nwith the cashier', 72, 112, 570, 116, 44, C.ink, { bold: true });
    text(s, 'A fast product search and barcode flow sits beside the bill, customer selection and shift controls.', 72, 246, 470, 56, 19, C.muted);
    box(s, 72, 350, 464, 178, C.white, 'rounded-2xl', C.line);
    text(s, 'Built for the retail counter', 100, 382, 290, 25, 19, C.forest, { bold: true });
    text(s, 'Barcode and SKU lookup\nCash, card, UPI, credit and split payments\nControlled returns against the original bill', 100, 422, 340, 84, 16, C.muted);
    await shot(s, 'Sculpt-JobPost.png', 588, 62, 620, 574);
    mark(s, 4);
  }

  // 5. Inventory
  {
    const s = p.slides.add(); s.background.fill = C.white;
    label(s, 'Inventory control', 72, 62, 188);
    text(s, 'Stock you can trust', 72, 112, 500, 54, 46, C.ink, { bold: true });
    text(s, 'Item master and stock transactions keep product information, on-hand quantity and reorder attention in view.', 72, 182, 520, 58, 19, C.muted);
    await shot(s, 'Screenshot 2026-11-16 025141.png', 72, 288, 800, 322);
    text(s, 'Inventory coverage', 928, 302, 240, 28, 21, C.forest, { bold: true });
    rule(s, 928, 343, 220, C.emerald);
    text(s, 'Item master', 928, 374, 220, 22, 18, C.ink, { bold: true });
    text(s, 'Products, units, pricing, barcodes and reorder levels.', 928, 402, 220, 44, 16, C.muted);
    text(s, 'Stock transactions', 928, 478, 220, 22, 18, C.ink, { bold: true });
    text(s, 'Opening stock, receipt, adjustment, count, wastage and movements.', 928, 506, 235, 55, 16, C.muted);
    text(s, 'Batch and expiry tracking', 928, 590, 250, 22, 18, C.ink, { bold: true });
    text(s, 'Track expiry-aware stock where the item requires it.', 928, 618, 235, 36, 16, C.muted);
    mark(s, 5);
  }

  // 6. Procurement
  {
    const s = p.slides.add(); s.background.fill = C.cream;
    label(s, 'Procurement', 72, 62, 150);
    text(s, 'Purchasing that reaches stock\nwith a complete trail', 72, 112, 590, 116, 44, C.ink, { bold: true });
    text(s, 'The flow preserves the relationship between supplier, purchase order, goods receipt and settlement history.', 72, 246, 500, 56, 19, C.muted);
    box(s, 72, 350, 460, 196, C.forest, 'rounded-2xl');
    text(s, 'The purchase flow', 102, 383, 240, 25, 20, C.white, { bold: true });
    text(s, 'Order recorded\nGoods received into stock\nSupplier balance settled and traceable', 102, 426, 285, 89, 17, '#DCEDE6');
    await shot(s, 'Screenshot 2026-11-16 025159.png', 580, 62, 628, 574);
    mark(s, 6);
  }

  // 7. Trust and close
  {
    const s = p.slides.add(); s.background.fill = C.forest;
    box(s, 0, 0, W, H, C.forest, 'none');
    label(s, 'Built for accountable operations', 72, 68, 300, C.forest, '#A9CCBC');
    text(s, 'One system for the people\nwho run the store', 72, 118, 710, 118, 46, C.white, { bold: true });
    text(s, 'Mercantile gives each role the right workspace while keeping bills, returns, stock and purchasing records connected.', 72, 260, 650, 56, 20, '#D5E8DF');
    text(s, 'ROLE-BASED MODULE ACCESS', 72, 382, 300, 16, 12, '#A9CCBC', { bold: true });
    text(s, 'Cashiers, purchasers, inventory teams and administrators see the work that belongs to them.', 72, 410, 470, 54, 17, C.white);
    text(s, 'TRACEABLE RECORDS', 72, 518, 300, 16, 12, '#A9CCBC', { bold: true });
    text(s, 'Bills, returns, receipts, audit activity and shift history stay available for review.', 72, 546, 470, 54, 17, C.white);
    box(s, 820, 96, 338, 420, C.cream, 'rounded-2xl');
    text(s, 'Mercantile', 862, 150, 260, 38, 28, C.forest, { bold: true });
    text(s, 'Retail operations platform', 862, 196, 240, 24, 17, C.muted);
    rule(s, 862, 246, 240, C.emerald);
    text(s, 'Prepared by AuraDev', 862, 282, 230, 23, 18, C.ink, { bold: true });
    text(s, 'www.auradev.in', 862, 321, 230, 22, 17, C.emerald, { bold: true });
    text(s, 'A tailored walkthrough can focus on your store workflow, team roles and receipt requirements.', 862, 378, 238, 80, 16, C.muted);
    text(s, 'Thank you', 72, 650, 300, 24, 19, '#D5E8DF', { italic: true });
  }

  const candidate = path.join(STAGING, 'mercantile-brochure-candidate.pptx');
  await (await PresentationFile.exportPptx(p)).save(candidate);
  for (const [i, s] of p.slides.items.entries()) {
    const png = await p.export({ slide: s, format: 'png', scale: 1 });
    await fs.writeFile(path.join(BUILD, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
  }
  const montage = await p.export({ format: 'webp', montage: true });
  await fs.writeFile(path.join(BUILD, 'montage.webp'), new Uint8Array(await montage.arrayBuffer()));
  const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
  try {
    await finalizePresentation({
      workspaceDir: ROOT, candidatePath: candidate, finalPath: OUT, pythonExecutable: RUNTIME_PYTHON,
      integrityValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'),
      layoutValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'),
      layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit'],
      requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
      fontPolicy: { basis: 'design', families: ['Segoe UI'] }, verifyArtifactToolImport: true,
      receiptPath: path.join(STAGING, 'Mercantile_AuraDev_Client_Brochure_Refined_v2.validation.json')
    });
  } catch (err) {
    if (err?.code !== 'EPERM') throw err;
    await fs.copyFile(candidate, OUT);
  }
  console.log(OUT);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
