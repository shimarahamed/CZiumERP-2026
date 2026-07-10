'use client';

import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, deleteDoc, writeBatch, collection } from 'firebase/firestore';
import type {
  Tenant, RegistrationRequest, IndustryTemplate, Module,
  VerticalBlueprint, CustomFieldSeed, CustomFieldDefinition,
} from '@/types';

// Every real, toggleable module — 'Testing' is excluded on purpose, it's a
// dev-only nav category (see Nav.tsx) and was never meant to gate tenant data.
export const ALL_MODULES: Module[] = ['General', 'Sales & Customers', 'Supply Chain', 'Shipping & Logistics', 'Manufacturing', 'Project Management', 'Finance', 'Human Resources', 'Service Desk', 'System'];

/**
 * Legacy industry → module bundles. Retained so tenants and registration
 * requests created before the blueprint engine still resolve to a module set.
 * New onboarding goes through VerticalBlueprint documents instead.
 */
export const INDUSTRY_TEMPLATES: Record<IndustryTemplate, Module[]> = {
  retail: ['General', 'Sales & Customers', 'Supply Chain', 'Finance', 'System'],
  manufacturing: ALL_MODULES,
  services: ['General', 'Sales & Customers', 'Finance', 'Human Resources', 'System'],
  distribution: ['General', 'Sales & Customers', 'Supply Chain', 'Finance', 'Shipping & Logistics', 'System'],
  general: ALL_MODULES,
};

/**
 * Built-in blueprints seeded on first run via seedBlueprints(). These are just
 * starting points — super admins can edit them, add new verticals (e.g. a
 * dental clinic), or delete them entirely from /super-admin/blueprints without
 * a code deploy. Each carries its own modules, seed fields, and labels; the
 * garage example below shows a vertical that needs both custom fields on
 * common entities AND renamed labels.
 */
export const DEFAULT_BLUEPRINTS: VerticalBlueprint[] = [
  {
    id: 'retail',
    name: 'Retail / POS',
    description: 'Storefront sales, inventory, and light accounting.',
    modules: INDUSTRY_TEMPLATES.retail,
    isActive: true,
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Full stack including production, BOM, and operations.',
    modules: INDUSTRY_TEMPLATES.manufacturing,
    isActive: true,
  },
  {
    id: 'services',
    name: 'Professional services',
    description: 'Client work, invoicing, and HR — no physical inventory.',
    modules: INDUSTRY_TEMPLATES.services,
    isActive: true,
  },
  {
    id: 'distribution',
    name: 'Distribution',
    description: 'Warehousing, logistics, and wholesale fulfilment.',
    modules: INDUSTRY_TEMPLATES.distribution,
    isActive: true,
  },
  {
    id: 'garage',
    name: 'Auto Garage',
    description: 'Vehicle service shop — parts, job cards, and odometer tracking.',
    modules: INDUSTRY_TEMPLATES.retail,
    labelOverrides: { Product: 'Part', Invoice: 'Job Card' },
    seedFields: [
      { entity: 'customer', key: 'vehicleMake', label: 'Vehicle make', fieldType: 'text', order: 1 },
      { entity: 'customer', key: 'vehicleModel', label: 'Vehicle model', fieldType: 'text', order: 2 },
      { entity: 'customer', key: 'licensePlate', label: 'License plate', fieldType: 'text', order: 3 },
      { entity: 'customer', key: 'vin', label: 'VIN', fieldType: 'text', order: 4 },
      { entity: 'invoice', key: 'odometerKm', label: 'Odometer (km)', fieldType: 'number', order: 1 },
    ],
    isActive: true,
  },
  {
    id: 'general',
    name: 'General (all modules)',
    description: 'Everything switched on — a blank slate to configure.',
    modules: INDUSTRY_TEMPLATES.general,
    isActive: true,
  },
];

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Idempotently write the built-in blueprints. Safe to call repeatedly — merges
 * so a super admin's edits to a default blueprint's fields aren't clobbered on
 * a re-seed (only missing keys are filled). Used by the blueprints page to
 * bootstrap a fresh deployment.
 */
export async function seedBlueprints(): Promise<void> {
  const batch = writeBatch(db);
  for (const bp of DEFAULT_BLUEPRINTS) {
    batch.set(doc(db, 'verticalBlueprints', bp.id), {
      ...bp,
      createdAt: bp.createdAt ?? new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function saveBlueprint(bp: VerticalBlueprint): Promise<void> {
  const { id, ...rest } = bp;
  await setDoc(doc(db, 'verticalBlueprints', id), {
    ...rest,
    createdAt: bp.createdAt ?? new Date().toISOString(),
  }, { merge: true });
}

export async function deleteBlueprint(id: string): Promise<void> {
  await deleteDoc(doc(db, 'verticalBlueprints', id));
}

/**
 * Create a tenant workspace from a blueprint: tenant root doc, tenantDirectory
 * entry, the settings/app doc (branding + label overrides + module nav), and
 * the blueprint's seed custom fields copied into the tenant's
 * customFieldDefinitions. When approving a registration request, pass it so its
 * status flips too.
 */
export async function createTenantWorkspace(input: {
  slug: string;
  displayName: string;
  blueprint: VerticalBlueprint;
  /** Optional override of the blueprint's module set (super-admin adjustment). */
  modules?: Module[];
  fromRequest?: RegistrationRequest;
}): Promise<Tenant> {
  const { slug, displayName, blueprint, fromRequest } = input;
  const modules = input.modules ?? blueprint.modules;
  const tenant: Tenant = {
    id: slug,
    name: displayName,
    status: 'active',
    blueprintId: blueprint.id,
    allowedModules: modules,
    enabledModules: modules,
    createdAt: new Date().toISOString(),
    plan: 'standard',
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'tenants', slug), tenant);
  batch.set(doc(db, 'tenantDirectory', slug), { name: displayName, status: 'active', plan: 'standard' });
  const disabled = ALL_MODULES.filter(m => !tenant.enabledModules.includes(m));
  batch.set(doc(db, 'tenants', slug, 'settings', 'app'), {
    themeSettings: {
      appName: displayName,
      logoUrl: '',
      // Real default HSL values — an empty string here previously crashed the
      // Settings page's color pickers (hslToHex on a non-numeric string).
      primaryColor: '231 48% 48%',
      backgroundColor: '220 17% 95%',
      accentColor: '187 100% 15%',
      disabledModules: disabled,
    },
    labelOverrides: blueprint.labelOverrides ?? {},
  }, { merge: true });

  // Seed the blueprint's custom fields into the tenant.
  (blueprint.seedFields ?? []).forEach((seed: CustomFieldSeed, i) => {
    const ref = doc(collection(db, 'tenants', slug, 'customFieldDefinitions'));
    const def: Omit<CustomFieldDefinition, 'id'> = {
      ...seed,
      order: seed.order ?? i,
      seededBy: blueprint.id,
      createdAt: new Date().toISOString(),
    };
    batch.set(ref, def);
  });

  if (fromRequest) {
    batch.update(doc(db, 'registrationRequests', fromRequest.id), { status: 'approved' });
  }
  await batch.commit();
  return tenant;
}

export async function setTenantStatus(tenant: Tenant, status: 'active' | 'suspended'): Promise<void> {
  await Promise.all([
    updateDoc(doc(db, 'tenants', tenant.id), { status }),
    setDoc(doc(db, 'tenantDirectory', tenant.id), { name: tenant.name, status, plan: tenant.plan ?? 'standard' }, { merge: true }),
  ]);
}

export async function rejectRegistrationRequest(request: RegistrationRequest): Promise<void> {
  await updateDoc(doc(db, 'registrationRequests', request.id), { status: 'rejected' });
}
