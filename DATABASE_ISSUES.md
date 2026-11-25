# HangoutBFF — Database Issues & Recommendations

> [!WARNING]
> The issues below were discovered during reverse-engineering. They represent potential
> problems, not confirmed bugs — some may be intentional design decisions.

---

## 1. Code / Database Mismatches

### 1.1 `deleteHangout()` — Race condition in message_read_status cleanup
**File:** `lib/supabase/mutations/hangout.ts` (lines 207–211)
**Issue:** The function deletes messages first, then tries to query `messages.id` to find `message_read_status` rows. By the time the second query runs, the messages are already deleted, so the cleanup is a no-op.

```typescript
// BUG: messages are already deleted by the line above
await supabase.from("messages").delete().eq("group_id", groupId);
await supabase.from("message_read_status").delete().in(
    "message_id",
    (await supabase.from("messages").select("id").eq("group_id", groupId)).data?.map(...)
);
```

**Recommendation:** Either:
- Reverse the order (delete `message_read_status` first, then `messages`), or
- Use `ON DELETE CASCADE` on `message_read_status.message_id` (already in the schema) and remove the manual cleanup, or
- Collect message IDs before deleting messages.

### 1.2 `deleteHangout()` — Manual cascade vs. DB CASCADE
**Issue:** The `deleteHangout()` function manually deletes from 6 related tables before deleting the group. If the schema has proper `ON DELETE CASCADE` constraints (which it does in the reconstructed schema), most of this manual cleanup is redundant.

**Recommendation:** With cascading FKs, only the final `DELETE FROM groups WHERE id = groupId` is needed. Consider simplifying the function.

### 1.3 `createHangout` inserts `current_participants: 0`
**File:** `lib/supabase/mutations/hangout.ts` (line 73)
**Issue:** The insert explicitly sets `current_participants: 0`, but the `trigger_create_host_membership` trigger immediately inserts a host membership, which fires `trigger_update_group_participant_count` to set it to 1. The initial value is overwritten almost immediately, so it's harmless but misleading.

**Recommendation:** Remove `current_participants: 0` from the insert since the trigger handles it.

---

## 2. Security Concerns

### 2.1 Client-side host verification
**Issue:** `deleteHangout()` and `removeMember()` still perform host verification client-side by querying `groups.host_id` and comparing it to the user ID. `updateHangout()` now uses the Clerk-authenticated Supabase client, and the `groups_update` RLS policy validates the JWT subject.

**Recommendation:** Apply the group creation/editing policies from `groups_rls_policies.sql` to the live Supabase project. For extra safety, consider using Supabase Edge Functions or database functions (RPC) for critical operations like delete and member removal.

### 2.2 User ID passed as parameter (not from JWT)
**Issue:** Some mutations accept `userId` as a parameter from the client code (e.g., `user?.id` from Clerk). The standard Supabase client (`supabase.ts`) does NOT include the Clerk JWT — it uses the anon key. `createHangout()` and `updateHangout()` now use the Clerk-authenticated client.

**Files affected:**
- `mutations/hangout.ts` — `joinHangout()`, `leaveHangout()`, and `checkMembership()` use the Clerk-authenticated client; other mutations still need review
- `mutations/message.ts` — `sendMessage()` sends with the Clerk token; RLS validates `senderId` against the JWT

**Root cause:** The app creates TWO Supabase clients:
1. `supabase.ts` — Anonymous client (used for most operations)
2. `clerkSupabase.ts` — Authenticated client with the Clerk session token; chat, membership, profile, notification, and hangout create/edit operations use this client

Most queries and mutations still use the **anonymous client**, not the Clerk-authenticated one. Profile, notification, hangout creation, and hangout editing operations use a Clerk session token, but other authenticated operations must also use `createClerkSupabaseClient(token)` for RLS policies that depend on the caller's JWT to work.

> [!CAUTION]
> **This is the most significant security issue.** Until the app switches to using the Clerk-authenticated Supabase client for all mutations, RLS policies cannot verify the caller's identity, and the user ID passed as a parameter must be trusted (which is insecure).

**Recommendation:**
1. Update all queries and mutations to use `createClerkSupabaseClient(token)` instead of the anon `supabase` client.
2. Obtain the current session token via `const token = await getToken()` from Clerk.
3. Only then will RLS policies based on `requesting_user_id()` function correctly.

### 2.4 Chat sends require a joined membership
**Issue:** Message inserts are allowed only when the JWT subject matches `sender_id` and that user has a `group_members` row with `status = 'joined'`. Membership mutations must therefore use the Clerk-authenticated client too.

**Recommendation:** Apply `messages_rls_policies.sql` in the Supabase SQL Editor. If inserts still fail, verify the authenticated Clerk user ID has a joined membership row for that group; do not weaken the policy to allow non-members to send.

### 2.3 Clerk native Supabase integration requirement
**Issue:** Supabase must trust Clerk's session tokens as a third-party auth provider so the RLS policies can read the Clerk user ID from the `sub` claim.

**Recommendation:** Activate the [Clerk Supabase integration](https://dashboard.clerk.com/setup/supabase), then add Clerk as a provider in Supabase under **Authentication → Sign In / Providers**. The app uses Clerk's regular session token; do not copy JWT signing keys or configure the deprecated custom Supabase JWT template.

---

## 3. Missing Database Features

### 3.1 No trigger to compute `profiles.rating_average`
**Issue:** `profiles.rating_average` is selected in `getProfile()` but no code creates or updates ratings. There's no trigger to recompute the average when `group_ratings` changes.

**Recommendation:** Add a trigger on `group_ratings` AFTER INSERT/UPDATE/DELETE:
```sql
CREATE OR REPLACE FUNCTION fn_update_rating_average()
RETURNS TRIGGER AS $$
DECLARE _user_id TEXT;
BEGIN
    _user_id := COALESCE(NEW.user_id, OLD.user_id);
    UPDATE profiles
    SET rating_average = COALESCE(
        (SELECT AVG(rating)::NUMERIC(3,2) FROM group_ratings WHERE user_id = _user_id), 0
    )
    WHERE id = _user_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

### 3.2 No UI for creating reports or ratings
**Issue:** The `reports` and `group_ratings` tables are referenced in `deleteHangout()` for cleanup, but there is no visible UI or mutation function for creating reports or ratings. These features may be planned but are not yet implemented.

### 3.3 No `location_address` on group creation
**Issue:** The `groups` table has a `location_address` column (selected in `getHangoutById`), but `createHangout()` does not insert it. The column will always be NULL for newly created groups.

**Recommendation:** Either:
- Add `locationAddress` to `CreateHangoutParams` and populate it from the geocoder result, or
- Remove the column if it's not needed.

---

## 4. Performance Recommendations

### 4.1 Bounding-box queries on coordinates
**Issue:** Multiple queries filter by `location_lat`/`location_lng` using range comparisons. This works but is not optimal for large datasets.

**Recommendation:** Consider adding a PostGIS `geography` column and using `ST_DWithin()` for more accurate and performant distance queries. This is optional for the current scale.

### 4.2 Interest-based sorting done client-side
**Issue:** `getHangouts()` over-fetches results (3×) and sorts by interest match client-side. This wastes bandwidth and DB resources.

**Recommendation:** Consider a PostgreSQL function or view that scores/sorts by interest overlap server-side.

### 4.3 Conversation ordering
**Issue:** `getConversations()` orders by `messages.created_at` DESC but the final JavaScript sort doesn't actually compare timestamps — it only checks for empty time strings. The actual conversation ordering relies on Supabase's returned order.

---

## 5. Data Integrity Notes

### 5.1 `group_members` UNIQUE constraint
The `(group_id, user_id)` UNIQUE constraint means a user cannot have multiple membership records for the same group. The `joinHangout()` function handles re-joining by updating the existing row's status back to `'joined'`.

### 5.2 `message_read_status` upsert
The `upsert({ onConflict: "message_id,user_id", ignoreDuplicates: true })` pattern relies on the `(message_id, user_id)` UNIQUE constraint. This is correctly defined in the schema.

### 5.3 Saved hangouts are device-local
Saved/bookmarked hangouts use `AsyncStorage` on the device. They are NOT synced across devices or persisted in the database. This is by design but worth noting.

---

## Summary of Priority Actions

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 **Critical** | Switch to Clerk-authenticated Supabase client for all operations | RLS cannot work without JWT |
| 🔴 **Critical** | Activate Clerk's native Supabase integration | Required for RLS-backed auth |
| 🟡 **Medium** | Fix `deleteHangout()` message_read_status race condition | Dead code / no actual cleanup |
| 🟡 **Medium** | Add `rating_average` recomputation trigger | Profile rating will never update |
| 🟢 **Low** | Add `location_address` to group creation flow | Column always NULL |
| 🟢 **Low** | Consider PostGIS for geo queries | Performance at scale |
