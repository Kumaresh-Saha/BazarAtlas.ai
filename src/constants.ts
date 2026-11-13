import { BusinessScale, IndianCityPreset, ShopCategory, TravelModeType } from './types';

export const CATEGORY_CONFIG: Array<{
  id: ShopCategory;
  label: string;
  shortLabel: string;
  queryKeywords: string;
  pinColor: string;
}> = [
  {
    id: 'all',
    label: 'All Shops',
    shortLabel: 'All',
    queryKeywords: 'retail shops kirana clothing electronics restaurant household cold drinks',
    pinColor: '#059669',
  },
  {
    id: 'cloths',
    label: 'Cloths & Apparel',
    shortLabel: 'Cloths',
    queryKeywords: 'clothing store saree garment shop boutique tailor',
    pinColor: '#7C3AED',
  },
  {
    id: 'groceries',
    label: 'Groceries & Kirana',
    shortLabel: 'Groceries',
    queryKeywords: 'grocery store kirana general store supermarket',
    pinColor: '#059669',
  },
  {
    id: 'electronics',
    label: 'Electronics',
    shortLabel: 'Electronics',
    queryKeywords: 'electronics store mobile shop appliances electricals',
    pinColor: '#2563EB',
  },
  {
    id: 'restaurant',
    label: 'Restaurants',
    shortLabel: 'Restaurants',
    queryKeywords: 'restaurant eatery dhaba tiffin sweet shop cafe',
    pinColor: '#D97706',
  },
  {
    id: 'household',
    label: 'Household Items',
    shortLabel: 'Household',
    queryKeywords: 'household goods kitchenware utensils hardware plastic store',
    pinColor: '#0D9488',
  },
  {
    id: 'cold_drinks',
    label: 'Cold Drinks & Beverages',
    shortLabel: 'Cold Drinks',
    queryKeywords: 'cold drinks beverage shop juice corner dairy parlour soft drinks',
    pinColor: '#0284C7',
  },
];

export const CATEGORY_LABELS: Record<Exclude<ShopCategory, 'all'>, string> = {
  cloths: 'Cloths & Apparel',
  groceries: 'Groceries & Kirana',
  electronics: 'Electronics',
  restaurant: 'Restaurant',
  household: 'Household Items',
  cold_drinks: 'Cold Drinks',
  other: 'General Retail',
};

export const SCALE_LABELS: Record<BusinessScale, string> = {
  small: 'Small Shopkeeper',
  medium: 'Medium Retailer',
  large: 'Big Business / Showroom',
};

export const INDIAN_CITIES: IndianCityPreset[] = [
  { id: 'delhi', name: 'New Delhi', state: 'Delhi NCR', lat: 28.6315, lng: 77.2167 },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.0176, lng: 72.8562 },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0418, lng: 80.2341 },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867 },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
];

export const TRAVEL_MODE_OPTIONS: Array<{ id: TravelModeType; label: string }> = [
  { id: 'DRIVING', label: 'Car / Auto' },
  { id: 'TWO_WHEELER', label: 'Two-Wheeler' },
  { id: 'WALKING', label: 'Walk' },
  { id: 'TRANSIT', label: 'Transit' },
];

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
