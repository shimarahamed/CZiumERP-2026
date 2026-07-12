

export type Role = 'admin' | 'manager' | 'cashier' | 'inventory-staff';

export type DashboardSettings = {
  hiddenWidgets: string[];
}

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  customRoleId?: string; // optional pointer to a tenant-defined roles/{id} doc that refines this user's permissions beyond the base role
  dashboardSettings?: DashboardSettings;
  /** Per-table column visibility, keyed by a stable table id (e.g. 'customers', 'inventory').
   *  Each value is the list of column ids to HIDE for that table — absent/unknown ids are shown. */
  columnPreferences?: Record<string, string[]>;
  /** Per-table ordered column ids. Missing/new columns are appended automatically. */
  columnOrderPreferences?: Record<string, string[]>;
  /** Store this user is scoped to. Required for non-admin/manager roles so they
   *  land directly in their store on login instead of being asked to pick one. */
  storeId?: string;
};

// ---------------- HR: Employee lifecycle ----------------

export type EmploymentType = 'Full-time' | 'Part-time' | 'Intern' | 'Contractor';
export type EmploymentStatus = 'Onboarding' | 'Active' | 'On Leave' | 'Resigned' | 'Terminated';

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type IdentityDocument = {
  id: string;
  type: 'Government ID' | 'Passport' | 'Visa/Work Permit' | "Driver's License" | 'Other';
  documentNumber: string;
  issueDate?: string;   // yyyy-MM-dd
  expiryDate?: string;  // yyyy-MM-dd
  notes?: string;
};

export type BankingDetails = {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ibanSwift?: string;
  taxId?: string;
};

export type IssuedAsset = {
  id: string;
  asset: string;          // e.g. Laptop, Monitor, ID Card, SIM Card, Security Key
  serialNumber?: string;
  dateIssued: string;     // yyyy-MM-dd
  dateReturned?: string;  // yyyy-MM-dd — set on offboarding
  notes?: string;
};

export type ITAccount = {
  id: string;
  system: string;         // e.g. Company Email, Slack, GitHub, VPN
  username?: string;
  mfaEnabled: boolean;
  status: 'Active' | 'Disabled';
};

export type AccessGrant = {
  id: string;
  resource: string;       // e.g. Finance Folder, Production Server, CRM
  grantedDate: string;    // yyyy-MM-dd
  revokedDate?: string;   // yyyy-MM-dd — set on offboarding
  notes?: string;
};

export type EmployeeDocument = {
  id: string;
  type: 'Employment Contract' | 'NDA' | 'Confidentiality Agreement' | 'Handbook Acknowledgment' | 'Code of Conduct Acknowledgment' | 'Equipment Handover Form' | 'Other';
  title?: string;
  status: 'Pending' | 'Signed' | 'Archived';
  signedDate?: string;    // yyyy-MM-dd
  notes?: string;
};

export type EmployeeBackground = {
  university?: string;
  graduationYear?: string;
  previousExperience?: string;
  certifications?: string;
  languages?: string;
  technicalSkills?: string;
  portfolio?: string;
  linkedin?: string;
  github?: string;
};

export type PerformanceRecordType = 'Probation Review' | 'Performance Review' | 'Promotion' | 'Salary Change' | 'Training' | 'Award/Recognition' | 'Disciplinary Action';

export type EmployeePerformanceRecord = {
  id: string;
  type: PerformanceRecordType;
  date: string;           // yyyy-MM-dd
  title: string;
  notes?: string;
  rating?: number;        // 1..5 for reviews
};

export type ExitInformation = {
  lastWorkingDay?: string;   // yyyy-MM-dd
  reasonForLeaving?: string;
  exitInterviewCompleted?: boolean;
  assetsReturned?: boolean;
  accountsDisabled?: boolean;
  finalPaymentCompleted?: boolean;
  documentsArchived?: boolean;
  notes?: string;
};

export type Employee = {
  id: string;
  name: string;                 // full legal name
  email: string;                // company email
  avatar: string;
  userId?: string;
  jobTitle?: string;
  department?: string;
  dateOfJoining: string;
  salary: number;
  annualLeaveAllowance?: number;
  leaveTaken?: number;
  storeId?: string;
  // 1. Personal information
  preferredName?: string;
  personalEmail?: string;
  personalPhone?: string;
  dateOfBirth?: string;         // yyyy-MM-dd
  nationality?: string;
  residentialAddress?: string;
  emergencyContact?: EmergencyContact;
  // 2. Employment information
  employeeCode?: string;        // human-readable Employee ID, e.g. EMP-0042
  employmentType?: EmploymentType;
  managerId?: string;           // references another Employee
  endDate?: string;             // yyyy-MM-dd, if applicable
  workLocation?: string;
  workingHours?: string;        // e.g. "Sun–Thu, 9:00–18:00"
  probationEndDate?: string;    // yyyy-MM-dd
  employmentStatus?: EmploymentStatus;
  // 3. Identity verification
  identityDocuments?: IdentityDocument[];
  // 4. Banking & payroll
  banking?: BankingDetails;
  // 5. Company assets
  issuedAssets?: IssuedAsset[];
  // 6. IT accounts (checklist — never store passwords)
  itAccounts?: ITAccount[];
  // 7. Access & permissions
  accessGrants?: AccessGrant[];
  // 8. Documents
  documents?: EmployeeDocument[];
  // 9. Skills & background
  background?: EmployeeBackground;
  // 10. Performance
  performanceRecords?: EmployeePerformanceRecord[];
  // 11. Exit information
  exitInfo?: ExitInformation;
  // Lifecycle email tracking
  onboardingEmailSentAt?: string;   // ISO timestamp
  offboardingEmailSentAt?: string;  // ISO timestamp
};

// ---------------- Tenant-wide email: SMTP config, templates & log ----------------

// One doc per tenant, id: 'default' — the ONE outgoing mail server for the whole tenant.
export type SmtpConfig = {
  id: string;                // always 'default'
  enabled: boolean;          // master switch — no email sent anywhere while off
  host: string;
  port: number;
  secure: boolean;           // true = implicit TLS (465), false = STARTTLS/plain (587/25)
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  ccEmail?: string;          // if set, every outgoing notification (all departments) is CC'd here
  updatedAt?: string;
  updatedBy?: string;
};

// Department categories used to group notification templates in Settings.
export type EmailDepartment =
  | 'System'
  | 'Sales & Customers'
  | 'Supply Chain'
  | 'Shipping & Logistics'
  | 'Finance'
  | 'Human Resources'
  | 'Service Desk'
  | 'Project Management';

// One row per email trigger point ("template"). Seeded per-tenant on first load.
export type EmailTemplateConfig = {
  id: string;                 // stable key, e.g. 'vendor-onboarding', 'po-sent-to-vendor'
  department: EmailDepartment;
  label: string;
  description: string;
  enabled: boolean;           // per-template on/off, only matters if SmtpConfig.enabled
  subjectTemplate: string;    // may contain {{placeholders}}
  bodyTemplate: string;       // HTML, may contain {{placeholders}}
  availableVars: string[];    // {{placeholder}} keys the call-site actually supplies — reference only, shown in the editor
  templateVersion?: number;   // bumped whenever DEFAULT_EMAIL_TEMPLATES content changes, so unedited docs can be safely upgraded
  updatedAt?: string;
  updatedBy?: string;
};

export type EmailLog = {
  id: string;
  department: EmailDepartment;
  templateId: string;
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: string;             // ISO timestamp
  sentBy: string;             // user name, or 'system' for automated sends
};

// ---------------- Tenant-wide SMS & WhatsApp: gateway config & log ----------------

// One doc per tenant, id: 'default' — generic HTTP SMS gateway (aggregator-agnostic).
export type SmsConfig = {
  id: string;                // always 'default'
  enabled: boolean;          // master switch — no SMS sent anywhere while off
  /** 'generic' posts {to,message,sender} with a Bearer token to gatewayUrl.
   *  'textbee' calls TextBee's Android-gateway API (https://api.textbee.dev) —
   *  a different auth header, URL shape, and body — via the deviceId below. */
  provider?: 'generic' | 'textbee';
  gatewayUrl: string;        // POST endpoint of the SMS gateway/aggregator (generic provider only)
  apiKey: string;
  senderId: string;          // sender name/number shown to the recipient (generic provider only)
  /** TextBee device ID — required when provider is 'textbee'. */
  deviceId?: string;
  updatedAt?: string;
  updatedBy?: string;
};

// One doc per tenant, id: 'default' — Meta WhatsApp Business Cloud API.
export type WhatsappConfig = {
  id: string;                 // always 'default'
  enabled: boolean;           // master switch — no WhatsApp message sent anywhere while off
  phoneNumberId: string;      // Meta "Phone number ID"
  accessToken: string;        // Meta permanent/system-user access token
  businessAccountId?: string; // Meta WABA ID (optional, for reference)
  updatedAt?: string;
  updatedBy?: string;
};

export type MessageChannel = 'sms' | 'whatsapp';

export type MessageLog = {
  id: string;
  channel: MessageChannel;
  department: EmailDepartment;
  templateId: string;
  to: string;                 // phone number (E.164 preferred)
  preview: string;            // first ~120 chars of the message body, for the log table
  status: 'sent' | 'failed';
  error?: string;
  sentAt: string;              // ISO timestamp
  sentBy: string;               // user name, or 'system' for automated sends
};

export type Store = {
  id: string;
  name: string;
  address: string;
  // The currency this store's books are kept in. Absent means the store uses the
  // tenant's legacy display currency (AppContext `currency`) — zero behavior change
  // for tenants that never set this. Transactions posted in a different currency are
  // converted to this currency at posting time; see LedgerEntry.transactionCurrency.
  functionalCurrency?: Currency;
  taxJurisdiction?: string;
};

// A physical stock-keeping location. Distinct from Store (a business/org unit) —
// a store can be served by one or more warehouses. Every tenant has exactly one
// isDefault warehouse, auto-created on first use, so single-location tenants see
// no behavior change.
export type Warehouse = {
  id: string;
  name: string;
  storeId?: string;    // optional link to the store/branch that operates it
  address?: string;
  isDefault?: boolean;
  deletedAt?: string;
};

// Per-warehouse stock for a product. Product.stock remains the denormalized total
// (sum of StockLevel.stock across warehouses for that product) so existing readers
// (low-stock badges, availableStock(), invoice decrement guards) keep working
// unmodified while this becomes the real source of truth.
export type StockLevel = {
  id: string; // `${productId}_${warehouseId}`
  productId: string;
  warehouseId: string;
  stock: number;
  reservedStock?: number;
  binLocation?: string;
  updatedAt?: string;
};

// Per-product opt-in to lot or serial tracking. Absent/'none' (the overwhelming
// majority of products) means StockLevel.stock is the whole story, exactly as today.
// 'lot' products additionally have Lot docs whose quantities sum to StockLevel.stock
// for that product+warehouse; 'serial' products have one SerialUnit doc per physical
// unit instead, and StockLevel.stock is the count of 'in-stock'/'reserved' units.
export type TrackingMode = 'none' | 'lot' | 'serial';

export type Lot = {
  id: string; // `${productId}_${lotNumber}_${warehouseId}`
  productId: string;
  warehouseId: string;
  lotNumber: string;
  quantity: number;
  expiryDate?: string;
  receivedAt: string;
  binLocation?: string;
  deletedAt?: string;
};

export type SerialStatus = 'in-stock' | 'reserved' | 'sold' | 'returned';
export type SerialUnit = {
  id: string; // the serial number itself
  productId: string;
  warehouseId: string;
  serialNumber: string;
  status: SerialStatus;
  binLocation?: string;
  invoiceId?: string; // set when status becomes 'sold'
  receivedAt: string;
  soldAt?: string;
};

export type CustomerTier = 'Bronze' | 'Silver' | 'Gold';

export type EnrichedData = {
  summary: string;
  industry: string;
  companySize?: number;
};

export type Customer = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  avatar: string;
  billingAddress?: string;
  shippingAddress?: string;
  loyaltyPoints?: number;
  /** Tenant-defined custom field values, keyed by CustomFieldDefinition.key. */
  customData?: Record<string, unknown>;
  tier?: CustomerTier;
  storeId?: string;
  enrichedData?: EnrichedData;
  creditLimit?: number;      // Sales blocked when outstanding exceeds this
  deletedAt?: string;        // Soft delete
  customerCode?: string;
  taxVatNumber?: string;
  paymentTerms?: string;     // free text, e.g. "Net 30"
  salesperson?: string;
  notes?: string;
};

export type Vendor = {
  id:string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays?: number;
  paymentTermsDays?: number; // days until a bill is due; defaults to 30 (Net 30) when unset
  storeId?: string;
  scorecard?: { onTimeRate?: number; qualityRate?: number; ratedAt?: string };
  deletedAt?: string;
  vendorCode?: string;
  taxVatNumber?: string;
  address?: string;
  paymentTerms?: string;     // free text, e.g. "Net 30"; distinct from paymentTermsDays used for AP due-date math
  currency?: string;         // preferred currency label, e.g. "USD" — not the strict transactional Currency enum
  creditLimit?: number;
  notes?: string;
};

/** A product a service consumes when performed: `quantity` units per single use. */
export type ServiceProductLink = {
  productId: string;
  quantity: number;
};

export type StockHistoryEntry = {
  id: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  createdAt: string;
  source: 'initial' | 'manual' | 'duplicate-merge' | 'edit';
  userName?: string;
  note?: string;
};

export type Product = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  description?: string;
  /** Tenant-defined custom field values, keyed by CustomFieldDefinition.key. */
  customData?: Record<string, unknown>;
  price: number;
  cost: number;
  stock: number;
  /** Auditable additions made from initial stock, restocking, edits, or merges. */
  stockHistory?: StockHistoryEntry[];
  /** Default discount applied to this product's line when sold: a % of the
   *  unit price (discountType 'percent', 0–100) or a fixed amount off each
   *  unit (discountType 'amount'). */
  discount?: number;
  discountType?: 'percent' | 'amount';
  /** ISO timestamp of when the product was added to inventory. */
  createdAt?: string;
  /** Optional product photo/thumbnail (data URI or URL) shown on POS cards. */
  imageUrl?: string;
  /** Optional named icon (lucide) assigned in Inventory; falls back to a
   *  name-derived guess on POS cards when no imageUrl is set. */
  iconName?: string;
  /**
   * Whether this item is a physical product (tracks its own stock) or a service
   * (holds no stock; consumes linked products when performed). Absent = product.
   */
  kind?: 'product' | 'service';
  /** For services: products consumed per single performance of the service. */
  serviceLinks?: ServiceProductLink[];
  vendorId?: string;
  reorderThreshold?: number;
  expiryDate?: string;
  warrantyDate?: string;
  productType?: 'manufactured' | 'component' | 'standard';
  storeId?: string;
  binLocation?: string;      // Warehouse bin
  reservedStock?: number;    // Committed but not yet shipped
  serialNumbers?: string[];  // Serial tracking
  trackingMode?: TrackingMode; // 'lot' | 'serial' opt-in; absent/'none' = untracked (default)
  deletedAt?: string;
  unitOfMeasure?: string;    // e.g. pcs, kg, box
  barcode?: string;
  brand?: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  createdAt?: string;
};

export type Department = {
  id: string;
  name: string;
  parentId?: string;         // Hierarchy
  managerId?: string;
};

export type Quotation = {
  id: string;
  customerId?: string;
  customerName?: string;
  items: InvoiceItem[];
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';
  validUntil?: string;
  createdAt: string;
  storeId?: string;
  discount?: number;
  taxRate?: number;
  paymentTerms?: string;
  salesperson?: string;
  notes?: string;
};

export type Timesheet = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  project?: string;
  notes?: string;
  approved?: boolean;
};

export type ExpenseClaim = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  category: string;
  amount: number;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
};

export type InvoiceItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number; // Price per item at the time of sale
  cost: number; // Cost per item at the time of sale
  /** Per-line discount snapshotted from the product at sale time — a % of the
   *  unit price ('percent', 0–100) or a fixed amount off each unit ('amount'). */
  discount?: number;
  discountType?: 'percent' | 'amount';
  /** Unit of measure snapshotted from the product (e.g. Pcs, Ltr, Kg). */
  unit?: string;
  /** Manually added line (e.g. a one-off fee) — has no product/stock record. */
  isCustom?: boolean;
};

export type Invoice = {
  id: string;
  storeId?: string;
  customerId?: string;
  customerName?: string;
  /** Snapshot of customer contact at invoice time (also holds walk-in details). */
  customerPhone?: string;
  customerEmail?: string;
  userId?: string;
  userName?: string;
  /** Tenant-defined custom field values, keyed by CustomFieldDefinition.key. */
  customData?: Record<string, unknown>;
  items: InvoiceItem[];
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'refunded' | 'partially-refunded' | 'pending-approval';
  date: string;
  /** ISO timestamp of when the invoice was created (for receipt time-of-sale). */
  createdAt?: string;
  dueDate?: string;
  discount?: number;
  taxRate?: number;
  currency?: Currency;
  /** How the sale was tendered — shown on the invoice/receipt. */
  paymentMethod?: 'cash' | 'card';
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  attachments?: Attachment[];
  /** Free-text additional details captured at sale time (e.g. POS order notes). */
  notes?: string;
  salesperson?: string;
  /**
   * Outbox posting state for POS sales. 'queued' = written locally (works
   * offline), awaiting the postQueuedInvoice trigger; 'posted' = server
   * assigned the final number and posted stock/ledger; 'failed' = server
   * rejected it (see postError). Absent on invoices from other flows.
   */
  postStatus?: 'queued' | 'posted' | 'failed';
  /** Client-generated reference linking the queued doc to its final invoice. */
  clientRef?: string;
  /**
   * Invoice number the client expects the server to assign (next number from
   * the locally cached list). Shown on the receipt while queued so users never
   * see a raw internal reference; the server honors it when still free.
   */
  predictedId?: string;
  /** Server-recorded reason when postStatus is 'failed'. */
  postError?: string;
  /** ISO timestamp of when the server posted the queued sale. */
  postedAt?: string;
  /** Tenant invoice prefix captured at queue time, consumed by the trigger. */
  invoicePrefix?: string;
};

export type RecurringInvoice = {
  id: string;
  storeId?: string;
  customerId?: string;
  customerName?: string;
  items: InvoiceItem[];
  amount: number;
  taxRate?: number;
  discount?: number;
  currency?: Currency;
  frequency: RecurringFrequency;
  startDate: string;
  nextDueDate: string;
  status: 'active' | 'paused';
  createdAt: string;
};

export type RefundItem = {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
};

export type Refund = {
  id: string;
  invoiceId: string;
  storeId?: string;
  items: RefundItem[];
  amount: number;
  reason: string;
  date: string;
};

export type PurchaseOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
};

export type PurchaseOrder = {
  id: string;
  vendorId: string;
  vendorName: string;
  storeId?: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  status: 'pending' | 'pending-approval' | 'ordered' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  currency?: Currency;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  attachments?: Attachment[];
  paymentTerms?: string;
  discount?: number;
  taxRate?: number;
  warehouse?: string;
  notes?: string;
};

export type VendorBillStatus = 'unpaid' | 'paid' | 'cancelled';

export type VendorBill = {
  id: string;
  storeId?: string;
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  items: PurchaseOrderItem[];
  amount: number;
  status: VendorBillStatus;
  billDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  // Optional pre-payment approval gate — set only when approvalRules['vendor-bill'] is
  // configured and the amount exceeds the threshold. Independent of `status`: a bill can be
  // 'unpaid' while its workflow is still 'in-progress' — Mark as Paid checks the workflow.
  requiresApproval?: boolean;
  // True when created automatically on PO receipt (src/app/purchase-orders/page.tsx)
  // rather than manually entered on the Accounts Payable page.
  autoGenerated?: boolean;
  discount?: number;
  taxRate?: number;
  attachments?: Attachment[];
  notes?: string;
};


export type RFQItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type RFQ = {
  id: string;
  storeId?: string;
  items: RFQItem[];
  vendorIds: string[];
  status: 'draft' | 'sent' | 'closed';
  creationDate: string;
  userId?: string;
  userName?: string;
  deliveryDate?: string;
  paymentTerms?: string;
  remarks?: string;
  attachments?: Attachment[];
};

export type Sale = {
  month: string;
  revenue: number;
};

export type ActivityLogChange = {
  field: string;
  from: string;
  to: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  changes?: ActivityLogChange[];
};

export type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  dataUrl: string;
};

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Currency = 'USD' | 'EUR' | 'JPY' | 'GBP' | 'AED' | 'LKR';

export type CurrencySymbols = {
  [key in Currency]: string;
};

export type Module = 
  | 'General'
  | 'Sales & Customers'
  | 'Supply Chain'
  | 'Shipping & Logistics'
  | 'Manufacturing'
  | 'Project Management'
  | 'Finance'
  | 'Human Resources'
  | 'Service Desk'
  | 'Testing'
  | 'System';

export type LoyaltySettings = {
    tiers: {
        Silver: { points: number; discount: number; };
        Gold: { points: number; discount: number; };
    }
}

/** Printable document layouts. 'letterhead' = custom uploaded header image or
 *  wordings on the left, compact company details on the right, with a large
 *  low-opacity logo watermark behind the page body. */
export type DocumentTemplate = 'classic' | 'modern' | 'lined' | 'thermal-receipt' | 'letterhead';

export type ThemeSettings = {
    appName: string;
    logoUrl: string;
    primaryColor: string;
    backgroundColor: string;
    accentColor: string;
    invoicePrefix?: string;
    /** Template for the A4 invoice. Also the legacy single template setting —
     *  documents without their own setting below fall back to defaults, not this. */
    invoiceTemplate?: DocumentTemplate;
    /** Template for the POS receipt slip (thermal only today). */
    receiptTemplate?: DocumentTemplate;
    /** Template for printed purchase orders. Defaults to 'classic'. */
    purchaseOrderTemplate?: DocumentTemplate;
    /** Template reserved for RFQ printing (no printable RFQ document yet). */
    rfqTemplate?: DocumentTemplate;
    /** Letterhead template: uploaded header image (logo/wordings artwork) shown
     *  instead of the company name. Data URL, same constraints as logoUrl. */
    letterheadImageUrl?: string;
    /** Letterhead template: custom wordings used when no image is uploaded. */
    letterheadText?: string;
    /** Letterhead template: show the big low-opacity logo watermark behind the page. */
    letterheadWatermark?: boolean;
    documentFooter?: string;
    showLogoOnDocuments?: boolean;
    documentAccent?: string;
    purchaseOrderPrefix?: string;
    disabledModules?: Module[];
    /** Non-secret switch controlling whether invoice Email actions are visible. */
    emailGatewayEnabled?: boolean;
    /** Non-secret switch controlling whether invoice SMS actions are visible. */
    smsGatewayEnabled?: boolean;
    /** Non-secret switch controlling whether invoice WhatsApp actions are visible. */
    whatsappGatewayEnabled?: boolean;
    loyaltySettings?: LoyaltySettings;
    invoiceApprovalThreshold?: number; // legacy single-step threshold — superseded by approvalRules['invoice'] when set
    approvalRules?: ApprovalRules;
    /** Default status pre-selected when creating a new invoice. */
    defaultInvoiceStatus?: 'paid' | 'pending';
    /** Product ids pinned to the front of the POS catalogue, in display order. */
    posPinnedProductIds?: string[];
    // Company profile — persisted here so it round-trips through the same
    // Firestore-backed settings doc as branding, instead of localStorage-only.
    companyName?: string;
    companyAddress?: string;
    companyWebsite?: string;
    companyPhone?: string;
    companyEmail?: string;
    taxRegistrationNumber?: string;
    /** Business registration number — printed on invoices and receipts as "Reg No". */
    companyRegNumber?: string;
    // Financial & regional — same reasoning as companyName above: previously
    // localStorage-only, so it silently reset on a new device/browser/cleared
    // storage. Now rides the tenant settings doc.
    currency?: Currency;
    /** Optional custom text/symbol used wherever monetary values are displayed. */
    currencySymbol?: string;
    fiscalYearStartMonth?: number;
};

export type AssetStatus = 'in-use' | 'in-storage' | 'under-maintenance' | 'retired';

export type Asset = {
  id: string;
  name: string;
  category: string;
  serialNumber?: string;
  purchaseDate: string;
  purchaseCost: number;
  status: AssetStatus;
  location: string;
  assignedTo?: string; // User ID
  storeId?: string;
};

export type ITAsset = {
  id: string; // Asset ID / Tag Number
  name: string; // Asset Name / Hostname
  category: string; // e.g., laptop, server
  status: AssetStatus;
  manufacturer?: string;
  model?: string;
  serialNumber: string;
  description?: string;
  // Assignment
  assignedTo?: string; // User ID
  department?: string;
  location?: string;
  // Procurement
  purchaseDate: string; // YYYY-MM-DD
  purchaseCost: number;
  vendorId?: string;
  warrantyExpiration?: string; // YYYY-MM-DD
  storeId?: string;
};


export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half-day';

export type AttendanceEntry = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
};

export type LedgerEntry = {
  id: string;
  date: string;
  account: string;
  description: string;
  // debit/credit are always in the store's functional currency (or the tenant's legacy
  // display currency if the store has none set) — every existing report that sums these
  // fields keeps working unmodified. transactionCurrency/fxRateToFunctional/functionalAmount
  // are audit metadata, populated only when the source transaction's currency differed from
  // the posting store's functional currency; absent for every single-currency tenant.
  debit: number;
  credit: number;
  storeId?: string;
  transactionCurrency?: Currency;
  fxRateToFunctional?: number;
  functionalAmount?: number;
  // Set only on entries produced by an IntercompanyTransaction — lets a consolidated
  // report find and eliminate (net out) matched Due to/Due from pairs across entities
  // instead of double-counting intercompany activity in the group total.
  intercompanyTransactionId?: string;
};

export type PayrollRunLine = {
  employeeId: string;
  employeeName: string;
  grossPay: number;
  deductions: number;
  netPay: number;
};

// A posted payroll period. Snapshots the per-employee breakdown at the moment of
// posting (Employee.salary/leaveTaken can change later without altering history) and
// records the ledger entries it produced, so a run can never be double-posted and so
// HR and Finance read the same number for a given period. See src/lib/posting.ts for
// the ledger entries this produces (Dr Salaries Expense / Cr Salaries Payable).
export type PayrollRun = {
  id: string;
  periodLabel: string; // e.g. "2026-07" for a monthly run
  storeId?: string; // absent = all stores
  runDate: string; // YYYY-MM-DD, when it was posted
  lines: PayrollRunLine[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  postedBy: string;
  ledgerEntryIds: string[];
};

export type TaxRate = {
  id: string;
  name: string;
  rate: number; // e.g., 5 for 5%
  isDefault?: boolean;
  // Scopes this rate to a specific store's tax jurisdiction (Store.taxJurisdiction).
  // Absent means tenant-wide — resolveTaxRate() (src/lib/tax.ts) prefers a rate whose
  // jurisdiction matches the invoice's store, falling back to the tenant-wide
  // isDefault rate, so a tenant that never sets a jurisdiction sees no behavior change.
  jurisdiction?: string;
};

// A transaction between two stores (entities) under the same tenant — e.g. Entity A
// bills Entity B for a shared service, or transfers cash/inventory value. Posts a
// balanced pair of ledger entries on each side using Due to/Due from accounts, so
// each entity's own books stay correct while a consolidated report can eliminate
// (net out) the pair rather than double-counting it across the group. See
// src/lib/posting.ts (buildIntercompanyLedgerEntries) for the entries this produces.
export type IntercompanyTransaction = {
  id: string;
  date: string; // YYYY-MM-DD
  fromStoreId: string; // the entity recording "Due from" (the one owed money)
  toStoreId: string;   // the entity recording "Due to" (the one that owes money)
  amount: number; // in the fromStoreId entity's functional currency
  description: string;
  createdBy: string;
  createdAt: string;
  ledgerEntryIds: string[];
};

export type Budget = {
  id: string;
  category: string;
  period: 'Monthly' | 'Quarterly' | 'Yearly';
  budgetedAmount: number;
  actualAmount: number;
  storeId?: string;
};

export type CandidateStatus = 'applied' | 'interviewing' | 'offer' | 'hired' | 'rejected';

export type InterviewFeedback = {
  id: string;
  interviewerId: string;
  interviewerName: string;
  date: string; // ISO String
  notes: string;
  rating: number; // 1-5
};

export type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobRequisitionId: string;
  positionAppliedFor: string;
  status: CandidateStatus;
  applicationDate: string; // ISO string
  avatar: string;
  feedback?: InterviewFeedback[];
};

export type PerformanceReview = {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string;
  reviewerName: string;
  date: string; // ISO string
  rating: number; // 1-5
  comments: string;
};

export type JobStatus = 'open' | 'on-hold' | 'closed';

export type JobRequisition = {
  id: string;
  title: string;
  department: string;
  status: JobStatus;
  description?: string;
  requirements?: string;
  createdAt: string; // ISO String
};

export type BOMItem = {
  componentId: string; // productId of the component
  componentName: string;
  quantity: number;
};

export type BillOfMaterials = {
  id: string;
  productId: string; // The finished product this BOM is for
  productName: string;
  items: BOMItem[];
  createdAt: string;
  storeId?: string;
};

export type ProductionOrderStatus = 'planned' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export type ProductionOrder = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  bomId: string;
  status: ProductionOrderStatus;
  scheduledStartDate: string;
  scheduledEndDate: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  notes?: string;
  storeId?: string;
};

export type QualityCheck = {
  id: string;
  productionOrderId: string;
  productName: string;
  checkDate: string;
  inspectorId: string;
  inspectorName: string;
  status: 'pass' | 'fail' | 'pending';
  notes: string;
  storeId?: string;
};

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal-won' | 'proposal-lost';

export type Lead = {
    id: string;
    name: string;
    company?: string;
    email: string;
    phone?: string;
    avatar: string;
    status: LeadStatus;
    value?: number;
    source?: string;
    assignedToId: string;
    assignedToName: string;
    createdAt: string; // ISO String
    storeId?: string;
    enrichedData?: EnrichedData;
};

export type CampaignStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type CampaignChannel = 'email' | 'social-media' | 'sms' | 'paid-ads' | 'other';

export type Campaign = {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  channel: CampaignChannel;
  targetAudience?: string;
  budget: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  storeId?: string;
};

export type ProjectStatus = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export type Project = {
  id: string;
  name: string;
  description: string;
  client?: string;
  status: ProjectStatus;
  managerId: string;
  teamIds: string[];
  startDate: string;
  endDate: string;
  budget: number;
  storeId?: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  startDate: string;
  endDate: string;
  cost?: number;
};

export type TicketStatus = 'open' | 'in-progress' | 'on-hold' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketComment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string; // ISO String
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  group?: string;
  assigneeId?: string;
  assigneeName?: string;
  reporterId: string;
  reporterName: string;
  createdAt: string; // ISO String
  comments: TicketComment[];
  storeId?: string;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  href?: string;
  isRead: boolean;
  createdAt: string; // ISO string
};

// Live Presence
export type PresenceRecord = {
  userId: string;
  userName: string;
  userAvatar: string;
  route: string;        // e.g. "/purchase-orders"
  recordId?: string;    // e.g. "PO-001" when viewing a specific record
  lastSeen: number;     // epoch ms
};

// Approval Workflows
export type ApprovalEntityType = 'purchase-order' | 'invoice' | 'leave-request' | 'expense-claim' | 'vendor-bill' | 'rfq';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalStep = {
  stepNumber: number;
  approverId: string;
  approverName: string;
  status: ApprovalStatus;
  decidedAt?: string;
  comment?: string;
};

export type ApprovalWorkflow = {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  entityTitle: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  currentStep: number;
  steps: ApprovalStep[];
  finalStatus: ApprovalStatus | 'in-progress';
  storeId?: string;
};

// Tenant-configurable approval chain per entity type — threshold (amount above which
// approval is required; 0/undefined = always require approval) and an ordered list of
// approver-resolution steps. Stored on ThemeSettings, e.g. approvalRules['purchase-order'].
// A step resolves to an approver by (in order of specificity): a pinned userId, the
// requester's manager (best-effort — falls back to role match if unresolvable), or the
// first user holding `role`.
export type ApprovalRuleStep = {
  role: Role;
  userId?: string;
  useRequesterManager?: boolean;
};
export type ApprovalRule = {
  threshold?: number;
  steps: ApprovalRuleStep[];
};
export type ApprovalRules = Partial<Record<ApprovalEntityType, ApprovalRule>>;

// RBAC
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export type ModulePermission = {
  module: Module;
  actions: PermissionAction[];
};

export type RolePermissions = {
  id: string; // role name as id
  role: Role;
  permissions: ModulePermission[];
};

// A tenant-defined role that refines a base Role's permissions. Users opt in via
// User.customRoleId; sign-in claims still carry the base Role (auth boundary), this
// is purely an in-app permission refinement layered on top via can()/getEffectivePermissions().
export type CustomRole = {
  id: string;
  name: string;
  baseRole: Role;
  permissions: ModulePermission[];
};

// FX Rates
export type FXRate = {
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  fetchedAt: string;
};

// Landed Cost
export type LandedCostEntry = {
  id: string;
  purchaseOrderId: string;
  duties: number;
  freight: number;
  insurance: number;
  other: number;
  total: number;
  currency: Currency;
  notes?: string;
  createdAt: string;
};

// Dashboard Widgets
export type DashboardWidgetId =
  | 'total-revenue'
  | 'total-profit'
  | 'avg-sale'
  | 'total-sales'
  | 'items-sold'
  | 'active-customers'
  | 'pending-payments'
  | 'top-store'
  | 'revenue-chart'
  | 'insights';

export type DashboardLayout = {
  userId: string;
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
};

// Scheduled Reports
export type ReportFrequency = 'weekly' | 'monthly';
export type ReportType = 'revenue' | 'inventory' | 'hr' | 'profitability';

export type ScheduledReport = {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipients: string[]; // email addresses
  isActive: boolean;
  lastSentAt?: string;
  nextRunAt: string;
  createdBy: string;
  createdAt: string;
};

// Pre-aggregated report data, computed daily by the computeRollups scheduled Cloud
// Function so dashboard pages don't have to iterate every invoice/ledger entry ever
// created on each load. id is `${storeId ?? 'all'}_${YYYY-MM-DD}`. Report pages should
// prefer reading these for historical date ranges and fall back to live computation
// (src/lib/analytics.ts) only for "today" (not yet rolled up) or ad-hoc breakdowns this
// summary doesn't cover.
// Per-tenant API key for the outward REST API — see functions/src/restApi.ts.
// The raw key is shown once at generation time and never stored; only a hash is
// persisted (compared server-side against the Authorization header on each call).
export type ApiKey = {
  id: string;
  name: string;
  hashedKey: string;
  keyPrefix: string; // first 8 chars of the raw key, shown in the UI for identification
  scopes: ('read' | 'write')[];
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type WebhookEventType = 'invoice.created' | 'stock.low' | 'purchase-order.approved';

export type WebhookEndpoint = {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string; // used to HMAC-sign outbound payloads so receivers can verify authenticity
  isActive: boolean;
  createdAt: string;
  createdBy: string;
};

// Data sources the report builder can query — the AppContext collections that make
// sense as flat, filterable/groupable tables. Kept to a deliberate list rather than
// every collection, since not everything (e.g. deeply nested settings docs) makes
// sense as a tabular report source.
export type ReportSource = 'invoices' | 'products' | 'customers' | 'vendors' | 'purchaseOrders' | 'ledgerEntries' | 'vendorBills';

export type ReportFilterOperator = 'equals' | 'notEquals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte';

export type ReportFilter = {
  field: string;
  operator: ReportFilterOperator;
  value: string;
};

export type ReportAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';

// A user-defined report: pick a source, the columns to show, optional filters, and
// an optional group-by with an aggregate — the "pick fields + filters" model, not a
// formula/expression language. Saved so it can be reopened without re-configuring.
export type ReportDefinition = {
  id: string;
  name: string;
  source: ReportSource;
  columns: string[];
  filters: ReportFilter[];
  groupByField?: string;
  aggregateField?: string;
  aggregate?: ReportAggregate;
  createdBy: string;
  createdAt: string;
};

export type ReportRollup = {
  id: string;
  date: string; // YYYY-MM-DD
  storeId?: string; // absent = tenant-wide rollup across all stores
  revenue: number;
  cogs: number;
  grossMargin: number;
  invoiceCount: number;
  newCustomerCount: number;
  topProducts: { productId: string; productName: string; revenue: number; units: number }[];
  computedAt: string;
};

// Tenant / White-label
export type TenantConfig = {
  id: string; // tenant slug e.g. "acme"
  companyName: string;
  primaryColor: string;
  backgroundColor: string;
  accentColor: string;
  logoUrl: string;
  firestorePrefix: string; // e.g. "tenants/acme"
  domains: string[];
  createdAt: string;
};

export type ShipmentStatus = 'pending' | 'processing' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed' | 'cancelled';

export type Shipment = {
  id: string;
  customId?: string;
  storeId?: string;
  invoiceId: string;
  customerId?: string;
  customerName: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  assignedDriverId?: string;
  assignedDriverName?: string;
  vehicleId?: string; // Corresponds to an Asset ID
  items: InvoiceItem[];
  shippingAddress: string;
  dispatchDate: string; // ISO String
  estimatedDeliveryDate?: string; // ISO String
  actualDeliveryDate?: string; // ISO String
};

// ---------------- Multi-tenancy ----------------

export type TenantStatus = 'active' | 'suspended' | 'pending';

/**
 * Legacy coarse industry enum. Superseded by data-driven VerticalBlueprint
 * documents (Tenant.blueprintId). Kept for back-compat reads of tenants and
 * registration requests created before the blueprint engine.
 */
export type IndustryTemplate = 'retail' | 'manufacturing' | 'services' | 'distribution' | 'general';

/** Entities that can carry tenant-defined custom fields. */
export type CustomFieldEntity =
  | 'customer'
  | 'product'
  | 'invoice';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

/**
 * A single tenant-defined custom field. Lives at
 * /tenants/{tenantId}/customFieldDefinitions/{id}. Seeded from the tenant's
 * VerticalBlueprint at onboarding, then freely added/edited/removed by the
 * tenant admin from Settings → Custom Fields. Values are stored in the target
 * entity's `customData` bag under `key`.
 */
export type CustomFieldDefinition = {
  id: string;
  entity: CustomFieldEntity;
  /** Stable machine key used in customData, e.g. 'odometerKm'. */
  key: string;
  /** Human label shown in forms, e.g. 'Odometer (km)'. */
  label: string;
  fieldType: CustomFieldType;
  required?: boolean;
  /** Choices for fieldType === 'select'. */
  options?: string[];
  /** Sort order within the entity's field list. */
  order?: number;
  /** Blueprint id that seeded this field, if any (vs. tenant-added). */
  seededBy?: string;
  createdAt?: string;
  /**
   * Auto-fill link: when the source field (by key, same entity) changes,
   * this field's value is set to source + offset. Only meaningful for
   * fieldType 'number'. Value stays editable afterward — this only sets
   * the initial/suggested value.
   */
  linkedFrom?: {
    /** CustomFieldDefinition.key of the source field on the same entity. */
    sourceKey: string;
    /** Default amount added to the source value, e.g. 5000 for "+5000 KM". */
    offset: number;
  };
};

/**
 * The field-definition shape carried inside a blueprint (no id/tenant scope
 * yet — those are assigned when copied into a tenant at onboarding).
 */
export type CustomFieldSeed = Omit<CustomFieldDefinition, 'id' | 'seededBy' | 'createdAt'>;

/**
 * A data-driven vertical definition. Lives at /verticalBlueprints/{id} and is
 * editable by super admins in the UI — adding a new vertical (e.g. a dental
 * clinic) requires no code deploy. Onboarding a tenant against a blueprint
 * seeds its module allowance, custom fields, and label overrides.
 */
export type VerticalBlueprint = {
  id: string;
  name: string;
  description?: string;
  /** Modules to allow + enable for a tenant onboarded on this vertical. */
  modules: Module[];
  /** Rename entities in the UI, e.g. { "Product": "Part", "Invoice": "Job Card" }. */
  labelOverrides?: Record<string, string>;
  /** Custom fields copied into the tenant at creation time. */
  seedFields?: CustomFieldSeed[];
  isActive?: boolean;
  createdAt?: string;
};

export type Tenant = {
  id: string;
  name: string;
  status: TenantStatus;
  /** @deprecated Legacy coarse industry. New tenants use blueprintId. */
  industry?: IndustryTemplate;
  /** The VerticalBlueprint this tenant was onboarded on. */
  blueprintId?: string;
  /** Modules the plan allows this tenant to enable (super-admin controlled) */
  allowedModules: Module[];
  /** Modules currently switched on by the tenant admin */
  enabledModules: Module[];
  createdAt: string;
  plan?: string;
};

export type RegistrationRequest = {
  id: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  /** @deprecated Legacy coarse industry; kept for old requests. */
  industry?: IndustryTemplate;
  /** The VerticalBlueprint the applicant selected. */
  blueprintId?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};
