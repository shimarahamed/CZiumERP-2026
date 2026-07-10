
'use client';

import React, { useState, useMemo } from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import type { ITAsset, AssetStatus } from '@/types';
import { useAppContext } from '@/context/AppContext';
import { format, parseISO } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { Combobox } from './ui/combobox';
import { useToast } from '@/hooks/use-toast';

interface ITAssetDetailProps {
    asset: ITAsset;
    onUpdate: (asset: ITAsset) => void;
}

const DetailItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex flex-col">
        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
        <dd className="text-sm">{value || 'N/A'}</dd>
    </div>
);

const ITAssetDetail = ({ asset, onUpdate }: ITAssetDetailProps) => {
    const { currencySymbol, vendorsMap, employees, addActivityLog } = useAppContext();
    const { toast } = useToast();
    const [currentStatus, setCurrentStatus] = useState<AssetStatus>(asset.status);
    const [assignedUserId, setAssignedUserId] = useState(asset.assignedTo);

    const vendor = asset.vendorId ? vendorsMap.get(asset.vendorId) : undefined;
    
    const employeeOptions = useMemo(() => employees.map(e => ({ label: e.name, value: e.id })), [employees]);

    const handleStatusChange = (newStatus: AssetStatus) => {
        setCurrentStatus(newStatus);
        const updatedAsset: ITAsset = { ...asset, status: newStatus };

        // If status is not 'in-use', unassign the user
        if (newStatus !== 'in-use' && updatedAsset.assignedTo) {
            updatedAsset.assignedTo = undefined;
            setAssignedUserId(undefined);
            addActivityLog('IT Asset Unassigned', `Asset ${asset.name} unassigned due to status change to ${newStatus}.`);
        }
        
        onUpdate(updatedAsset);
        addActivityLog('IT Asset Status Updated', `Asset ${asset.name} status changed to ${newStatus}.`);
        toast({ title: "Status Updated" });
    };

    const handleAssignmentChange = (userId: string) => {
        const newAssignedUserId = userId === 'unassigned' ? undefined : userId;
        setAssignedUserId(newAssignedUserId);
        const updatedAsset: ITAsset = { ...asset, assignedTo: newAssignedUserId };
        onUpdate(updatedAsset);
        const employeeName = employees.find(e => e.id === userId)?.name || 'Unassigned';
        addActivityLog('IT Asset Assignment Updated', `Asset ${asset.name} assigned to ${employeeName}.`);
        toast({ title: "Assignment Updated" });
    }

    return (
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{asset.name}</DialogTitle>
                <DialogDescription>
                    {asset.category} - S/N: {asset.serialNumber}
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto px-1">
                 <div>
                    <h3 className="text-lg font-semibold mb-2">Assignment & Status</h3>
                    <Card>
                        <CardContent className="p-4">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                                <div className="col-span-1">
                                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                                    <dd>
                                        <Select value={currentStatus} onValueChange={handleStatusChange}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="in-use">In Use</SelectItem>
                                                <SelectItem value="in-storage">In Storage</SelectItem>
                                                <SelectItem value="under-maintenance">Under Maintenance</SelectItem>
                                                <SelectItem value="retired">Retired</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </dd>
                                </div>
                                {currentStatus === 'in-use' && (
                                     <div className="col-span-2">
                                        <dt className="text-sm font-medium text-muted-foreground">Assigned To</dt>
                                        <dd>
                                            <Combobox
                                                options={employeeOptions}
                                                value={assignedUserId}
                                                onValueChange={handleAssignmentChange}
                                                placeholder="Select an employee..."
                                                searchPlaceholder='Search employees...'
                                                emptyText='No employee found.'
                                            />
                                        </dd>
                                    </div>
                                )}
                                <DetailItem label="Department" value={asset.department} />
                                <DetailItem label="Location" value={asset.location} />
                            </dl>
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Core Information</h3>
                    <Card>
                        <CardContent className="p-4">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                                <DetailItem label="Manufacturer" value={asset.manufacturer} />
                                <DetailItem label="Model" value={asset.model} />
                                <DetailItem label="Serial Number" value={asset.serialNumber} />
                                <DetailItem label="Description" value={<p className="col-span-full">{asset.description}</p>} />
                            </dl>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-2">Procurement & Financials</h3>
                     <Card>
                        <CardContent className="p-4">
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                                <DetailItem label="Purchase Date" value={format(parseISO(asset.purchaseDate), 'PPP')} />
                                <DetailItem label="Purchase Cost" value={`${currencySymbol} ${asset.purchaseCost.toFixed(2)}`} />
                                <DetailItem label="Vendor" value={vendor?.name} />
                                <DetailItem label="Warranty Expiration" value={asset.warrantyExpiration ? format(parseISO(asset.warrantyExpiration), 'PPP') : 'N/A'} />
                            </dl>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DialogContent>
    );
};

export default ITAssetDetail;

    