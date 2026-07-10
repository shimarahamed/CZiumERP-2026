

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo , useRef } from 'react';
import type { Invoice, Customer, Product, User, Vendor, ActivityLog, ActivityLogChange, Store, Currency, CurrencySymbols, PurchaseOrder, RFQ, Asset, ITAsset, AttendanceEntry, LeaveRequest, Employee, LedgerEntry, TaxRate, Budget, Candidate, PerformanceReview, BillOfMaterials, ProductionOrder, QualityCheck, Lead, Campaign, Project, Task, Ticket, JobRequisition, Shipment, ThemeSettings, Module, Role, LoyaltySettings, Notification, VendorBill, Refund, RecurringInvoice, SmtpConfig, EmailTemplateConfig, EmailLog, ApprovalWorkflow, CustomRole, Warehouse, StockLevel, Lot, SerialUnit, PayrollRun, IntercompanyTransaction, CustomFieldDefinition } from '@/types';
import { initialInvoices, initialCustomers, initialProducts, initialVendors, initialStores, initialUsers, initialPurchaseOrders, initialRfqs, initialAssets, initialItAssets, initialAttendance, initialLeaveRequests, initialEmployees, initialLedgerEntries, initialTaxRates, initialBudgets, initialCandidates, initialPerformanceReviews, initialBillsOfMaterials, initialProductionOrders, initialQualityChecks, initialLeads, initialCampaigns, initialProjects, initialTasks, initialTickets, initialJobRequisitions, initialShipments, initialVendorBills } from '@/lib/data';

import { useFirestoreCollection } from '@/hooks/use-firestore-collection';
import { doc, setDoc, writeBatch, deleteDoc, getDocs, getDoc, query, where, collection, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { ALL_STORES_ID, uuid } from '@/lib/utils';
import { ALL_MODULES } from '@/lib/super-admin';

export type LoginResult = {
  user: User | null;
  superAdmin?: boolean;
  error?: string;
};

// Setter type returned by useFirestoreCollection — accepts value or updater function
type CollectionSetter<T> = (updater: T[] | ((prev: T[]) => T[])) => void;

// Helper to get item from localStorage. This is now only used for user session info.
const getStoredState = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  const storedValue = localStorage.getItem(key);
  if (storedValue && storedValue !== "undefined") {
    try {
      return JSON.parse(storedValue);
    } catch (e) {
      console.warn(`Could not parse data for localStorage key "${key}". Using default.`, e);
      return defaultValue;
    }
  }
  return defaultValue;
};


const currencySymbols: CurrencySymbols = {
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  AED: 'AED',
  LKR: 'LKR',
};

const defaultThemeSettings: ThemeSettings = {
    appName: 'CZium ERP',
    logoUrl: '',
    primaryColor: '231 48% 48%',
    backgroundColor: '220 17% 95%',
    accentColor: '187 100% 15%',
    invoicePrefix: 'INV-',
    purchaseOrderPrefix: 'PO-',
    disabledModules: [],
    loyaltySettings: {
        tiers: {
            Silver: { points: 500, discount: 5 },
            Gold: { points: 2000, discount: 10 },
        }
    },
    invoiceApprovalThreshold: 0,
};

interface AppContextType {
  // Raw Data & Setters
  invoices: Invoice[];
  setInvoices: CollectionSetter<Invoice>;
  customers: Customer[];
  setCustomers: CollectionSetter<Customer>;
  products: Product[];
  setProducts: CollectionSetter<Product>;
  vendors: Vendor[];
  setVendors: CollectionSetter<Vendor>;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: CollectionSetter<PurchaseOrder>;
  vendorBills: VendorBill[];
  setVendorBills: CollectionSetter<VendorBill>;
  rfqs: RFQ[];
  setRfqs: CollectionSetter<RFQ>;
  assets: Asset[];
  setAssets: CollectionSetter<Asset>;
  itAssets: ITAsset[];
  setItAssets: CollectionSetter<ITAsset>;
  employees: Employee[];
  setEmployees: CollectionSetter<Employee>;
  users: User[];
  setUsers: CollectionSetter<User>;
  stores: Store[];
  setStores: CollectionSetter<Store>;
  activityLogs: ActivityLog[];
  addActivityLog: (action: string, details: string, changes?: ActivityLogChange[]) => void;
  recurringInvoices: RecurringInvoice[];
  setRecurringInvoices: CollectionSetter<RecurringInvoice>;
  attendance: AttendanceEntry[];
  setAttendance: CollectionSetter<AttendanceEntry>;
  leaveRequests: LeaveRequest[];
  setLeaveRequests: CollectionSetter<LeaveRequest>;
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: CollectionSetter<LedgerEntry>;
  payrollRuns: PayrollRun[];
  setPayrollRuns: CollectionSetter<PayrollRun>;
  intercompanyTransactions: IntercompanyTransaction[];
  setIntercompanyTransactions: CollectionSetter<IntercompanyTransaction>;
  customFieldDefinitions: CustomFieldDefinition[];
  setCustomFieldDefinitions: CollectionSetter<CustomFieldDefinition>;
  taxRates: TaxRate[];
  setTaxRates: CollectionSetter<TaxRate>;
  budgets: Budget[];
  setBudgets: CollectionSetter<Budget>;
  candidates: Candidate[];
  setCandidates: CollectionSetter<Candidate>;
  performanceReviews: PerformanceReview[];
  setPerformanceReviews: CollectionSetter<PerformanceReview>;
  billsOfMaterials: BillOfMaterials[];
  setBillsOfMaterials: CollectionSetter<BillOfMaterials>;
  productionOrders: ProductionOrder[];
  setProductionOrders: CollectionSetter<ProductionOrder>;
  qualityChecks: QualityCheck[];
  setQualityChecks: CollectionSetter<QualityCheck>;
  leads: Lead[];
  setLeads: CollectionSetter<Lead>;
  campaigns: Campaign[];
  setCampaigns: CollectionSetter<Campaign>;
  projects: Project[];
  setProjects: CollectionSetter<Project>;
  tasks: Task[];
  setTasks: CollectionSetter<Task>;
  tickets: Ticket[];
  setTickets: CollectionSetter<Ticket>;
  refunds: Refund[];
  setRefunds: CollectionSetter<Refund>;
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  jobRequisitions: JobRequisition[];
  setJobRequisitions: CollectionSetter<JobRequisition>;
  shipments: Shipment[];
  setShipments: CollectionSetter<Shipment>;
  smtpConfigList: SmtpConfig[];
  setSmtpConfigList: CollectionSetter<SmtpConfig>;
  emailTemplates: EmailTemplateConfig[];
  setEmailTemplates: CollectionSetter<EmailTemplateConfig>;
  emailLogs: EmailLog[];
  setEmailLogs: CollectionSetter<EmailLog>;
  approvalWorkflows: ApprovalWorkflow[];
  setApprovalWorkflows: CollectionSetter<ApprovalWorkflow>;
  roles: CustomRole[];
  setRoles: CollectionSetter<CustomRole>;
  warehouses: Warehouse[];
  setWarehouses: CollectionSetter<Warehouse>;
  stockLevels: StockLevel[];
  setStockLevels: CollectionSetter<StockLevel>;
  lots: Lot[];
  setLots: CollectionSetter<Lot>;
  serialUnits: SerialUnit[];
  setSerialUnits: CollectionSetter<SerialUnit>;

  // Auth & Store
  currentStore: Store | null;
  selectStore: (storeId: string) => void;
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, pass: string) => Promise<LoginResult>;
  tenantId: string | null;
  isSuperAdmin: boolean;
  logout: () => void;
  
  // Settings
  currency: Currency;
  setCurrency: React.Dispatch<React.SetStateAction<Currency>>;
  currencySymbol: string;
  currencySymbols: CurrencySymbols;
  companyName: string;
  setCompanyName: React.Dispatch<React.SetStateAction<string>>;
  companyAddress: string;
  setCompanyAddress: React.Dispatch<React.SetStateAction<string>>;
  fiscalYearStartMonth: number;
  setFiscalYearStartMonth: React.Dispatch<React.SetStateAction<number>>;
  themeSettings: ThemeSettings;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
  saveThemeSettings: (patch: Partial<ThemeSettings>) => Promise<void>;
  isHydrated: boolean;
  isStoreResolving: boolean;
  isDataLoaded: boolean;

  // Derived & Memoized Data Maps for performance
  customersMap: Map<string, Customer>;
  productsMap: Map<string, Product>;
  employeesMap: Map<string, Employee>;
  usersMap: Map<string, User>;
  vendorsMap: Map<string, Vendor>;
  storesMap: Map<string, Store>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// A static object for the "All Stores" view
const allStoresView: Store = { id: ALL_STORES_ID, name: 'All Stores', address: 'Global Administrator View' };




// Memoize initial data arrays outside the component
const memoizedInitialInvoices = initialInvoices;
const memoizedInitialCustomers = initialCustomers;
const memoizedInitialProducts = initialProducts;
const memoizedInitialVendors = initialVendors;
const memoizedInitialPurchaseOrders = initialPurchaseOrders;
const memoizedInitialVendorBills = initialVendorBills;
const memoizedInitialRfqs = initialRfqs;
const memoizedInitialAssets = initialAssets;
const memoizedInitialItAssets = initialItAssets;
const memoizedInitialUsers = initialUsers;
const memoizedInitialEmployees = initialEmployees;
const memoizedInitialStores = initialStores;
const memoizedInitialAttendance = initialAttendance;
const memoizedInitialLeaveRequests = initialLeaveRequests;
const memoizedInitialLedgerEntries = initialLedgerEntries;
const memoizedInitialTaxRates = initialTaxRates;
const memoizedInitialBudgets = initialBudgets;
const memoizedInitialCandidates = initialCandidates;
const memoizedInitialPerformanceReviews = initialPerformanceReviews;
const memoizedInitialBillsOfMaterials = initialBillsOfMaterials;
const memoizedInitialProductionOrders = initialProductionOrders;
const memoizedInitialQualityChecks = initialQualityChecks;
const memoizedInitialLeads = initialLeads;
const memoizedInitialCampaigns = initialCampaigns;
const memoizedInitialProjects = initialProjects;
const memoizedInitialTasks = initialTasks;
const memoizedInitialTickets = initialTickets;
const memoizedInitialJobRequisitions = initialJobRequisitions;
const memoizedInitialShipments = initialShipments;

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  // Multi-tenancy: resolved from Firebase Auth custom claims, never client-settable
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  // True while we know a storeId is saved but Firestore hasn't returned stores yet
  const [isStoreResolving, setIsStoreResolving] = useState(false);
  
  // Settings that are still stored locally
  const [currency, setCurrency] = useState<Currency>('AED');
  const [companyName, setCompanyName] = useState<string>('CZium ERP');
  const [companyAddress, setCompanyAddress] = useState<string>('123 Innovation Drive, Tech City, 12345');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(1);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultThemeSettings);
  const [currencySymbol, setCurrencySymbol] = useState<string>('AED');
  
  // Several collections are read-restricted to admin/manager by firestore.rules
  // (HR, Finance, Assets, activity/report audit trails). Passing `null` as the
  // tenantId argument makes useFirestoreCollection skip the subscription
  // entirely (same behavior it already has for signed-out users), so cashiers/
  // inventory-staff never open a listener the rules would reject — avoiding
  // permission-denied errors and toasts on every login.
  const isManagerRole = user?.role === 'admin' || user?.role === 'manager';
  const managerTenantId = isManagerRole ? tenantId : null;

  const [invoices, setInvoices, invoicesLoaded] = useFirestoreCollection<Invoice>('invoices', memoizedInitialInvoices, tenantId);
  const [customers, setCustomers, customersLoaded] = useFirestoreCollection<Customer>('customers', memoizedInitialCustomers, tenantId);
  const [products, setProducts, productsLoaded] = useFirestoreCollection<Product>('products', memoizedInitialProducts, tenantId);
  const [vendors, setVendors] = useFirestoreCollection<Vendor>('vendors', memoizedInitialVendors, tenantId);
  const [purchaseOrders, setPurchaseOrders] = useFirestoreCollection<PurchaseOrder>('purchaseOrders', memoizedInitialPurchaseOrders, tenantId);
  const [vendorBills, setVendorBills] = useFirestoreCollection<VendorBill>('vendorBills', memoizedInitialVendorBills, managerTenantId);
  const [rfqs, setRfqs] = useFirestoreCollection<RFQ>('rfqs', memoizedInitialRfqs, tenantId);
  const [assets, setAssets] = useFirestoreCollection<Asset>('assets', memoizedInitialAssets, managerTenantId);
  const [itAssets, setItAssets] = useFirestoreCollection<ITAsset>('itAssets', memoizedInitialItAssets, managerTenantId);
  const [users, setUsers] = useFirestoreCollection<User>('users', memoizedInitialUsers, tenantId);
  const [employees, setEmployees] = useFirestoreCollection<Employee>('employees', memoizedInitialEmployees, managerTenantId);
  const [stores, setStores] = useFirestoreCollection<Store>('stores', memoizedInitialStores, tenantId);
  const [activityLogs, setActivityLogs] = useFirestoreCollection<ActivityLog>('activityLogs', [], managerTenantId);
  const [attendance, setAttendance] = useFirestoreCollection<AttendanceEntry>('attendance', memoizedInitialAttendance, managerTenantId);
  const [leaveRequests, setLeaveRequests] = useFirestoreCollection<LeaveRequest>('leaveRequests', memoizedInitialLeaveRequests, managerTenantId);
  const [ledgerEntries, setLedgerEntries] = useFirestoreCollection<LedgerEntry>('ledgerEntries', memoizedInitialLedgerEntries, managerTenantId);
  const [payrollRuns, setPayrollRuns] = useFirestoreCollection<PayrollRun>('payrollRuns', [], managerTenantId);
  const [intercompanyTransactions, setIntercompanyTransactions] = useFirestoreCollection<IntercompanyTransaction>('intercompanyTransactions', [], managerTenantId);
  const [customFieldDefinitions, setCustomFieldDefinitions] = useFirestoreCollection<CustomFieldDefinition>('customFieldDefinitions', [], tenantId);
  const [taxRates, setTaxRates] = useFirestoreCollection<TaxRate>('taxRates', memoizedInitialTaxRates, tenantId);
  const [budgets, setBudgets] = useFirestoreCollection<Budget>('budgets', memoizedInitialBudgets, managerTenantId);
  const [candidates, setCandidates] = useFirestoreCollection<Candidate>('candidates', memoizedInitialCandidates, managerTenantId);
  const [performanceReviews, setPerformanceReviews] = useFirestoreCollection<PerformanceReview>('performanceReviews', memoizedInitialPerformanceReviews, managerTenantId);
  const [billsOfMaterials, setBillsOfMaterials] = useFirestoreCollection<BillOfMaterials>('billsOfMaterials', memoizedInitialBillsOfMaterials, tenantId);
  const [productionOrders, setProductionOrders] = useFirestoreCollection<ProductionOrder>('productionOrders', memoizedInitialProductionOrders, tenantId);
  const [qualityChecks, setQualityChecks] = useFirestoreCollection<QualityCheck>('qualityChecks', memoizedInitialQualityChecks, tenantId);
  const [leads, setLeads] = useFirestoreCollection<Lead>('leads', memoizedInitialLeads, tenantId);
  const [campaigns, setCampaigns] = useFirestoreCollection<Campaign>('campaigns', memoizedInitialCampaigns, managerTenantId);
  const [projects, setProjects] = useFirestoreCollection<Project>('projects', memoizedInitialProjects, tenantId);
  const [tasks, setTasks] = useFirestoreCollection<Task>('tasks', memoizedInitialTasks, tenantId);
  const [tickets, setTickets] = useFirestoreCollection<Ticket>('tickets', memoizedInitialTickets, tenantId);
  const [jobRequisitions, setJobRequisitions] = useFirestoreCollection<JobRequisition>('jobRequisitions', memoizedInitialJobRequisitions, managerTenantId);
  const [shipments, setShipments] = useFirestoreCollection<Shipment>('shipments', memoizedInitialShipments, tenantId);
  const [notifications, setNotifications] = useFirestoreCollection<Notification>('notifications', [], tenantId);
  const [refunds, setRefunds] = useFirestoreCollection<Refund>('refunds', [], tenantId);
  const [recurringInvoices, setRecurringInvoices] = useFirestoreCollection<RecurringInvoice>('recurringInvoices', [], managerTenantId);
  const [smtpConfigList, setSmtpConfigList] = useFirestoreCollection<SmtpConfig>('smtpConfig', [], tenantId);
  const [emailTemplates, setEmailTemplates] = useFirestoreCollection<EmailTemplateConfig>('emailTemplates', [], tenantId);
  const [emailLogs, setEmailLogs] = useFirestoreCollection<EmailLog>('emailLogs', [], managerTenantId);
  const [approvalWorkflows, setApprovalWorkflows] = useFirestoreCollection<ApprovalWorkflow>('approvalWorkflows', [], tenantId);
  const [roles, setRoles] = useFirestoreCollection<CustomRole>('roles', [], tenantId);
  const [warehouses, setWarehouses, warehousesLoaded] = useFirestoreCollection<Warehouse>('warehouses', [], tenantId);
  const [stockLevels, setStockLevels] = useFirestoreCollection<StockLevel>('stockLevels', [], tenantId);
  const [lots, setLots] = useFirestoreCollection<Lot>('lots', [], tenantId);
  const [serialUnits, setSerialUnits] = useFirestoreCollection<SerialUnit>('serialUnits', [], tenantId);

  // One-time per-tenant seed: the first time a tenant's warehouse list is confirmed empty
  // (Firestore has actually reported back, not just "not loaded yet"), create a default
  // warehouse and seed StockLevel docs from each existing Product's current stock value.
  // This makes every existing tenant warehouse-aware with zero manual migration and zero
  // visible change to their numbers — Product.stock stays what it was, just now backed by
  // one StockLevel doc per product instead of being the sole source of truth.
  useEffect(() => {
    if (!tenantId || !warehousesLoaded || !productsLoaded) return;
    if (warehouses.length > 0) return;
    // Always create the default warehouse, even with zero products yet, so future
    // stock-touching flows (PO receiving, manufacturing) always have somewhere to write to.
    const defaultWarehouse: Warehouse = { id: `wh-default-${tenantId}`, name: 'Main Warehouse', isDefault: true };
    setWarehouses([defaultWarehouse]);
    if (products.length > 0) {
      setStockLevels(prev => {
        const seeded = products
          .filter(p => !prev.some(s => s.productId === p.id && s.warehouseId === defaultWarehouse.id))
          .map(p => ({ id: `${p.id}_${defaultWarehouse.id}`, productId: p.id, warehouseId: defaultWarehouse.id, stock: p.stock, updatedAt: new Date().toISOString() }));
        return [...prev, ...seeded];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, warehousesLoaded, productsLoaded, warehouses.length]);

  // Phase 1: Read localStorage immediately — no Firestore dependency.
  // This unblocks the UI (isHydrated=true) before any network call completes.
  useEffect(() => {
    const storedAuth = getStoredState('isAuthenticated', false);
    setIsAuthenticated(storedAuth);
    const storedUser = getStoredState<User | null>('user', null);
    setUser(storedUser);
    setCurrency(getStoredState('currency', 'AED'));
    setCompanyName(getStoredState('companyName', 'CZium ERP'));
    setCompanyAddress(getStoredState('companyAddress', '123 Innovation Drive, Tech City, 12345'));
    setFiscalYearStartMonth(getStoredState('fiscalYearStartMonth', 1));
    setThemeSettings(getStoredState('themeSettings', defaultThemeSettings));

    const storedStoreId = getStoredState<string | null>('currentStoreId', null);
    if (storedStoreId === ALL_STORES_ID) {
      // All-Stores is available to any role now — a user with no assigned
      // store legitimately operates in the global view.
      setCurrentStore(allStoresView);
    } else if (storedStoreId) {
      // Mark that we expect a store — Phase 2 will resolve it once Firestore is ready
      setIsStoreResolving(true);
    }

    setIsHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore tenant/super-admin claims whenever the Firebase session resumes.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setTenantId(null);
        setIsSuperAdmin(false);
        return;
      }
      try {
        const token = await fbUser.getIdTokenResult(true);
        setTenantId((token.claims.tenantId as string) ?? null);
        setIsSuperAdmin(token.claims.superAdmin === true);
      } catch {
        setTenantId(null);
        setIsSuperAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Per-tenant settings: /tenants/{id}/settings/app is the source of truth for
  // branding + enabled modules. localStorage remains a fast-paint cache only.
  const remoteThemeRef = useRef<string | null>(null);
  const themeSettingsRef = useRef<ThemeSettings>(themeSettings);
  useEffect(() => { themeSettingsRef.current = themeSettings; }, [themeSettings]);
  useEffect(() => {
    if (!tenantId) return;
    const ref = doc(db, 'tenants', tenantId, 'settings', 'app');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as { themeSettings?: ThemeSettings } | undefined;
      if (data?.themeSettings) {
        remoteThemeRef.current = JSON.stringify(data.themeSettings);
        setThemeSettings(data.themeSettings);
      }
    }, () => { /* settings read failure falls back to local cache */ });
    return () => unsub();
  }, [tenantId]);

  // Self-heal: security rules gate reads of most collections on the tenant
  // doc's enabledModules field (moduleEnabled()). If that field is missing,
  // incomplete, or was written by an older buggy module-name list, non-admin
  // roles get denied on data (e.g. invoices, products) that should be visible.
  // On each admin login, reconcile it against the current disabledModules —
  // this doesn't depend on the admin touching Settings to trigger a fix.
  useEffect(() => {
    if (!tenantId || !isHydrated || !isAuthenticated || user?.role !== 'admin') return;
    const wanted = ALL_MODULES.filter(m => !(themeSettings.disabledModules ?? []).includes(m));
    getDoc(doc(db, 'tenants', tenantId)).then(snap => {
      const current: string[] = snap.data()?.enabledModules ?? [];
      const isStale = current.length !== wanted.length || wanted.some(m => !current.includes(m));
      if (isStale) {
        setDoc(doc(db, 'tenants', tenantId), { enabledModules: wanted }, { merge: true }).catch(() => {});
      }
    }).catch(() => { /* read failure — leave as-is, next save will still reconcile */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isHydrated, isAuthenticated, user?.role]);

  useEffect(() => {
    if (!tenantId || !isHydrated || !isAuthenticated) return;
    const json = JSON.stringify(themeSettings);
    if (json === remoteThemeRef.current) return;
    remoteThemeRef.current = json;
    setDoc(doc(db, 'tenants', tenantId, 'settings', 'app'), { themeSettings }, { merge: true }).catch(() => {});
    // Mirror module toggles onto the tenant root doc so security rules can
    // enforce them server-side (moduleEnabled() reads this field directly —
    // any module missing here is denied for every role, including admin).
    if (user?.role === 'admin') {
      const enabledModules = ALL_MODULES.filter(m => !(themeSettings.disabledModules ?? []).includes(m));
      setDoc(doc(db, 'tenants', tenantId), { enabledModules }, { merge: true }).catch(() => { /* denied outside allowance */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSettings, tenantId, isHydrated, isAuthenticated]);

  // companyName/companyAddress used to be localStorage-only. They now live on
  // themeSettings (which round-trips to Firestore above); this mirrors them
  // into the standalone state so existing useAppContext().companyName call
  // sites keep working unmodified.
  useEffect(() => {
    if (themeSettings.companyName) setCompanyName(themeSettings.companyName);
    if (themeSettings.companyAddress) setCompanyAddress(themeSettings.companyAddress);
  }, [themeSettings.companyName, themeSettings.companyAddress]);

  // Explicit save path for Settings-page "Save" buttons: writes straight to
  // Firestore and resolves only once the write completes, so callers can show
  // real save-in-progress feedback instead of relying on the reactive effect
  // above (which is fire-and-forget and meant for cross-tab sync).
  const saveThemeSettings = useCallback(async (patch: Partial<ThemeSettings>) => {
    const merged = { ...themeSettingsRef.current, ...patch };
    setThemeSettings(merged);
    if (!tenantId) return;
    const json = JSON.stringify(merged);
    remoteThemeRef.current = json;
    await setDoc(doc(db, 'tenants', tenantId, 'settings', 'app'), { themeSettings: merged }, { merge: true });
    // Same mirror as the reactive effect below — needed here too since setting
    // remoteThemeRef above makes that effect see this write as already-synced
    // and skip it, which previously meant Module-tab saves never updated the
    // enabledModules field the security rules actually enforce.
    if (user?.role === 'admin') {
      const enabledModules = ALL_MODULES.filter(m => !(merged.disabledModules ?? []).includes(m));
      await setDoc(doc(db, 'tenants', tenantId), { enabledModules }, { merge: true }).catch(() => { /* denied outside allowance */ });
    }
  }, [tenantId, user?.role]);

  // Phase 2: Resolve currentStore once Firestore 'stores' collection arrives.
  // Runs independently — does not block hydration.
  useEffect(() => {
    if (!isStoreResolving) return;
    if (stores.length === 0) return; // Firestore not ready yet
    const storedStoreId = getStoredState<string | null>('currentStoreId', null);
    if (storedStoreId && storedStoreId !== 'all') {
      setCurrentStore(stores.find(s => s.id === storedStoreId) || null);
    }
    setIsStoreResolving(false);
  }, [stores, isStoreResolving]);

  // Safety timeout: if Firestore never returns stores, stop waiting after 8s
  // so the app can redirect to /select-store instead of being stuck forever.
  useEffect(() => {
    if (!isStoreResolving) return;
    const timer = setTimeout(() => {
      setIsStoreResolving(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isStoreResolving]);

  // Effects to persist non-Firestore state changes to localStorage after hydration
  useEffect(() => { if (isHydrated) localStorage.setItem('isAuthenticated', JSON.stringify(isAuthenticated)); }, [isAuthenticated, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('user', JSON.stringify(user)); }, [user, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('currentStoreId', JSON.stringify(currentStore ? currentStore.id : null)); }, [currentStore, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('currency', JSON.stringify(currency)); }, [currency, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('companyName', JSON.stringify(companyName)); }, [companyName, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('companyAddress', JSON.stringify(companyAddress)); }, [companyAddress, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('fiscalYearStartMonth', JSON.stringify(fiscalYearStartMonth)); }, [fiscalYearStartMonth, isHydrated]);
  useEffect(() => { if (isHydrated) localStorage.setItem('themeSettings', JSON.stringify(themeSettings)); }, [themeSettings, isHydrated]);

  // Sync settings changes from other tabs via storage events
  useEffect(() => {
    if (!isHydrated) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.newValue === null) return;
      try {
        const val = JSON.parse(e.newValue);
        if (e.key === 'currency') setCurrency(val);
        if (e.key === 'companyName') setCompanyName(val);
        if (e.key === 'companyAddress') setCompanyAddress(val);
        if (e.key === 'fiscalYearStartMonth') setFiscalYearStartMonth(val);
        if (e.key === 'themeSettings') setThemeSettings(val);
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isHydrated]);

  const addActivityLog = useCallback(async (action: string, details: string, changes?: ActivityLogChange[]) => {
    const currentUser = user || (isAuthenticated ? { name: 'Admin User', email: 'admin@czium.com', avatar: '', role: 'admin' } : null);
    if (!currentUser) return;

    const storeInfo = currentStore ? ` (Store: ${currentStore.name})` : '';

    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser.email,
      action: action,
      details: `${details}${storeInfo}`,
      ...(changes && changes.length > 0 ? { changes } : {}),
    };
    if (!tenantId) return;
    await setDoc(doc(db, 'tenants', tenantId, 'activityLogs', newLog.id), newLog).catch(() => { /* logging must never break the action that triggered it */ });
  }, [user, isAuthenticated, currentStore, tenantId]);

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
    if (!tenantId) return;
    const newNotification: Notification = {
        id: uuid(),
        createdAt: new Date().toISOString(),
        isRead: false,
        ...notification,
    };
    await setDoc(doc(db, 'tenants', tenantId, 'notifications', newNotification.id), newNotification).catch(() => { /* non-fatal */ });
  }, [tenantId]);

  const markNotificationAsRead = useCallback(async (id: string) => {
    if (!tenantId) return;
    const notificationRef = doc(db, 'tenants', tenantId, 'notifications', id);
    await setDoc(notificationRef, { isRead: true }, { merge: true });
  }, [tenantId]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!tenantId) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.isRead).forEach(n => {
        const docRef = doc(db, 'tenants', tenantId, 'notifications', n.id);
        batch.update(docRef, { isRead: true });
    });
    await batch.commit();
  }, [notifications, tenantId]);

  const dismissNotification = useCallback(async (id: string) => {
    if (!tenantId) return;
    await deleteDoc(doc(db, 'tenants', tenantId, 'notifications', id));
  }, [tenantId]);

  const clearAllNotifications = useCallback(async () => {
    if (!tenantId) return;
    const batch = writeBatch(db);
    notifications.forEach(n => batch.delete(doc(db, 'tenants', tenantId, 'notifications', n.id)));
    await batch.commit();
  }, [notifications, tenantId]);

  // Memoized maps for performant lookups
  const customersMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const productsMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const employeesMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const vendorsMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const storesMap = useMemo(() => new Map(stores.map(s => [s.id, s])), [stores]);

  // Effect to update currency symbol when currency changes
  useEffect(() => {
    setCurrencySymbol(currencySymbols[currency]);
  }, [currency]);

  const handleSetCurrency = (newCurrency: Currency) => {
    if (currencySymbols[newCurrency]) {
      setCurrency(newCurrency);
      addActivityLog('Settings Updated', `Currency changed to ${newCurrency}`);
    }
  };

  const login = async (email: string, pass: string): Promise<LoginResult> => {
    // Authenticate against Firebase Auth — passwords are never stored in
    // app code, Firestore, or client state.
    let fbUser;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      fbUser = cred.user;
    } catch {
      return { user: null, error: 'Invalid email or password.' };
    }

    // Enforce verified email (accounts provisioned by admins are pre-verified).
    if (!fbUser.emailVerified) {
      try { await sendEmailVerification(fbUser); } catch { /* rate-limited is fine */ }
      await signOut(auth).catch(() => {});
      return { user: null, error: 'Please verify your email first. A new verification link has been sent.' };
    }

    // Tenant + role come from custom claims — the only trusted source.
    const token = await fbUser.getIdTokenResult(true);
    const claimTenantId = (token.claims.tenantId as string) ?? null;
    const superAdmin = token.claims.superAdmin === true;
    const claimRole = (token.claims.role as Role) ?? 'cashier';

    if (superAdmin) {
      const saUser: User = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Super Admin',
        email: fbUser.email ?? email,
        avatar: '',
        role: 'admin',
      };
      setIsSuperAdmin(true);
      setTenantId(null);
      setIsAuthenticated(true);
      setUser(saUser);
      setCurrentStore(allStoresView);
      return { user: saUser, superAdmin: true };
    }

    if (!claimTenantId) {
      await signOut(auth).catch(() => {});
      return { user: null, error: 'Your account has no workspace assigned yet. Contact your administrator.' };
    }

    // Verify the tenant is active before letting anyone in.
    try {
      const tenantSnap = await getDoc(doc(db, 'tenantDirectory', claimTenantId));
      if (tenantSnap.exists() && tenantSnap.data()?.status === 'suspended') {
        await signOut(auth).catch(() => {});
        return { user: null, error: 'This workspace is suspended. Contact support.' };
      }
    } catch { /* directory read failures must not block login */ }

    setTenantId(claimTenantId);
    setIsSuperAdmin(false);

    // Load (or self-heal) the profile inside the tenant.
    let loggedInUser: User;
    try {
      const profileQuery = query(
        collection(db, 'tenants', claimTenantId, 'users'),
        where('email', '==', (fbUser.email ?? email).toLowerCase())
      );
      const snap = await getDocs(profileQuery);
      if (!snap.empty) {
        const d = snap.docs[0];
        loggedInUser = { ...(d.data() as User), id: d.id };
      } else {
        loggedInUser = {
          id: fbUser.uid,
          name: fbUser.displayName || (fbUser.email ?? email),
          email: (fbUser.email ?? email).toLowerCase(),
          avatar: '',
          role: claimRole,
        };
        await setDoc(doc(db, 'tenants', claimTenantId, 'users', fbUser.uid), loggedInUser);
      }
    } catch {
      await signOut(auth).catch(() => {});
      setTenantId(null);
      return { user: null, error: 'Could not load your profile. Please try again.' };
    }
    // Role claim is authoritative over the profile doc.
    loggedInUser = { ...loggedInUser, role: claimRole };

    setIsAuthenticated(true);
    setUser(loggedInUser);

    addActivityLog('User Login', `User ${loggedInUser.email} logged in.`);

    // Store assignment is optional for every role. A user with an assigned
    // storeId lands directly in that store; anyone without one (any role)
    // defaults to the All-Stores view rather than being forced to pick.
    if (loggedInUser.storeId) {
      const store = stores.find(s => s.id === loggedInUser.storeId);
      if (store) {
        setCurrentStore(store);
      } else {
        // 'stores' collection hasn't arrived yet — reuse the existing
        // hydration path (isStoreResolving + localStorage) that resolves
        // currentStoreId once Firestore delivers the stores list.
        localStorage.setItem('currentStoreId', JSON.stringify(loggedInUser.storeId));
        setIsStoreResolving(true);
      }
    } else {
      setCurrentStore(allStoresView);
    }

    return { user: loggedInUser };
  };

  const selectStore = (storeId: string) => {
    if (storeId === ALL_STORES_ID) {
      setCurrentStore(allStoresView);
      addActivityLog('Store Selected', 'Session set to All Stores (Global View)');
      return;
    }

    const store = stores.find(s => s.id === storeId);
    if (store) {
        setCurrentStore(store);
        addActivityLog('Store Selected', `Session set to store: ${store.name}`);
    }
  };

  const logout = useCallback(() => {
    if(user) {
        addActivityLog('User Logout', `User ${user.email} logged out.`);
    }
    setIsAuthenticated(false);
    setUser(null);
    setCurrentStore(null);
    setTenantId(null);
    setIsSuperAdmin(false);
    // End the Firebase Auth session (revokes Firestore access under the new rules)
    signOut(auth).catch(() => {});
    // Keep localstorage for offline data, but clear auth state
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    localStorage.removeItem('currentStoreId');
  }, [user, addActivityLog]);

  // Session timeout: auto-logout after 2 hours of inactivity
  useEffect(() => {
    if (!isAuthenticated) return;
    const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, SESSION_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [isAuthenticated, logout]);
  
  const contextValue: AppContextType = {
      // Raw Data & Setters
      invoices, setInvoices,
      customers, setCustomers,
      products, setProducts,
      vendors, setVendors,
      purchaseOrders, setPurchaseOrders,
      vendorBills, setVendorBills,
      rfqs, setRfqs,
      assets, setAssets,
      itAssets, setItAssets,
      employees, setEmployees,
      users, setUsers,
      stores, setStores,
      activityLogs, addActivityLog,
      attendance, setAttendance,
      leaveRequests, setLeaveRequests,
      ledgerEntries, setLedgerEntries,
      payrollRuns, setPayrollRuns,
      intercompanyTransactions, setIntercompanyTransactions,
      customFieldDefinitions, setCustomFieldDefinitions,
      taxRates, setTaxRates,
      budgets, setBudgets,
      candidates, setCandidates,
      performanceReviews, setPerformanceReviews,
      billsOfMaterials, setBillsOfMaterials,
      productionOrders, setProductionOrders,
      qualityChecks, setQualityChecks,
      leads, setLeads,
      campaigns, setCampaigns,
      projects, setProjects,
      tasks, setTasks,
      tickets, setTickets,
      notifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead, dismissNotification, clearAllNotifications,
      refunds, setRefunds,
      jobRequisitions, setJobRequisitions,
      shipments, setShipments,
      recurringInvoices, setRecurringInvoices,
      smtpConfigList, setSmtpConfigList,
      emailTemplates, setEmailTemplates,
      emailLogs, setEmailLogs,
      approvalWorkflows, setApprovalWorkflows,
      roles, setRoles,
      warehouses, setWarehouses,
      stockLevels, setStockLevels,
      lots, setLots,
      serialUnits, setSerialUnits,

      // Auth & Store
      currentStore,
      selectStore,
      isAuthenticated, user, login, logout,
      tenantId, isSuperAdmin,
      
      // Settings
      currency,
      setCurrency: handleSetCurrency as React.Dispatch<React.SetStateAction<Currency>>,
      currencySymbol,
      currencySymbols,
      companyName, setCompanyName,
      companyAddress, setCompanyAddress,
      fiscalYearStartMonth, setFiscalYearStartMonth,
      themeSettings, setThemeSettings, saveThemeSettings,
      isHydrated,
      isStoreResolving,
      isDataLoaded: invoicesLoaded && customersLoaded && productsLoaded,
    
      // Derived & Memoized Data Maps
      customersMap,
      productsMap,
      employeesMap,
      usersMap,
      vendorsMap,
      storesMap
  };


  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
