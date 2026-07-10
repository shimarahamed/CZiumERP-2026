
'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import { Download, DollarSign, FileText, Users, ShoppingBag, BarChart3, Package, TrendingUp, Sparkles, Loader2 } from "@/components/icons";
import { EmptyState } from '@/components/EmptyState';
import { useAppContext } from '@/context/AppContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns/subDays';
import { isWithinInterval } from 'date-fns/isWithinInterval';
import { parseISO } from 'date-fns/parseISO';
import { format } from 'date-fns/format';
import type { Invoice, Product } from '@/types';
import { getSalesForecast } from '@/ai/flows/sales-forecast';
import type { SalesForecastOutput } from '@/ai/flows/sales-forecast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/PageSkeleton';


const ReportKPI = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card className="bg-slate-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const PrintableReport = React.forwardRef<HTMLDivElement, { children: React.ReactNode, title: string, description: string, date?: DateRange }>(({ children, title, description, date }, ref) => (
    <div ref={ref} className="printable-report-area hidden print:block bg-white text-black p-8">
        <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
            {date?.from && <p className="text-sm text-muted-foreground">{format(date.from, 'PPP')} - {date.to ? format(date.to, 'PPP') : 'Today'}</p>}
        </div>
        {children}
    </div>
));
PrintableReport.displayName = "PrintableReport";


export default function ReportsPage() {
    const { invoices, products, currentStore, currencySymbol, companyName, user, isDataLoaded } = useAppContext();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
    const [forecast, setForecast] = useState<SalesForecastOutput | null>(null);
    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'sales');

    // Sync tab to URL
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Update document title
    useEffect(() => {
        document.title = `Reports — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;
        return () => { document.title = 'CZium ERP'; };
    }, [activeTab]);

    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 89),
        to: new Date(),
    });

    const reportRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        setIsPrintDialogOpen(true);
        setTimeout(() => {
          const printWindow = window.open('', '_blank');
          if (printWindow && reportRef.current) {
            const printableContent = reportRef.current.innerHTML;
            const styles = Array.from(document.styleSheets)
              .map(s => {
                  try {
                      return Array.from(s.cssRules).map(r => r.cssText).join('\n');
                  } catch(e) {
                      return '';
                  }
              }).join('\n');

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Report</title>
                        <style>${styles}</style>
                    </head>
                    <body>
                        ${printableContent}
                    </body>
                </html>
            `);

            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { 
                printWindow.print();
                printWindow.close();
             }, 250);
          }
           setIsPrintDialogOpen(false);
        }, 500);
    };

    // Base filtered data
    const filteredInvoices = useMemo(() => {
        const baseInvoices = (currentStore?.id === 'all' ? invoices : invoices.filter(inv => inv.storeId === currentStore?.id))
            .filter(inv => inv.status === 'paid');

        if (date?.from) {
            const endDate = date.to || new Date();
            return baseInvoices.filter(inv => 
                isWithinInterval(parseISO(inv.date), { start: date.from!, end: endDate })
            );
        }
        return baseInvoices;
    }, [invoices, currentStore, date]);

    // Sales Report Data
    const salesReportData = useMemo(() => {
        const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        const userSales: { [key: string]: { name: string; invoices: number; revenue: number } } = {};

        filteredInvoices.forEach(inv => {
            if (inv.userId) {
                if (!userSales[inv.userId]) {
                    userSales[inv.userId] = { name: inv.userName || 'Unknown', invoices: 0, revenue: 0 };
                }
                userSales[inv.userId].invoices += 1;
                userSales[inv.userId].revenue += inv.amount;
            }
            inv.items.forEach(item => {
                if (!productSales[item.productId]) {
                    productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
                }
                productSales[item.productId].quantity += item.quantity;
                productSales[item.productId].revenue += item.price * item.quantity;
            });
        });

        return {
            totalRevenue: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0),
            totalInvoices: filteredInvoices.length,
            totalItemsSold: filteredInvoices.reduce((sum, inv) => sum + inv.items.reduce((iSum, i) => iSum + i.quantity, 0), 0),
            uniqueCustomers: new Set(filteredInvoices.map(inv => inv.customerId).filter(Boolean)).size,
            productSales: Object.entries(productSales).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue),
            userSales: Object.entries(userSales).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue),
        };
    }, [filteredInvoices]);

    // Inventory Report Data
    const inventoryReportData = useMemo(() => {
        const lowStockItems = products.filter(p => p.reorderThreshold && p.stock <= p.reorderThreshold);
        return {
            totalItems: products.length,
            totalStockValue: products.reduce((sum, p) => sum + p.cost * p.stock, 0),
            lowStockItems,
            allItems: products,
        }
    }, [products]);

    // Financial Report Data
    const financialReportData = useMemo(() => {
        const totalRevenue = salesReportData.totalRevenue;
        const costOfGoodsSold = filteredInvoices.reduce((sum, inv) => 
            sum + inv.items.reduce((iSum, i) => iSum + (i.cost * i.quantity), 0), 0);
        const grossProfit = totalRevenue - costOfGoodsSold;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        
        return {
            totalRevenue,
            costOfGoodsSold,
            grossProfit,
            profitMargin,
        };
    }, [salesReportData, filteredInvoices]);

    // Loading guard sits AFTER all hooks so hook order never changes between
    // renders (React rules-of-hooks) — previously this crashed on hydration.
    if (!isDataLoaded) return <PageSkeleton hasFilters rows={6} cols={5} />;

    const handleGenerateForecast = async () => {
        setIsGeneratingForecast(true);
        setForecast(null);
        try {
            const monthlySales = filteredInvoices.reduce((acc, inv) => {
                const month = format(parseISO(inv.date), 'yyyy-MM');
                acc[month] = (acc[month] || 0) + inv.amount;
                return acc;
            }, {} as Record<string, number>);

            const salesDataForAI = Object.entries(monthlySales)
                .map(([month, revenue]) => ({ month, revenue }))
                .sort((a, b) => a.month.localeCompare(b.month));
            
            if (salesDataForAI.length < 2) {
                setForecast({ forecast: "Not enough historical data to generate a forecast.", trendAnalysis: "At least two months of sales data are needed for trend analysis."});
                return;
            }

            const result = await getSalesForecast({ salesData: salesDataForAI });
            setForecast(result);

        } catch {
            setForecast({ forecast: "An error occurred while generating the forecast.", trendAnalysis: "Please try again later." });
        } finally {
            setIsGeneratingForecast(false);
        }
    }
    
    const SalesReportContent = () => filteredInvoices.length === 0 ? (
        <EmptyState
            icon={BarChart3}
            title="No sales data for this period"
            description="Try adjusting the date range to see sales results."
        />
    ) : (
         <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportKPI title="Total Revenue" value={`${currencySymbol} ${salesReportData.totalRevenue.toFixed(2)}`} icon={DollarSign} />
                <ReportKPI title="Invoices" value={`${salesReportData.totalInvoices}`} icon={FileText} />
                <ReportKPI title="Items Sold" value={`${salesReportData.totalItemsSold}`} icon={ShoppingBag} />
                <ReportKPI title="Customers" value={`${salesReportData.uniqueCustomers}`} icon={Users} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle>Sales by Product</CardTitle></CardHeader><CardContent>
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                    <TableBody>{salesReportData.productSales.map(p => (<TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.quantity}</TableCell><TableCell className="text-right">{currencySymbol} {p.revenue.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>Sales by User</CardTitle></CardHeader><CardContent>
                    <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                    <TableBody>{salesReportData.userSales.map(u => (<TableRow key={u.id}><TableCell>{u.name}</TableCell><TableCell className="text-right">{u.invoices}</TableCell><TableCell className="text-right">{currencySymbol} {u.revenue.toFixed(2)}</TableCell></TableRow>))}</TableBody></Table>
                </CardContent></Card>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle>AI Forecasting & Trends</CardTitle>
                    </div>
                    <CardDescription>Generate a sales forecast based on the selected date range.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleGenerateForecast} disabled={isGeneratingForecast} className="non-printable">
                        {isGeneratingForecast ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Generating...</> : <><Sparkles className="mr-2 h-4 w-4"/> Generate Forecast</>}
                    </Button>
                    {isGeneratingForecast ? ( <div className="mt-4 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground"/></div>) :
                    forecast && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><h4 className="font-semibold mb-2">Forecast</h4><p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">{forecast.forecast}</p></div>
                            <div><h4 className="font-semibold mb-2">Trend Analysis</h4><p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">{forecast.trendAnalysis}</p></div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const InventoryReportContent = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportKPI title="Total SKUs" value={`${inventoryReportData.totalItems}`} icon={Package} />
                <ReportKPI title="Total Stock Value (Cost)" value={`${currencySymbol} ${inventoryReportData.totalStockValue.toFixed(2)}`} icon={DollarSign} />
                <ReportKPI title="Low Stock Items" value={`${inventoryReportData.lowStockItems.length}`} icon={TrendingUp} />
            </div>
            <Card>
                <CardHeader><CardTitle>Inventory Details</CardTitle></CardHeader>
                <CardContent>
                    <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Total Value</TableHead></TableRow></TableHeader>
                    <TableBody>{inventoryReportData.allItems.map(p => (
                        <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.sku || 'N/A'}</TableCell>
                            <TableCell className="text-right">{p.stock}</TableCell>
                            <TableCell className="text-right">{currencySymbol} {p.cost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{currencySymbol} {(p.stock * p.cost).toFixed(2)}</TableCell>
                        </TableRow>
                    ))}</TableBody></Table>
                </CardContent>
            </Card>
        </div>
    );
    
    const FinancialReportContent = () => (
         <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle>Profit & Loss Summary</CardTitle><CardDescription>A high-level overview of profitability for the selected period.</CardDescription></CardHeader>
                <CardContent>
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="font-medium">Total Revenue</span>
                            <span className="font-bold text-lg">{currencySymbol} {financialReportData.totalRevenue.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="font-medium text-destructive">Cost of Goods Sold (COGS)</span>
                            <span className="font-bold text-lg text-destructive">-{currencySymbol} {financialReportData.costOfGoodsSold.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <span className="font-semibold text-primary">Gross Profit</span>
                            <span className="font-bold text-xl text-primary">{currencySymbol} {financialReportData.grossProfit.toFixed(2)}</span>
                        </div>
                        <div className="text-center pt-2">
                            <p className="text-sm text-muted-foreground">Profit Margin: <span className="font-bold">{financialReportData.profitMargin.toFixed(2)}%</span></p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const reportContentMap = {
        sales: <SalesReportContent />,
        inventory: <InventoryReportContent />,
        financial: <FinancialReportContent />,
    };

    return (
        <div className="flex flex-col h-full">
            <Header title="Reports & Analytics" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Card>
                    <CardHeader className="non-printable">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <CardTitle>Business Reports</CardTitle>
                                <CardDescription>Generate and view detailed reports for your business.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <DateRangePicker date={date} setDate={setDate} />
                                <Button asChild variant="outline" size="sm" className="gap-1 w-full sm:w-auto non-printable">
                                    <Link href="/reports/builder">Build a Custom Report</Link>
                                </Button>
                                <Button onClick={handlePrint} size="sm" className="gap-1 w-full sm:w-auto">
                                    <Download className="h-4 w-4" />
                                    Download PDF
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <Tabs value={activeTab} onValueChange={handleTabChange}>
                            <TabsList className="grid w-full grid-cols-3 non-printable">
                                <TabsTrigger value="sales">Sales</TabsTrigger>
                                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                                <TabsTrigger value="financial">Financial</TabsTrigger>
                            </TabsList>
                            <TabsContent value="sales" className="mt-4">
                               <SalesReportContent />
                            </TabsContent>
                             <TabsContent value="inventory" className="mt-4">
                                <InventoryReportContent />
                             </TabsContent>
                              <TabsContent value="financial" className="mt-4">
                                <FinancialReportContent />
                              </TabsContent>
                         </Tabs>
                    </CardContent>
                </Card>
                 <PrintableReport 
                    ref={reportRef} 
                    title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report for ${companyName}`}
                    description={currentStore?.name || ''}
                    date={date}
                >
                    {reportContentMap[activeTab as keyof typeof reportContentMap]}
                </PrintableReport>
            </main>
        </div>
    );
}
