import * as XLSX from 'xlsx';
import type { Product, Customer, Vendor, Invoice, InvoiceItem } from '@/types';

export type ImportKind = 'products' | 'customers' | 'vendors' | 'invoices';

export type ColumnSpec = {
  key: string;
  label: string;
  required?: boolean;
  /** Human hint shown under the field in the template guide. */
  hint?: string;
};

export type EntitySchema = {
  kind: ImportKind;
  label: string;
  description: string;
  columns: ColumnSpec[];
  /** Sample data row(s) for the downloadable template. */
  sample: string[][];
};

/**
 * Column contracts for each importable entity. The first `required` columns are
 * validated as mandatory; everything else is optional and mapped when present.
 * Invoices are modelled one-line-item-per-row, grouped by the `invoiceId` column
 * — the only sane way to carry line items through a flat spreadsheet.
 */
export const IMPORT_SCHEMAS: Record<ImportKind, EntitySchema> = {
  products: {
    kind: 'products',
    label: 'Products',
    description: 'Inventory items — physical products with stock, or services that consume linked products.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'sku', label: 'SKU', hint: 'Used to detect duplicates' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'price', label: 'Price', hint: 'Number' },
      { key: 'cost', label: 'Cost', hint: 'Number' },
      { key: 'stock', label: 'Stock', hint: 'Whole number — ignored for services' },
      { key: 'reorderThreshold', label: 'Reorder threshold', hint: 'Whole number' },
      { key: 'unitOfMeasure', label: 'Unit of measure', hint: 'e.g. pcs, kg, box' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'brand', label: 'Brand' },
      { key: 'vendorId', label: 'Preferred vendor', hint: 'Existing vendor name — matched case-insensitively' },
      { key: 'productType', label: 'Product type', hint: 'standard / manufactured / component — defaults to standard' },
      { key: 'trackingMode', label: 'Stock tracking', hint: 'none / lot / serial — defaults to none' },
      { key: 'expiryDate', label: 'Expiry date', hint: 'YYYY-MM-DD' },
      { key: 'warrantyDate', label: 'Warranty date', hint: 'YYYY-MM-DD' },
      { key: 'kind', label: 'Kind', hint: 'product or service — defaults to product' },
      { key: 'serviceLinks', label: 'Linked products (services only)', hint: 'e.g. "Shampoo:1; Conditioner:1" — productName:quantity pairs, semicolon-separated' },
    ],
    sample: [
      ['name', 'sku', 'category', 'description', 'price', 'cost', 'stock', 'reorderThreshold', 'unitOfMeasure', 'barcode', 'brand', 'vendorId', 'productType', 'trackingMode', 'expiryDate', 'warrantyDate', 'kind', 'serviceLinks'],
      ['Espresso Beans 1kg', 'SKU-001', 'Coffee', 'Single-origin arabica', '45.00', '28.50', '120', '20', 'kg', '0123456789012', 'Roastery Co', 'Global Beans Co', 'standard', 'lot', '2027-01-01', '', 'product', ''],
      ['Ceramic Mug', 'SKU-002', 'Merch', '350ml branded mug', '12.00', '4.00', '80', '15', 'pcs', '0123456789029', '', '', 'standard', 'none', '', '', 'product', ''],
      ['Haircut & Wash', '', 'Salon Services', 'Standard cut with wash', '25.00', '0', '', '', '', '', '', '', '', '', '', '', 'service', 'Shampoo:1'],
    ],
  },
  customers: {
    kind: 'customers',
    label: 'Customers',
    description: 'People and companies you sell to.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', hint: 'Used to detect duplicates' },
      { key: 'phone', label: 'Phone' },
      { key: 'company', label: 'Company' },
      { key: 'billingAddress', label: 'Billing address' },
      { key: 'shippingAddress', label: 'Shipping address' },
      { key: 'creditLimit', label: 'Credit limit', hint: 'Number' },
      { key: 'customerCode', label: 'Customer code' },
      { key: 'taxVatNumber', label: 'Tax / VAT number' },
      { key: 'paymentTerms', label: 'Payment terms', hint: 'e.g. Net 30' },
      { key: 'salesperson', label: 'Salesperson' },
      { key: 'notes', label: 'Notes' },
    ],
    sample: [
      ['name', 'email', 'phone', 'company', 'billingAddress', 'shippingAddress', 'creditLimit', 'customerCode', 'taxVatNumber', 'paymentTerms', 'salesperson', 'notes'],
      ['Jane Smith', 'jane@acme.com', '+971501234567', 'Acme LLC', '12 Market St, Dubai', '12 Market St, Dubai', '5000', 'CUST-001', 'VAT123456', 'Net 30', 'Alex Chen', ''],
      ['Omar Farooq', 'omar@example.com', '+971559876543', '', '', '', '', '', '', '', '', ''],
    ],
  },
  vendors: {
    kind: 'vendors',
    label: 'Vendors',
    description: 'Suppliers you buy from.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', hint: 'Used to detect duplicates' },
      { key: 'contactPerson', label: 'Contact person' },
      { key: 'phone', label: 'Phone' },
      { key: 'leadTimeDays', label: 'Lead time (days)', hint: 'Number' },
      { key: 'paymentTermsDays', label: 'Payment terms (days)', hint: 'Number, e.g. 30' },
      { key: 'vendorCode', label: 'Vendor code' },
      { key: 'taxVatNumber', label: 'Tax / VAT number' },
      { key: 'address', label: 'Address' },
      { key: 'paymentTerms', label: 'Payment terms', hint: 'e.g. Net 30' },
      { key: 'currency', label: 'Currency', hint: 'e.g. USD' },
      { key: 'creditLimit', label: 'Credit limit', hint: 'Number' },
      { key: 'notes', label: 'Notes' },
    ],
    sample: [
      ['name', 'email', 'contactPerson', 'phone', 'leadTimeDays', 'paymentTermsDays', 'vendorCode', 'taxVatNumber', 'address', 'paymentTerms', 'currency', 'creditLimit', 'notes'],
      ['Global Beans Co', 'sales@globalbeans.com', 'Maria Lopez', '+15551234567', '7', '30', 'VEND-001', 'VAT654321', '1 Bean St, Bogota', 'Net 30', 'USD', '10000', ''],
      ['CupWorks Ltd', 'orders@cupworks.com', 'Ken Adams', '+442071234567', '14', '45', '', '', '', '', '', '', ''],
    ],
  },
  invoices: {
    kind: 'invoices',
    label: 'Invoices (sales history)',
    description: 'Historical sales. One row per line item; rows sharing an Invoice ID become one invoice.',
    columns: [
      { key: 'invoiceId', label: 'Invoice ID', required: true, hint: 'Groups line items into one invoice' },
      { key: 'productName', label: 'Product name', required: true },
      { key: 'quantity', label: 'Quantity', hint: 'Number' },
      { key: 'price', label: 'Unit price', hint: 'Number' },
      { key: 'cost', label: 'Unit cost', hint: 'Number' },
      { key: 'customerName', label: 'Customer name' },
      { key: 'customerPhone', label: 'Customer phone' },
      { key: 'date', label: 'Date', hint: 'YYYY-MM-DD' },
      { key: 'status', label: 'Status', hint: 'paid / pending / overdue' },
      { key: 'paymentMethod', label: 'Payment', hint: 'cash / card' },
      { key: 'salesperson', label: 'Salesperson' },
      { key: 'notes', label: 'Notes' },
    ],
    sample: [
      ['invoiceId', 'productName', 'quantity', 'price', 'cost', 'customerName', 'customerPhone', 'date', 'status', 'paymentMethod', 'salesperson', 'notes'],
      ['INV-1001', 'Espresso Beans 1kg', '2', '45.00', '28.50', 'Jane Smith', '+971501234567', '2026-06-01', 'paid', 'card', 'Alex Chen', ''],
      ['INV-1001', 'Ceramic Mug', '1', '12.00', '4.00', 'Jane Smith', '+971501234567', '2026-06-01', 'paid', 'card', 'Alex Chen', ''],
      ['INV-1002', 'Espresso Beans 1kg', '5', '45.00', '28.50', 'Omar Farooq', '+971559876543', '2026-06-03', 'pending', 'cash', '', ''],
    ],
  },
};

export type ParsedRow = Record<string, string>;

/** Minimal CSV parser: handles quoted fields and commas/newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

/** Read a File (CSV or XLSX/XLS) into a matrix of string cells (first sheet). */
export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return parseCsv(await file.text());
  }
  // Excel — parse the first worksheet, formatting every cell as a raw string.
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  return matrix.map(r => (r ?? []).map(c => (c == null ? '' : String(c))));
}

export type ValidationResult = {
  headers: string[];
  records: ParsedRow[];
  errors: string[];
  /** Non-blocking notices — e.g. detected duplicates the user may still import. */
  warnings: string[];
};

/**
 * Turns a raw cell matrix into typed records for the given entity, collecting
 * blocking errors (missing required columns / cells) and non-blocking warnings
 * (rows that look like duplicates of existing data). Duplicates never block the
 * import — the user is informed and may proceed.
 */
export function validateRows(
  kind: ImportKind,
  matrix: string[][],
  existing: { products: Product[]; customers: Customer[]; vendors: Vendor[]; invoices: Invoice[] },
): ValidationResult {
  const schema = IMPORT_SCHEMAS[kind];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (matrix.length < 2) {
    return { headers: [], records: [], errors: ['File has no data rows.'], warnings: [] };
  }

  const headers = matrix[0].map(h => h.trim());
  const required = schema.columns.filter(c => c.required).map(c => c.key);
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) {
    errors.push(`Missing required column(s): ${missing.join(', ')}. Download the template for the expected format.`);
    return { headers, records: [], errors, warnings };
  }

  const records: ParsedRow[] = matrix.slice(1).map(r => {
    const rec: ParsedRow = {};
    headers.forEach((h, i) => { rec[h] = (r[i] ?? '').trim(); });
    return rec;
  });

  // Per-row validation
  const isNum = (v: string) => v === '' || !isNaN(Number(v));
  records.forEach((rec, idx) => {
    const rowNo = idx + 2;
    required.forEach(key => { if (!rec[key]) errors.push(`Row ${rowNo}: ${key} is required.`); });
    if (kind === 'products') {
      if (!isNum(rec.price)) errors.push(`Row ${rowNo}: price "${rec.price}" is not a number.`);
      const productKind = (rec.kind || 'product').toLowerCase();
      if (productKind !== 'product' && productKind !== 'service') {
        errors.push(`Row ${rowNo}: kind "${rec.kind}" must be "product" or "service".`);
      }
      if (productKind === 'product' && !isNum(rec.stock)) {
        errors.push(`Row ${rowNo}: stock "${rec.stock}" is not a number.`);
      }
      if (rec.productType && !['standard', 'manufactured', 'component'].includes(rec.productType.toLowerCase())) {
        warnings.push(`Row ${rowNo}: productType "${rec.productType}" is not one of standard/manufactured/component — it will be left unset.`);
      }
      if (rec.trackingMode && !['none', 'lot', 'serial'].includes(rec.trackingMode.toLowerCase())) {
        warnings.push(`Row ${rowNo}: trackingMode "${rec.trackingMode}" is not one of none/lot/serial — it will be left unset.`);
      }
      if (rec.vendorId) {
        const vendorExists = existing.vendors.some(v => v.name.toLowerCase() === rec.vendorId.toLowerCase());
        if (!vendorExists) warnings.push(`Row ${rowNo}: vendor "${rec.vendorId}" was not found in your vendor list — it will be left unset.`);
      }
      if (productKind === 'service' && rec.serviceLinks) {
        const allProductNames = new Set([
          ...existing.products.filter(p => p.kind !== 'service').map(p => p.name.toLowerCase()),
          ...records.filter(r => (r.kind || 'product').toLowerCase() === 'product').map(r => r.name.toLowerCase()),
        ]);
        const pairs = rec.serviceLinks.split(';').map(s => s.trim()).filter(Boolean);
        pairs.forEach(pair => {
          const [linkedName, qty] = pair.split(':').map(s => s.trim());
          if (!linkedName || !allProductNames.has(linkedName.toLowerCase())) {
            warnings.push(`Row ${rowNo}: linked product "${linkedName}" in serviceLinks was not found among products in this file or existing inventory — it will be skipped.`);
          }
          if (qty !== undefined && !isNum(qty)) {
            errors.push(`Row ${rowNo}: serviceLinks quantity "${qty}" for "${linkedName}" is not a number.`);
          }
        });
      }
    }
    if (kind === 'customers' && rec.email && !rec.email.includes('@')) {
      warnings.push(`Row ${rowNo}: email "${rec.email}" looks invalid.`);
    }
    if (kind === 'invoices' && !isNum(rec.quantity)) {
      errors.push(`Row ${rowNo}: quantity "${rec.quantity}" is not a number.`);
    }
  });

  // Duplicate detection (non-blocking) — matched on the natural key per entity.
  if (kind === 'products') {
    const bySku = new Set(existing.products.filter(p => p.sku).map(p => p.sku!.toLowerCase()));
    const dupes = records.filter(r => r.sku && bySku.has(r.sku.toLowerCase())).map(r => r.sku);
    if (dupes.length) warnings.push(`${dupes.length} row(s) match an existing SKU (${[...new Set(dupes)].slice(0, 5).join(', ')}${dupes.length > 5 ? '…' : ''}). They'll be added as new records — proceed only if that's intended.`);
  } else if (kind === 'customers') {
    const byEmail = new Set(existing.customers.filter(c => c.email).map(c => c.email!.toLowerCase()));
    const dupes = records.filter(r => r.email && byEmail.has(r.email.toLowerCase())).map(r => r.email);
    if (dupes.length) warnings.push(`${dupes.length} row(s) match an existing customer email. They'll be added as new records — proceed only if that's intended.`);
  } else if (kind === 'vendors') {
    const byEmail = new Set(existing.vendors.filter(v => v.email).map(v => v.email.toLowerCase()));
    const dupes = records.filter(r => r.email && byEmail.has(r.email.toLowerCase())).map(r => r.email);
    if (dupes.length) warnings.push(`${dupes.length} row(s) match an existing vendor email. They'll be added as new records — proceed only if that's intended.`);
  } else if (kind === 'invoices') {
    const existingIds = new Set(existing.invoices.map(i => i.id));
    const incomingIds = new Set(records.map(r => r.invoiceId).filter(Boolean));
    const dupes = [...incomingIds].filter(id => existingIds.has(id));
    if (dupes.length) warnings.push(`${dupes.length} invoice ID(s) already exist (${dupes.slice(0, 5).join(', ')}${dupes.length > 5 ? '…' : ''}). Importing will create duplicate invoices — proceed only if that's intended.`);
  }

  return { headers, records, errors, warnings };
}

const num = (v: string, fallback = 0) => { const n = Number(v); return isNaN(n) ? fallback : n; };

const VALID_PRODUCT_TYPES = ['standard', 'manufactured', 'component'] as const;
const VALID_TRACKING_MODES = ['none', 'lot', 'serial'] as const;

/** Parses a YYYY-MM-DD (or any Date-parseable) cell into an ISO string, or undefined if blank/invalid. */
function parseDateCell(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Map validated product rows to Product records. `existingProducts` is used to
 * resolve service `serviceLinks` (productName:qty pairs) to product IDs — a
 * service can link to a product already in the tenant, or to another product
 * row in the same import batch (resolved after id assignment, below).
 * `existingVendors` resolves the `vendorId` column, which is entered as a
 * vendor name (matched case-insensitively) rather than a raw Firestore ID.
 */
export function toProducts(rows: ParsedRow[], storeId: string | undefined, ts: number, existingProducts: Product[] = [], existingVendors: Vendor[] = []): Product[] {
  const vendorNameToId = new Map(existingVendors.map(v => [v.name.toLowerCase(), v.id]));

  const items = rows.map((r, i) => {
    const isService = (r.kind || 'product').toLowerCase() === 'service';
    const productType = r.productType?.toLowerCase();
    const trackingMode = r.trackingMode?.toLowerCase();
    const base = {
      id: `prod-${ts}-${i}`,
      name: r.name,
      sku: r.sku || undefined,
      category: r.category || undefined,
      description: r.description || undefined,
      price: num(r.price),
      cost: num(r.cost),
      reorderThreshold: r.reorderThreshold ? Math.round(num(r.reorderThreshold)) : undefined,
      unitOfMeasure: r.unitOfMeasure || undefined,
      barcode: r.barcode || undefined,
      brand: r.brand || undefined,
      vendorId: r.vendorId ? vendorNameToId.get(r.vendorId.toLowerCase()) : undefined,
      productType: (VALID_PRODUCT_TYPES as readonly string[]).includes(productType ?? '') ? (productType as Product['productType']) : undefined,
      trackingMode: (VALID_TRACKING_MODES as readonly string[]).includes(trackingMode ?? '') ? (trackingMode as Product['trackingMode']) : undefined,
      expiryDate: parseDateCell(r.expiryDate),
      warrantyDate: parseDateCell(r.warrantyDate),
      storeId,
    };
    return isService
      ? { ...base, kind: 'service' as const, stock: 0 }
      : { ...base, kind: 'product' as const, stock: Math.round(num(r.stock)) };
  });

  // Resolve serviceLinks by product name against both this batch and existing inventory.
  const nameToId = new Map<string, string>();
  existingProducts.filter(p => p.kind !== 'service').forEach(p => nameToId.set(p.name.toLowerCase(), p.id));
  items.filter(p => p.kind !== 'service').forEach(p => nameToId.set(p.name.toLowerCase(), p.id));

  return items.map((item, i) => {
    const r = rows[i];
    if (item.kind !== 'service' || !r.serviceLinks) return item;
    const serviceLinks = r.serviceLinks.split(';').map(s => s.trim()).filter(Boolean)
      .map(pair => {
        const [linkedName, qty] = pair.split(':').map(s => s.trim());
        const productId = linkedName ? nameToId.get(linkedName.toLowerCase()) : undefined;
        return productId ? { productId, quantity: num(qty, 1) || 1 } : null;
      })
      .filter((l): l is { productId: string; quantity: number } => l !== null);
    return { ...item, serviceLinks };
  });
}

export function toCustomers(rows: ParsedRow[], storeId: string | undefined, ts: number): Customer[] {
  return rows.map((r, i) => ({
    id: `cust-${ts}-${i}`,
    name: r.name,
    email: r.email || '',
    phone: r.phone || '',
    company: r.company || undefined,
    billingAddress: r.billingAddress || undefined,
    shippingAddress: r.shippingAddress || undefined,
    creditLimit: r.creditLimit ? num(r.creditLimit) : undefined,
    customerCode: r.customerCode || undefined,
    taxVatNumber: r.taxVatNumber || undefined,
    paymentTerms: r.paymentTerms || undefined,
    salesperson: r.salesperson || undefined,
    notes: r.notes || undefined,
    avatar: '',
    storeId,
  }));
}

export function toVendors(rows: ParsedRow[], storeId: string | undefined, ts: number): Vendor[] {
  return rows.map((r, i) => ({
    id: `vend-${ts}-${i}`,
    name: r.name,
    email: r.email || '',
    phone: r.phone || '',
    contactPerson: r.contactPerson || '',
    leadTimeDays: r.leadTimeDays ? Math.round(num(r.leadTimeDays)) : undefined,
    paymentTermsDays: r.paymentTermsDays ? Math.round(num(r.paymentTermsDays)) : undefined,
    vendorCode: r.vendorCode || undefined,
    taxVatNumber: r.taxVatNumber || undefined,
    address: r.address || undefined,
    paymentTerms: r.paymentTerms || undefined,
    currency: r.currency || undefined,
    creditLimit: r.creditLimit ? num(r.creditLimit) : undefined,
    notes: r.notes || undefined,
    storeId,
  }));
}

/**
 * Group line-item rows by invoiceId into Invoice records. Totals are computed
 * from the lines. Historical imports are recorded as-is (no stock decrement or
 * ledger posting — they represent sales that already happened elsewhere).
 */
export function toInvoices(rows: ParsedRow[], storeId: string | undefined): Invoice[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    if (!r.invoiceId) continue;
    const g = groups.get(r.invoiceId) ?? [];
    g.push(r);
    groups.set(r.invoiceId, g);
  }
  const invoices: Invoice[] = [];
  for (const [id, lines] of groups) {
    const items: InvoiceItem[] = lines.map((l, i) => ({
      productId: `import-${id}-${i}`,
      productName: l.productName,
      quantity: Math.round(num(l.quantity, 1)) || 1,
      price: num(l.price),
      cost: num(l.cost),
      isCustom: true,
    }));
    const amount = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const first = lines[0];
    const rawStatus = (first.status || 'paid').toLowerCase();
    const allowedStatuses: Invoice['status'][] = ['paid', 'pending', 'overdue', 'refunded'];
    const status: Invoice['status'] = allowedStatuses.includes(rawStatus as Invoice['status'])
      ? (rawStatus as Invoice['status'])
      : 'paid';
    const pm = (first.paymentMethod || '').toLowerCase();
    const date = first.date || new Date().toISOString().slice(0, 10);
    invoices.push({
      id,
      storeId,
      customerName: first.customerName || undefined,
      customerPhone: first.customerPhone || undefined,
      items,
      amount,
      status,
      paymentMethod: pm === 'cash' || pm === 'card' ? pm : undefined,
      date,
      createdAt: new Date(`${date}T00:00:00`).toISOString(),
      salesperson: first.salesperson || undefined,
      notes: first.notes || undefined,
    });
  }
  return invoices;
}

/** Build an .xlsx blob for the entity's template. */
export function buildTemplateWorkbook(kind: ImportKind): Blob {
  const schema = IMPORT_SCHEMAS[kind];
  const ws = XLSX.utils.aoa_to_sheet(schema.sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, schema.label.slice(0, 31));
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
