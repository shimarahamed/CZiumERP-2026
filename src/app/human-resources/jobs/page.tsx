
'use client'

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { JobRequisition, JobStatus } from '@/types';
import { MoreHorizontal, PlusCircle } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const requisitionSchema = z.object({
  title: z.string().min(1, "Job title is required."),
  department: z.string().min(1, "Department is required."),
  status: z.enum(['open', 'on-hold', 'closed']),
  description: z.string().optional(),
  requirements: z.string().optional(),
});

type RequisitionFormData = z.infer<typeof requisitionSchema>;

const statusVariant: { [key in JobStatus]: 'default' | 'secondary' | 'destructive' } = {
    open: 'default',
    'on-hold': 'secondary',
    closed: 'destructive',
};

export default function JobRequisitionsPage() {
    const { jobRequisitions, setJobRequisitions, addActivityLog, user, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [reqToEdit, setReqToEdit] = useState<JobRequisition | null>(null);
    const [reqToDelete, setReqToDelete] = useState<JobRequisition | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<RequisitionFormData>({
        resolver: zodResolver(requisitionSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const filteredRequisitions = useMemo(() => {
        if (!searchTerm) return jobRequisitions;
        const lowercasedFilter = searchTerm.toLowerCase();
        return jobRequisitions.filter(req =>
            req.title.toLowerCase().includes(lowercasedFilter) ||
            req.department.toLowerCase().includes(lowercasedFilter)
        );
    }, [jobRequisitions, searchTerm]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full"><Header title="Access Denied" />
                <main className="flex-1 p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage job requisitions.</p></CardContent></Card></main>
            </div>
        );
    }

    const handleOpenForm = (requisition: JobRequisition | null = null) => {
        setReqToEdit(requisition);
        form.reset(requisition || { title: '', department: '', status: 'open', description: '', requirements: '' });
        setIsFormOpen(true);
    };

    const onSubmit = (data: RequisitionFormData) => {
        if (reqToEdit) {
            setJobRequisitions(prev => prev.map(r => r.id === reqToEdit.id ? { ...r, ...data } : r));
            toast({ title: "Job Requisition Updated" });
            addActivityLog('Requisition Updated', `Updated job requisition: ${data.title}`);
        } else {
            const newRequisition: JobRequisition = {
                id: `job-${Date.now()}`,
                createdAt: new Date().toISOString(),
                ...data,
            };
            setJobRequisitions(prev => [newRequisition, ...prev]);
            toast({ title: "Job Requisition Created" });
            addActivityLog('Requisition Created', `Created job requisition: ${data.title}`);
        }
        setIsFormOpen(false);
    };

    const handleDelete = () => {
        if (!reqToDelete) return;
        addActivityLog('Requisition Deleted', `Deleted requisition: ${reqToDelete.title}`);
        setJobRequisitions(jobRequisitions.filter(r => r.id !== reqToDelete.id));
        toast({ title: "Requisition Deleted" });
        setReqToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Job Requisitions" />
            <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources' }, { label: 'Job Requisitions' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by title or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" /> New Requisition
                    </Button>
                </div>
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Job Title</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date Created</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={4} />
                            ) : (
                            <TableBody>
                                {filteredRequisitions.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.title}</TableCell>
                                        <TableCell>{req.department}</TableCell>
                                        <TableCell><Badge variant={statusVariant[req.status]} className="capitalize">{req.status.replace('-', ' ')}</Badge></TableCell>
                                        <TableCell>{format(new Date(req.createdAt), 'PPP')}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenForm(req)}>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setReqToDelete(req)}>Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{reqToEdit ? 'Edit Requisition' : 'New Job Requisition'}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="department" render={({ field }) => (
                                    <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Job Description</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="requirements" render={({ field }) => (
                                <FormItem><FormLabel>Requirements</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="on-hold">On Hold</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit">{reqToEdit ? 'Save Changes' : 'Create Requisition'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!reqToDelete} onOpenChange={(open) => !open && setReqToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the requisition for &quot;{reqToDelete?.title}&quot;.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    

