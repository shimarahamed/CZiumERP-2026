
'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Shipment } from '@/types';
import { Printer } from '@/components/icons';
import { useAppContext } from '@/context/AppContext';
import jsbarcode from 'jsbarcode';
import { format } from 'date-fns';

interface ShippingLabelProps {
    shipment: Shipment;
}

const ShippingLabel = ({ shipment }: ShippingLabelProps) => {
    const { companyName, companyAddress } = useAppContext();
    const barcodeRef = React.useRef<SVGSVGElement>(null);

    React.useEffect(() => {
        if (barcodeRef.current && shipment.trackingNumber) {
            jsbarcode(barcodeRef.current, shipment.trackingNumber, {
                format: 'CODE128',
                displayValue: true,
                fontSize: 14,
                margin: 10,
                height: 50,
            });
        }
    }, [shipment.trackingNumber]);
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <DialogContent className="sm:max-w-xl p-0 printable-area-container">
            <DialogHeader className="sr-only">
              <DialogTitle>Shipping Label for {shipment.id}</DialogTitle>
            </DialogHeader>
            <div className="printable-area bg-white text-black font-sans" style={{ width: '4in', height: '6in', padding: '0.25in' }}>
                 <div className="flex flex-col h-full w-full border border-black p-1">
                    <div className="flex justify-between items-center border-b-2 border-black p-2">
                        <div>
                            <p className="font-bold text-lg">{companyName}</p>
                            <p className="text-xs">Ship Date: {format(new Date(), 'dd MMM yyyy')}</p>
                        </div>
                        <p className="font-bold text-lg">USPS PRIORITY</p>
                    </div>

                    <div className="flex flex-grow border-b-2 border-black">
                        <div className="w-1/2 border-r-2 border-black p-2">
                            <p className="text-xs font-bold">FROM:</p>
                            <p className="text-sm font-semibold">{companyName}</p>
                            <p className="text-sm whitespace-pre-wrap">{companyAddress}</p>
                        </div>
                        <div className="w-1/2 p-2 pl-4">
                            <p className="text-xs font-bold">SHIP TO:</p>
                            <p className="text-lg font-bold">{shipment.customerName}</p>
                            <p className="text-lg whitespace-pre-wrap">{shipment.shippingAddress}</p>
                        </div>
                    </div>
                    
                    <div className="pt-2 flex flex-col items-center justify-center">
                        <svg ref={barcodeRef} className="w-full"></svg>
                    </div>
                </div>
            </div>
            <DialogFooter className="non-printable p-4 border-t flex justify-center">
                <Button onClick={handlePrint} variant="outline" className="w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    Print 4x6 Label
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default ShippingLabel;
