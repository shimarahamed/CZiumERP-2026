

'use client'

import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import type { Shipment, ShipmentStatus } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { format, parseISO } from 'date-fns';
import { Truck, Package, User, Map, Check, Circle, AlertCircle, Ticket } from '@/components/icons';
import FullInvoice from './FullInvoice';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import ShippingLabel from './ShippingLabel';


interface ShipmentDetailProps {
    shipment: Shipment;
    onClose: () => void;
}

const statusVariant: { [key in ShipmentStatus]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
    pending: 'secondary',
    processing: 'secondary',
    'in-transit': 'default',
    'out-for-delivery': 'default',
    delivered: 'outline',
    failed: 'destructive',
    cancelled: 'destructive'
};

const timelineSteps = [
    { status: 'pending', title: 'Pending', description: 'Shipment created.' },
    { status: 'processing', title: 'Processing', description: 'Items are being prepared.' },
    { status: 'in-transit', title: 'In Transit', description: 'Shipment is on its way.' },
    { status: 'out-for-delivery', title: 'Out for Delivery', description: 'Driver is en route.' },
    { status: 'delivered', title: 'Delivered', description: 'Shipment has been delivered.' },
];


export function ShipmentDetail({ shipment, onClose }: ShipmentDetailProps) {
    const { employees, assets, invoices } = useAppContext();
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [isLabelOpen, setIsLabelOpen] = useState(false);
    
    const driver = employees.find(e => e.id === shipment.assignedDriverId);
    const vehicle = assets.find(a => a.id === shipment.vehicleId);
    const invoice = invoices.find(inv => inv.id === shipment.invoiceId);
    
    const currentStepIndex = timelineSteps.findIndex(step => step.status === shipment.status);

    const isFailedOrCancelled = shipment.status === 'failed' || shipment.status === 'cancelled';

    const getTimelineDate = (status: ShipmentStatus) => {
        if (status === 'delivered' && shipment.actualDeliveryDate) {
            return `on ${format(parseISO(shipment.actualDeliveryDate), 'PPP')}`;
        }
        if (status === 'in-transit' && shipment.dispatchDate) {
            return `on ${format(parseISO(shipment.dispatchDate), 'PPP')}`;
        }
         if (status === 'processing' && shipment.dispatchDate) {
            return `on ${format(parseISO(shipment.dispatchDate), 'PPP')}`;
        }
         if (status === 'pending' && shipment.dispatchDate) {
            return `on ${format(parseISO(shipment.dispatchDate), 'PPP')}`;
        }
        return null;
    }

    return (
        <>
            <DialogContent className="sm:max-w-4xl bg-card">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-6 w-6"/> Shipment Details for {shipment.customId || shipment.id}
                    </DialogTitle>
                    <DialogDescription>Tracking Number: {shipment.trackingNumber || 'N/A'}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto px-1">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                             <h3 className="font-semibold text-lg">Details</h3>
                             <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
                                 <div><p className="font-medium text-muted-foreground flex items-center gap-2"><User className="h-4 w-4"/>Customer</p><p>{shipment.customerName}</p></div>
                                 <div className="col-span-2 sm:col-span-1"><p className="font-medium text-muted-foreground flex items-center gap-2"><Map className="h-4 w-4"/>Address</p><p>{shipment.shippingAddress}</p></div>
                                 <div><p className="font-medium text-muted-foreground">Status</p><Badge variant={statusVariant[shipment.status]} className="capitalize">{shipment.status.replace('-', ' ')}</Badge></div>
                                 <div><p className="font-medium text-muted-foreground flex items-center gap-2"><User className="h-4 w-4"/>Driver</p><p>{driver?.name || 'Unassigned'}</p></div>
                                 <div><p className="font-medium text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4"/>Vehicle</p><p>{vehicle?.name || 'Unassigned'}</p></div>
                             </div>
                             <h3 className="font-semibold text-lg flex items-center gap-2 pt-4"><Package className="h-5 w-5"/>Items in Shipment</h3>
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                                {shipment.items.map(item => (
                                    <div key={item.productId} className="flex justify-between items-center p-3 border-b last:border-b-0 text-sm">
                                        <span>{item.productName}</span>
                                        <span className="text-muted-foreground font-mono">x {item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg mb-4">Shipment Timeline</h3>
                            {isFailedOrCancelled ? (
                                <div className="flex items-center justify-center p-8 bg-destructive/10 rounded-lg text-center border border-destructive/20">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="h-10 w-10 text-destructive" />
                                        <p className="font-bold text-lg capitalize text-destructive">{shipment.status}</p>
                                        <p className="text-sm text-muted-foreground">This shipment has been marked as {shipment.status}.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative pl-4">
                                    {timelineSteps.map((step, index) => (
                                        <div key={step.status} className="relative flex items-start pb-8">
                                            {index < timelineSteps.length - 1 && (
                                                <div className={cn(
                                                    "absolute left-[11px] top-[1.2rem] h-full w-0.5",
                                                    index < currentStepIndex ? "bg-primary" : "bg-muted-foreground/30"
                                                )} />
                                            )}
                                             <div className={cn(
                                                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card",
                                                index <= currentStepIndex ? "border-2 border-primary" : "border-2 border-muted-foreground/30"
                                            )}>
                                                {index < currentStepIndex ? (
                                                    <Check className="h-4 w-4 text-primary" />
                                                ) : index === currentStepIndex ? (
                                                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                                                ) : (
                                                    <Circle className="h-3 w-3 text-muted-foreground/30" />
                                                )}
                                            </div>
                                            <div className="ml-4">
                                                <p className={cn(
                                                    "font-semibold",
                                                    index <= currentStepIndex ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {step.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{getTimelineDate(step.status as ShipmentStatus) || step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:justify-end">
                    {invoice && <Button variant="outline" onClick={() => setIsInvoiceOpen(true)}>View Linked Invoice</Button>}
                    <Button variant="outline" onClick={() => setIsLabelOpen(true)}>
                        <Ticket className="mr-2 h-4 w-4" />
                        Generate Shipping Label
                    </Button>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
            {invoice && (
                 <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
                    <FullInvoice invoice={invoice}/>
                </Dialog>
            )}
             <Dialog open={isLabelOpen} onOpenChange={setIsLabelOpen}>
                <ShippingLabel shipment={shipment} />
            </Dialog>
        </>
    );
}
