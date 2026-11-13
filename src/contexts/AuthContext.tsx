import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  FavoriteShop,
  Shop,
  ShopOwnerProfile,
  TravelModeType,
  UserProfile,
} from '../types';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  favorites: FavoriteShop[];
  favoriteIds: Record<string, boolean>;
  shopOwners: Record<string, ShopOwnerProfile>;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  toggleFavorite: (shop: Shop, note?: string) => Promise<boolean>;
  updateFavoriteNote: (placeId: string, note: string) => Promise<void>;
  updateUserProfile: (updates: {
    displayName: string;
    phone?: string;
    preferredCity: string;
    preferredTravelMode: TravelModeType;
    accountRole: 'shopper' | 'owner';
  }) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteShop[]>([]);
  const [shopOwners, setShopOwners] = useState<Record<string, ShopOwnerProfile>>({});
  const [authError, setAuthError] = useState<string | null>(null);

  const ensureProfileDocument = useCallback(async (firebaseUser: User) => {
    const profilePath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const displayName = (firebaseUser.displayName || 'BazaarAtlas Member')
          .trim()
          .slice(0, 80);
        const email = (firebaseUser.email || '').trim().slice(0, 160);
        const payload: Record<string, unknown> = {
          uid: firebaseUser.uid,
          displayName: displayName || 'BazaarAtlas Member',
          email,
          phone: '',
          preferredCity: 'New Delhi',
          preferredTravelMode: 'DRIVING',
          accountRole: 'shopper',
          photoUrl: (firebaseUser.photoURL || '').slice(0, 500),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, profilePath);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setFavorites([]);
      } else {
        void ensureProfileDocument(firebaseUser).catch((err) => {
          console.error(err);
        });
      }
    });
    return unsubscribe;
  }, [ensureProfileDocument]);

  // Public shopkeeper & business owner enrichments
  useEffect(() => {
    const ownersQuery = query(
      collection(db, 'shop_owners'),
      where('isPublic', '==', true)
    );
    const unsubscribe = onSnapshot(
      ownersQuery,
      (snapshot) => {
        const map: Record<string, ShopOwnerProfile> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ShopOwnerProfile;
          map[data.placeId] = data;
        });
        setShopOwners(map);
      },
      (error) => {
        console.error('Shop owners listener error:', error);
      }
    );
    return unsubscribe;
  }, []);

  // Private profile + favorites listeners (only attached when auth is ready & signed in)
  useEffect(() => {
    if (!authReady || !user) return;

    const profilePath = `users/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );

    const favPath = `users/${user.uid}/favorites`;
    const favQuery = query(
      collection(db, 'users', user.uid, 'favorites'),
      where('userId', '==', user.uid)
    );
    const unsubFavs = onSnapshot(
      favQuery,
      (snapshot) => {
        const items: FavoriteShop[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as FavoriteShop);
        });
        setFavorites(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, favPath);
      }
    );

    return () => {
      unsubProfile();
      unsubFavs();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await ensureProfileDocument(result.user);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in right now.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError(message);
      }
    }
  }, [ensureProfileDocument]);

  const logOut = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const favoriteIds: Record<string, boolean> = {};
  for (const fav of favorites) {
    favoriteIds[fav.placeId] = true;
  }

  const toggleFavorite = useCallback(
    async (shop: Shop, note = ''): Promise<boolean> => {
      if (!user) {
        setAuthError('Please sign in to save shops to your Favorites list.');
        return false;
      }

      const safePlaceId = sanitizeId(shop.placeId);
      const favPath = `users/${user.uid}/favorites/${safePlaceId}`;
      const favRef = doc(db, 'users', user.uid, 'favorites', safePlaceId);

      try {
        await ensureProfileDocument(user);
        if (favoriteIds[safePlaceId]) {
          await deleteDoc(favRef);
          return false;
        }

        const clampedLat = Math.min(Math.max(shop.lat, 5.0), 38.0);
        const clampedLng = Math.min(Math.max(shop.lng, 67.0), 98.0);

        await setDoc(favRef, {
          userId: user.uid,
          placeId: safePlaceId,
          shopName: shop.name.trim().slice(0, 140) || 'Indian Shop',
          category: shop.category,
          scale: shop.scale,
          shortAddress: (shop.shortAddress || 'India').trim().slice(0, 240),
          lat: clampedLat,
          lng: clampedLng,
          note: note.trim().slice(0, 280),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, favPath);
      }
    },
    [user, favoriteIds, ensureProfileDocument]
  );

  const updateFavoriteNote = useCallback(
    async (placeId: string, note: string) => {
      if (!user) return;
      const safePlaceId = sanitizeId(placeId);
      const favPath = `users/${user.uid}/favorites/${safePlaceId}`;
      try {
        await updateDoc(doc(db, 'users', user.uid, 'favorites', safePlaceId), {
          note: note.trim().slice(0, 280),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, favPath);
      }
    },
    [user]
  );

  const updateUserProfile = useCallback(
    async (updates: {
      displayName: string;
      phone?: string;
      preferredCity: string;
      preferredTravelMode: TravelModeType;
      accountRole: 'shopper' | 'owner';
    }) => {
      if (!user) return;
      const profilePath = `users/${user.uid}`;
      try {
        await ensureProfileDocument(user);
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: updates.displayName.trim().slice(0, 80) || 'BazaarAtlas User',
          phone: (updates.phone || '').trim().slice(0, 20),
          preferredCity: updates.preferredCity.trim().slice(0, 80) || 'New Delhi',
          preferredTravelMode: updates.preferredTravelMode,
          accountRole: updates.accountRole,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, profilePath);
      }
    },
    [user, ensureProfileDocument]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        profile,
        favorites,
        favoriteIds,
        shopOwners,
        authError,
        signInWithGoogle,
        logOut,
        toggleFavorite,
        updateFavoriteNote,
        updateUserProfile,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
