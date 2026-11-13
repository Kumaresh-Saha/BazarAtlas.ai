# Security Specification — BazaarAtlas India

## 1. Data Invariants
1. **User Profile Privacy (PII Isolation)**: A `/users/{userId}` document contains PII (`email`, `phone`) and may only be read, created, updated, or deleted when `request.auth.uid == userId` and `request.auth.token.email_verified == true`. Blanket `list` on `/users` is denied.
2. **Favorites Ownership & Parent Gate**: A favorite shop document at `/users/{userId}/favorites/{favoriteId}` can only be read, listed, created, updated, or deleted by `userId` (`request.auth.uid == userId` and `resource.data.userId == request.auth.uid` on `list`). `userId` and `placeId` are immutable after creation.
3. **Shop Owner Profile Integrity**: A `/shop_owners/{placeId}` document requires `isPublic == true`, a valid `placeId` matching the document ID, and `ownerUid == request.auth.uid`. Only the owning user (`existing().ownerUid == request.auth.uid`) may update or delete it, and `ownerUid`, `placeId`, and `createdAt` are immutable.
4. **Customer Review Integrity**: A `/shop_reviews/{reviewId}` document requires `isPublic == true`, `rating` between 1 and 5, `authorUid == request.auth.uid`, and `reviewId == reviewId` path variable. Only the author may edit or delete their review.
5. **Temporal & Structural Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time` on creation, and `updatedAt == request.time` with `createdAt == existing().createdAt` on updates. Strict `hasAll` and `hasOnly` key allowlists block ghost/shadow fields on every write.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **PII Cross-Read**: User B attempts `get /users/userA` -> `PERMISSION_DENIED`.
2. **PII Directory Scraping**: Any user attempts `list /users` -> `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: User with `email_verified: false` attempts `create /users/userA` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Profile**: User A creates `/users/userA` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Cross-User Favorite Poisoning**: User B attempts `create /users/userA/favorites/place123` with `userId: "userB"` -> `PERMISSION_DENIED`.
6. **Immutable Field Mutation on Favorite**: User A updates `/users/userA/favorites/place123` changing `placeId` or `createdAt` -> `PERMISSION_DENIED`.
7. **Oversized ID Poisoning**: User A attempts `create /users/userA/favorites/<200-char-invalid-id>` -> `PERMISSION_DENIED`.
8. **Fake Timestamp Backdating**: User A creates favorite with client timestamp `createdAt: 2020-01-01` -> `PERMISSION_DENIED`.
9. **Owner Hijacking**: User B updates `/shop_owners/ChIJ123` owned by User A -> `PERMISSION_DENIED`.
10. **Ghost Visibility Bypass**: User A creates `/shop_owners/ChIJ123` with `isPublic: false` -> `PERMISSION_DENIED`.
11. **Out-of-Bounds Review Rating**: User A creates `/shop_reviews/rev1` with `rating: 99` -> `PERMISSION_DENIED`.
12. **Review Author Spoofing**: User B creates `/shop_reviews/rev1` with `authorUid: "userA"` -> `PERMISSION_DENIED`.
