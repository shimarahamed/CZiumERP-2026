
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAppContext } from '@/context/AppContext';
import {
  LayoutDashboard, FileText, Users, Package, BarChart3, Settings,
  CreditCard, Undo2, Building2, ShoppingCart, History, Lightbulb,
  LifeBuoy, Briefcase, Truck, Landmark, UserCog, ClipboardCheck,
} from '@/components/icons';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, group: 'Pages' },
  { label: 'Invoices', href: '/invoices', icon: FileText, group: 'Pages' },
  { label: 'Payments', href: '/payments', icon: CreditCard, group: 'Pages' },
  { label: 'Returns', href: '/returns', icon: Undo2, group: 'Pages' },
  { label: 'Customers', href: '/customers', icon: Users, group: 'Pages' },
  { label: 'AI Upselling', href: '/upselling', icon: Lightbulb, group: 'Pages' },
  { label: 'Inventory', href: '/inventory', icon: Package, group: 'Pages' },
  { label: 'Vendors', href: '/vendors', icon: Building2, group: 'Pages' },
  { label: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart, group: 'Pages' },
  { label: 'Reports', href: '/reports', icon: BarChart3, group: 'Pages' },
  { label: 'Projects', href: '/projects', icon: Briefcase, group: 'Pages' },
  { label: 'Support Tickets', href: '/support/tickets', icon: LifeBuoy, group: 'Pages' },
  { label: 'Employees', href: '/human-resources/employees', icon: UserCog, group: 'HR' },
  { label: 'Leave Requests', href: '/human-resources/leave-requests', icon: UserCog, group: 'HR' },
  { label: 'Payroll', href: '/human-resources/payroll', icon: UserCog, group: 'HR' },
  { label: 'General Ledger', href: '/accounting/general-ledger', icon: Landmark, group: 'Finance' },
  { label: 'Accounts Payable', href: '/accounting/payables', icon: Landmark, group: 'Finance' },
  { label: 'Accounts Receivable', href: '/accounting/receivables', icon: Landmark, group: 'Finance' },
  { label: 'Bill of Materials', href: '/manufacturing/bom', icon: ClipboardCheck, group: 'Manufacturing' },
  { label: 'Production Orders', href: '/manufacturing/production', icon: ClipboardCheck, group: 'Manufacturing' },
  { label: 'Shipment Tracking', href: '/shipping/shipments', icon: Truck, group: 'Logistics' },
  { label: 'Route Planning', href: '/shipping/routes', icon: Truck, group: 'Logistics' },
  { label: 'Activity Logs', href: '/activity', icon: History, group: 'System' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'System' },
  { label: 'User Accounts', href: '/users', icon: Users, group: 'System' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { customers, invoices, products } = useAppContext();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback((href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  }, [router]);

  const groups = Array.from(new Set(NAV_ITEMS.map(i => i.group)));

  const filteredItems = query
    ? NAV_ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  // Quick search results for records
  const lowerQ = query.toLowerCase();
  const matchedCustomers = query.length > 1
    ? customers.filter(c => c.name.toLowerCase().includes(lowerQ)).slice(0, 4)
    : [];
  const matchedInvoices = query.length > 1
    ? invoices.filter(i => i.id?.toLowerCase().includes(lowerQ) || i.customerName?.toLowerCase().includes(lowerQ)).slice(0, 4)
    : [];
  const matchedProducts = query.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(lowerQ)).slice(0, 4)
    : [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, customers, invoices…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {matchedCustomers.length > 0 && (
          <CommandGroup heading="Customers">
            {matchedCustomers.map(c => (
              <CommandItem key={c.id} onSelect={() => runCommand('/customers')}>
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                {c.name}
                <span className="ml-auto text-xs text-muted-foreground">{c.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedInvoices.length > 0 && (
          <CommandGroup heading="Invoices">
            {matchedInvoices.map(i => (
              <CommandItem key={i.id} onSelect={() => runCommand('/invoices')}>
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                {i.id}
                <span className="ml-auto text-xs text-muted-foreground">{i.customerName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedProducts.length > 0 && (
          <CommandGroup heading="Products">
            {matchedProducts.map(p => (
              <CommandItem key={p.id} onSelect={() => runCommand('/inventory')}>
                <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                {p.name}
                <span className="ml-auto text-xs text-muted-foreground">Stock: {p.stock}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(matchedCustomers.length > 0 || matchedInvoices.length > 0 || matchedProducts.length > 0) && (
          <CommandSeparator />
        )}

        {groups.map(group => {
          const items = filteredItems.filter(i => i.group === group);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {items.map(item => (
                <CommandItem key={item.href} onSelect={() => runCommand(item.href)}>
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
