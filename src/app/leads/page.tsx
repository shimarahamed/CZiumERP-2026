'use client'

import { usePageTitle } from '@/hooks/use-page-title';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { PageSkeleton } from '@/components/PageSkeleton';
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from '@/lib/money';
import { useAppContext } from '@/context/AppContext';
import type { Lead, LeadStatus, Customer } from '@/types';
import { MoreHorizontal, PlusCircle, Mail, Phone, Briefcase, DollarSign, ArrowUpDown, Sparkles, Loader2 } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enrichLead } from '@/ai/flows/enrich-lead-flow';
import { Separator } from '@/components/ui/separator';

const leadSchema = z.object({
  name: z.string().min(1, "Name is required."),
  company: z.string().optional(),
  email: z.string().email("Invalid email address."),
  phone: z.string().regex(/^[+\d][\d\s\-().]{6,19}$/, "Enter a valid phone number.").optional(),
  value: z.coerce.number().min(0, "Value must be non-negative.").optional(),
  source: z.string().optional(),
  assignedToId: z.string().min(1, "Please assign this lead to a user."),
});

type LeadFormData = z.infer<typeof leadSchema>;

type SortKey = 'name' | 'createdAt';

const statusColumns: { status: LeadStatus; title: string; color: string }[] = [
    { status: 'new', title: 'New', color: 'bg-blue-500' },
    { status: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
    { status: 'qualified', title: 'Qualified', color: 'bg-purple-500' },
    { status: 'proposal-won', title: 'Won', color: 'bg-green-500' },
    { status: 'proposal-lost', title: 'Lost', color: 'bg-red-500' },
];

const nextStatusMap: Partial<Record<LeadStatus, LeadStatus[]>> = {
    new: ['contacted', 'proposal-lost'],
    contacted: ['qualified', 'proposal-lost'],
    qualified: ['proposal-won', 'proposal-lost'],
};


export default function LeadsPage() {
  usePageTitle('Leads');
    const { leads, setLeads, users, addActivityLog, user, currencySymbol, customers, setCustomers, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);

    const form = useForm<LeadFormData>({
        resolver: zodResolver(leadSchema),
        defaultValues: { 
            name: '', 
            company: '',
            email: '', 
            phone: '',
            value: 0,
            source: '',
            assignedToId: user?.id || ''
        }
    });
    
    const salesTeam = useMemo(() => users.filter(u => u.role === 'admin' || u.role === 'manager'), [users]);

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const sortedLeads = useMemo(() => {
        let sorted = [...leads].sort((a, b) => {
            if (sortKey === 'createdAt') {
                return sortDirection === 'asc'
                    ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (a.name < b.name) return sortDirection === 'asc' ? -1 : 1;
            if (a.name > b.name) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        if (!searchTerm) return sorted;
        const lowercasedFilter = searchTerm.toLowerCase();
        return sorted.filter(lead =>
            lead.name.toLowerCase().includes(lowercasedFilter) ||
            lead.email.toLowerCase().includes(lowercasedFilter) ||
            (lead.company && lead.company.toLowerCase().includes(lowercasedFilter))
        );
    }, [leads, searchTerm, sortKey, sortDirection]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full"><Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage leads.</p></CardContent></Card></main>
            </div>
        );
    }
    
    const handleEnrichLead = async (leadId: string) => {
        const leadToEnrich = leads.find(l => l.id === leadId);
        if (!leadToEnrich || !leadToEnrich.company) {
            toast({ variant: 'destructive', title: 'Cannot Enrich Lead', description: 'Lead must have a company name to enrich.'});
            return;
        }

        setEnrichingLeadId(leadId);
        try {
            const enrichedData = await enrichLead({ name: leadToEnrich.name, company: leadToEnrich.company });
            setLeads(prevLeads => prevLeads.map(l => 
                l.id === leadId ? { ...l, enrichedData } : l
            ));
            toast({ title: 'Lead Enriched!', description: `Successfully found new data for ${leadToEnrich.company}.` });
        } catch (error) {
            console.error("Error enriching lead:", error);
            toast({ variant: 'destructive', title: 'Enrichment Failed', description: 'Could not fetch data for this lead.'});
        } finally {
            setEnrichingLeadId(null);
        }
    };


    const onSubmit = (data: LeadFormData) => {
        const assignedUser = users.find(u => u.id === data.assignedToId);
        if (!assignedUser) return;
        
        const newLead: Lead = {
            id: `lead-${Date.now()}`,
            avatar: `https://placehold.co/40x40`,
            status: 'new',
            createdAt: new Date().toISOString(),
            assignedToName: assignedUser.name,
            ...data,
        };
        setLeads(prev => [newLead, ...prev]);
        addActivityLog('Lead Added', `Added new lead: ${data.name}`);
        toast({ title: 'Lead Added' });
        
        // Automated enrichment in the background
        if (newLead.company) {
            (async () => {
                try {
                    const enrichedData = await enrichLead({ name: newLead.name, company: newLead.company! });
                    setLeads(prevLeads => prevLeads.map(l => 
                        l.id === newLead.id ? { ...l, enrichedData } : l
                    ));
                    toast({ title: 'Lead Enriched!', description: `AI found new data for ${newLead.company}.` });
                } catch (error) {
                    console.error("Auto-enrichment failed:", error);
                    // Silently fail or show a less intrusive notification
                }
            })();
        }
        
        setIsFormOpen(false);
        form.reset({ 
            name: '', 
            company: '',
            email: '', 
            phone: '',
            value: 0,
            source: '',
            assignedToId: user?.id || ''
        });
    };

    const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        
        addActivityLog('Lead Status Updated', `${lead.name}'s status changed to ${newStatus}`);
        toast({ title: 'Status Updated' });
        
        if (newStatus === 'proposal-won') {
            const existingCustomer = customers.find(c => c.email === lead.email);
            if (existingCustomer) {
                toast({ title: "Customer Already Exists", description: `${lead.name} already exists as a customer.`});
                return;
            }

            const newCustomer: Customer = {
                id: `cust-${Date.now()}`,
                name: lead.name,
                company: lead.company,
                email: lead.email,
                phone: lead.phone || '',
                avatar: lead.avatar,
                loyaltyPoints: 0,
                tier: 'Bronze',
                enrichedData: lead.enrichedData,
            };
            setCustomers(prev => [newCustomer, ...prev]);
            addActivityLog('Customer Created', `Created customer from lead: ${lead.name}`);
            toast({ title: "Customer Created!", description: `${lead.name} has been added to your customers list.`});
        }
    };

    if (!isDataLoaded) return <PageSkeleton cardCount={5} hasFilters />;

    return (
        <div className="flex flex-col h-full">
            <Header title="Sales Leads Pipeline" />
            <main className="flex-1 flex flex-col p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Input
                            placeholder="Search leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                        />
                         <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                            <SelectTrigger className="w-full sm:w-auto">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="createdAt">Creation Date</SelectItem>
                                <SelectItem value="name">Lead Name</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" className="gap-1" onClick={() => setIsFormOpen(true)}>
                            <PlusCircle className="h-4 w-4" /> Add Lead
                        </Button>
                    </div>
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 overflow-x-auto">
                    {statusColumns.map(column => (
                        <div key={column.status} className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 px-2">
                                <span className={cn("h-2 w-2 rounded-full", column.color)} />
                                <h2 className="font-semibold text-lg">{column.title}</h2>
                                <span className="text-sm text-muted-foreground">({sortedLeads.filter(c => c.status === column.status).length})</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-4 bg-muted/50 p-4 rounded-lg min-h-[200px]">
                                {sortedLeads.filter(c => c.status === column.status).map(lead => (
                                    <Card key={lead.id}>
                                        <CardHeader className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                     <Avatar>
                                                        <AvatarImage src={lead.avatar} alt={lead.name} data-ai-hint="person user"/>
                                                        <AvatarFallback>{lead.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <CardTitle className="text-base truncate">{lead.name}</CardTitle>
                                                        <CardDescription className="text-xs truncate">{lead.company || 'No company'}</CardDescription>
                                                    </div>
                                                </div>
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onSelect={() => handleEnrichLead(lead.id)} disabled={!lead.company || enrichingLeadId === lead.id}>
                                                            {enrichingLeadId === lead.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                                            Enrich with AI
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                        {nextStatusMap[lead.status]?.map(nextStatus => (
                                                             <DropdownMenuItem key={nextStatus} onClick={() => handleStatusChange(lead.id, nextStatus)}>
                                                                Move to {nextStatus.replace('-', ' ')}
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {lead.status !== 'proposal-lost' && <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(lead.id, 'proposal-lost')}>Mark as Lost</DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-2 text-sm">
                                            {lead.value != null && lead.value > 0 && <p className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /> {currencySymbol}{formatNumber(lead.value)}</p>}
                                            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {lead.email}</p>
                                            {lead.enrichedData && (
                                                <>
                                                    <Separator className="my-2"/>
                                                    <div className="space-y-1">
                                                        <p className="font-semibold text-xs text-primary">AI Enriched Data</p>
                                                        <p className="text-xs text-muted-foreground"><strong>Industry:</strong> {lead.enrichedData.industry}</p>
                                                        {lead.enrichedData.companySize && <p className="text-xs text-muted-foreground"><strong>Size:</strong> ~{lead.enrichedData.companySize} employees</p>}
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="company" render={({ field }) => (
                                <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="value" render={({ field }) => (
                                    <FormItem><FormLabel>Potential Value ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                             <FormField control={form.control} name="source" render={({ field }) => (
                                <FormItem><FormLabel>Source</FormLabel><FormControl><Input placeholder="e.g. Website, Referral" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="assignedToId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assigned To</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a team member" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {salesTeam.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit">Add Lead</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}


