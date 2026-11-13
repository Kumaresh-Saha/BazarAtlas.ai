import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  Navigation,
  Route,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_CONFIG, TRAVEL_MODE_OPTIONS } from '../constants';
import { ComputedRouteInfo, Shop, TravelModeType } from '../types';
import { ShopThumbnail } from './ShopThumbnail';

interface ShopMapPanelProps {
  origin: { lat: number; lng: number; label: string };
  shops: Shop[];
  selectedShop: Shop | null;
  onSelectShop: (shop: Shop | null) => void;
  onOpenDetails: (shop: Shop) => void;
  routeStops: Shop[];
  onRemoveRouteStop: (placeId: string) => void;
  onClearRouteStops: () => void;
  onReorderRouteStops: (orderedStops: Shop[]) => void;
  travelMode: TravelModeType;
  onTravelModeChange: (mode: TravelModeType) => void;
  activeRoute: ComputedRouteInfo | null;
  onRouteComputed: (route: ComputedRouteInfo | null) => void;
  triggerComputeCount: number;
  className?: string;
}

function ShopMarkerItem({
  shop,
  isSelected,
  routeIndex,
  zIndex,
  onMarkerClick,
}: {
  shop: Shop;
  isSelected: boolean;
  routeIndex: number;
  zIndex: number;
  onMarkerClick: (
    shop: Shop,
    marker: google.maps.marker.AdvancedMarkerElement
  ) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const catColor =
    CATEGORY_CONFIG.find((c) => c.id === shop.category)?.pinColor || '#059669';

  const bg =
    isSelected
      ? '#0F172A'
      : routeIndex >= 0
      ? '#4F46E5'
      : catColor;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: shop.lat, lng: shop.lng }}
      zIndex={zIndex}
      title={shop.name}
      onClick={() => {
        if (marker) {
          onMarkerClick(shop, marker);
        }
      }}
    >
      <Pin
        background={bg}
        borderColor="#FFFFFF"
        glyphColor="#FFFFFF"
        glyphText={routeIndex >= 0 ? String(routeIndex + 1) : undefined}
        scale={isSelected ? 1.2 : 1.0}
      />
    </AdvancedMarker>
  );
}

function RoutePolylineController({
  encodedPolyline,
  origin,
  stops,
}: {
  encodedPolyline: string | null;
  origin: { lat: number; lng: number };
  stops: Shop[];
}) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!encodedPolyline || !geometryLib) return;

    const path = geometryLib.encoding.decodePath(encodedPolyline);
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#059669',
      strokeOpacity: 0.92,
      strokeWeight: 5,
      map,
    });
    polylineRef.current = polyline;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(origin);
    path.forEach((pt) => bounds.extend(pt));
    stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    map.fitBounds(bounds, 56);

    return () => {
      polyline.setMap(null);
    };
  }, [map, geometryLib, encodedPolyline, origin, stops]);

  return null;
}

function MapCameraSync({
  origin,
  selectedShop,
  hasActiveRoute,
}: {
  origin: { lat: number; lng: number };
  selectedShop: Shop | null;
  hasActiveRoute: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || hasActiveRoute) return;
    if (selectedShop) {
      map.panTo({ lat: selectedShop.lat, lng: selectedShop.lng });
    }
  }, [map, selectedShop, hasActiveRoute]);

  useEffect(() => {
    if (!map || hasActiveRoute || selectedShop) return;
    map.panTo({ lat: origin.lat, lng: origin.lng });
  }, [map, origin.lat, origin.lng, hasActiveRoute, selectedShop]);

  return null;
}

export function ShopMapPanel({
  origin,
  shops,
  selectedShop,
  onSelectShop,
  onOpenDetails,
  routeStops,
  onRemoveRouteStop,
  onClearRouteStops,
  onReorderRouteStops,
  travelMode,
  onTravelModeChange,
  activeRoute,
  onRouteComputed,
  triggerComputeCount,
  className = 'h-[540px] lg:h-[calc(100vh-210px)] min-h-[500px]',
}: ShopMapPanelProps) {
  const [infoMarker, setInfoMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [infoShop, setInfoShop] = useState<Shop | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [liveNavActive, setLiveNavActive] = useState(false);
  const [liveGpsPos, setLiveGpsPos] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const sortedShops = useMemo(() => {
    return [...shops]
      .sort((a, b) => b.lat - a.lat)
      .map((s, idx) => ({ shop: s, baseZ: idx + 1 }));
  }, [shops]);

  const handleMarkerClick = useCallback(
    (shop: Shop, marker: google.maps.marker.AdvancedMarkerElement) => {
      setInfoShop(shop);
      setInfoMarker(marker);
      onSelectShop(shop);
    },
    [onSelectShop]
  );

  const computeOptimizedRoute = useCallback(
    async (stopsToCompute: Shop[]) => {
      if (stopsToCompute.length === 0) return;

      setRouteLoading(true);
      setRouteError(null);

      const startPoint = liveGpsPos || { lat: origin.lat, lng: origin.lng };
      const destinationStop = stopsToCompute[stopsToCompute.length - 1];
      const intermediateStops = stopsToCompute.slice(0, -1);

      try {
        const res = await fetch('/api/routes/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: startPoint,
            destination: { lat: destinationStop.lat, lng: destinationStop.lng },
            intermediates: intermediateStops.map((s) => ({
              lat: s.lat,
              lng: s.lng,
              placeId: s.placeId,
            })),
            travelMode,
          }),
        });

        const data = (await res.json()) as ComputedRouteInfo & {
          error?: string;
          message?: string;
        };

        if (!res.ok) {
          if (res.status === 429 || data.error === 'RESOURCE_EXHAUSTED') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setRouteError(data.message || 'Could not compute route.');
          setRouteLoading(false);
          return;
        }

        let orderedStops = [...stopsToCompute];
        if (
          Array.isArray(data.optimizedOrder) &&
          data.optimizedOrder.length === intermediateStops.length
        ) {
          const reorderedIntermediates = data.optimizedOrder.map(
            (idx) => intermediateStops[idx]
          );
          orderedStops = [...reorderedIntermediates, destinationStop];
          onReorderRouteStops(orderedStops);
        }

        onRouteComputed({
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds,
          encodedPolyline: data.encodedPolyline,
          optimizedOrder: data.optimizedOrder,
          steps: data.steps || [],
          orderedStopPlaceIds: orderedStops.map((s) => s.placeId),
        });
        setCurrentStepIdx(0);
      } catch (err) {
        setRouteError(
          err instanceof Error ? err.message : 'Unable to reach routing service.'
        );
      } finally {
        setRouteLoading(false);
      }
    },
    [
      liveGpsPos,
      origin.lat,
      origin.lng,
      travelMode,
      onReorderRouteStops,
      onRouteComputed,
    ]
  );

  // Trigger compute when user clicks "Go" in table or switches travel mode with an active route
  useEffect(() => {
    if (triggerComputeCount > 0 && routeStops.length > 0) {
      void computeOptimizedRoute(routeStops);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerComputeCount, travelMode]);

  // Live GPS Turn-by-Turn Tracking
  useEffect(() => {
    if (!liveNavActive) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setRouteError('Live GPS navigation is not supported in this browser.');
      setLiveNavActive(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveGpsPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setRouteError('Location permission denied. Using selected city center.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchIdRef.current = id;

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, [liveNavActive]);

  const stopLiveNav = () => {
    setLiveNavActive(false);
    setLiveGpsPos(null);
    onRouteComputed(null);
    onClearRouteStops();
  };

  const formatTotalDuration = (sec: number) => {
    const mins = Math.max(1, Math.round(sec / 60));
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
  };

  const googleMapsExternalUrl = useMemo(() => {
    if (routeStops.length === 0) return null;
    const dest = routeStops[routeStops.length - 1];
    const waypoints = routeStops
      .slice(0, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');
    const modeMap: Record<TravelModeType, string> = {
      DRIVING: 'driving',
      TWO_WHEELER: 'two-wheeler',
      WALKING: 'walking',
      TRANSIT: 'transit',
    };
    const params = new URLSearchParams({
      api: '1',
      origin: `${(liveGpsPos || origin).lat},${(liveGpsPos || origin).lng}`,
      destination: `${dest.lat},${dest.lng}`,
      travelmode: modeMap[travelMode],
    });
    if (waypoints) params.set('waypoints', waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [routeStops, liveGpsPos, origin, travelMode]);

  const activeStep = activeRoute?.steps?.[currentStepIdx];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Travel Mode & Route Queue Bar */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
          {TRAVEL_MODE_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onTravelModeChange(m.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                travelMode === m.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {routeStops.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => void computeOptimizedRoute(routeStops)}
                disabled={routeLoading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Route className="w-3.5 h-3.5" />
                <span>
                  {routeLoading
                    ? 'Optimizing...'
                    : routeStops.length > 1
                    ? `Optimize ${routeStops.length} Stops`
                    : 'Compute Route'}
                </span>
              </button>
              <button
                type="button"
                onClick={stopLiveNav}
                title="Clear route"
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Multi-stop Chips Bar when building a route */}
      {routeStops.length > 0 && (
        <div className="px-3.5 py-2 border-b border-slate-200 bg-indigo-50/50 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-semibold text-indigo-900 whitespace-nowrap shrink-0">
            Route Stops:
          </span>
          {routeStops.map((stop, index) => (
            <div
              key={stop.placeId}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-indigo-200 rounded-md text-slate-800 whitespace-nowrap shrink-0"
            >
              <span className="font-mono-data font-semibold text-indigo-700">
                {index + 1}.
              </span>
              <span className="max-w-[140px] truncate">{stop.name}</span>
              <button
                type="button"
                onClick={() => onRemoveRouteStop(stop.placeId)}
                aria-label={`Remove ${stop.name}`}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Map Viewport (Explicit height so Map never collapses) */}
      <div className={`relative w-full ${className}`}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: origin.lat, lng: origin.lng }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraSync
            origin={origin}
            selectedShop={selectedShop}
            hasActiveRoute={Boolean(activeRoute)}
          />
          <RoutePolylineController
            encodedPolyline={activeRoute?.encodedPolyline || null}
            origin={liveGpsPos || origin}
            stops={routeStops}
          />

          {/* User Origin / Live GPS Marker */}
          <AdvancedMarker
            position={liveGpsPos || { lat: origin.lat, lng: origin.lng }}
            zIndex={1200}
            title={liveGpsPos ? 'Your Live GPS Location' : origin.label}
          >
            <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
          </AdvancedMarker>

          {/* Shop Markers */}
          {sortedShops.map(({ shop, baseZ }) => {
            const isSelected = selectedShop?.placeId === shop.placeId;
            const routeIdx = routeStops.findIndex(
              (s) => s.placeId === shop.placeId
            );
            const zIndex = isSelected ? 1000 : routeIdx >= 0 ? 900 : baseZ;
            return (
              <ShopMarkerItem
                key={shop.placeId}
                shop={shop}
                isSelected={isSelected}
                routeIndex={routeIdx}
                zIndex={zIndex}
                onMarkerClick={handleMarkerClick}
              />
            );
          })}

          {infoShop && infoMarker && (
            <InfoWindow
              anchor={infoMarker}
              pixelOffset={[0, -4]}
              onCloseClick={() => {
                setInfoShop(null);
                setInfoMarker(null);
              }}
            >
              <div className="w-60 p-1 text-slate-900">
                <div className="flex items-start gap-2.5">
                  <ShopThumbnail
                    photos={infoShop.photos}
                    shopName={infoShop.name}
                    className="w-16 h-14 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm leading-tight truncate">
                      {infoShop.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {infoShop.scaleLabel}
                    </div>
                    {infoShop.rating && (
                      <div className="flex items-center gap-1 text-xs font-medium mt-1 font-mono-data">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{infoShop.rating.toFixed(1)}</span>
                        <span className="text-slate-400">
                          ({infoShop.userRatingCount})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  {infoShop.shortAddress}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(infoShop)}
                    className="flex-1 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    Photos &amp; Reviews
                  </button>
                  <button
                    type="button"
                    onClick={() => void computeOptimizedRoute([infoShop])}
                    className="flex-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Route</span>
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Live Turn-by-Turn Navigation & Route Summary Card */}
        {(activeRoute || routeError) && (
          <div className="absolute left-3 right-3 bottom-3 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg p-3.5 space-y-2.5 z-20">
            {routeError ? (
              <div className="flex items-center justify-between text-xs text-red-700">
                <span>{routeError}</span>
                <button
                  type="button"
                  onClick={() => setRouteError(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : activeRoute ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="text-base font-bold text-slate-900 font-mono-data">
                      {formatTotalDuration(activeRoute.durationSeconds)}
                    </div>
                    <span className="text-slate-300" aria-hidden="true">
                      |
                    </span>
                    <div className="text-sm font-medium text-slate-600 font-mono-data">
                      {(activeRoute.distanceMeters / 1000).toFixed(1)} km
                    </div>
                    {routeStops.length > 1 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700">
                        <Sparkles className="w-3.5 h-3.5" />
                        Order Optimized
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLiveNavActive((v) => !v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        liveNavActive
                          ? 'bg-emerald-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>
                        {liveNavActive ? 'Live GPS Active' : 'Start Live Nav'}
                      </span>
                    </button>

                    {googleMapsExternalUrl && (
                      <a
                        href={googleMapsExternalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Turn-by-Turn Step Navigator */}
                {activeStep && (
                  <div className="bg-slate-900 text-white rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-emerald-300 font-mono-data">
                        Step {currentStepIdx + 1} of {activeRoute.steps.length} ·{' '}
                        {activeStep.distanceMeters >= 1000
                          ? `${(activeStep.distanceMeters / 1000).toFixed(1)} km`
                          : `${activeStep.distanceMeters} m`}{' '}
                        ({activeStep.durationText})
                      </div>
                      <div className="text-xs sm:text-sm font-medium mt-0.5 leading-snug">
                        {activeStep.instruction}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={currentStepIdx === 0}
                        onClick={() =>
                          setCurrentStepIdx((i) => Math.max(0, i - 1))
                        }
                        className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={
                          currentStepIdx >= activeRoute.steps.length - 1
                        }
                        onClick={() =>
                          setCurrentStepIdx((i) =>
                            Math.min(activeRoute.steps.length - 1, i + 1)
                          )
                        }
                        className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
