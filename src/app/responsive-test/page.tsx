'use client';

// TEMPORARY diagnostic page — delete after mobile-responsiveness debugging.
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RowContextMenu } from '@/components/RowContextMenu';

const rows = [
  { id: 'INV-0042', customer: 'Acme Corporation LLC', date: '2026-07-08', amount: 'AED 1,250.00', status: 'Paid' },
  { id: 'INV-0043', customer: 'Beta Trading Co', date: '2026-07-09', amount: 'AED 900.00', status: 'Pending' },
  { id: 'INV-0044', customer: 'Gamma Industries International FZE', date: '2026-07-10', amount: 'AED 12,480.75', status: 'Overdue' },
];

export default function ResponsiveTest() {
  const [clicks, setClicks] = useState(0);
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold">Responsive test <span data-testid="clicks">clicks:{clicks}</span></h1>

      <Dialog>
        <DialogTrigger asChild>
          <Button data-testid="open-dialog">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add invoice</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Customer</Label><Input placeholder="Customer" /></div>
            <div className="space-y-2"><Label>Amount</Label><Input placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" /></div>
            <div className="space-y-2"><Label>Reference</Label><Input placeholder="Ref" /></div>
          </div>
          <DialogFooter>
            <Button data-testid="dialog-save" onClick={() => setClicks(c => c + 1)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><Button variant="ghost">Invoice</Button></TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <RowContextMenu key={r.id} items={[{ label: 'View', onClick: () => {} }]}>
              <TableCell className="font-medium">{r.id}</TableCell>
              <TableCell>{r.customer}</TableCell>
              <TableCell className="hidden sm:table-cell">{r.date}</TableCell>
              <TableCell>{r.amount}</TableCell>
              <TableCell><Badge variant={r.status === 'Paid' ? 'default' : 'destructive'}>{r.status}</Badge></TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid={`actions-${r.id}`}>⋮</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setClicks(c => c + 1)} data-testid="menu-view">View details</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </RowContextMenu>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
