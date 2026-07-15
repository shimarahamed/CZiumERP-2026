
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar } from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, FileText, CreditCard, BarChart3, Lightbulb, Package,
  Building2, History, Settings, Undo2, ShoppingCart, UserCog, Store, ClipboardList,
  Archive, Clock, CalendarPlus, Banknote, UserRoundCog, BookCopy, Target, Landmark as LandmarkIcon,
  UserPlus, Star, ClipboardCheck, Megaphone, Briefcase, LifeBuoy, Truck, Map, ChevronDown, Wrench, Database, Receipt, DollarSign, ScanLine, Rocket,
  PieChart, Shield, Mail, TrendingUp, Search, X
, Upload, ArrowLeftRight, LayoutGrid, MessageSquare, CalendarClock } from '@/components/icons';
import Link from 'next/link';
import { useAppContext } from '@/context/AppContext';
import { useFavoriteNavLinks } from '@/hooks/use-favorite-nav-links';
import type { Role, Module } from '@/types';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavCategory = {
  label: Module;
  icon: LucideIcon;
  links: NavLink[];
};


const navLinksConfig: Record<Role, string[]> = {
    admin: ['Dashboard', 'Advanced Analytics', 'AI Assistant', 'Point of Sale', 'Invoices', 'Quotations', 'Payments', 'Returns', 'Customers', 'AI Upselling', 'Leads', 'Marketing Campaigns', 'Barcode Scanner', 'Inventory', 'Cycle Count', 'Purchase Orders', 'Request for Quotation', 'Vendors', 'Stores', 'Warehouses', 'Reports', 'Cohort Analysis', 'Profitability', 'Scheduled Reports', 'Assets', 'Employees', 'Departments', 'Staff Accounts', 'Attendance', 'Timesheets', 'Leave Requests', 'Expense Claims', 'Payroll', 'HR Settings', 'Activity Logs', 'Settings', 'Custom Roles', 'Custom Fields', 'Bulk Import', 'RBAC Permissions', 'Multi-Tenant', 'General Ledger', 'Accounts Payable', 'Accounts Receivable', 'Tax Management', 'Budgeting', 'Bank Reconciliation', 'Financial Statements', 'Intercompany', 'Job Requisitions', 'Candidate Pipeline', 'Performance', 'Bill of Materials', 'Production Orders', 'Quality Control', 'Projects', 'Support Tickets', 'IT Assets', 'HR Dashboard', 'Fleet Management', 'Route Planning', 'Shipment Tracking', 'System Issues', 'Testing Checklist', 'Data Management'],
    manager: ['Dashboard', 'Advanced Analytics', 'AI Assistant', 'Point of Sale', 'Invoices', 'Quotations', 'Payments', 'Returns', 'Customers', 'AI Upselling', 'Leads', 'Marketing Campaigns', 'Barcode Scanner', 'Inventory', 'Cycle Count', 'Purchase Orders', 'Request for Quotation', 'Vendors', 'Stores', 'Reports', 'Cohort Analysis', 'Profitability', 'Activity Logs', 'Settings', 'Bulk Import', 'Assets', 'Employees', 'Departments', 'Attendance', 'Timesheets', 'Leave Requests', 'Expense Claims', 'HR Settings', 'General Ledger', 'Accounts Payable', 'Accounts Receivable', 'Tax Management', 'Budgeting', 'Bank Reconciliation', 'Financial Statements', 'Intercompany', 'Job Requisitions', 'Candidate Pipeline', 'Performance', 'Bill of Materials', 'Production Orders', 'Quality Control', 'Projects', 'Support Tickets', 'IT Assets', 'HR Dashboard', 'Fleet Management', 'Route Planning', 'Shipment Tracking'],
    cashier: ['Dashboard', 'AI Assistant', 'Point of Sale', 'Invoices', 'Quotations', 'Payments', 'Returns', 'Customers', 'AI Upselling', 'Barcode Scanner', 'Vendors', 'Request for Quotation', 'Purchase Orders', 'Inventory', 'Cycle Count', 'Timesheets', 'Expense Claims', 'Bulk Import'],
    'inventory-staff': ['AI Assistant', 'Inventory', 'Cycle Count', 'Purchase Orders', 'Vendors', 'Reports', 'Bill of Materials', 'Production Orders', 'Quality Control', 'Barcode Scanner', 'Timesheets', 'Expense Claims', 'Bulk Import'],
};

// Reorganized structure for better logical flow
const categories: NavCategory[] = [
  {
    label: 'General',
    icon: LayoutDashboard,
    links: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Advanced Analytics', icon: TrendingUp },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/reports/cohorts', label: 'Cohort Analysis', icon: PieChart },
      { href: '/reports/profitability', label: 'Profitability', icon: TrendingUp },
      { href: '/reports/scheduled', label: 'Scheduled Reports', icon: Mail },
      { href: '/assistant', label: 'AI Assistant', icon: MessageSquare },
    ],
  },
  {
    label: 'Sales & Customers',
    icon: ShoppingCart,
    links: [
      { href: '/pos', label: 'Point of Sale', icon: CreditCard },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/returns', label: 'Returns', icon: Undo2 },
      { href: '/quotations', label: 'Quotations', icon: ClipboardList },
      { href: '/campaigns', label: 'Marketing Campaigns', icon: Megaphone },
      { href: '/leads', label: 'Leads', icon: Target },
      { href: '/upselling', label: 'AI Upselling', icon: Lightbulb },
      { href: '/scanner', label: 'Barcode Scanner', icon: ScanLine },
    ],
  },
  {
    label: 'Supply Chain',
    icon: Package,
    links: [
      { href: '/inventory', label: 'Inventory', icon: Package },
      { href: '/vendors', label: 'Vendors', icon: Building2 },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      { href: '/rfq', label: 'Request for Quotation', icon: ClipboardList },
      { href: '/inventory/cycle-count', label: 'Cycle Count', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Manufacturing',
    icon: Wrench,
    links: [
      { href: '/manufacturing/bom', label: 'Bill of Materials', icon: BookCopy },
      { href: '/manufacturing/production', label: 'Production Orders', icon: Rocket },
      { href: '/manufacturing/quality', label: 'Quality Control', icon: ClipboardCheck },
    ]
  },
  {
    label: 'Shipping & Logistics',
    icon: Truck,
    links: [
      { href: '/shipping/shipments', label: 'Shipment Tracking', icon: ClipboardList },
      { href: '/shipping/vehicles', label: 'Fleet Management', icon: UserCog },
      { href: '/shipping/routes', label: 'Route Planning', icon: Map },
    ],
  },
  {
    label: 'Finance',
    icon: LandmarkIcon,
    links: [
      { href: '/accounting/receivables', label: 'Accounts Receivable', icon: DollarSign },
      { href: '/accounting/payables', label: 'Accounts Payable', icon: Receipt },
      { href: '/accounting/general-ledger', label: 'General Ledger', icon: BookCopy },
      { href: '/accounting/intercompany', label: 'Intercompany', icon: ArrowLeftRight },
      { href: '/accounting/statements', label: 'Financial Statements', icon: FileText },
      { href: '/accounting/reconciliation', label: 'Bank Reconciliation', icon: Banknote },
      { href: '/accounting/budgeting', label: 'Budgeting', icon: Target },
      { href: '/accounting/tax', label: 'Tax Management', icon: LandmarkIcon },
      { href: '/accounting/assets', label: 'Assets', icon: Archive },
    ],
  },
  {
    label: 'Human Resources',
    icon: UserCog,
    links: [
      { href: '/human-resources/dashboard', label: 'HR Dashboard', icon: Users },
      { href: '/human-resources/departments', label: 'Departments', icon: Building2 },
      { href: '/human-resources/jobs', label: 'Job Requisitions', icon: ClipboardList },
      { href: '/human-resources/recruitment', label: 'Candidate Pipeline', icon: UserPlus },
      { href: '/human-resources/employees', label: 'Employees', icon: UserCog },
      { href: '/human-resources/attendance', label: 'Attendance', icon: Clock },
      { href: '/human-resources/timesheets', label: 'Timesheets', icon: CalendarClock },
      { href: '/human-resources/leave-requests', label: 'Leave Requests', icon: CalendarPlus },
      { href: '/human-resources/expenses', label: 'Expense Claims', icon: Receipt },
      { href: '/human-resources/performance', label: 'Performance', icon: Star },
      { href: '/human-resources/payroll', label: 'Payroll', icon: Banknote },
      { href: '/human-resources/settings', label: 'HR Settings', icon: Settings },
    ],
  },
  {
    label: 'Project Management',
    icon: Briefcase,
    links: [
      { href: '/projects', label: 'Projects', icon: Briefcase },
    ]
  },
  {
    label: 'Service Desk',
    icon: LifeBuoy,
    links: [
      { href: '/support/tickets', label: 'Support Tickets', icon: LifeBuoy },
      { href: '/support/it-assets', label: 'IT Assets', icon: Wrench },
    ]
  },
  ...(process.env.NODE_ENV === 'development' ? [{
    label: 'Testing' as Module,
    icon: Wrench,
    links: [
      { href: '/testing/issues', label: 'System Issues', icon: Wrench },
      { href: '/testing/functional', label: 'Testing Checklist', icon: ClipboardCheck },
      { href: '/testing/data', label: 'Data Management', icon: Database },
    ]
  }] : []),
  {
    label: 'System',
    icon: Settings,
    links: [
      { href: '/stores', label: 'Stores', icon: Store },
      { href: '/warehouses', label: 'Warehouses', icon: Store },
      { href: '/users', label: 'Staff Accounts', icon: UserRoundCog },
      { href: '/activity', label: 'Activity Logs', icon: History },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/settings/roles', label: 'Custom Roles', icon: Shield },
      { href: '/settings/custom-fields', label: 'Custom Fields', icon: LayoutGrid },
      { href: '/settings/import', label: 'Bulk Import', icon: Upload },
    ],
  }
];


export default function Nav() {
  const pathname = usePathname();
  const { user, themeSettings } = useAppContext();
  const { state, setOpen } = useSidebar();
  const [navSearch, setNavSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isFavorite, toggleFavorite } = useFavoriteNavLinks();
  const canFavorite = Boolean(user);

  const initialOpenState = categories.reduce((acc, category) => {
      if (category.links.some(link => isActive(link.href, pathname))) {
          acc[category.label] = true;
      }
      return acc;
  }, {} as Record<string, boolean>);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(initialOpenState);

  function isActive(href: string, currentPath: string) {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }

  const toggleCategory = (label: string) => {
    if (state === 'collapsed') {
      setOpen(true);
    }
    setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavSearchChange = (val: string) => {
    setNavSearch(val);
    if (val && state === 'collapsed') {
      setOpen(true);
    }
  };

  if (!user) return null;

  const allowedLinks = navLinksConfig[user.role] || [];
  const disabledModules = themeSettings.disabledModules || [];

  const isSearching = navSearch.trim().length > 0;
  const searchQuery = navSearch.trim().toLowerCase();

  const visibleCategories = categories
    .filter(category => !disabledModules.includes(category.label))
    .filter(category => category.links.some(link => allowedLinks.includes(link.label)));

  const filteredCategories = visibleCategories
    .map(category => ({
      ...category,
      links: category.links.filter(link =>
        allowedLinks.includes(link.label) &&
        (!isSearching || link.label.toLowerCase().includes(searchQuery) || category.label.toLowerCase().includes(searchQuery))
      ),
    }))
    .filter(category => category.links.length > 0);

  if (visibleCategories.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        All modules are currently disabled. Enable modules in Settings.
      </div>
    );
  }

  const allVisibleLinks = visibleCategories.flatMap(category => category.links.filter(link => allowedLinks.includes(link.label)));
  const favoriteLinks = canFavorite
    ? allVisibleLinks.filter(link => isFavorite(link.href) && (!isSearching || link.label.toLowerCase().includes(searchQuery)))
    : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Nav search — hidden in icon-only collapsed mode */}
      <div className="px-2 pt-2 pb-1 group-data-[collapsible=icon]:hidden shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search navigation…"
            value={navSearch}
            onChange={e => handleNavSearchChange(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-sm bg-sidebar-accent/40 border border-sidebar-border rounded-md placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-sidebar-accent/60 transition-colors"
          />
          {navSearch && (
            <button
              type="button"
              onClick={() => setNavSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isSearching && filteredCategories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No pages found</p>
        )}
      </div>

      <SidebarMenu className="p-2 space-y-1 flex-1 overflow-y-auto no-scrollbar">
        {favoriteLinks.length > 0 && (
          <SidebarMenuItem key="__favorites">
            <SidebarMenuButton
              onClick={() => toggleCategory('__favorites')}
              className="font-semibold text-sidebar-foreground/90"
              tooltip="Favourites"
            >
              <Star className="w-5 h-5" />
              <span>Favourites</span>
              {!isSearching && (
                <ChevronDown className={cn(
                  "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                  (isSearching ? true : openCategories.__favorites) && "rotate-180",
                  "group-data-[collapsible=icon]:hidden"
                )} />
              )}
            </SidebarMenuButton>
            <SidebarMenuSub data-state={(isSearching ? true : openCategories.__favorites) ? 'open' : 'closed'}>
              {favoriteLinks.map(link => (
                <SidebarMenuSubItem key={link.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(link.href, pathname)}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary group/fav"
                    onClick={() => setNavSearch('')}
                  >
                    <Link href={link.href} className="flex items-center w-full">
                      <link.icon className="w-4 h-4" />
                      <span className="flex-1">{link.label}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(link.href); }}
                        className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
                        aria-label="Remove from favourites"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </SidebarMenuItem>
        )}
        {filteredCategories.map((category) => {
          const isCategoryOpen = isSearching ? true : openCategories[category.label];

          return (
            <SidebarMenuItem key={category.label}>
              <SidebarMenuButton
                onClick={() => toggleCategory(category.label)}
                className="font-semibold text-sidebar-foreground/90"
                tooltip={category.label}
              >
                <category.icon className="w-5 h-5" />
                <span>{category.label}</span>
                {!isSearching && (
                  <ChevronDown className={cn(
                    "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                    isCategoryOpen && "rotate-180",
                    "group-data-[collapsible=icon]:hidden"
                  )} />
                )}
              </SidebarMenuButton>

              <SidebarMenuSub data-state={isCategoryOpen ? 'open' : 'closed'}>
                {category.links.map((link) => (
                  <SidebarMenuSubItem key={link.href}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isActive(link.href, pathname)}
                      className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary"
                      onClick={() => setNavSearch('')}
                    >
                      <Link href={link.href} className="flex items-center w-full group/link">
                        <link.icon className="w-4 h-4" />
                        <span className="flex-1">{link.label}</span>
                        {canFavorite && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(link.href); }}
                            className={cn(
                              "shrink-0 transition-opacity group-data-[collapsible=icon]:hidden",
                              isFavorite(link.href) ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover/link:opacity-40 hover:opacity-100"
                            )}
                            aria-label={isFavorite(link.href) ? "Remove from favourites" : "Add to favourites"}
                          >
                            <Star className={cn("w-3.5 h-3.5", isFavorite(link.href) && "fill-current")} />
                          </button>
                        )}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}
