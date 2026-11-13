import { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { INDIAN_CITIES, haversineKm } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ActiveTab, Navbar } from './components/Navbar';
import { QuotaBanner } from './components/QuotaBanner';
import { CollectorToolbar } from './components/CollectorToolbar';
import { ShopTable, SortField } from './components/ShopTable';
import { ShopMapPanel } from './components/ShopMapPanel';
import { ShopDetailDrawer } from './components/ShopDetailDrawer';
import { FavoritesView } from './components/FavoritesView';
import { ListShopView } from './components/ListShopView';
import { ProfileModal } from './components/ProfileModal';
import {
  BusinessScale,
  ComputedRouteInfo,
  Shop,
  ShopCategory,
  TravelModeType,
} from './types';

function BazaarAtlasShell() {
  const {
    profile,
    favoriteIds,
    shopOwners,
    toggleFavorite,
    authError,
    clearAuthError,
    signInWithGoogle,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');
  const [profileOpen, setProfileOpen] = useState(false);

  // Location & Collector State
  const [selectedCityId, setSelectedCityId] = useState('delhi');
  const [origin, setOrigin] = useState<{ lat: number; lng: number; label: string }>(
    () => ({
      lat: INDIAN_CITIES[0].lat,
      lng: INDIAN_CITIES[0].lng,
      label: `${INDIAN_CITIES[0].name}, ${INDIAN_CITIES[0].state}`,
    })
  );
  const [isUsingGps, setIsUsingGps] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShopCategory>('all');
  const [scaleFilter, setScaleFilter] = useState<BusinessScale | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('distance');

  // Collected Shops Data
  const [shops, setShops] = useState<Shop[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  // Selection, Drawer & Route State
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [drawerShop, setDrawerShop] = useState<Shop | null>(null);
  const [routeStops, setRouteStops] = useState<Shop[]>([]);
  const [travelMode, setTravelMode] = useState<TravelModeType>('DRIVING');
  const [activeRoute, setActiveRoute] = useState<ComputedRouteInfo | null>(null);
  const [triggerComputeCount, setTriggerComputeCount] = useState(0);

  // Sync user's saved travel mode & preferred city on first profile load
  const [appliedProfileDefaults, setAppliedProfileDefaults] = useState(false);
  useEffect(() => {
    if (profile && !appliedProfileDefaults) {
      if (profile.preferredTravelMode) {
        setTravelMode(profile.preferredTravelMode);
      }
      const matchedCity = INDIAN_CITIES.find(
        (c) => c.name.toLowerCase() === profile.preferredCity?.toLowerCase()
      );
      if (matchedCity && !isUsingGps) {
        setSelectedCityId(matchedCity.id);
        setOrigin({
          lat: matchedCity.lat,
          lng: matchedCity.lng,
          label: `${matchedCity.name}, ${matchedCity.state}`,
        });
      }
      setAppliedProfileDefaults(true);
    }
  }, [profile, appliedProfileDefaults, isUsingGps]);

  const collectShops = useCallback(
    async (opts?: {
      overrideQuery?: string;
      overrideOrigin?: { lat: number; lng: number; label: string };
      overrideCategory?: ShopCategory;
      appendPageToken?: string;
    }) => {
      const targetOrigin = opts?.overrideOrigin || origin;
      const targetCategory = opts?.overrideCategory ?? category;
      const targetQuery = opts?.overrideQuery !== undefined ? opts.overrideQuery : query;

      setIsCollecting(true);
      setCollectError(null);

      try {
        const res = await fetch('/api/shops/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: targetQuery,
            category: targetCategory,
            city: targetOrigin.label,
            lat: targetOrigin.lat,
            lng: targetOrigin.lng,
            pageToken: opts?.appendPageToken,
          }),
        });

        const data = (await res.json()) as {
          shops?: Shop[];
          nextPageToken?: string | null;
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          if (res.status === 429 || data.error === 'RESOURCE_EXHAUSTED') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setCollectError(data.message || 'Unable to collect shops from Google.');
          return;
        }

        const incoming = data.shops || [];
        if (opts?.appendPageToken) {
          setShops((prev) => {
            const seen: Record<string, boolean> = {};
            const merged: Shop[] = [];
            for (const item of [...prev, ...incoming]) {
              if (!seen[item.placeId]) {
                seen[item.placeId] = true;
                merged.push(item);
              }
            }
            return merged;
          });
        } else {
          setShops(incoming);
          if (incoming.length > 0) {
            setSelectedShop(incoming[0]);
          } else {
            setSelectedShop(null);
          }
        }
        setNextPageToken(data.nextPageToken || null);
      } catch (err) {
        setCollectError(
          err instanceof Error ? err.message : 'Network error while collecting shops.'
        );
      } finally {
        setIsCollecting(false);
      }
    },
    [origin, category, query]
  );

  // Initial shop collection on mount
  useEffect(() => {
    void collectShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCitySelect = (cityId: string) => {
    const city = INDIAN_CITIES.find((c) => c.id === cityId);
    if (!city) return;
    setIsUsingGps(false);
    setSelectedCityId(city.id);
    const nextOrigin = {
      lat: city.lat,
      lng: city.lng,
      label: `${city.name}, ${city.state}`,
    };
    setOrigin(nextOrigin);
    setActiveRoute(null);
    void collectShops({ overrideOrigin: nextOrigin });
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setCollectError('Geolocation is not available in this browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // If browser GPS is outside India (e.g. remote cloud preview), still center near user or note label
        const inIndia = lat >= 5 && lat <= 38 && lng >= 67 && lng <= 98;
        const nextOrigin = inIndia
          ? { lat, lng, label: 'Your Current Location (India)' }
          : {
              lat: origin.lat,
              lng: origin.lng,
              label: `${origin.label} (GPS outside India)`,
            };
        setIsUsingGps(inIndia);
        setOrigin(nextOrigin);
        setGpsLoading(false);
        setActiveRoute(null);
        void collectShops({ overrideOrigin: nextOrigin });
      },
      () => {
        setGpsLoading(false);
        setCollectError('Could not access GPS location. Please pick an Indian city.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCategoryChange = (cat: ShopCategory) => {
    setCategory(cat);
    void collectShops({ overrideCategory: cat });
  };

  const handleSearchSubmit = (
    overrideQuery?: string,
    overrideCoords?: { lat: number; lng: number; label?: string }
  ) => {
    const nextOrigin = overrideCoords
      ? {
          lat: overrideCoords.lat,
          lng: overrideCoords.lng,
          label: overrideCoords.label || overrideQuery || origin.label,
        }
      : origin;
    if (overrideCoords) {
      setIsUsingGps(false);
      setOrigin(nextOrigin);
    }
    void collectShops({
      overrideQuery: overrideQuery !== undefined ? overrideQuery : query,
      overrideOrigin: nextOrigin,
    });
  };

  const handleToggleRouteStop = (shop: Shop) => {
    setRouteStops((prev) => {
      const exists = prev.some((s) => s.placeId === shop.placeId);
      if (exists) {
        return prev.filter((s) => s.placeId !== shop.placeId);
      }
      if (prev.length >= 8) return prev;
      return [...prev, shop];
    });
  };

  const handleNavigateNow = (shop: Shop) => {
    setSelectedShop(shop);
    setRouteStops([shop]);
    setTriggerComputeCount((c) => c + 1);
    if (activeTab !== 'directory' && activeTab !== 'map') {
      setActiveTab('map');
    }
  };

  const handleOpenFavoriteLiveDetails = async (
    placeId: string,
    fallbackShop: Shop
  ) => {
    setDrawerShop(fallbackShop);
    try {
      const res = await fetch(
        `/api/shops/details/${encodeURIComponent(placeId)}?lat=${origin.lat}&lng=${origin.lng}`
      );
      if (res.ok) {
        const data = (await res.json()) as { shop?: Shop };
        if (data.shop) {
          setDrawerShop(data.shop);
        }
      }
    } catch {
      // Keep fallback shop open
    }
  };

  const handleOptimizeFavoritesRoute = (favShops: Shop[]) => {
    if (favShops.length === 0) return;
    setRouteStops(favShops);
    setSelectedShop(favShops[0]);
    setActiveTab('map');
    setTriggerComputeCount((c) => c + 1);
  };

  // Filtered and Sorted Shops for Table & Map
  const visibleShops = useMemo(() => {
    const enriched = shops.map((shop) => {
      const safeId = shop.placeId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const ownerOverride = shopOwners[safeId];
      const effectiveScale = ownerOverride?.businessScale || shop.scale;
      const dist =
        typeof shop.distanceKm === 'number'
          ? shop.distanceKm
          : haversineKm(origin.lat, origin.lng, shop.lat, shop.lng);
      return {
        ...shop,
        scale: effectiveScale,
        distanceKm: dist,
      };
    });

    const filtered =
      scaleFilter === 'all'
        ? enriched
        : enriched.filter((s) => s.scale === scaleFilter);

    return filtered.sort((a, b) => {
      if (sortField === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortField === 'reviews') {
        return b.userRatingCount - a.userRatingCount;
      }
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });
  }, [shops, shopOwners, scaleFilter, sortField, origin.lat, origin.lng]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <QuotaBanner />
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {authError && (
        <div className="bg-slate-900 text-white px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-4">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => {
              clearAuthError();
              void signInWithGoogle();
            }}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded font-medium cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={clearAuthError}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {(activeTab === 'directory' || activeTab === 'map') && (
        <>
          <CollectorToolbar
            query={query}
            onQueryChange={setQuery}
            onSearchSubmit={handleSearchSubmit}
            category={category}
            onCategoryChange={handleCategoryChange}
            scaleFilter={scaleFilter}
            onScaleFilterChange={setScaleFilter}
            selectedCityId={selectedCityId}
            onCitySelect={handleCitySelect}
            onUseGps={handleUseGps}
            gpsLoading={gpsLoading}
            isUsingGps={isUsingGps}
            origin={origin}
            isCollecting={isCollecting}
          />

          <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
            {activeTab === 'directory' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 7 cols: Clean Shop Information Table */}
                <div className="lg:col-span-7">
                  <ShopTable
                    shops={visibleShops}
                    isLoading={isCollecting}
                    error={collectError}
                    selectedPlaceId={selectedShop?.placeId || null}
                    routeStopIds={routeStops.map((s) => s.placeId)}
                    favoriteIds={favoriteIds}
                    shopOwners={shopOwners}
                    sortField={sortField}
                    onSortChange={setSortField}
                    onSelectShop={(shop) => {
                      setSelectedShop(shop);
                      setDrawerShop(shop);
                    }}
                    onToggleFavorite={(shop) => void toggleFavorite(shop)}
                    onToggleRouteStop={handleToggleRouteStop}
                    onNavigateNow={handleNavigateNow}
                    hasNextPage={Boolean(nextPageToken)}
                    onLoadMore={() => {
                      if (nextPageToken) {
                        void collectShops({ appendPageToken: nextPageToken });
                      }
                    }}
                    onRetryCollect={() => void collectShops()}
                    originLabel={origin.label}
                  />
                </div>

                {/* Right 5 cols: Sticky Interactive Google Map & Route Optimizer */}
                <div className="lg:col-span-5 lg:sticky lg:top-20">
                  <ShopMapPanel
                    origin={origin}
                    shops={visibleShops}
                    selectedShop={selectedShop}
                    onSelectShop={setSelectedShop}
                    onOpenDetails={(shop) => setDrawerShop(shop)}
                    routeStops={routeStops}
                    onRemoveRouteStop={(id) =>
                      setRouteStops((prev) =>
                        prev.filter((s) => s.placeId !== id)
                      )
                    }
                    onClearRouteStops={() => setRouteStops([])}
                    onReorderRouteStops={setRouteStops}
                    travelMode={travelMode}
                    onTravelModeChange={setTravelMode}
                    activeRoute={activeRoute}
                    onRouteComputed={setActiveRoute}
                    triggerComputeCount={triggerComputeCount}
                  />
                </div>
              </div>
            ) : (
              /* Full-width Map & Routes Workspace */
              <ShopMapPanel
                origin={origin}
                shops={visibleShops}
                selectedShop={selectedShop}
                onSelectShop={setSelectedShop}
                onOpenDetails={(shop) => setDrawerShop(shop)}
                routeStops={routeStops}
                onRemoveRouteStop={(id) =>
                  setRouteStops((prev) => prev.filter((s) => s.placeId !== id))
                }
                onClearRouteStops={() => setRouteStops([])}
                onReorderRouteStops={setRouteStops}
                travelMode={travelMode}
                onTravelModeChange={setTravelMode}
                activeRoute={activeRoute}
                onRouteComputed={setActiveRoute}
                triggerComputeCount={triggerComputeCount}
                className="h-[620px] lg:h-[calc(100vh-220px)] min-h-[540px]"
              />
            )}
          </main>
        </>
      )}

      {activeTab === 'favorites' && (
        <main className="flex-1">
          <FavoritesView
            onOpenPlaceDetails={(placeId, fallback) =>
              void handleOpenFavoriteLiveDetails(placeId, fallback)
            }
            onOptimizeFavoritesRoute={handleOptimizeFavoritesRoute}
            onBrowseDirectory={() => setActiveTab('directory')}
          />
        </main>
      )}

      {activeTab === 'list-shop' && (
        <main className="flex-1">
          <ListShopView onSuccess={() => setActiveTab('directory')} />
        </main>
      )}

      <ShopDetailDrawer
        shop={drawerShop}
        onClose={() => setDrawerShop(null)}
        onNavigateNow={handleNavigateNow}
        onToggleRouteStop={handleToggleRouteStop}
        isInRoute={
          drawerShop
            ? routeStops.some((s) => s.placeId === drawerShop.placeId)
            : false
        }
      />

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            BazaarAtlas India — Shop Directory from Neighborhood Kiranas to Wholesale Showrooms
          </span>
          <span>
            Powered by Google Maps Platform (Places, Routes &amp; Maps JS API)
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapsApiKey, setMapsApiKey] = useState<string>(envKey);
  const [configLoaded, setConfigLoaded] = useState<boolean>(Boolean(envKey));

  useEffect(() => {
    if (envKey) return;
    fetch('/api/config/maps')
      .then((r) => r.json())
      .then((d: { apiKey?: string }) => {
        if (d.apiKey) setMapsApiKey(d.apiKey);
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, [envKey]);

  if (!configLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Loading BazaarAtlas India...
      </div>
    );
  }

  return (
    <AuthProvider>
      {mapsApiKey ? (
        <APIProvider
          apiKey={mapsApiKey}
          libraries={['marker', 'routes', 'places', 'geometry']}
          language="en"
          region="IN"
        >
          <BazaarAtlasShell />
        </APIProvider>
      ) : (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md bg-white border border-slate-200 rounded-xl p-6 text-center space-y-2">
            <h1 className="text-lg font-bold text-slate-900">
              Google Maps API Key Required
            </h1>
            <p className="text-sm text-slate-600">
              Please configure your Google Maps Platform key in AI Studio to load Indian shop locations, photos, and routes.
            </p>
          </div>
        </div>
      )}
    </AuthProvider>
  );
}
