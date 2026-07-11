
'use client';
import { useRequireRole } from '@/hooks/use-require-role';
import { PageSkeleton } from '@/components/PageSkeleton';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Header from "@/components/Header";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from '@/context/AppContext';
import { formatNumber } from '@/lib/money';
import type { Budget } from '@/types';
import { Progress } from '@/components/ui/progress';
import { MoreHorizontal, PlusCircle } from '@/components/icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required."),
  period: z.enum(['Monthly', 'Quarterly', 'Yearly']),
  budgetedAmount: z.coerce.number().min(1, "Budget must be greater than 0."),
  actualAmount: z.coerce.number().min(0, "Actual amount cannot be negative."),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

function BudgetingPageInner() {
    const { budgets, setBudgets, addActivityLog, user, currencySymbol, isDataLoaded } = useAppContext();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [budgetToEdit, setBudgetToEdit] = useState<Budget | null>(null);
    const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<BudgetFormData>({
        resolver: zodResolver(budgetSchema),
    });

    const canManage = user?.role === 'admin' || user?.role === 'manager';

    const filteredBudgets = useMemo(() => {
        if (!searchTerm) return budgets;
        const lowercasedFilter = searchTerm.toLowerCase();
        return budgets.filter(budget =>
            budget.category.toLowerCase().includes(lowercasedFilter)
        );
    }, [budgets, searchTerm]);

    if (!canManage) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Access Denied" />
                <main className="flex-1 p-4 md:p-6"><Card><CardHeader><CardTitle>Permission Required</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage budgets.</p></CardContent></Card></main>
            </div>
        );
    }

    const handleOpenForm = (budget: Budget | null = null) => {
        setBudgetToEdit(budget);
        form.reset(budget || { category: '', period: 'Monthly', budgetedAmount: 0, actualAmount: 0 });
        setIsFormOpen(true);
    };

    const processSubmit = (data: BudgetFormData) => {
        if (budgetToEdit) {
            setBudgets(budgets.map(b => b.id === budgetToEdit.id ? { ...b, ...data } : b));
            toast({ title: "Budget Updated" });
            addActivityLog('Budget Updated', `Updated budget for ${data.category}`);
        } else {
            const newBudget: Budget = { id: `bud-${Date.now()}`, ...data };
            setBudgets([newBudget, ...budgets]);
            toast({ title: "Budget Added" });
            addActivityLog('Budget Added', `Added new budget for ${data.category}`);
        }
        setIsFormOpen(false);
    };

    const handleDelete = () => {
        if (!budgetToDelete) return;
        addActivityLog('Budget Deleted', `Deleted budget for ${budgetToDelete.category}`);
        setBudgets(budgets.filter(b => b.id !== budgetToDelete.id));
        toast({ title: "Budget Deleted" });
        setBudgetToDelete(null);
    };

    if (!isDataLoaded) return <PageSkeleton cardCount={4} hasFilters={false} />;

    return (
        <div className="flex flex-col h-full">
            <Header title="Budgeting & Reporting" />
            <Breadcrumb items={[{ label: 'Finance', href: '/accounting/budgeting' }, { label: 'Budgeting' }]} />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-end md:items-center gap-4 mb-4">
                    <Input
                        placeholder="Search by category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-auto md:min-w-[250px] bg-secondary"
                    />
                    <Button size="sm" className="gap-1" onClick={() => handleOpenForm()}>
                        <PlusCircle className="h-4 w-4" /> New Budget
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredBudgets.map(budget => {
                        const percentage = budget.budgetedAmount > 0 ? (budget.actualAmount / budget.budgetedAmount) * 100 : 0;
                        return (
                            <Card key={budget.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{budget.category}</CardTitle>
                                            <CardDescription>{budget.period} Period</CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenForm(budget)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => setBudgetToDelete(budget)}>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Actual Spent</span>
                                            <span>{currencySymbol} {formatNumber(budget.actualAmount)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-muted-foreground">Budgeted</span>
                                            <span>{currencySymbol} {formatNumber(budget.budgetedAmount)}</span>
                                        </div>
                                        <Progress value={percentage} className={cn(percentage > 100 && "[&>div]:bg-destructive")} />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <p className={cn("text-xs", percentage > 100 ? "text-destructive" : "text-muted-foreground")}>
                                        {formatNumber(percentage, 1, 1)}% of budget used.
                                        {percentage > 100 && ` ${currencySymbol} ${formatNumber(budget.actualAmount - budget.budgetedAmount)} over budget.`}
                                    </p>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            </main>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{budgetToEdit ? 'Edit Budget' : 'Add New Budget'}</DialogTitle></DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(processSubmit)} className="space-y-4 py-4">
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="period" render={({ field }) => (
                                <FormItem><FormLabel>Period</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Quarterly">Quarterly</SelectItem><SelectItem value="Yearly">Yearly</SelectItem></SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )}/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="budgetedAmount" render={({ field }) => (
                                    <FormItem><FormLabel>Budgeted Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="actualAmount" render={({ field }) => (
                                    <FormItem><FormLabel>Actual Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <DialogFooter>
                                <Button type="submit">{budgetToEdit ? 'Save Changes' : 'Add Budget'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!budgetToDelete} onOpenChange={(open) => !open && setBudgetToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the budget for {budgetToDelete?.category}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

    

    



// Permission guard lives in a wrapper so all hooks inside BudgetingPageInner
// run unconditionally (React rules-of-hooks).
export default function BudgetingPage() {
  const isAllowed = useRequireRole(['admin', 'manager']);
  if (!isAllowed) return null;
  return <BudgetingPageInner />;
}
