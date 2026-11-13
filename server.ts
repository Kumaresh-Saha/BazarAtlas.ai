import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAPS_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

function getMapsApiKey(): string {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

type ShopCategoryKey =
  | 'cloths'
  | 'groceries'
  | 'electronics'
  | 'restaurant'
  | 'household'
  | 'cold_drinks'
  | 'other';

type ScaleKey = 'small' | 'medium' | 'large';

const CATEGORY_QUERIES: Record<string, string> = {
  all: 'retail shops kirana clothing electronics restaurant household cold drinks',
  cloths: 'clothing store saree garment shop textile',
  groceries: 'grocery store kirana general store supermarket',
  electronics: 'electronics store mobile shop appliances electricals',
  restaurant: 'restaurant dhaba sweet shop eatery',
  household: 'household items utensils kitchenware hardware store',
  cold_drinks: 'cold drinks beverage shop juice corner dairy',
};

const PLACE_SEARCH_FIELDMASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.businessStatus',
  'places.currentOpeningHours',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.googleMapsLinks',
  'places.photos',
  'places.reviews',
  'places.editorialSummary',
  'routingSummaries',
  'nextPageToken',
].join(',');

const PLACE_DETAILS_FIELDMASK = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'location',
  'types',
  'primaryType',
  'primaryTypeDisplayName',
  'rating',
  'userRatingCount',
  'priceLevel',
  'businessStatus',
  'currentOpeningHours',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'googleMapsLinks',
  'photos',
  'reviews',
  'editorialSummary',
  'reviewSummary',
].join(',');

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function classifyCategory(
  types: string[] = [],
  primaryType = '',
  name = '',
  requestedCategory = 'all'
): ShopCategoryKey {
  if (requestedCategory && requestedCategory !== 'all') {
    return requestedCategory as ShopCategoryKey;
  }

  const hay = `${primaryType} ${types.join(' ')} ${name}`.toLowerCase();
  if (/(clothing|apparel|saree|garment|textile|tailor|shoe|boutique|fashion)/.test(hay)) {
    return 'cloths';
  }
  if (/(juice|beverage|cold_drink|cold drink|soda|lassi|milk|dairy|ice_cream|tea|coffee)/.test(hay)) {
    return 'cold_drinks';
  }
  if (/(grocery|supermarket|kirana|convenience|provision|produce|vegetable|fruit|market)/.test(hay)) {
    return 'groceries';
  }
  if (/(electronic|mobile|cell_phone|computer|appliance|laptop|camera|tv|electrical)/.test(hay)) {
    return 'electronics';
  }
  if (/(restaurant|food|meal|dhaba|cafe|bakery|sweet|mithai|biryani|fast_food)/.test(hay)) {
    return 'restaurant';
  }
  if (/(home_goods|hardware|furniture|utensil|kitchen|houseware|department_store|variety)/.test(hay)) {
    return 'household';
  }
  return 'other';
}

function inferScale(place: Record<string, unknown>): { scale: ScaleKey; scaleLabel: string } {
  const types = Array.isArray(place.types) ? (place.types as string[]) : [];
  const priceLevel = String(place.priceLevel || '');
  const ratingCount = Number(place.userRatingCount || 0);
  const name = String((place.displayName as { text?: string } | undefined)?.text || '').toLowerCase();

  const isLargeKeyword =
    types.includes('shopping_mall') ||
    types.includes('department_store') ||
    types.includes('wholesaler') ||
    /(emporium|mall|megamart|mart|bazaar|hypermarket|wholesale|enterprise|showroom|reliance|dmart|tata|croma|tanishq)/.test(
      name
    );

  if (
    isLargeKeyword ||
    priceLevel === 'PRICE_LEVEL_EXPENSIVE' ||
    priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE' ||
    ratingCount >= 600
  ) {
    return { scale: 'large', scaleLabel: 'Big Business / Showroom' };
  }

  if (priceLevel === 'PRICE_LEVEL_MODERATE' || ratingCount >= 80 || types.includes('supermarket')) {
    return { scale: 'medium', scaleLabel: 'Medium Retailer' };
  }

  return { scale: 'small', scaleLabel: 'Small Shopkeeper' };
}

function formatDurationSeconds(secStr?: string): string | undefined {
  if (!secStr) return undefined;
  const seconds = parseInt(secStr.replace('s', ''), 10);
  if (Number.isNaN(seconds)) return undefined;
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

function normalizePlace(
  place: Record<string, unknown>,
  routingSummary: Record<string, unknown> | undefined,
  originLat: number,
  originLng: number,
  requestedCategory: string
) {
  const loc = (place.location as { latitude?: number; longitude?: number } | undefined) || {};
  const lat = Number(loc.latitude || originLat);
  const lng = Number(loc.longitude || originLng);
  const name = String((place.displayName as { text?: string } | undefined)?.text || 'Local Indian Shop');
  const types = Array.isArray(place.types) ? (place.types as string[]) : [];
  const primaryType = String(place.primaryType || '');
  const category = classifyCategory(types, primaryType, name, requestedCategory);
  const { scale, scaleLabel } = inferScale(place);

  const leg = Array.isArray(routingSummary?.legs)
    ? (routingSummary.legs[0] as { distanceMeters?: number; duration?: string } | undefined)
    : undefined;

  const distanceKm =
    typeof leg?.distanceMeters === 'number'
      ? Math.round((leg.distanceMeters / 1000) * 100) / 100
      : haversineKm(originLat, originLng, lat, lng);

  const etaText = formatDurationSeconds(leg?.duration);

  const rawPhotos = Array.isArray(place.photos)
    ? (place.photos as Array<Record<string, unknown>>).slice(0, 6).map((p) => ({
        name: String(p.name || ''),
        widthPx: typeof p.widthPx === 'number' ? p.widthPx : undefined,
        heightPx: typeof p.heightPx === 'number' ? p.heightPx : undefined,
        authorAttributions: Array.isArray(p.authorAttributions)
          ? (p.authorAttributions as Array<Record<string, unknown>>).map((a) => ({
              displayName: String(a.displayName || 'Google Maps Contributor'),
              uri: typeof a.uri === 'string' ? a.uri : undefined,
            }))
          : [],
      }))
    : [];

  const rawReviews = Array.isArray(place.reviews)
    ? (place.reviews as Array<Record<string, unknown>>).map((r) => {
        const author = (r.authorAttribution as Record<string, unknown> | undefined) || {};
        const textObj = (r.text as Record<string, unknown> | undefined) ||
          (r.originalText as Record<string, unknown> | undefined) || {};
        return {
          authorName: String(author.displayName || 'Google Customer'),
          authorPhotoUri: typeof author.photoUri === 'string' ? author.photoUri : undefined,
          authorUri: typeof author.uri === 'string' ? author.uri : undefined,
          rating: Number(r.rating || 0),
          relativePublishTimeDescription: String(r.relativePublishTimeDescription || ''),
          text: String(textObj.text || ''),
        };
      })
    : [];

  const openingHours = place.currentOpeningHours as
    | { openNow?: boolean; weekdayDescriptions?: string[] }
    | undefined;
  const links = place.googleMapsLinks as { directionsUri?: string } | undefined;

  return {
    placeId: String(place.id || ''),
    name,
    category,
    primaryTypeLabel: String(
      (place.primaryTypeDisplayName as { text?: string } | undefined)?.text ||
        primaryType.replace(/_/g, ' ') ||
        'Local Store'
    ),
    scale,
    scaleLabel,
    shortAddress: String(place.shortFormattedAddress || place.formattedAddress || 'India'),
    formattedAddress: String(place.formattedAddress || place.shortFormattedAddress || 'India'),
    lat,
    lng,
    rating: typeof place.rating === 'number' ? place.rating : null,
    userRatingCount: Number(place.userRatingCount || 0),
    priceLevel: typeof place.priceLevel === 'string' ? place.priceLevel : undefined,
    businessStatus: typeof place.businessStatus === 'string' ? place.businessStatus : undefined,
    openNow: typeof openingHours?.openNow === 'boolean' ? openingHours.openNow : null,
    weekdayDescriptions: Array.isArray(openingHours?.weekdayDescriptions)
      ? openingHours.weekdayDescriptions
      : undefined,
    phone: String(place.nationalPhoneNumber || place.internationalPhoneNumber || '') || undefined,
    websiteUri: typeof place.websiteUri === 'string' ? place.websiteUri : undefined,
    googleMapsUri: typeof place.googleMapsUri === 'string' ? place.googleMapsUri : undefined,
    directionsUri: typeof links?.directionsUri === 'string' ? links.directionsUri : undefined,
    editorialSummary:
      typeof (place.editorialSummary as { text?: string } | undefined)?.text === 'string'
        ? (place.editorialSummary as { text: string }).text
        : undefined,
    reviewSummary:
      typeof (place.reviewSummary as { text?: { text?: string } } | undefined)?.text?.text === 'string'
        ? (place.reviewSummary as { text: { text: string } }).text.text
        : undefined,
    photos: rawPhotos,
    reviews: rawReviews,
    distanceKm,
    etaText,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Expose Maps API key cleanly for browser SDK initialization
  app.get('/api/config/maps', (_req, res) => {
    const apiKey = getMapsApiKey();
    res.json({ apiKey });
  });

  // Google Places API (New) Shop Collector
  app.post('/api/shops/collect', async (req, res) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'MAPS_KEY_MISSING',
        message: 'Google Maps API key is not configured yet.',
      });
      return;
    }

    const {
      query = '',
      category = 'all',
      city = 'New Delhi',
      lat = 28.6315,
      lng = 77.2167,
      radiusMeters = 8000,
      openNow = false,
      pageToken,
    } = req.body as {
      query?: string;
      category?: string;
      city?: string;
      lat?: number;
      lng?: number;
      radiusMeters?: number;
      openNow?: boolean;
      pageToken?: string;
    };

    const trimmedQuery = query.trim();
    const catKeywords = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.all;
    const textQuery = trimmedQuery
      ? `${trimmedQuery}${category !== 'all' ? ` ${catKeywords.split(' ').slice(0, 2).join(' ')}` : ''} India`
      : `${catKeywords} in ${city}, India`;

    const bodyPayload: Record<string, unknown> = {
      textQuery,
      languageCode: 'en',
      regionCode: 'in',
      pageSize: 16,
      locationBias: {
        circle: {
          center: { latitude: Number(lat), longitude: Number(lng) },
          radius: Math.min(Math.max(Number(radiusMeters) || 8000, 1000), 45000),
        },
      },
      routingParameters: {
        origin: { latitude: Number(lat), longitude: Number(lng) },
      },
    };

    if (openNow) {
      bodyPayload.openNow = true;
    }
    if (pageToken) {
      bodyPayload.pageToken = pageToken;
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': PLACE_SEARCH_FIELDMASK,
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = (await response.json()) as {
        places?: Array<Record<string, unknown>>;
        routingSummaries?: Array<Record<string, unknown>>;
        nextPageToken?: string;
        error?: { status?: string; message?: string; code?: number };
      };

      if (!response.ok) {
        const isQuota =
          response.status === 429 ||
          data.error?.status === 'RESOURCE_EXHAUSTED' ||
          String(data.error?.message || '').toLowerCase().includes('quota');

        res.status(isQuota ? 429 : response.status).json({
          error: isQuota ? 'RESOURCE_EXHAUSTED' : data.error?.status || 'PLACES_ERROR',
          message: data.error?.message || 'Failed to collect shops from Google Places.',
        });
        return;
      }

      const rawPlaces = Array.isArray(data.places) ? data.places : [];
      const summaries = Array.isArray(data.routingSummaries) ? data.routingSummaries : [];

      const shops = rawPlaces.map((p, idx) =>
        normalizePlace(p, summaries[idx], Number(lat), Number(lng), category)
      );

      res.json({
        shops,
        nextPageToken: data.nextPageToken || null,
        queryUsed: textQuery,
      });
    } catch (error) {
      res.status(500).json({
        error: 'COLLECTOR_FAILED',
        message: error instanceof Error ? error.message : 'Unable to reach Google Places API.',
      });
    }
  });

  // Live Place Details endpoint (hydrates saved favorites / details view)
  app.get('/api/shops/details/:placeId', async (req, res) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({ error: 'MAPS_KEY_MISSING', message: 'Maps API key unavailable.' });
      return;
    }

    const placeId = req.params.placeId;
    const originLat = Number(req.query.lat) || 28.6315;
    const originLng = Number(req.query.lng) || 77.2167;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=in`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': PLACE_DETAILS_FIELDMASK,
            'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
          },
        }
      );

      const data = (await response.json()) as Record<string, unknown> & {
        error?: { status?: string; message?: string };
      };

      if (!response.ok) {
        const isQuota =
          response.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED';
        res.status(isQuota ? 429 : response.status).json({
          error: isQuota ? 'RESOURCE_EXHAUSTED' : 'DETAILS_ERROR',
          message: data.error?.message || 'Failed to fetch place details.',
        });
        return;
      }

      const shop = normalizePlace(data, undefined, originLat, originLng, 'all');
      res.json({ shop });
    } catch (error) {
      res.status(500).json({
        error: 'DETAILS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch place details.',
      });
    }
  });

  // Google Place Photo (New) proxy endpoint — streams real Google shop photos securely
  app.get('/api/places/photo', async (req, res) => {
    const apiKey = getMapsApiKey();
    const photoName = String(req.query.name || '');
    const maxWidthPx = Math.min(Math.max(Number(req.query.maxWidthPx) || 800, 100), 1600);
    const maxHeightPx = Math.min(Math.max(Number(req.query.maxHeightPx) || 600, 100), 1600);

    if (!apiKey || !photoName.startsWith('places/')) {
      res.status(400).json({ error: 'INVALID_PHOTO_REQUEST' });
      return;
    }

    try {
      const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;
      const response = await fetch(mediaUrl, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        res.status(response.status).end();
        return;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.send(buffer);
    } catch {
      res.status(502).end();
    }
  });

  // Google Routes API v2 Multi-Stop Optimizer & Turn-by-Turn Navigation Proxy
  app.post('/api/routes/optimize', async (req, res) => {
    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({ error: 'MAPS_KEY_MISSING', message: 'Maps API key unavailable.' });
      return;
    }

    const {
      origin,
      destination,
      intermediates = [],
      travelMode = 'DRIVING',
    } = req.body as {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      intermediates?: Array<{ lat: number; lng: number; placeId?: string }>;
      travelMode?: string;
    };

    const restTravelModeMap: Record<string, string> = {
      DRIVING: 'DRIVE',
      TWO_WHEELER: 'TWO_WHEELER',
      WALKING: 'WALK',
      TRANSIT: 'TRANSIT',
    };
    const restMode = restTravelModeMap[travelMode] || 'DRIVE';
    const supportsTraffic = restMode === 'DRIVE' || restMode === 'TWO_WHEELER';

    const requestBody: Record<string, unknown> = {
      origin: {
        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode: restMode,
      languageCode: 'en-IN',
      units: 'METRIC',
    };

    if (supportsTraffic) {
      requestBody.routingPreference = 'TRAFFIC_AWARE';
    }

    if (intermediates.length > 0 && restMode !== 'TRANSIT') {
      requestBody.intermediates = intermediates.map((wp) => ({
        location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
      }));
      requestBody.optimizeWaypointOrder = true;
    }

    const fieldMask = [
      'routes.duration',
      'routes.distanceMeters',
      'routes.polyline.encodedPolyline',
      'routes.optimizedIntermediateWaypointIndex',
      'routes.legs.duration',
      'routes.legs.distanceMeters',
      'routes.legs.steps.navigationInstruction',
      'routes.legs.steps.distanceMeters',
      'routes.legs.steps.staticDuration',
      'routes.legs.steps.startLocation',
      'routes.legs.steps.endLocation',
    ].join(',');

    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as {
        routes?: Array<{
          duration?: string;
          distanceMeters?: number;
          polyline?: { encodedPolyline?: string };
          optimizedIntermediateWaypointIndex?: number[];
          legs?: Array<{
            steps?: Array<{
              navigationInstruction?: { instructions?: string; maneuver?: string };
              distanceMeters?: number;
              staticDuration?: string;
              startLocation?: { latLng?: { latitude?: number; longitude?: number } };
              endLocation?: { latLng?: { latitude?: number; longitude?: number } };
            }>;
          }>;
        }>;
        error?: { status?: string; message?: string };
      };

      if (!response.ok) {
        const isQuota =
          response.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED';
        res.status(isQuota ? 429 : response.status).json({
          error: isQuota ? 'RESOURCE_EXHAUSTED' : data.error?.status || 'ROUTES_ERROR',
          message: data.error?.message || 'Unable to compute optimized route.',
        });
        return;
      }

      const route = data.routes?.[0];
      if (!route) {
        res.status(404).json({ error: 'NO_ROUTE', message: 'No drivable route found between these points.' });
        return;
      }

      const durationSeconds = parseInt(String(route.duration || '0s').replace('s', ''), 10) || 0;
      const steps = (route.legs || []).flatMap((leg) =>
        (leg.steps || []).map((step) => ({
          instruction: step.navigationInstruction?.instructions || 'Continue straight',
          maneuver: step.navigationInstruction?.maneuver,
          distanceMeters: step.distanceMeters || 0,
          durationText: formatDurationSeconds(step.staticDuration) || '1 min',
          startLocation: step.startLocation?.latLng
            ? {
                lat: Number(step.startLocation.latLng.latitude),
                lng: Number(step.startLocation.latLng.longitude),
              }
            : undefined,
          endLocation: step.endLocation?.latLng
            ? {
                lat: Number(step.endLocation.latLng.latitude),
                lng: Number(step.endLocation.latLng.longitude),
              }
            : undefined,
        }))
      );

      res.json({
        distanceMeters: route.distanceMeters || 0,
        durationSeconds,
        encodedPolyline: route.polyline?.encodedPolyline || '',
        optimizedOrder: route.optimizedIntermediateWaypointIndex,
        steps,
      });
    } catch (error) {
      res.status(500).json({
        error: 'ROUTE_FAILED',
        message: error instanceof Error ? error.message : 'Route calculation failed.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BazaarAtlas server running on http://localhost:${PORT}`);
  });
}

void startServer();
