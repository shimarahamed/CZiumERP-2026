
'use client'

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireRole, useRequirePermission } from '@/hooks/use-require-role';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import type { Employee, EmailLog } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, PlusCircle } from '@/components/icons';
import { TableSkeleton } from '@/components/TableSkeleton';
import { buildOnboardingEmail, isSmtpConfigured, sendHrEmail } from '@/lib/hr-email';
import { EMPLOYMENT_TYPES, EMPLOYMENT_STATUSES, statusBadgeVariant, nextEmployeeCode } from '@/lib/hr';
import { useColumnVisibility, type ColumnDef } from '@/hooks/use-column-visibility';
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu';

const EMPLOYEES_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Employee', locked: true },
  { id: 'employeeCode', label: 'Employee ID' },
  { id: 'jobTitle', label: 'Job Title' },
  { id: 'department', label: 'Department' },
  { id: 'startDate', label: 'Start Date' },
  { id: 'status', label: 'Status' },
];

const employeeSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Invalid email address."),
  personalEmail: z.string().email("Invalid email address.").or(z.literal('')).optional(),
  jobTitle: z.string().min(1, "Job title is required."),
  department: z.string().min(1, "Department is required."),
  employmentType: z.enum(['Full-time', 'Part-time', 'Intern', 'Contractor']),
  employmentStatus: z.enum(['Onboarding', 'Active', 'On Leave', 'Resigned', 'Terminated']),
  dateOfJoining: z.date({ required_error: "Date of joining is required." }),
  salary: z.coerce.number().min(0, "Salary must be non-negative"),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

function EmployeesPageInner() {
    const { employees, setEmployees, addActivityLog, user: currentUser, currencySymbol, currentStore, isDataLoaded, smtpConfigList, emailTemplates, setEmailLogs, companyName } = useAppContext();
    const { toast } = useToast();
    const router = useRouter();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const form = useForm<EmployeeFormData>({
        resolver: zodResolver(employeeSchema),
    });

    const canManage = useRequirePermission('Human Resources', 'edit');
    const smtpSettings = smtpConfigList.find(s => s.id === 'default');
    const columnVisibility = useColumnVisibility('employees', EMPLOYEES_COLUMNS);
    const { isVisible } = columnVisibility;

    const filteredEmployees = useMemo(() => {
        let result = employees.filter(employee =>
            currentStore?.id === 'all' || !employee.storeId || employee.storeId === currentStore?.id
        );
        if (statusFilter !== 'all') {
            result = result.filter(employee => (employee.employmentStatus ?? 'Active') === statusFilter);
        }
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            result = result.filter(employee =>
                employee.name.toLowerCase().includes(lowercasedFilter) ||
                employee.email.toLowerCase().includes(lowercasedFilter) ||
                (employee.employeeCode && employee.employeeCode.toLowerCase().includes(lowercasedFilter)) ||
                (employee.jobTitle && employee.jobTitle.toLowerCase().includes(lowercasedFilter)) ||
                (employee.department && employee.department.toLowerCase().includes(lowercasedFilter))
            );
        }
        return result;
    }, [employees, searchTerm, statusFilter, currentStore]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Permission Required</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>You do not have permission to view or manage employees. Please contact an administrator.</p>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    const handleOpenForm = (employee: Employee | null = null) => {
        setEmployeeToEdit(employee);
        if (employee) {
            form.reset({
                name: employee.name,
                email: employee.email,
                personalEmail: employee.personalEmail ?? '',
                jobTitle: employee.jobTitle ?? '',
                department: employee.department ?? '',
                employmentType: employee.employmentType ?? 'Full-time',
                employmentStatus: employee.employmentStatus ?? 'Active',
                dateOfJoining: parseISO(employee.dateOfJoining),
                salary: employee.salary,
            });
        } else {
            form.reset({
                name: '',
                email: '',
                personalEmail: '',
                jobTitle: '',
                department: '',
                employmentType: 'Full-time',
                employmentStatus: 'Onboarding',
                dateOfJoining: new Date(),
                salary: 0,
            });
        }
        setIsFormOpen(true);
    };

    const sendOnboardingEmail = async (employee: Employee) => {
        const onboardingTemplate = emailTemplates.find(t => t.id === 'onboarding');
        if (!isSmtpConfigured(smtpSettings) || !onboardingTemplate?.enabled) return;
        const to = employee.personalEmail || employee.email;
        const built = buildOnboardingEmail(employee, companyName);
        const logBase: Omit<EmailLog, 'status' | 'error'> = {
            id: `mail-${Date.now()}`,
            department: 'Human Resources',
            templateId: 'onboarding',
            to,
            subject: built.subject,
            sentAt: new Date().toISOString(),
            sentBy: currentUser?.name ?? 'Unknown',
        };
        try {
            await sendHrEmail(smtpSettings, { to, ...built });
            setEmailLogs(prev => [{ ...logBase, status: 'sent' }, ...prev]);
            setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, onboardingEmailSentAt: new Date().toISOString() } : e));
            addActivityLog('Onboarding Email Sent', `Onboarding email sent to ${employee.name} (${to}).`);
            toast({ title: "Onboarding Email Sent", description: `Welcome email sent to ${to}.` });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error.';
            setEmailLogs(prev => [{ ...logBase, status: 'failed', error: message }, ...prev]);
            toast({ variant: 'destructive', title: "Onboarding Email Failed", description: message });
        }
    };

    const onSubmit = (data: EmployeeFormData) => {
        const employeeData = {
          ...data,
          personalEmail: data.personalEmail || undefined,
          dateOfJoining: format(data.dateOfJoining, 'yyyy-MM-dd'),
        };

        if (employeeToEdit) {
            const updatedEmployees = employees.map(e => e.id === employeeToEdit.id ? { ...e, ...employeeData } : e);
            setEmployees(updatedEmployees);
            toast({ title: "Employee Updated", description: `${data.name}'s details have been updated.` });
            addActivityLog('Employee Updated', `Updated employee record: ${data.name} (ID: ${employeeToEdit.id})`);
        } else {
            const newEmployee: Employee = {
                id: `emp-${Date.now()}`,
                avatar: '',
                storeId: currentStore?.id,
                employeeCode: nextEmployeeCode(employees),
                ...employeeData,
            };
            setEmployees([newEmployee, ...employees]);
            toast({ title: "Employee Added", description: `${data.name} has been added.` });
            addActivityLog('Employee Added', `Added new employee record: ${data.name}`);
            void sendOnboardingEmail(newEmployee);
        }
        setIsFormOpen(false);
        setEmployeeToEdit(null);
    };

    const handleDelete = () => {
        if (!employeeToDelete) return;
        addActivityLog('Employee Deleted', `Deleted employee record: ${employeeToDelete.name} (ID: ${employeeToDelete.id})`);
        setEmployees(employees.filter(e => e.id !== employeeToDelete.id));
        toast({ title: "Employee Deleted", description: `${employeeToDelete.name}'s record has been deleted.` });
        setEmployeeToDelete(null);
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Employee Management" />
            <Breadcrumb items={[{ label: 'Human Resources', href: '/human-resources/employees' }, { label: 'Employees' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <CardTitle>Employees</CardTitle>
                                <CardDescription>Manage all employee information for your organization.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px] bg-secondary">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        {EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Search employees..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-auto md:min-w-[220px] bg-secondary"
                                />
                                <ColumnVisibilityMenu visibility={columnVisibility} />
                                <Button size="sm" className="gap-1 w-full sm:w-auto" onClick={() => handleOpenForm()}>
                                    <PlusCircle className="h-4 w-4" />
                                    Add Employee
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    {isVisible('employeeCode') && <TableHead className="hidden lg:table-cell">Employee ID</TableHead>}
                                    {isVisible('jobTitle') && <TableHead>Job Title</TableHead>}
                                    {isVisible('department') && <TableHead className="hidden md:table-cell">Department</TableHead>}
                                    {isVisible('startDate') && <TableHead className="hidden md:table-cell">Start Date</TableHead>}
                                    {isVisible('status') && <TableHead>Status</TableHead>}
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            {!isDataLoaded ? (
                              <TableSkeleton rows={8} cols={7} />
                            ) : (
                            <TableBody>
                                {filteredEmployees.length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No employees found.</TableCell></TableRow>
                                )}
                                {filteredEmployees.map(employee => (
                                    <TableRow key={employee.id} className="cursor-pointer" onClick={() => router.push(`/human-resources/employees/${employee.id}`)}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={employee.avatar} alt={employee.name} data-ai-hint="person user" />
                                                    <AvatarFallback>{employee.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                   <span className="truncate">{employee.name}</span>
                                                   <span className="text-sm text-muted-foreground truncate">{employee.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {isVisible('employeeCode') && <TableCell className="hidden lg:table-cell text-muted-foreground">{employee.employeeCode ?? '—'}</TableCell>}
                                        {isVisible('jobTitle') && <TableCell>{employee.jobTitle}</TableCell>}
                                        {isVisible('department') && <TableCell className="hidden md:table-cell">{employee.department}</TableCell>}
                                        {isVisible('startDate') && <TableCell className="hidden md:table-cell">{format(parseISO(employee.dateOfJoining), 'MMM d, yyyy')}</TableCell>}
                                        {isVisible('status') && (
                                        <TableCell>
                                            <Badge variant={statusBadgeVariant(employee.employmentStatus)}>{employee.employmentStatus ?? 'Active'}</Badge>
                                        </TableCell>
                                        )}
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => router.push(`/human-resources/employees/${employee.id}`)}>View Profile</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleOpenForm(employee)}>Quick Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setEmployeeToDelete(employee)}>Delete</DropdownMenuItem>
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
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{employeeToEdit ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                        <DialogDescription>
                            {employeeToEdit ? "Update the employee's HR information." : 'Fill in the details to add a new employee. The full profile (identity, banking, assets, IT accounts, documents…) can be completed from the employee page afterwards.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                             <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Full Legal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>Company Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="personalEmail" render={({ field }) => (
                                    <FormItem><FormLabel>Personal Email (for onboarding email)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="jobTitle" render={({ field }) => (
                                    <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} placeholder="e.g. Store Manager" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="department" render={({ field }) => (
                                    <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} placeholder="e.g. Sales" /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="employmentType" render={({ field }) => (
                                    <FormItem><FormLabel>Employment Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="employmentStatus" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{EMPLOYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                                    <FormItem className="flex flex-col pt-2"><FormLabel>Start Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="salary" render={({ field }) => (
                                    <FormItem><FormLabel>Salary ({currencySymbol})</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                             </div>

                            <DialogFooter>
                                <Button type="submit">{employeeToEdit ? 'Save Changes' : 'Add Employee'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the employee record.</AlertDialogDescription>
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




// Permission guard lives in a wrapper so all hooks inside EmployeesPageInner
// run unconditionally (React rules-of-hooks).
export default function EmployeesPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <EmployeesPageInner />;
}
