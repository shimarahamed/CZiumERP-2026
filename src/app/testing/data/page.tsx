
'use client';

import { useState } from 'react';
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { Loader2, Trash2, Database } from '@/components/icons';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// This list should be maintained and include all collections in your app
const allCollections = [
    'invoices', 'customers', 'products', 'vendors', 'purchaseOrders', 'vendorBills',
    'rfqs', 'assets', 'itAssets', 'users', 'employees', 'stores',
    'activityLogs', 'attendance', 'leaveRequests', 'ledgerEntries',
    'taxRates', 'budgets', 'candidates', 'performanceReviews',
    'billsOfMaterials', 'productionOrders', 'qualityChecks', 'leads',
    'campaigns', 'projects', 'tasks', 'tickets', 'jobRequisitions',
    'shipments', 'notifications', 'presence', 'scheduledReports',
    'tenants', 'approvalWorkflows', 'recurringInvoices',
];

export default function MockDataPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [useMockData, setUseMockData] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('useMockData') === 'true';
        }
        return true;
    });

    const handleToggleMockData = (checked: boolean) => {
        setUseMockData(checked);
        if (typeof window !== 'undefined') {
            localStorage.setItem('useMockData', String(checked));
            toast({
                title: "Settings Changed",
                description: `Mock data is now ${checked ? 'ON' : 'OFF'}. Please reload the application to apply changes.`,
            });
        }
    };

    const clearAllData = async () => {
        setIsLoading(true);
        toast({ title: 'Starting data cleanup...', description: 'This may take a moment.' });
        try {
            const batch = writeBatch(db);
            for (const collectionName of allCollections) {
                const querySnapshot = await getDocs(collection(db, collectionName));
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
            }
            await batch.commit();
            toast({ title: 'Success!', description: 'All collections have been cleared. The app is now in a production-ready state. Refresh to see changes.' });
        } catch (error) {
            console.error("Error clearing data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear all data.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Data Management" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mock Data Control</CardTitle>
                            <CardDescription>
                                Toggle to control whether the application uses initial seed data.
                                When OFF, the application will start with an empty database, ready for production.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="flex items-center space-x-2">
                                <Switch id="mock-data-toggle" checked={useMockData} onCheckedChange={handleToggleMockData}/>
                                <Label htmlFor="mock-data-toggle">Use Mock Data on Startup</Label>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                You must reload the application (Ctrl/Cmd + R) for this setting to take full effect.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Reset Application Data</CardTitle>
                            <CardDescription>
                                This will permanently delete all data from all collections, allowing the mock data to be re-seeded if enabled. This is useful for testing or starting fresh.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                     <Button variant="destructive" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                                        Clear All Live Data
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete ALL data across the entire application, including users, invoices, products, and all other records.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={clearAllData} className="bg-destructive hover:bg-destructive/90">
                                            Yes, Delete Everything
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
