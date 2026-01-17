# Cron Cleanup Summary & Recommendations

**Date:** 2025-01-28  
**Quick Reference:** Implications and action plan for cron cleanup

---

## Executive Summary

### 1. Remove `api/cron/process-posts.ts` ✅ **SAFE**

**Impact:** Minimal risk, cleaner codebase

**What happens:**
- File is already unused (removed from `vercel.json`)
- Manual testing still possible via direct Edge Function calls
- No production impact (pg_cron handles all execution)

**Action:** Delete the file or keep with comment "for manual testing only"

---

### 2. Fix Hardcoded Secrets in Migrations 🔴 **HIGH PRIORITY**

**Impact:** Security risk, but fix requires testing

**Current Problem:**
```sql
-- Hardcoded in migrations:
'Authorization', 'Bearer Sonara2026!'
```

**Security Risks:**
- Secret exposed in git history
- Can't rotate without new migration
- Visible to anyone with repo access

**Solutions (in order of preference):**

#### Option A: Use Database Config Variable (Easiest) ✅

**Pros:**
- Simple to implement
- Works on all Supabase plans
- Secret not in code

**Implementation:**
```sql
-- 1. Set secret via Supabase Dashboard or CLI
-- Database → Settings → Database → Custom Config
-- Add: cron_secret = 'Sonara2026!'

-- 2. Update migration:
SELECT cron.schedule(
  'process-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Note:** Requires setting `app.cron_secret` in database config first.

---

#### Option B: Keep Hardcoded but Document (Temporary) ⚠️

**If you can't change migrations right now:**

1. Ensure repo is private
2. Document risk in README
3. Plan to fix before making repo public
4. Rotate secret if repo is ever shared

**Pros:**
- No code changes needed
- Works immediately

**Cons:**
- Security risk remains
- Can't easily rotate

---

#### Option C: Use Supabase Vault (If Available) 🔒

**Check availability:**
```sql
SELECT * FROM pg_available_extensions WHERE name LIKE '%vault%';
```

**If available:**
```sql
-- Store in vault first (via CLI or dashboard)
-- supabase secrets set CRON_SECRET=Sonara2026!

-- Then in migration:
SELECT cron.schedule(
  'process-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (vault.get_secret('CRON_SECRET')).decrypted_secret
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Note:** Vault may require Pro plan or may not be available.

---

## Recommended Action Plan

### Phase 1: Quick Win (Do Now) ✅

1. **Delete `api/cron/process-posts.ts`**
   - File is unused
   - No risk
   - Cleaner codebase

### Phase 2: Security Fix (Do Soon) 🔴

1. **Choose solution:**
   - Try Option A (database config) - easiest
   - If not available, use Option B (document risk)
   - If Vault available, use Option C (most secure)

2. **Test on dev/staging first:**
   - Create new migration with fix
   - Test that pg_cron jobs still work
   - Verify Edge Function authentication

3. **Apply to production:**
   - Run migration
   - Verify cron jobs execute successfully
   - Monitor for 24 hours

### Phase 3: Verification ✅

After changes:
- [ ] pg_cron jobs execute successfully
- [ ] Edge Functions authenticate correctly
- [ ] No secrets in git history (check with `git log -S "Sonara2026"`)
- [ ] Documentation updated

---

## Testing Commands

### Test pg_cron Status:
```sql
-- Check if jobs exist
SELECT * FROM cron.job 
WHERE jobname IN ('process-scheduled-posts', 'process-agent-actions');

-- Check recent executions
SELECT 
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('process-scheduled-posts', 'process-agent-actions')
ORDER BY jrd.start_time DESC
LIMIT 10;
```

### Test Edge Function Directly:
```bash
# Test process-scheduled-posts
curl -X POST https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-scheduled-posts \
  -H "Authorization: Bearer Sonara2026!" \
  -H "Content-Type: application/json"

# Test process-agent-actions
curl -X POST https://wqwhlbmsafgjlsjujuel.supabase.co/functions/v1/process-agent-actions \
  -H "Authorization: Bearer Sonara2026!" \
  -H "Content-Type: application/json"
```

---

## Files to Update

### Immediate:
- [ ] Delete `api/cron/process-posts.ts` (or add comment)

### Security Fix:
- [ ] Create new migration: `YYYYMMDD_fix_cron_secrets.sql`
- [ ] Update `supabase/migrations/20250122_setup_pg_cron_scheduler.sql` (or create new)
- [ ] Update `supabase/migrations/20250128_add_process_agent_cron.sql` (or create new)
- [ ] Update documentation

### Documentation:
- [ ] Update `docs/CRON_ARCHITECTURE.md`
- [ ] Update `docs/CRON_ANALYSIS.md`
- [ ] Add security note to README

---

## Risk Assessment

| Action | Risk Level | Impact | Priority |
|--------|-----------|--------|----------|
| Delete `process-posts.ts` | 🟢 Low | Cleaner code | Low |
| Fix hardcoded secrets | 🔴 High | Security | **HIGH** |
| Test migrations | 🟡 Medium | Stability | Medium |

---

**Last Updated:** 2025-01-28
