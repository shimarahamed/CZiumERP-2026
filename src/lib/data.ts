

import type { Customer, Invoice, Sale, Product, Vendor, Store, User, PurchaseOrder, RFQ, Asset, ITAsset, AttendanceEntry, LeaveRequest, Employee, LedgerEntry, TaxRate, Budget, Candidate, PerformanceReview, BillOfMaterials, ProductionOrder, QualityCheck, Lead, Campaign, Project, Task, Ticket, JobRequisition, Shipment, VendorBill } from '@/types';

// SECURITY: passwords are managed exclusively by Firebase Authentication.
// Never add password fields here — provision auth accounts with
// scripts/manage-auth-users.mjs or the Firebase console.
export const initialUsers: User[] = [
  { id: 'user-1', name: 'Admin User', email: 'admin@czium.com', avatar: '', role: 'admin' },
  { id: 'user-2', name: 'Manager Mike', email: 'manager@czium.com', avatar: '', role: 'manager' },
  { id: 'user-3', name: 'Cashier Chloe', email: 'cashier@czium.com', avatar: '', role: 'cashier' },
  { id: 'user-4', name: 'Inventory Ian', email: 'inventory@czium.com', avatar: '', role: 'inventory-staff' },
];

export const initialEmployees: Employee[] = [
  { id: 'emp-1', userId: 'user-1', name: 'Admin User', email: 'admin@czium.com', avatar: '', jobTitle: 'System Administrator', department: 'IT', dateOfJoining: '2022-01-01', salary: 120000, annualLeaveAllowance: 25, leaveTaken: 5, storeId: 'store-1' },
  { id: 'emp-2', userId: 'user-2', name: 'Manager Mike', email: 'manager@czium.com', avatar: '', jobTitle: 'Store Manager', department: 'Operations', dateOfJoining: '2023-03-15', salary: 85000, annualLeaveAllowance: 25, leaveTaken: 10, storeId: 'store-1' },
  { id: 'emp-3', userId: 'user-3', name: 'Cashier Chloe', email: 'cashier@czium.com', avatar: '', jobTitle: 'Cashier', department: 'Sales', dateOfJoining: '2024-06-01', salary: 45000, annualLeaveAllowance: 20, leaveTaken: 2, storeId: 'store-2' },
  { id: 'emp-4', userId: 'user-4', name: 'Inventory Ian', email: 'inventory@czium.com', avatar: '', jobTitle: 'Inventory Specialist', department: 'Logistics', dateOfJoining: '2024-09-20', salary: 55000, annualLeaveAllowance: 20, leaveTaken: 0, storeId: 'store-2' },
  { id: 'emp-5', name: 'Warehouse William', email: 'william@czium.com', avatar: '', jobTitle: 'Warehouse Associate', department: 'Logistics', dateOfJoining: '2025-01-10', salary: 42000, annualLeaveAllowance: 18, leaveTaken: 3, storeId: 'store-3' },
  { id: 'emp-6', name: 'Driver Dan', email: 'dan@czium.com', avatar: '', jobTitle: 'Delivery Driver', department: 'Logistics', dateOfJoining: '2024-02-20', salary: 48000, annualLeaveAllowance: 20, leaveTaken: 8, storeId: 'store-3' },
];

export const initialStores: Store[] = [
  { id: 'store-1', name: 'Downtown Central', address: '123 Main St, Anytown, USA' },
  { id: 'store-2', name: 'Westside Mall', address: '456 Oak Ave, Anytown, USA' },
  { id: 'store-3', name: 'Northpoint Plaza', address: '789 Pine Ln, Anytown, USA' },
];

export const initialCustomers: Customer[] = [
  { id: 'cust-1', name: 'John Doe', email: 'john@example.com', phone: '123-456-7890', avatar: '', billingAddress: '123 Billing Rd, Anytown, USA', shippingAddress: '123 Shipping Rd, Anytown, USA', loyaltyPoints: 525, tier: 'Silver', storeId: 'store-1' },
  { id: 'cust-2', name: 'Jane Smith', email: 'jane@example.com', phone: '234-567-8901', avatar: '', billingAddress: '456 Billing Ave, Anytown, USA', shippingAddress: '456 Shipping Ave, Anytown, USA', loyaltyPoints: 80, tier: 'Bronze', storeId: 'store-2' },
  { id: 'cust-3', name: 'Sam Wilson', email: 'sam@example.com', phone: '345-678-9012', avatar: '', billingAddress: '789 Billing Ln, Anytown, USA', shippingAddress: '789 Shipping Ln, Anytown, USA', loyaltyPoints: 130, tier: 'Bronze', storeId: 'store-1' },
  { id: 'cust-4', name: 'Alice Johnson', email: 'alice@example.com', phone: '456-789-0123', avatar: '', billingAddress: '101 Billing Blvd, Anytown, USA', shippingAddress: '101 Shipping Blvd, Anytown, USA', loyaltyPoints: 2150, tier: 'Gold', storeId: 'store-3' },
  { id: 'cust-5', name: 'Bob Brown', email: 'bob@example.com', phone: '567-890-1234', avatar: '', billingAddress: '212 Billing Ct, Anytown, USA', shippingAddress: '212 Shipping Ct, Anytown, USA', loyaltyPoints: 0, tier: 'Bronze', storeId: 'store-2' },
  { id: 'cust-6', name: 'Emily White', email: 'emily@example.com', phone: '678-901-2345', avatar: '', billingAddress: '333 Billing Dr, Anytown, USA', shippingAddress: '333 Shipping Dr, Anytown, USA', loyaltyPoints: 1200, tier: 'Silver', storeId: 'store-1' },
  { id: 'cust-7', name: 'Michael Green', email: 'michael@example.com', phone: '789-012-3456', avatar: '', billingAddress: '444 Billing Pl, Anytown, USA', shippingAddress: '444 Shipping Pl, Anytown, USA', loyaltyPoints: 340, tier: 'Bronze', storeId: 'store-3' },
  { id: 'cust-8', name: 'Sarah Black', email: 'sarah@example.com', phone: '890-123-4567', avatar: '', billingAddress: '555 Billing Way, Anytown, USA', shippingAddress: '555 Shipping Way, Anytown, USA', loyaltyPoints: 450, tier: 'Bronze', storeId: 'store-2' },
];

export const initialProducts: Product[] = [
  { id: 'prod-1', name: 'Espresso Machine', price: 499.99, cost: 350.00, stock: 5, sku: 'EM-499', category: 'Appliances', description: 'A high-quality espresso machine for home baristas.', reorderThreshold: 5, warrantyDate: '2027-05-20T00:00:00.000Z', productType: 'manufactured', storeId: 'store-1' },
  { id: 'prod-2', name: 'Coffee Grinder', price: 129.50, cost: 80.00, stock: 30, sku: 'CG-129', category: 'Appliances', description: 'A conical burr grinder for a consistent grind.', reorderThreshold: 10, vendorId: 'vend-3', productType: 'standard', storeId: 'store-1' },
  { id: 'prod-3', name: 'Bag of Premium Coffee Beans (1kg)', price: 22.00, cost: 12.00, stock: 25, sku: 'CB-1KG', category: 'Consumables', description: 'Single-origin beans from Ethiopia.', reorderThreshold: 20, expiryDate: '2025-06-15T00:00:00.000Z', vendorId: 'vend-1', productType: 'standard', storeId: 'store-2' },
  { id: 'prod-4', name: 'Milk Frother', price: 75.00, cost: 45.00, stock: 45, sku: 'MF-075', category: 'Accessories', description: 'Automatic milk frother for lattes and cappuccinos.', reorderThreshold: 15, vendorId: 'vend-2', productType: 'standard', storeId: 'store-2' },
  { id: 'prod-5', name: 'Set of 4 Ceramic Mugs', price: 40.00, cost: 20.00, stock: 60, sku: 'CM-SET4', category: 'Accessories', description: 'Durable and stylish ceramic mugs.', reorderThreshold: 20, vendorId: 'vend-2', productType: 'standard', storeId: 'store-3' },
  { id: 'prod-6', name: 'Almond Milk (1L)', price: 4.50, cost: 2.50, stock: 50, sku: 'AM-1L', category: 'Consumables', description: 'Unsweetened almond milk.', reorderThreshold: 20, expiryDate: '2025-08-20T00:00:00.000Z', vendorId: 'vend-1', productType: 'standard', storeId: 'store-1' },
  { id: 'prod-7', name: 'Oat Milk (1L)', price: 4.75, cost: 2.75, stock: 40, sku: 'OM-1L', category: 'Consumables', description: 'Unsweetened oat milk.', reorderThreshold: 20, expiryDate: '2025-04-10T00:00:00.000Z', vendorId: 'vend-1', productType: 'standard', storeId: 'store-2' },
  { id: 'prod-8', name: 'Assorted Pastries', price: 3.50, cost: 1.50, stock: 8, sku: 'PST-ASST', category: 'Consumables', description: 'Freshly baked pastries.', reorderThreshold: 10, expiryDate: '2025-05-22T00:00:00.000Z', productType: 'standard', storeId: 'store-3' },
  { id: 'prod-9', name: 'Cleaning Tablets', price: 15.00, cost: 8.00, stock: 80, sku: 'CL-TAB', category: 'Maintenance', description: 'Tablets for cleaning espresso machines.', reorderThreshold: 15, productType: 'standard', storeId: 'store-1' },
  { id: 'prod-10', name: 'Digital Scale', price: 35.00, cost: 20.00, stock: 0, sku: 'SCL-DGTL', category: 'Accessories', description: 'Precision digital scale for coffee weighing.', reorderThreshold: 10, vendorId: 'vend-2', productType: 'standard', storeId: 'store-2' }, // Out of Stock
  { id: 'prod-11', name: 'Gooseneck Kettle', price: 89.99, cost: 60.00, stock: 9, sku: 'KT-GNK', category: 'Appliances', description: 'Electric gooseneck kettle for pour-over coffee.', reorderThreshold: 10, vendorId: 'vend-3', productType: 'standard', storeId: 'store-3' }, // Low Stock
  { id: 'prod-12', name: 'Travel Mug', price: 25.00, cost: 15.00, stock: 100, sku: 'TM-16OZ', category: 'Accessories', description: '16oz insulated travel mug.', reorderThreshold: 30, vendorId: 'vend-2', productType: 'standard', storeId: 'store-1' },
  { id: 'prod-13', name: 'Barista Apron', price: 30.00, cost: 18.00, stock: 40, sku: 'APRN-BRST', category: 'Apparel', description: 'Canvas barista apron with leather straps.', reorderThreshold: 10, vendorId: 'vend-2', productType: 'standard', storeId: 'store-2' },
  { id: 'prod-14', name: 'Syrup Variety Pack', price: 18.00, cost: 10.00, stock: 60, sku: 'SYRP-PCK', category: 'Consumables', description: 'Pack of 3 flavored syrups.', reorderThreshold: 25, vendorId: 'vend-1', expiryDate: '2025-11-20T00:00:00.000Z', productType: 'standard', storeId: 'store-3' },
  { id: 'prod-15', name: 'Casing Unit', price: 0, cost: 150.00, stock: 200, sku: 'CS-UNIT', category: 'Components', description: 'Outer casing for Espresso Machine.', reorderThreshold: 10, vendorId: 'vend-3', productType: 'component', storeId: 'store-1' },
  { id: 'prod-16', name: 'Internal Pump Assembly', price: 0, cost: 200.00, stock: 200, sku: 'PMP-ASSY', category: 'Components', description: 'Pump and boiler assembly for Espresso Machine.', reorderThreshold: 5, vendorId: 'vend-3', productType: 'component', storeId: 'store-1' },
];

export const initialVendors: Vendor[] = [
  { id: 'vend-1', name: 'Beans & Co.', contactPerson: 'Mark R.', email: 'mark@beans.co', phone: '987-654-3210', leadTimeDays: 7, storeId: 'store-1' },
  { id: 'vend-2', name: 'Cup Supplies Inc.', contactPerson: 'Susan B.', email: 'susan@cups.inc', phone: '876-543-2109', leadTimeDays: 5, storeId: 'store-2' },
  { id: 'vend-3', name: 'Machinery Masters', contactPerson: 'Leo P.', email: 'leo@machinery.com', phone: '765-432-1098', leadTimeDays: 14, storeId: 'store-1' },
];

export const initialInvoices: Invoice[] = [
  { id: 'INV-001', storeId: 'store-1', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 1, price: 499.99, cost: 350.00 }], amount: 524.99, status: 'paid', date: '2025-10-25', discount: 0, taxRate: 5 },
  { id: 'INV-002', storeId: 'store-2', customerId: 'cust-2', customerName: 'Jane Smith', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 2, price: 22.00, cost: 12.00 }, { productId: 'prod-5', productName: 'Set of 4 Ceramic Mugs', quantity: 1, price: 40.00, cost: 20.00 }], amount: 79.80, status: 'pending', date: '2025-10-26', dueDate: '2025-11-26', discount: 5, taxRate: 0 },
  { id: 'INV-003', storeId: 'store-1', customerId: 'cust-3', customerName: 'Sam Wilson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-2', productName: 'Coffee Grinder', quantity: 1, price: 129.50, cost: 80.00 }], amount: 129.50, status: 'overdue', date: '2025-09-15', dueDate: '2025-10-15' },
  { id: 'INV-004', storeId: 'store-2', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-4', productName: 'Milk Frother', quantity: 1, price: 75.00, cost: 45.00 }, { productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 5, price: 22.00, cost: 12.00 }], amount: 185.00, status: 'paid', date: '2025-10-27', dueDate: '2025-11-27' },
  { id: 'INV-005', storeId: 'store-1', customerName: 'Alice Johnson', customerId: 'cust-4', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-5', productName: 'Set of 4 Ceramic Mugs', quantity: 2, price: 40.00, cost: 20.00 }], amount: 72.00, status: 'pending', date: '2025-10-28', dueDate: '2025-11-28', discount: 10, taxRate: 0 },
  { id: 'INV-006', storeId: 'store-3', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 1, price: 22.00, cost: 12.00 }], amount: 22.00, status: 'paid', date: '2025-10-29' },
  { id: 'INV-007', storeId: 'store-1', customerId: 'cust-6', customerName: 'Emily White', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-2', productName: 'Coffee Grinder', quantity: 1, price: 129.50, cost: 80.00 }], amount: 123.03, status: 'refunded', date: '2025-11-01', dueDate: '2025-12-01', discount: 5, taxRate: 0 },
  { id: 'INV-008', storeId: 'store-2', customerId: 'cust-7', customerName: 'Michael Green', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-12', productName: 'Travel Mug', quantity: 1, price: 25.00, cost: 15.00 }], amount: 52.50, status: 'partially-refunded', date: '2025-11-02', dueDate: '2025-12-02', discount: 0, taxRate: 5 },
  { id: 'INV-009', storeId: 'store-3', customerId: 'cust-8', customerName: 'Sarah Black', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-13', productName: 'Barista Apron', quantity: 1, price: 30.00, cost: 18.00 }, { productId: 'prod-14', productName: 'Syrup Variety Pack', quantity: 1, price: 18.00, cost: 10.00 }], amount: 48.00, status: 'paid', date: '2025-11-05', dueDate: '2025-12-05' },
  { id: 'INV-010', storeId: 'store-1', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-8', productName: 'Assorted Pastries', quantity: 3, price: 3.50, cost: 1.50 }], amount: 10.50, status: 'paid', date: '2025-11-08' },
  { id: 'INV-011', storeId: 'store-2', customerId: 'cust-4', customerName: 'Alice Johnson', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 1, price: 499.99, cost: 350.00 }, { productId: 'prod-9', productName: 'Cleaning Tablets', quantity: 2, price: 15.00, cost: 8.00 }], amount: 476.99, status: 'paid', date: '2025-11-10', discount: 10, taxRate: 0 },
  { id: 'INV-012', storeId: 'store-3', customerId: 'cust-5', customerName: 'Bob Brown', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-6', productName: 'Almond Milk (1L)', quantity: 2, price: 4.50, cost: 2.50 }], amount: 9.00, status: 'pending', date: '2025-11-11', dueDate: '2025-12-11' },
  { id: 'INV-013', storeId: 'store-1', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-7', productName: 'Oat Milk (1L)', quantity: 4, price: 4.75, cost: 2.75 }], amount: 18.05, status: 'overdue', date: '2025-10-01', dueDate: '2025-11-01', discount: 5, taxRate: 0 },
  { id: 'INV-014', storeId: 'store-2', customerId: 'cust-2', customerName: 'Jane Smith', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-4', productName: 'Milk Frother', quantity: 1, price: 75.00, cost: 45.00 }, { productId: 'prod-14', productName: 'Syrup Variety Pack', quantity: 2, price: 18.00, cost: 10.00 }], amount: 116.55, status: 'paid', date: '2025-11-12', discount: 0, taxRate: 5 },
  { id: 'INV-015', storeId: 'store-3', customerId: 'cust-7', customerName: 'Michael Green', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-11', productName: 'Gooseneck Kettle', quantity: 1, price: 89.99, cost: 60.00 }], amount: 89.99, status: 'pending', date: '2025-11-13', dueDate: '2025-12-13' },
  { id: 'INV-016', storeId: 'store-1', customerId: 'cust-8', customerName: 'Sarah Black', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-12', productName: 'Travel Mug', quantity: 3, price: 25.00, cost: 15.00 }], amount: 75.00, status: 'overdue', date: '2025-10-05', dueDate: '2025-11-05' },
  { id: 'INV-017', storeId: 'store-1', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-8', productName: 'Assorted Pastries', quantity: 5, price: 3.50, cost: 1.50 }], amount: 17.50, status: 'paid', date: '2025-11-14' },
  { id: 'INV-018', storeId: 'store-3', customerId: 'cust-4', customerName: 'Alice Johnson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 1, price: 499.99, cost: 350.00 }], amount: 472.49, status: 'paid', date: '2025-11-15', discount: 10, taxRate: 5 },
  { id: 'INV-019', storeId: 'store-2', customerId: 'cust-6', customerName: 'Emily White', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-2', productName: 'Coffee Grinder', quantity: 1, price: 129.50, cost: 80.00 }], amount: 123.03, status: 'paid', date: '2025-11-15', discount: 5, taxRate: 0 },
  { id: 'INV-020', storeId: 'store-1', customerId: 'cust-5', customerName: 'Bob Brown', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 2, price: 22.00, cost: 12.00 }], amount: 44.00, status: 'paid', date: '2025-11-16' },
  { id: 'INV-021', storeId: 'store-2', customerId: 'cust-3', customerName: 'Sam Wilson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-5', productName: 'Set of 4 Ceramic Mugs', quantity: 1, price: 40.00, cost: 20.00 }, { productId: 'prod-6', productName: 'Almond Milk (1L)', quantity: 3, price: 4.50, cost: 2.50 }], amount: 53.50, status: 'pending', date: '2025-11-17', dueDate: '2025-12-17' },
  { id: 'INV-022', storeId: 'store-1', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-9', productName: 'Cleaning Tablets', quantity: 4, price: 15.00, cost: 8.00 }], amount: 57, status: 'paid', date: '2025-11-18', discount: 5, taxRate: 0 },
  { id: 'INV-023', storeId: 'store-1', customerId: 'cust-2', customerName: 'Jane Smith', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-13', productName: 'Barista Apron', quantity: 1, price: 30.00, cost: 18.00 }], amount: 31.5, status: 'paid', date: '2025-08-20', taxRate: 5 },
  { id: 'INV-024', storeId: 'store-2', customerId: 'cust-3', customerName: 'Sam Wilson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-12', productName: 'Travel Mug', quantity: 1, price: 25.00, cost: 15.00 }], amount: 25, status: 'overdue', date: '2025-10-10', dueDate: '2025-11-10' },
  { id: 'INV-025', storeId: 'store-3', customerId: 'cust-8', customerName: 'Sarah Black', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-14', productName: 'Syrup Variety Pack', quantity: 1, price: 18.00, cost: 10.00 }], amount: 18.00, status: 'paid', date: '2025-11-19' },
  { id: 'INV-026', storeId: 'store-1', customerId: 'cust-6', customerName: 'Emily White', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-4', productName: 'Milk Frother', quantity: 1, price: 75.00, cost: 45.00 }], amount: 71.25, status: 'paid', date: '2025-11-20', discount: 5, taxRate: 0 },
  { id: 'INV-027', storeId: 'store-2', customerId: 'cust-7', customerName: 'Michael Green', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-13', productName: 'Barista Apron', quantity: 2, price: 30.00, cost: 18.00 }], amount: 63.00, status: 'pending', date: '2025-11-21', dueDate: '2025-12-21', discount: 0, taxRate: 5 },
  { id: 'INV-028', storeId: 'store-3', customerId: 'cust-4', customerName: 'Alice Johnson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-12', productName: 'Travel Mug', quantity: 4, price: 25.00, cost: 15.00 }], amount: 90.00, status: 'paid', date: '2025-11-22', discount: 10, taxRate: 0 },
  { id: 'INV-029', storeId: 'store-1', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-8', productName: 'Assorted Pastries', quantity: 10, price: 3.50, cost: 1.50 }], amount: 35.00, status: 'paid', date: '2025-11-22' },
  { id: 'INV-030', storeId: 'store-2', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 3, price: 22.00, cost: 12.00 }], amount: 62.70, status: 'paid', date: '2025-08-15', discount: 5, taxRate: 0 },
  { id: 'INV-031', storeId: 'store-3', customerId: 'cust-2', customerName: 'Jane Smith', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-7', productName: 'Oat Milk (1L)', quantity: 5, price: 4.75, cost: 2.75 }], amount: 24.94, status: 'overdue', date: '2025-09-30', dueDate: '2025-10-30', discount: 0, taxRate: 5 },
  { id: 'INV-032', storeId: 'store-1', customerId: 'cust-5', customerName: 'Bob Brown', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-14', productName: 'Syrup Variety Pack', quantity: 2, price: 18.00, cost: 10.00 }], amount: 36.00, status: 'paid', date: '2025-11-23' },
  { id: 'INV-033', storeId: 'store-2', customerId: 'cust-8', customerName: 'Sarah Black', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-11', productName: 'Gooseneck Kettle', quantity: 1, price: 89.99, cost: 60.00 }, { productId: 'prod-5', productName: 'Set of 4 Ceramic Mugs', quantity: 1, price: 40.00, cost: 20.00 }], amount: 136.49, status: 'pending', date: '2025-11-24', dueDate: '2025-12-24', taxRate: 5 },
  { id: 'INV-034', storeId: 'store-3', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-9', productName: 'Cleaning Tablets', quantity: 1, price: 15.00, cost: 8.00 }], amount: 15, status: 'paid', date: '2025-11-25' },
  { id: 'INV-035', storeId: 'store-1', customerId: 'cust-4', customerName: 'Alice Johnson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-2', productName: 'Coffee Grinder', quantity: 1, price: 129.50, cost: 80.00 }], amount: 116.55, status: 'paid', date: '2025-11-26', discount: 10 },
  { id: 'INV-036', storeId: 'store-1', customerId: 'cust-7', customerName: 'Michael Green', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-12', productName: 'Travel Mug', quantity: 2, price: 25.00, cost: 15.00 }, { productId: 'prod-8', productName: 'Assorted Pastries', quantity: 4, price: 3.50, cost: 1.50 }], amount: 67.20, status: 'paid', date: '2025-07-28', taxRate: 5 },
  { id: 'INV-037', storeId: 'store-2', customerId: 'cust-1', customerName: 'John Doe', userId: 'user-2', userName: 'Manager Mike', items: [{ productId: 'prod-13', productName: 'Barista Apron', quantity: 1, price: 30.00, cost: 18.00 }], amount: 28.50, status: 'overdue', date: '2025-10-12', dueDate: '2025-11-12', discount: 5, taxRate: 0 },
  { id: 'INV-038', storeId: 'store-3', customerId: 'cust-4', customerName: 'Alice Johnson', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 10, price: 22.00, cost: 12.00 }], amount: 198.00, status: 'paid', date: '2025-08-05', discount: 10 },
  { id: 'INV-039', storeId: 'store-1', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-6', productName: 'Almond Milk (1L)', quantity: 6, price: 4.50, cost: 2.50 }], amount: 27.00, status: 'pending', date: '2025-11-28', dueDate: '2025-12-28' },
  { id: 'INV-040', storeId: 'store-2', customerId: 'cust-5', customerName: 'Bob Brown', userId: 'user-3', userName: 'Cashier Chloe', items: [{ productId: 'prod-4', productName: 'Milk Frother', quantity: 1, price: 75.00, cost: 45.00 }], amount: 78.75, status: 'paid', date: '2025-11-28', taxRate: 5 }
];

export const initialPurchaseOrders: PurchaseOrder[] = [
    { id: 'PO-001', vendorId: 'vend-1', vendorName: 'Beans & Co.', storeId: 'store-1', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 50, cost: 11.50 }, { productId: 'prod-6', productName: 'Almond Milk (1L)', quantity: 100, cost: 2.25 }], totalCost: (50 * 11.50) + (100 * 2.25), status: 'ordered', orderDate: '2025-10-20', expectedDeliveryDate: '2025-10-28' },
    { id: 'PO-002', vendorId: 'vend-3', vendorName: 'Machinery Masters', storeId: 'store-2', items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 5, cost: 340.00 }], totalCost: 5 * 340.00, status: 'received', orderDate: '2025-10-15', expectedDeliveryDate: '2025-10-25', receivedDate: '2025-10-24' },
    { id: 'PO-003', vendorId: 'vend-2', vendorName: 'Cup Supplies Inc.', storeId: 'store-1', items: [{ productId: 'prod-10', productName: 'Digital Scale', quantity: 15, cost: 20.00 }, { productId: 'prod-12', productName: 'Travel Mug', quantity: 50, cost: 15.00 }], totalCost: (15 * 20.00) + (50 * 15.00), status: 'pending-approval', orderDate: '2025-11-01', expectedDeliveryDate: '2025-11-06' },
    { id: 'PO-004', vendorId: 'vend-3', vendorName: 'Machinery Masters', storeId: 'store-1', items: [{ productId: 'prod-11', productName: 'Gooseneck Kettle', quantity: 10, cost: 60.00 }], totalCost: 600.00, status: 'pending', orderDate: '2025-11-05', expectedDeliveryDate: '2025-11-19' },
    { id: 'PO-005', vendorId: 'vend-1', vendorName: 'Beans & Co.', storeId: 'store-3', items: [{ productId: 'prod-7', productName: 'Oat Milk (1L)', quantity: 20, cost: 2.75 }], totalCost: 55.00, status: 'cancelled', orderDate: '2025-10-18' }
];

export const initialVendorBills: VendorBill[] = [
    { 
        id: 'bill-1', 
        purchaseOrderId: 'PO-002',
        vendorId: 'vend-3',
        vendorName: 'Machinery Masters',
        items: initialPurchaseOrders.find(p => p.id === 'PO-002')?.items || [],
        amount: initialPurchaseOrders.find(p => p.id === 'PO-002')?.totalCost || 0,
        status: 'unpaid',
        billDate: '2025-10-25',
        dueDate: '2025-11-24',
    }
];

export const initialRfqs: RFQ[] = [
    { id: 'RFQ-001', storeId: 'store-1', items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 10 }, { productId: 'prod-2', productName: 'Coffee Grinder', quantity: 20 }], vendorIds: ['vend-3'], status: 'sent', creationDate: '2025-11-01', userId: 'user-2', userName: 'Manager Mike' },
    { id: 'RFQ-002', storeId: 'store-1', items: [{ productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 200 }], vendorIds: ['vend-1', 'vend-2'], status: 'draft', creationDate: '2025-11-05', userId: 'user-2', userName: 'Manager Mike' },
    { id: 'RFQ-003', storeId: 'store-2', items: [{ productId: 'prod-13', productName: 'Barista Apron', quantity: 50 }], vendorIds: ['vend-2'], status: 'closed', creationDate: '2025-10-15', userId: 'user-4', userName: 'Inventory Ian' }
];

export const initialAssets: Asset[] = [
  { id: 'asset-1', name: 'Delivery Van 01', category: 'Vehicle', serialNumber: 'VIN123456789', purchaseDate: '2024-01-15', purchaseCost: 25000, status: 'in-use', location: 'store-1', assignedTo: 'emp-6', storeId: 'store-1' },
  { id: 'asset-2', name: 'Head Office Printer', category: 'Office Equipment', serialNumber: 'PRINTER-XYZ', purchaseDate: '2023-05-20', purchaseCost: 800, status: 'in-use', location: 'Head Office', storeId: 'store-1' },
  { id: 'asset-4', name: 'Reserve Cash Register', category: 'Point of Sale', serialNumber: 'POS-005-RESERVE', purchaseDate: '2022-11-30', purchaseCost: 1200, status: 'in-storage', location: 'store-2', storeId: 'store-2' },
  { id: 'asset-5', name: 'Delivery Van 02', category: 'Vehicle', serialNumber: 'VIN987654321', purchaseDate: '2024-08-01', purchaseCost: 28000, status: 'under-maintenance', location: 'store-2', storeId: 'store-2' },
];

export const initialItAssets: ITAsset[] = [
    { id: 'itasset-1', name: 'Laptop - Manager 1', category: 'Laptop', serialNumber: 'LAPTOP-001', purchaseDate: '2025-02-10', purchaseCost: 1500, status: 'in-use', location: 'store-1', assignedTo: 'user-2', manufacturer: 'Dell', model: 'XPS 15' },
    { id: 'itasset-2', name: 'Server Rack A', category: 'Server', serialNumber: 'SRV-RACK-01', purchaseDate: '2023-01-20', purchaseCost: 2500, status: 'in-use', location: 'Data Center', manufacturer: 'HPE', model: 'ProLiant DL380' },
    { id: 'itasset-3', name: 'Conference Room Projector', category: 'Projector', serialNumber: 'PROJ-CONF-01', purchaseDate: '2023-03-10', purchaseCost: 700, status: 'in-use', location: 'Head Office', manufacturer: 'Epson', model: 'PowerLite 1781W' },
];

export const initialAttendance: AttendanceEntry[] = [];
export const initialLeaveRequests: LeaveRequest[] = [
  { id: 'lr-1', userId: 'user-3', userName: 'Cashier Chloe', startDate: '2025-07-01', endDate: '2025-07-03', reason: 'Family vacation', status: 'approved', requestedAt: '2025-06-15T00:00:00.000Z'},
  { id: 'lr-2', userId: 'user-4', userName: 'Inventory Ian', startDate: '2025-07-10', endDate: '2025-07-11', reason: 'Doctor\'s appointment', status: 'pending', requestedAt: '2025-06-20T00:00:00.000Z'}
];

export const initialLedgerEntries: LedgerEntry[] = [
  { id: 'gl-1', date: '2025-10-01', account: 'Accounts Receivable', description: 'Invoice INV-001', debit: 524.99, credit: 0, storeId: 'store-1' },
  { id: 'gl-2', date: '2025-10-01', account: 'Sales Revenue', description: 'Invoice INV-001', debit: 0, credit: 524.99, storeId: 'store-1' },
  { id: 'gl-3', date: '2025-10-02', account: 'Cash', description: 'Payment for INV-001', debit: 524.99, credit: 0, storeId: 'store-1' },
  { id: 'gl-4', date: '2025-10-02', account: 'Accounts Receivable', description: 'Payment for INV-001', debit: 0, credit: 524.99, storeId: 'store-1' },
  { id: 'gl-5', date: '2025-10-15', account: 'Inventory', description: 'PO-002 Received', debit: 1700, credit: 0, storeId: 'store-2' },
  { id: 'gl-6', date: '2025-10-15', account: 'Accounts Payable', description: 'PO-002', debit: 0, credit: 1700, storeId: 'store-2' },
  { id: 'gl-7', date: '2025-10-20', account: 'Rent Expense', description: 'October Rent Payment', debit: 5000, credit: 0, storeId: 'store-1' },
  { id: 'gl-8', date: '2025-10-20', account: 'Cash', description: 'October Rent', debit: 0, credit: 5000, storeId: 'store-1' },
];

export const initialTaxRates: TaxRate[] = [
  { id: 'tax-1', name: 'Standard VAT', rate: 5, isDefault: true },
  { id: 'tax-2', name: 'Zero Rate', rate: 0 },
  { id: 'tax-3', name: 'Luxury Goods Tax', rate: 10 },
];

export const initialBudgets: Budget[] = [
  { id: 'bud-1', category: 'Marketing & Advertising', period: 'Monthly', budgetedAmount: 2000, actualAmount: 1570.50, storeId: 'store-1' },
  { id: 'bud-2', category: 'Operations & Utilities', period: 'Monthly', budgetedAmount: 10000, actualAmount: 9542.75, storeId: 'store-2' },
  { id: 'bud-3', category: 'Employee Payroll', period: 'Monthly', budgetedAmount: 25000, actualAmount: 24800, storeId: 'store-1' },
  { id: 'bud-4', category: 'IT & Software', period: 'Quarterly', budgetedAmount: 5000, actualAmount: 5250, storeId: 'store-1' },
  { id: 'bud-5', category: 'Capital Expenditures', period: 'Yearly', budgetedAmount: 50000, actualAmount: 25000, storeId: 'store-3' },
];

export const initialPerformanceReviews: PerformanceReview[] = [
  { id: 'pr-1', employeeId: 'emp-3', employeeName: 'Cashier Chloe', reviewerId: 'user-2', reviewerName: 'Manager Mike', date: '2025-03-30', rating: 4, comments: 'Chloe has excellent customer service skills and is always punctual. Could improve upselling techniques.' },
  { id: 'pr-2', employeeId: 'emp-4', employeeName: 'Inventory Ian', reviewerId: 'user-2', reviewerName: 'Manager Mike', date: '2025-04-15', rating: 5, comments: 'Ian is extremely organized and has significantly improved inventory accuracy. A model employee.' },
  { id: 'pr-3', employeeId: 'emp-5', employeeName: 'Warehouse William', reviewerId: 'user-2', reviewerName: 'Manager Mike', date: '2025-04-25', rating: 3, comments: 'William is a hard worker but needs to be more careful with handling fragile items. Some breakages reported this quarter.' },
];

export const initialJobRequisitions: JobRequisition[] = [
  {
    id: 'job-1',
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    status: 'open',
    description: 'Looking for an experienced Frontend Developer to build our next-generation user interfaces.',
    requirements: '5+ years of React, TypeScript, and Next.js experience.',
    createdAt: '2025-05-10T00:00:00.000Z',
  },
  {
    id: 'job-2',
    title: 'Product Manager',
    department: 'Product',
    status: 'open',
    description: 'Seeking a talented Product Manager to lead our mobile app development.',
    requirements: 'Experience with agile methodologies and B2C products.',
    createdAt: '2025-05-15T00:00:00.000Z',
  },
  {
    id: 'job-3',
    title: 'Data Analyst',
    department: 'Analytics',
    status: 'on-hold',
    description: 'Data Analyst to help us make sense of our sales and user data.',
    requirements: 'Proficiency in SQL and data visualization tools like Tableau.',
    createdAt: '2025-04-20T00:00:00.000Z',
  },
  {
    id: 'job-4',
    title: 'Barista',
    department: 'Retail',
    status: 'closed',
    description: 'Hiring baristas for our new Northpoint Plaza location.',
    requirements: 'Previous coffee shop experience preferred.',
    createdAt: '2025-03-15T00:00:00.000Z',
  },
   {
    id: 'job-5',
    title: 'Senior Sales Associate',
    department: 'Sales',
    status: 'open',
    description: 'Seeking an experienced sales associate to drive customer engagement and sales.',
    requirements: '3+ years in a retail or sales environment.',
    createdAt: '2025-05-01T00:00:00.000Z',
  },
  {
    id: 'job-6',
    title: 'Barista',
    department: 'Retail',
    status: 'open',
    description: 'Join our team of passionate baristas. Full-time and part-time positions available.',
    requirements: 'Customer service experience is a plus.',
    createdAt: '2025-05-01T00:00:00.000Z',
  }
];

export const initialCandidates: Candidate[] = [
  { id: 'cand-1', name: 'Alicia Keys', email: 'alicia@example.com', phone: '111-222-3333', jobRequisitionId: 'job-5', positionAppliedFor: 'Senior Sales Associate', status: 'interviewing', applicationDate: '2025-04-10', avatar: '', feedback: [{ id: 'fb-1', interviewerId: 'user-2', interviewerName: 'Manager Mike', date: '2025-04-20T00:00:00.000Z', notes: 'Strong candidate with relevant experience. Good communication skills. Follow up on technical skills in next round.', rating: 4 }] },
  { id: 'cand-2', name: 'Ben Carter', email: 'ben@example.com', phone: '222-333-4444', jobRequisitionId: 'job-6', positionAppliedFor: 'Barista', status: 'applied', applicationDate: '2025-04-15', avatar: '', feedback: [] },
  { id: 'cand-3', name: 'Charlie Davis', email: 'charlie@example.com', phone: '333-444-5555', jobRequisitionId: 'job-6', positionAppliedFor: 'Barista', status: 'offer', applicationDate: '2025-04-05', avatar: '', feedback: [] },
  { id: 'cand-4', name: 'Diana Evans', email: 'diana@example.com', phone: '444-555-6666', jobRequisitionId: 'job-2', positionAppliedFor: 'Product Manager', status: 'hired', applicationDate: '2025-03-20', avatar: '', feedback: [] },
  { id: 'cand-5', name: 'Frank Green', email: 'frank@example.com', phone: '555-666-7777', jobRequisitionId: 'job-5', positionAppliedFor: 'Senior Sales Associate', status: 'rejected', applicationDate: '2025-04-12', avatar: '', feedback: [] },
];

export const initialBillsOfMaterials: BillOfMaterials[] = [
  {
    id: 'bom-1',
    productId: 'prod-1',
    productName: 'Espresso Machine',
    items: [
      { componentId: 'prod-15', componentName: 'Casing Unit', quantity: 1 },
      { componentId: 'prod-16', componentName: 'Internal Pump Assembly', quantity: 1 },
    ],
    createdAt: '2025-01-01',
    storeId: 'store-1',
  }
];

export const initialProductionOrders: ProductionOrder[] = [
  {
    id: 'prod-ord-1',
    productId: 'prod-1',
    productName: 'Espresso Machine',
    quantity: 10,
    bomId: 'bom-1',
    status: 'planned',
    scheduledStartDate: '2025-05-20',
    scheduledEndDate: '2025-05-27',
    storeId: 'store-1',
  },
  {
    id: 'prod-ord-2',
    productId: 'prod-1',
    productName: 'Espresso Machine',
    quantity: 5,
    bomId: 'bom-1',
    status: 'in-progress',
    scheduledStartDate: '2025-05-15',
    scheduledEndDate: '2025-05-22',
    actualStartDate: '2025-05-15',
    storeId: 'store-1',
  }
];

export const initialQualityChecks: QualityCheck[] = [];

export const initialLeads: Lead[] = [
    { id: 'lead-1', name: 'Laura Williams', company: 'Innovate Corp', email: 'laura@innovate.com', phone: '123-111-2222', avatar: '', status: 'new', value: 5000, source: 'Website', assignedToId: 'user-2', assignedToName: 'Manager Mike', createdAt: '2025-05-10T00:00:00.000Z', storeId: 'store-1' },
    { id: 'lead-2', name: 'Tom Harris', company: 'Data Solutions', email: 'tom@data.com', phone: '123-222-3333', avatar: '', status: 'contacted', value: 12000, source: 'Referral', assignedToId: 'user-2', assignedToName: 'Manager Mike', createdAt: '2025-05-12T00:00:00.000Z', storeId: 'store-2' },
    { id: 'lead-3', name: 'Grace Lee', company: 'Quantum Tech', email: 'grace@quantum.com', phone: '123-333-4444', avatar: '', status: 'qualified', value: 8500, source: 'Cold Call', assignedToId: 'user-1', assignedToName: 'Admin User', createdAt: '2025-05-14T00:00:00.000Z', storeId: 'store-1' },
    { id: 'lead-4', name: 'Peter Jones', company: 'Global Exports', email: 'peter@global.com', phone: '123-444-5555', avatar: '', status: 'proposal-won', value: 25000, source: 'Trade Show', assignedToId: 'user-1', assignedToName: 'Admin User', createdAt: '2025-05-01T00:00:00.000Z', storeId: 'store-3' },
    { id: 'lead-5', name: 'Olivia Martinez', company: 'Healthful Goods', email: 'olivia@health.com', phone: '123-555-6666', avatar: '', status: 'proposal-lost', value: 3000, source: 'Website', assignedToId: 'user-2', assignedToName: 'Manager Mike', createdAt: '2025-05-05T00:00:00.000Z', storeId: 'store-2' },
];

export const initialCampaigns: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Fall Coffee Promotion',
    description: 'Promote our new fall-themed coffee blends.',
    status: 'active',
    channel: 'email',
    targetAudience: 'Existing customers',
    budget: 500,
    startDate: '2025-09-01',
    endDate: '2025-10-31',
    storeId: 'store-1',
  },
  {
    id: 'camp-2',
    name: 'Holiday Season Special',
    description: 'Special offers and discounts for the holiday season.',
    status: 'planning',
    channel: 'social-media',
    targetAudience: 'New and existing customers',
    budget: 1500,
    startDate: '2025-11-15',
    endDate: '2025-12-31',
    storeId: 'store-2',
  },
  {
    id: 'camp-3',
    name: 'Summer Iced Drinks Launch',
    description: 'Launch event for our new line of iced drinks.',
    status: 'completed',
    channel: 'paid-ads',
    targetAudience: 'Local residents, age 18-35',
    budget: 2000,
    startDate: '2025-06-01',
    endDate: '2025-07-31',
    storeId: 'store-1',
  },
];

export const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Q4 Website Redesign',
    description: 'Complete overhaul of the main company website with a new branding and e-commerce platform.',
    status: 'in-progress',
    managerId: 'emp-2',
    teamIds: ['emp-1', 'emp-2', 'emp-3'],
    startDate: '2025-10-01',
    endDate: '2025-12-20',
    budget: 25000,
    client: 'Marketing Department',
    storeId: 'store-1',
  },
  {
    id: 'proj-2',
    name: 'New Store Opening - Northpoint',
    description: 'Full project plan for launching the new Northpoint Plaza location, from construction to grand opening.',
    status: 'not-started',
    managerId: 'emp-1',
    teamIds: ['emp-1', 'emp-2', 'emp-4', 'emp-5'],
    startDate: '2026-01-15',
    endDate: '2026-05-15',
    budget: 150000,
    client: 'Executive Board',
    storeId: 'store-3',
  },
  {
    id: 'proj-3',
    name: 'Inventory System Audit',
    description: 'Perform a full audit of the physical inventory against the system records for all store locations.',
    status: 'completed',
    managerId: 'emp-4',
    teamIds: ['emp-4', 'emp-5'],
    startDate: '2025-08-01',
    endDate: '2025-09-15',
    budget: 5000,
    client: 'Finance Department',
    storeId: 'store-2',
  },
  {
    id: 'proj-4',
    name: 'Customer Loyalty Program Launch',
    description: 'Develop and launch a new customer loyalty program to increase retention and sales.',
    status: 'in-progress',
    managerId: 'emp-2',
    teamIds: ['emp-1', 'emp-2', 'emp-3'],
    startDate: '2025-09-01',
    endDate: '2025-11-30',
    budget: 15000,
    client: 'Sales Department',
    storeId: 'store-1',
  },
  {
    id: 'proj-5',
    name: 'Supplier Contract Negotiations 2026',
    description: 'Renegotiate contracts with top 5 suppliers to improve terms and reduce costs.',
    status: 'on-hold',
    managerId: 'emp-1',
    teamIds: ['emp-1', 'emp-4'],
    startDate: '2025-11-01',
    endDate: '2026-01-15',
    budget: 2000,
    client: 'Procurement',
    storeId: 'store-1',
  },
  {
    id: 'proj-6',
    name: 'Mobile App Development (Phase 1)',
    description: 'Initial planning and wireframing for a new customer-facing mobile application.',
    status: 'cancelled',
    managerId: 'emp-1',
    teamIds: ['emp-1', 'emp-2'],
    startDate: '2025-07-01',
    endDate: '2025-09-01',
    budget: 50000,
    client: 'IT Department',
    storeId: 'store-1',
  }
];

export const initialTasks: Task[] = [
  // Tasks for Project 1: Website Redesign
  { id: 'task-1', projectId: 'proj-1', title: 'Finalize new logo and branding guidelines', status: 'done', assigneeId: 'emp-1', startDate: '2025-10-01', endDate: '2025-10-10', priority: 'High', cost: 1500 },
  { id: 'task-2', projectId: 'proj-1', title: 'Develop front-end for the new homepage', status: 'in-progress', assigneeId: 'emp-2', startDate: '2025-10-11', endDate: '2025-11-10', priority: 'High', cost: 5000 },
  { id: 'task-3', projectId: 'proj-1', title: 'Set up new e-commerce backend', status: 'todo', assigneeId: 'emp-1', startDate: '2025-11-11', endDate: '2025-11-25', priority: 'Medium', cost: 4000 },
  { id: 'task-10', projectId: 'proj-1', title: 'User acceptance testing', status: 'todo', assigneeId: 'emp-3', startDate: '2025-11-26', endDate: '2025-12-10', priority: 'Medium', cost: 2000 },

  // Tasks for Project 2: New Store Opening
  { id: 'task-4', projectId: 'proj-2', title: 'Secure construction permits', status: 'todo', assigneeId: 'emp-1', startDate: '2026-01-15', endDate: '2026-02-15', priority: 'High', cost: 10000 },
  { id: 'task-5', projectId: 'proj-2', title: 'Hire new staff for Northpoint location', status: 'todo', assigneeId: 'emp-2', startDate: '2026-02-16', endDate: '2026-03-15', priority: 'Medium', cost: 5000 },
  { id: 'task-11', projectId: 'proj-2', title: 'Order initial inventory stock', status: 'todo', assigneeId: 'emp-4', startDate: '2026-03-16', endDate: '2026-03-31', priority: 'High', cost: 40000 },
  { id: 'task-12', projectId: 'proj-2', title: 'Plan grand opening event', status: 'todo', assigneeId: 'emp-2', startDate: '2026-04-01', endDate: '2026-04-15', priority: 'Medium', cost: 7500 },


  // Tasks for Project 3: Inventory Audit
  { id: 'task-6', projectId: 'proj-3', title: 'Conduct physical stock count at Downtown Central', status: 'done', assigneeId: 'emp-4', startDate: '2025-08-01', endDate: '2025-08-10', priority: 'Low', cost: 800 },
  { id: 'task-7', projectId: 'proj-3', title: 'Conduct physical stock count at Westside Mall', status: 'done', assigneeId: 'emp-4', startDate: '2025-08-11', endDate: '2025-08-20', priority: 'Low', cost: 800 },
  { id: 'task-8', projectId: 'proj-3', title: 'Reconcile discrepancies and submit final report', status: 'done', assigneeId: 'emp-4', startDate: '2025-08-21', endDate: '2025-09-15', priority: 'Medium', cost: 1200 },
  { id: 'task-13', projectId: 'proj-3', title: 'Archive audit documentation', status: 'done', assigneeId: 'emp-5', startDate: '2025-09-14', endDate: '2025-09-15', priority: 'Low', cost: 200 },

  // Tasks for Project 4: Loyalty Program
  { id: 'task-14', projectId: 'proj-4', title: 'Define program tiers and rewards', status: 'done', assigneeId: 'emp-2', startDate: '2025-09-01', endDate: '2025-09-15', priority: 'High', cost: 2500 },
  { id: 'task-15', projectId: 'proj-4', title: 'Integrate loyalty logic into POS', status: 'in-progress', assigneeId: 'emp-1', startDate: '2025-09-16', endDate: '2025-10-15', priority: 'High', cost: 6000 },
  { id: 'task-16', projectId: 'proj-4', title: 'Create marketing materials', status: 'todo', assigneeId: 'emp-3', startDate: '2025-10-01', endDate: '2025-10-30', priority: 'Medium', cost: 1500 },

  // Tasks for Project 5: Supplier Negotiations
  { id: 'task-17', projectId: 'proj-5', title: 'Review current supplier performance', status: 'in-progress', assigneeId: 'emp-4', startDate: '2025-11-01', endDate: '2025-11-20', priority: 'High', cost: 500 },
  { id: 'task-18', projectId: 'proj-5', title: 'Schedule meetings with vendors', status: 'todo', assigneeId: 'emp-1', startDate: '2025-11-21', endDate: '2025-12-05', priority: 'Medium', cost: 250 },
];

export const initialTickets: Ticket[] = [
  {
    id: 'ticket-1',
    title: 'Cannot print invoices from Westside Mall',
    description: 'The receipt printer at the Westside Mall location is not responding. We have tried restarting it, but it still does not print any invoices or receipts. This is urgent as we cannot provide customers with physical copies.',
    status: 'open',
    priority: 'urgent',
    category: 'Hardware',
    group: 'IT Support',
    assigneeId: 'user-1',
    assigneeName: 'Admin User',
    reporterId: 'user-3',
    reporterName: 'Cashier Chloe',
    createdAt: '2025-05-18T10:00:00.000Z',
    storeId: 'store-2',
    comments: [
      {
        id: 'comment-1',
        authorId: 'user-1',
        authorName: 'Admin User',
        content: 'I have dispatched a technician. They should be on-site within 2 hours.',
        createdAt: '2025-05-18T10:15:00.000Z',
      }
    ],
  },
  {
    id: 'ticket-2',
    title: 'Product price mismatch for Espresso Machine',
    description: 'The price for the Espresso Machine in the system is showing as $499.99, but the shelf tag says $479.99. Please clarify which is correct and update the system if necessary.',
    status: 'in-progress',
    priority: 'medium',
    category: 'Data Entry',
    group: 'Operations',
    assigneeId: 'user-2',
    assigneeName: 'Manager Mike',
    reporterId: 'user-3',
    reporterName: 'Cashier Chloe',
    createdAt: '2025-05-17T14:30:00.000Z',
    storeId: 'store-1',
    comments: [],
  },
  {
    id: 'ticket-3',
    title: 'Request for new report: Customer Lifetime Value',
    description: 'It would be helpful to have a report that calculates the total amount spent by each customer over their lifetime with us. This would help in identifying our most valuable customers.',
    status: 'open',
    priority: 'low',
    category: 'Feature Request',
    group: 'System Development',
    reporterId: 'user-2',
    reporterName: 'Manager Mike',
    createdAt: '2025-05-16T11:00:00.000Z',
    storeId: 'store-1',
    comments: [],
  },
    {
    id: 'ticket-4',
    title: 'System is slow during peak hours',
    description: 'Between 12 PM and 2 PM, the invoicing page becomes very slow to load. It takes several seconds to add items to a new invoice. It seems to happen every day.',
    status: 'on-hold',
    priority: 'high',
    category: 'Performance',
    group: 'IT Support',
    assigneeId: 'user-1',
    assigneeName: 'Admin User',
    reporterId: 'user-2',
    reporterName: 'Manager Mike',
    createdAt: '2025-05-15T13:00:00.000Z',
    storeId: 'store-2',
    comments: [],
  },
  {
    id: 'ticket-5',
    title: 'Forgot password functionality not working',
    description: 'A user reported that the "Forgot Password" link on the login page does not seem to do anything. Tested and confirmed.',
    status: 'closed',
    priority: 'high',
    category: 'Bug Report',
    group: 'System Development',
    assigneeId: 'user-1',
    assigneeName: 'Admin User',
    reporterId: 'user-1',
    reporterName: 'Admin User',
    createdAt: '2025-05-10T09:00:00.000Z',
    storeId: 'store-1',
    comments: [],
  },
];

export const initialShipments: Shipment[] = [
    {
        id: 'SHIP-1672531200000',
        customId: 'CUST1-ORD1',
        invoiceId: 'INV-001',
        customerId: 'cust-1',
        customerName: 'John Doe',
        trackingNumber: '1Z999AA10123456784',
        status: 'delivered',
        assignedDriverId: 'emp-6',
        assignedDriverName: 'Driver Dan',
        vehicleId: 'asset-1',
        items: [{ productId: 'prod-1', productName: 'Espresso Machine', quantity: 1, price: 499.99, cost: 350.00 }],
        shippingAddress: '123 Shipping Rd, Anytown, USA',
        dispatchDate: '2025-10-25T00:00:00.000Z',
        estimatedDeliveryDate: '2025-10-27T00:00:00.000Z',
        actualDeliveryDate: '2025-10-26T00:00:00.000Z',
    },
    {
        id: 'SHIP-1672617600000',
        invoiceId: 'INV-004',
        customerId: 'cust-1',
        customerName: 'John Doe',
        trackingNumber: '1Z999AA10123456785',
        status: 'in-transit',
        assignedDriverId: 'emp-6',
        assignedDriverName: 'Driver Dan',
        vehicleId: 'asset-5',
        items: [
            { productId: 'prod-4', productName: 'Milk Frother', quantity: 1, price: 75.00, cost: 45.00 },
            { productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 5, price: 22.00, cost: 12.00 }
        ],
        shippingAddress: '456 Oak Ave, Anytown, USA',
        dispatchDate: '2025-10-28T00:00:00.000Z',
        estimatedDeliveryDate: '2025-10-30T00:00:00.000Z',
    },
     {
        id: 'SHIP-1672704000000',
        invoiceId: 'INV-006',
        customerName: 'Walk-in Customer',
        trackingNumber: '1Z999AA10123456786',
        status: 'processing',
        items: [
            { productId: 'prod-3', productName: 'Bag of Premium Coffee Beans (1kg)', quantity: 1, price: 22.00, cost: 12.00 }
        ],
        shippingAddress: '789 Pine Ln, Anytown, USA',
        dispatchDate: '2025-10-29T00:00:00.000Z',
        estimatedDeliveryDate: '2025-11-01T00:00:00.000Z',
    },
     {
        id: 'SHIP-1672790400000',
        invoiceId: 'INV-009',
        customerId: 'cust-8',
        customerName: 'Sarah Black',
        trackingNumber: '1Z999AA10123456787',
        status: 'out-for-delivery',
        assignedDriverId: 'emp-6',
        assignedDriverName: 'Driver Dan',
        vehicleId: 'asset-1',
        items: [
            { productId: 'prod-13', productName: 'Barista Apron', quantity: 1, price: 30.00, cost: 18.00 },
            { productId: 'prod-14', productName: 'Syrup Variety Pack', quantity: 1, price: 18.00, cost: 10.00 }
        ],
        shippingAddress: '555 Shipping Way, Anytown, USA',
        dispatchDate: '2025-11-06T00:00:00.000Z',
        estimatedDeliveryDate: '2025-11-07T00:00:00.000Z',
    },
    {
        id: 'SHIP-1672876800000',
        invoiceId: 'INV-011',
        customerId: 'cust-4',
        customerName: 'Alice Johnson',
        trackingNumber: '1Z999AA10123456788',
        status: 'failed',
        assignedDriverId: 'emp-6',
        assignedDriverName: 'Driver Dan',
        vehicleId: 'asset-5',
        items: [
            { productId: 'prod-1', productName: 'Espresso Machine', quantity: 1, price: 499.99, cost: 350.00 }
        ],
        shippingAddress: '101 Shipping Blvd, Anytown, USA',
        dispatchDate: '2025-11-11T00:00:00.000Z',
        estimatedDeliveryDate: '2025-11-12T00:00:00.000Z',
    },
];

export const initialVehicles: Asset[] = [];

    

    

