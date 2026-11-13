export type ShopCategory =
  | 'all'
  | 'cloths'
  | 'groceries'
  | 'electronics'
  | 'restaurant'
  | 'household'
  | 'cold_drinks'
  | 'other';

export type BusinessScale = 'small' | 'medium' | 'large';

export type TravelModeType = 'DRIVING' | 'TWO_WHEELER' | 'WALKING' | 'TRANSIT';

export interface PhotoAttribution {
  displayName: string;
  uri?: string;
}

export interface ShopPhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: PhotoAttribution[];
}

export interface GoogleReview {
  authorName: string;
  authorPhotoUri?: string;
  authorUri?: string;
  rating: number;
  relativePublishTimeDescription: string;
  text: string;
}

export interface Shop {
  placeId: string;
  name: string;
  category: Exclude<ShopCategory, 'all'>;
  primaryTypeLabel: string;
  scale: BusinessScale;
  scaleLabel: string;
  shortAddress: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel?: string;
  businessStatus?: string;
  openNow?: boolean | null;
  weekdayDescriptions?: string[];
  phone?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  directionsUri?: string;
  editorialSummary?: string;
  reviewSummary?: string;
  photos: ShopPhoto[];
  reviews: GoogleReview[];
  distanceKm?: number;
  etaText?: string;
}

export interface ShopOwnerProfile {
  placeId: string;
  ownerUid: string;
  ownerName: string;
  businessName: string;
  category: Exclude<ShopCategory, 'all'>;
  businessScale: BusinessScale;
  city: string;
  locality: string;
  goodsSummary: string;
  deliveryAvailable: boolean;
  yearsInBusiness: number;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommunityReview {
  reviewId: string;
  placeId: string;
  authorUid: string;
  authorName: string;
  rating: number;
  comment: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  preferredCity: string;
  preferredTravelMode: TravelModeType;
  accountRole: 'shopper' | 'owner';
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FavoriteShop {
  userId: string;
  placeId: string;
  shopName: string;
  category: Exclude<ShopCategory, 'all'>;
  scale: BusinessScale;
  shortAddress: string;
  lat: number;
  lng: number;
  note?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IndianCityPreset {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export interface RouteStep {
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
  durationText: string;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
}

export interface ComputedRouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  optimizedOrder?: number[];
  steps: RouteStep[];
  orderedStopPlaceIds: string[];
}
