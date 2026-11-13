import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Clock,
  ExternalLink,
  Globe,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Star,
  Store,
  UserCheck,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, SCALE_LABELS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BusinessScale,
  CommunityReview,
  Shop,
  ShopCategory,
} from '../types';

interface ShopDetailDrawerProps {
  shop: Shop | null;
  onClose: () => void;
  onNavigateNow: (shop: Shop) => void;
  onToggleRouteStop: (shop: Shop) => void;
  isInRoute: boolean;
}

export function ShopDetailDrawer({
  shop,
  onClose,
  onNavigateNow,
  onToggleRouteStop,
  isInRoute,
}: ShopDetailDrawerProps) {
  const { user, profile, favoriteIds, shopOwners, toggleFavorite, signInWithGoogle } =
    useAuth();

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [photoFailed, setPhotoFailed] = useState<Record<number, boolean>>({});
  const [communityReviews, setCommunityReviews] = useState<CommunityReview[]>([]);

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Owner Claim Inline Form State
  const [showOwnerForm, setShowOwnerForm] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerScale, setOwnerScale] = useState<BusinessScale>('small');
  const [goodsSummary, setGoodsSummary] = useState('');
  const [yearsInBiz, setYearsInBiz] = useState(3);
  const [deliveryAvail, setDeliveryAvail] = useState(true);
  const [savingOwner, setSavingOwner] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  useEffect(() => {
    setActivePhotoIdx(0);
    setPhotoFailed({});
    setShowOwnerForm(false);
    setReviewError(null);
    setOwnerError(null);
  }, [shop?.placeId]);

  useEffect(() => {
    if (!shop) return;
    const safeId = shop.placeId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const q = query(
      collection(db, 'shop_reviews'),
      where('placeId', '==', safeId),
      where('isPublic', '==', true)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: CommunityReview[] = [];
        snap.forEach((d) => list.push(d.data() as CommunityReview));
        setCommunityReviews(list);
      },
      (err) => {
        console.error('Reviews listener error:', err);
      }
    );
    return unsubscribe;
  }, [shop]);

  if (!shop) return null;

  const safePlaceId = shop.placeId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const isFav = Boolean(favoriteIds[safePlaceId]);
  const ownerInfo = shopOwners[safePlaceId];
  const activePhoto = shop.photos[activePhotoIdx];
  const photoUrl =
    activePhoto && !photoFailed[activePhotoIdx]
      ? `/api/places/photo?name=${encodeURIComponent(
          activePhoto.name
        )}&maxWidthPx=1000&maxHeightPx=700`
      : null;

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = reviewText.trim();
    if (trimmed.length < 3) {
      setReviewError('Please write at least 3 characters.');
      return;
    }

    setSubmittingReview(true);
    setReviewError(null);
    const reviewDocRef = doc(collection(db, 'shop_reviews'));
    const path = `shop_reviews/${reviewDocRef.id}`;
    try {
      await setDoc(reviewDocRef, {
        reviewId: reviewDocRef.id,
        placeId: safePlaceId,
        authorUid: user.uid,
        authorName: (
          profile?.displayName ||
          user.displayName ||
          'Indian Shopper'
        ).slice(0, 80),
        rating: Math.min(Math.max(Number(reviewRating), 1), 5),
        comment: trimmed.slice(0, 600),
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReviewText('');
      setReviewRating(5);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, path);
      } catch (formattedErr) {
        setReviewError(
          formattedErr instanceof Error ? formattedErr.message : 'Failed to save review.'
        );
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOwnerSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (ownerName.trim().length < 2 || goodsSummary.trim().length < 3) {
      setOwnerError('Please enter the owner name and goods sold.');
      return;
    }

    setSavingOwner(true);
    setOwnerError(null);
    const path = `shop_owners/${safePlaceId}`;
    const addressParts = shop.formattedAddress.split(',').map((p) => p.trim());
    const guessCity = addressParts[addressParts.length - 3] || addressParts[0] || 'India';

    try {
      await setDoc(doc(db, 'shop_owners', safePlaceId), {
        placeId: safePlaceId,
        ownerUid: user.uid,
        ownerName: ownerName.trim().slice(0, 100),
        businessName: shop.name.trim().slice(0, 140),
        category: shop.category as Exclude<ShopCategory, 'all'>,
        businessScale: ownerScale,
        city: guessCity.slice(0, 80) || 'India',
        locality: (shop.shortAddress || shop.formattedAddress).slice(0, 200),
        goodsSummary: goodsSummary.trim().slice(0, 300),
        deliveryAvailable: deliveryAvail,
        yearsInBusiness: Math.min(Math.max(Number(yearsInBiz) || 0, 0), 200),
        isPublic: true,
        createdAt: ownerInfo?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowOwnerForm(false);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (formattedErr) {
        setOwnerError(
          formattedErr instanceof Error
            ? formattedErr.message
            : 'Unable to save owner profile.'
        );
      }
    } finally {
      setSavingOwner(false);
    }
  };

  // Unused import guard for addDoc
  void addDoc;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]">
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>{CATEGORY_LABELS[shop.category]}</span>
              <span aria-hidden="true">·</span>
              <span>
                {ownerInfo
                  ? SCALE_LABELS[ownerInfo.businessScale]
                  : shop.scaleLabel}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5 leading-snug">
              {shop.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shop details"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 flex-1">
          {/* Google Shop Photo Gallery */}
          <div className="space-y-2.5">
            <div className="relative h-56 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={shop.name}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setPhotoFailed((prev) => ({ ...prev, [activePhotoIdx]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Store className="w-8 h-8 mb-1.5" />
                  <span className="text-xs">No Google storefront photo available</span>
                </div>
              )}

              {activePhoto?.authorAttributions &&
                activePhoto.authorAttributions.length > 0 &&
                photoUrl && (
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
                    Photo by{' '}
                    {activePhoto.authorAttributions[0].uri ? (
                      <a
                        href={
                          activePhoto.authorAttributions[0].uri.startsWith('//')
                            ? `https:${activePhoto.authorAttributions[0].uri}`
                            : activePhoto.authorAttributions[0].uri
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {activePhoto.authorAttributions[0].displayName}
                      </a>
                    ) : (
                      activePhoto.authorAttributions[0].displayName
                    )}
                  </div>
                )}
            </div>

            {shop.photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {shop.photos.map((photo, idx) => (
                  <button
                    key={photo.name}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`w-16 h-12 rounded-md overflow-hidden border-2 shrink-0 cursor-pointer ${
                      activePhotoIdx === idx
                        ? 'border-emerald-600'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={`/api/places/photo?name=${encodeURIComponent(
                        photo.name
                      )}&maxWidthPx=200&maxHeightPx=150`}
                      alt={`${shop.name} view ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover bg-slate-100"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action Strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onNavigateNow(shop);
                onClose();
              }}
              className="flex-1 min-w-[140px] px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>Navigate Now</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleRouteStop(shop)}
              className={`px-3.5 py-2.5 text-sm font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer ${
                isInRoute
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isInRoute ? 'In Route' : 'Add Stop'}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleFavorite(shop)}
              className={`px-3.5 py-2.5 text-sm font-medium rounded-lg border inline-flex items-center gap-1.5 cursor-pointer ${
                isFav
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600' : ''}`} />
              <span>{isFav ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          {/* Location, Hours & Contact Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-slate-900 font-medium">
                  {shop.formattedAddress}
                </div>
                {typeof shop.distanceKm === 'number' && (
                  <div className="text-xs text-slate-500 mt-0.5 font-mono-data">
                    {shop.distanceKm.toFixed(2)} km away
                    {shop.etaText ? ` · ~${shop.etaText}` : ''}
                  </div>
                )}
              </div>
            </div>

            {shop.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                <a
                  href={`tel:${shop.phone}`}
                  className="text-emerald-700 hover:underline font-mono-data"
                >
                  {shop.phone}
                </a>
              </div>
            )}

            {shop.websiteUri && (
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                <a
                  href={shop.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:underline truncate"
                >
                  {shop.websiteUri}
                </a>
              </div>
            )}

            {shop.openNow !== null && shop.openNow !== undefined && (
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <span
                    className={`font-medium ${
                      shop.openNow ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {shop.openNow ? 'Open Now' : 'Currently Closed'}
                  </span>
                  {shop.weekdayDescriptions && shop.weekdayDescriptions.length > 0 && (
                    <details className="mt-1 text-xs text-slate-600">
                      <summary className="cursor-pointer hover:text-slate-900">
                        View weekly hours
                      </summary>
                      <ul className="mt-1.5 space-y-0.5">
                        {shop.weekdayDescriptions.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}

            {shop.googleMapsUri && (
              <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Data from Google Maps</span>
                <a
                  href={shop.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-slate-900 font-medium inline-flex items-center gap-1"
                >
                  <span>View on Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Shopkeeper / Business Owner Section */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Shopkeeper &amp; Business Profile
                </h3>
              </div>
              {user && !showOwnerForm && (!ownerInfo || ownerInfo.ownerUid === user.uid) && (
                <button
                  type="button"
                  onClick={() => {
                    setOwnerName(ownerInfo?.ownerName || '');
                    setOwnerScale(ownerInfo?.businessScale || shop.scale);
                    setGoodsSummary(ownerInfo?.goodsSummary || '');
                    setYearsInBiz(ownerInfo?.yearsInBusiness ?? 3);
                    setDeliveryAvail(ownerInfo?.deliveryAvailable ?? true);
                    setShowOwnerForm(true);
                  }}
                  className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                >
                  {ownerInfo ? 'Edit Owner Info' : 'Add Owner Details'}
                </button>
              )}
            </div>

            {ownerInfo ? (
              <div className="text-sm space-y-1.5 text-slate-700">
                <div>
                  <span className="text-slate-500">Owner:</span>{' '}
                  <span className="font-semibold text-slate-900">
                    {ownerInfo.ownerName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Business Scale:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {SCALE_LABELS[ownerInfo.businessScale]}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Goods Sold:</span>{' '}
                  <span>{ownerInfo.goodsSummary}</span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                  <span>{ownerInfo.yearsInBusiness} yrs in business</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ownerInfo.deliveryAvailable
                      ? 'Local delivery available'
                      : 'In-store pickup'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Classified as <span className="font-semibold">{shop.scaleLabel}</span> based on Google Maps store profile.
                {!user && ' Sign in if you are the Indian shopkeeper or owner to add your owner details.'}
              </p>
            )}

            {showOwnerForm && (
              <form onSubmit={handleOwnerSave} className="space-y-3 pt-2 border-t border-slate-100">
                {ownerError && (
                  <p className="text-xs text-red-700">{ownerError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Owner Name
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Gupta"
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Business Scale
                    </label>
                    <select
                      value={ownerScale}
                      onChange={(e) => setOwnerScale(e.target.value as BusinessScale)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-emerald-600"
                    >
                      <option value="small">Small Shopkeeper</option>
                      <option value="medium">Medium Retailer</option>
                      <option value="large">Big Business / Wholesale</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Goods &amp; Specialties Sold
                  </label>
                  <input
                    type="text"
                    required
                    value={goodsSummary}
                    onChange={(e) => setGoodsSummary(e.target.value)}
                    placeholder="e.g. Daily groceries, cold drinks, dry fruits, household items"
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">
                      Years Operating:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={yearsInBiz}
                      onChange={(e) => setYearsInBiz(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-md"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryAvail}
                      onChange={(e) => setDeliveryAvail(e.target.checked)}
                    />
                    Local Delivery
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOwnerForm(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOwner}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer"
                  >
                    {savingOwner ? 'Saving...' : 'Save Owner Info'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Customer Reviews (Google + Community) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Customer Reviews
              </h3>
              {shop.rating && (
                <div className="flex items-center gap-1.5 text-sm font-semibold font-mono-data">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{shop.rating.toFixed(1)}</span>
                  <span className="text-slate-500 font-normal">
                    ({shop.userRatingCount.toLocaleString('en-IN')} Google reviews)
                  </span>
                </div>
              )}
            </div>

            {shop.reviewSummary && (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {shop.reviewSummary}
              </p>
            )}

            {/* Add Review Box */}
            {user ? (
              <form
                onSubmit={handleReviewSubmit}
                className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Share your experience
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="p-0.5 cursor-pointer"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= reviewRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write about prices, quality of goods, or shopkeeper behavior..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
                {reviewError && (
                  <p className="text-xs text-red-700">{reviewError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md cursor-pointer"
                  >
                    {submittingReview ? 'Posting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 bg-slate-50">
                <span className="text-xs text-slate-600">
                  Sign in to post your own customer review.
                </span>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Community Reviews */}
            {communityReviews.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  BazaarAtlas Community Reviews
                </div>
                {communityReviews.map((rev) => (
                  <div
                    key={rev.reviewId}
                    className="border border-slate-200 rounded-lg p-3 space-y-1 bg-white"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">
                        {rev.authorName}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono-data font-medium text-slate-800">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Google Reviews */}
            {shop.reviews.length > 0 ? (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reviews from Google Maps
                </div>
                {shop.reviews.map((rev, i) => (
                  <div
                    key={`${rev.authorName}-${i}`}
                    className="border border-slate-200 rounded-lg p-3 space-y-1.5 bg-white"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 truncate">
                        {rev.authorName}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 text-slate-500">
                        <span>{rev.relativePublishTimeDescription}</span>
                        <span className="inline-flex items-center gap-0.5 font-mono-data font-semibold text-slate-900">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {rev.rating}
                        </span>
                      </div>
                    </div>
                    {rev.text && (
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {rev.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No Google text reviews returned for this storefront yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
