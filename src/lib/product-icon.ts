import {
  Package, Wrench, Coffee, Pizza, Shirt, Smartphone, Laptop, Car,
  Wine, Apple, Pill, Scissors, Sparkles, Gift, Book, Dumbbell,
  Hammer, Droplet, Flower2, Cake, Fuel, PawPrint, Baby, Gem,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Curated set of product icons the admin can assign in Inventory, and that the
 * POS falls back to (by matching the product name) when no image is set. Keys
 * are the stable `iconName` stored on Product.iconName.
 */
export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  package: Package, wrench: Wrench, coffee: Coffee, pizza: Pizza,
  shirt: Shirt, phone: Smartphone, laptop: Laptop, car: Car,
  wine: Wine, apple: Apple, pill: Pill, scissors: Scissors,
  sparkles: Sparkles, gift: Gift, book: Book, dumbbell: Dumbbell,
  hammer: Hammer, droplet: Droplet, flower: Flower2, cake: Cake,
  fuel: Fuel, pet: PawPrint, baby: Baby, gem: Gem,
};

// Keyword → icon-name guesses, checked in order against the product name.
const KEYWORDS: [RegExp, string][] = [
  [/coffee|espresso|latte|cappuccino|tea|brew/i, 'coffee'],
  [/pizza|burger|sandwich|meal|food|snack|fries|kitchen/i, 'pizza'],
  [/cake|pastry|dessert|bakery|bread|donut/i, 'cake'],
  [/wine|beer|whisky|vodka|liquor|alcohol|drink|soda|juice|beverage/i, 'wine'],
  [/apple|fruit|vegetable|grocery|produce|organic/i, 'apple'],
  [/shirt|tshirt|jacket|dress|apparel|clothing|wear|jeans|hoodie/i, 'shirt'],
  [/phone|mobile|iphone|android|smartphone|sim/i, 'phone'],
  [/laptop|computer|pc|macbook|notebook/i, 'laptop'],
  [/car|vehicle|auto|tyre|tire|brake|engine|motor/i, 'car'],
  [/fuel|petrol|diesel|gas|oil/i, 'fuel'],
  [/pill|tablet|medicine|drug|pharma|capsule|syrup|vitamin/i, 'pill'],
  [/scissor|haircut|salon|barber|trim|shave|grooming/i, 'scissors'],
  [/spa|facial|massage|beauty|cosmetic|makeup|skincare/i, 'sparkles'],
  [/gift|voucher|hamper|present/i, 'gift'],
  [/book|magazine|novel|stationery|notebook|pen/i, 'book'],
  [/gym|fitness|weight|dumbbell|workout|protein/i, 'dumbbell'],
  [/tool|wrench|repair|service|maintenance|fix|install/i, 'wrench'],
  [/hammer|nail|construction|hardware|timber|cement/i, 'hammer'],
  [/water|bottle|cleaning|detergent|soap|wash|liquid/i, 'droplet'],
  [/flower|plant|garden|bouquet|floral/i, 'flower'],
  [/pet|dog|cat|animal|vet/i, 'pet'],
  [/baby|infant|diaper|toddler|kids/i, 'baby'],
  [/jewel|gold|ring|necklace|diamond|gem/i, 'gem'],
];

/** Resolve the icon-name for a product: an explicit assignment wins, otherwise
 *  guess from the product name, otherwise a generic package. */
export function resolveIconName(name: string | undefined, explicit?: string): string {
  if (explicit && PRODUCT_ICONS[explicit]) return explicit;
  const n = name ?? '';
  for (const [re, icon] of KEYWORDS) if (re.test(n)) return icon;
  return 'package';
}

export function iconFor(name: string | undefined, explicit?: string): LucideIcon {
  return PRODUCT_ICONS[resolveIconName(name, explicit)] ?? Package;
}
