# Action Plan: Login & Onboarding Flow Fixes

## 🚨 Critical Priority (Fix Immediately)

### 1. Enforce Industry Selection - Make It Mandatory

**Issue:** Users can bypass industry selection modal and proceed without selecting industry type.

**Implementation Steps:**

#### 1.1 Update ProtectedRoute to Block Access Without Industry
**File:** `client/src/App.tsx`
- Add check for `user.industryType` in `ProtectedRoute` component
- If missing, redirect to `/onboarding` or show blocking modal
- Ensure this check happens before rendering any protected content

**Code Changes:**
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const currentPath = window.location.pathname;
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // NEW: Block access if industryType is missing (except onboarding page)
  if (!user?.industryType && currentPath !== '/onboarding') {
    return <Redirect to="/onboarding" />;
  }

  return (
    <>
      <IndustrySelectionModal />
      {children}
    </>
  );
}
```

#### 1.2 Make IndustrySelectionModal Non-Dismissible
**File:** `client/src/components/IndustrySelectionModal.tsx`
- Remove ability to close modal without selection
- Remove `onOpenChange` handler that allows dismissal
- Add visual indicator that selection is required
- Show error message if user tries to navigate away

**Code Changes:**
```typescript
// Change Dialog to not allow closing
<Dialog open={isOpen} onOpenChange={(open) => {
  // Only allow closing if industry is selected
  if (!open && !user?.industryType) {
    // Prevent closing - show warning
    return;
  }
}}>
```

#### 1.3 Add Backend Validation for Industry Type
**File:** `server/routes.ts` or `server/middleware/auth.ts`
- Create middleware `requireIndustryType` that checks `user.industryType`
- Apply to all protected routes except `/onboarding` and `/api/user/profile` (for updating)
- Return 403 if industryType is missing

**Implementation:**
```typescript
const requireIndustryType = async (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const user = await storage.getUser(req.user.id);
  if (!user?.industryType) {
    return res.status(403).json({ 
      message: "Industry selection required",
      redirectTo: "/onboarding"
    });
  }
  
  next();
};
```

#### 1.4 Update Onboarding Flow to Set IndustryType
**File:** `client/src/pages/Onboarding.tsx`
- Ensure `industry_selection` step saves to `user.industryType` (not just onboarding responses)
- Call `updateUserProfile({ industryType })` when industry is selected
- Verify industry is saved before allowing progression

**Code Changes:**
```typescript
const handleIndustrySelect = async (industry: string) => {
  // Save to user profile immediately
  await updateUserIndustryMutation.mutateAsync(industry);
  // Then update onboarding responses
  updateResponse({ industry });
};
```

---

## 🔴 High Priority (Fix This Week)

### 2. Improve Cookie Security - Change SameSite to Strict

**Issue:** Cookies use `sameSite: "lax"` which is less secure than "strict".

**Implementation Steps:**

#### 2.1 Update Session Configuration
**File:** `server/session.ts`
- Change `sameSite: "lax"` to `sameSite: "strict"`
- Test that login still works (may need to adjust for OAuth redirects if any)
- Document any exceptions needed

**Code Changes:**
```typescript
export const sessionOptions: SessionOptions = {
  cookieName: "ef.session",
  password: process.env.SESSION_SECRET || "dev_dev_dev_dev_dev_dev_dev_dev_dev_dev_32+chars",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // Changed from "lax"
    httpOnly: true,
  },
};
```

#### 2.2 Add Environment Variable Validation
**File:** `server/session.ts` or `server/bootstrapEnv.ts`
- Add check that `SESSION_SECRET` is set in production
- Throw error if using dev secret in production
- Add validation for minimum secret length (32+ characters)

**Code Changes:**
```typescript
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set and at least 32 characters in production');
  }
  console.warn('[Session] Using weak dev secret - not suitable for production');
}
```

---

### 3. Add Zod Validation to Onboarding Endpoints

**Issue:** Onboarding endpoints lack schema validation.

**Implementation Steps:**

#### 3.1 Create Onboarding Schemas
**File:** `shared/schemas.ts`
- Add `OnboardingUpdateSchema` for `/api/onboarding/update`
- Add `OnboardingCompleteSchema` for `/api/onboarding/complete`
- Validate step names, response structure

**Code Changes:**
```typescript
export const OnboardingStepSchema = z.enum([
  'welcome',
  'industry_selection',
  'questionnaire',
  'preview',
  'upload',
  'material_demo',
  'enhancement_demo',
  'workspace_setup',
  'completed'
]);

export const OnboardingUpdateSchema = z.object({
  step: OnboardingStepSchema,
  responses: z.record(z.unknown()).optional(),
});

export const OnboardingCompleteSchema = z.object({
  // Empty for now, but can add confirmation fields
});
```

#### 3.2 Apply Validation to Routes
**File:** `server/routes.ts`
- Update `/api/onboarding/update` to use `OnboardingUpdateSchema.parse()`
- Update `/api/onboarding/complete` to use `OnboardingCompleteSchema.parse()`
- Return proper validation errors

**Code Changes:**
```typescript
app.post("/api/onboarding/update", authenticateSession, async (req: AuthenticatedRequest, res: any) => {
  try {
    const validated = OnboardingUpdateSchema.parse(req.body);
    // ... rest of handler
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: error.errors 
      });
    }
    // ... handle other errors
  }
});
```

---

## 🟡 Medium Priority (Fix This Month)

### 4. Remove localStorage Fallback from IndustrySelectionModal

**Issue:** Modal uses localStorage as fallback which can desync with database.

**Implementation Steps:**

#### 4.1 Remove localStorage Logic
**File:** `client/src/components/IndustrySelectionModal.tsx`
- Remove all `localStorage.setItem('user_industry')` calls
- Remove `STORAGE_KEY` usage
- Only rely on API calls and database state
- Show loading state while API call is in progress
- Handle errors properly (don't fallback to localStorage)

**Code Changes:**
```typescript
// Remove:
const STORAGE_KEY = 'industry_selection_completed';
localStorage.setItem('user_industry', ...);
localStorage.setItem(STORAGE_KEY, 'true');

// Keep only API-based updates:
const updateIndustryMutation = useMutation({
  mutationFn: async (industryValue: 'real_estate' | null) => {
    const updatedUser = await apiClient.updateUserProfile({ industryType: industryValue });
    return updatedUser;
  },
  // Remove localStorage fallback from onError
});
```

#### 4.2 Add Proper Error Handling
- Show toast/alert if API call fails
- Don't allow user to proceed if update fails
- Retry mechanism or manual retry button

---

### 5. Make industryType Required in Database Schema

**Issue:** `industryType` is nullable, allowing users without industry selection.

**Implementation Steps:**

#### 5.1 Create Migration
**File:** `migrations/038_require_industry_type.sql`
- Add NOT NULL constraint to `industry_type` column
- Set default value for existing users (e.g., 'pool' or 'trades')
- Add check constraint to ensure valid values

**Migration SQL:**
```sql
-- Migration: Require industry_type for all users
-- Set default for existing users without industry
UPDATE users 
SET industry_type = 'pool' 
WHERE industry_type IS NULL;

-- Add NOT NULL constraint
ALTER TABLE users 
  ALTER COLUMN industry_type SET NOT NULL,
  ALTER COLUMN industry_type SET DEFAULT 'pool';

-- Add check constraint for valid values
ALTER TABLE users 
  ADD CONSTRAINT valid_industry_type 
  CHECK (industry_type IN ('pool', 'real_estate', 'trades', 'other'));
```

#### 5.2 Update Schema Definition
**File:** `shared/schema.ts`
- Change `industryType: text("industry_type")` to `industryType: text("industry_type").notNull().default("pool")`
- Update TypeScript types accordingly

#### 5.3 Update Registration Flow
**File:** `server/routes.ts` - `/api/auth/register`
- Require industry selection during registration
- Set `industryType` during user creation
- Validate industry value

**Code Changes:**
```typescript
// In registration endpoint:
const industry = req.body.industry || 'pool'; // Default fallback
if (!['pool', 'real_estate', 'trades', 'other'].includes(industry)) {
  return res.status(400).json({ 
    ok: false, 
    error: "Invalid industry type" 
  });
}

const userToCreate: any = {
  ...userData,
  email: normalizedEmail,
  password: hashedPassword,
  industryType: industry, // Set during registration
  isActive: true,
  // ...
};
```

---

### 6. Add Comprehensive Test Suite

**Issue:** No automated tests for authentication or onboarding flows.

**Implementation Steps:**

#### 6.1 Set Up Test Infrastructure (if not exists)
**Files:** `tests/auth/`, `tests/onboarding/`
- Use existing test framework (Jest/Playwright based on codebase)
- Create test utilities for auth helpers

#### 6.2 Create Authentication Tests
**File:** `tests/auth/login.test.ts`
- Test successful login with correct credentials
- Test failed login with incorrect password
- Test account lockout after 5 failed attempts
- Test rate limiting (20 requests per 15 minutes)
- Test password hashing (verify bcrypt)
- Test session creation on successful login
- Test error messages don't leak sensitive info

**Test Structure:**
```typescript
describe('Authentication', () => {
  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      // Test successful login
    });
    
    it('should fail with incorrect password', async () => {
      // Test failed login
    });
    
    it('should lock account after 5 failed attempts', async () => {
      // Test lockout mechanism
    });
    
    it('should rate limit login attempts', async () => {
      // Test rate limiting
    });
  });
});
```

#### 6.3 Create Onboarding Tests
**File:** `tests/onboarding/flow.test.ts`
- Test onboarding status endpoint
- Test industry selection saves to user.industryType
- Test onboarding completion
- Test redirect to onboarding if industryType missing
- Test protected routes block without industryType

**Test Structure:**
```typescript
describe('Onboarding Flow', () => {
  it('should require industry selection on first login', async () => {
    // Test industry selection enforcement
  });
  
  it('should save industryType to user profile', async () => {
    // Test database update
  });
  
  it('should block protected routes without industryType', async () => {
    // Test route protection
  });
});
```

#### 6.4 Create E2E Tests
**File:** `e2e/auth_onboarding.spec.ts` (Playwright)
- Test full login flow
- Test onboarding flow from start to finish
- Test industry selection modal appears and is required
- Test conditional UI based on industry type
- Test that real estate users see real estate tools
- Test that trades users see trades tools

**E2E Test Structure:**
```typescript
test('complete onboarding flow', async ({ page }) => {
  // 1. Login
  // 2. Verify onboarding modal appears
  // 3. Select industry
  // 4. Complete onboarding steps
  // 5. Verify industry-specific UI appears
});
```

---

## 🟢 Low Priority (Nice to Have)

### 7. Improve Error Messages

**Issue:** Some error messages could be more user-friendly.

**Implementation:**
- Add specific error messages for different failure scenarios
- Provide actionable guidance (e.g., "Account locked, try again in 15 minutes")
- Add i18n support for error messages

---

### 8. Add Session Management UI

**Issue:** No UI for users to view/manage active sessions.

**Implementation:**
- Add `/settings/sessions` page
- Show active sessions with device info
- Allow users to revoke sessions
- Show last login time and location

---

### 9. Add Password Strength Indicator

**Issue:** Registration shows validation errors but no real-time strength indicator.

**Implementation:**
- Add visual password strength meter during registration
- Show requirements checklist
- Provide real-time feedback

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Week 1)
- [ ] 1.1 Update ProtectedRoute to block access without industryType
- [ ] 1.2 Make IndustrySelectionModal non-dismissible
- [ ] 1.3 Add backend validation for industryType
- [ ] 1.4 Update onboarding flow to set industryType immediately

### Phase 2: High Priority (Week 2)
- [ ] 2.1 Change SameSite cookie to "strict"
- [ ] 2.2 Add SESSION_SECRET validation
- [ ] 3.1 Create onboarding Zod schemas
- [ ] 3.2 Apply validation to onboarding endpoints

### Phase 3: Medium Priority (Week 3-4)
- [ ] 4.1 Remove localStorage fallback from IndustrySelectionModal
- [ ] 4.2 Add proper error handling
- [ ] 5.1 Create migration to require industryType
- [ ] 5.2 Update schema definition
- [ ] 5.3 Update registration flow
- [ ] 6.1 Set up test infrastructure
- [ ] 6.2 Create authentication tests
- [ ] 6.3 Create onboarding tests
- [ ] 6.4 Create E2E tests

### Phase 4: Low Priority (Ongoing)
- [ ] 7. Improve error messages
- [ ] 8. Add session management UI
- [ ] 9. Add password strength indicator

---

## 🧪 Testing Strategy

### Manual Testing Checklist
1. **Login Flow:**
   - [ ] Login with correct credentials → success
   - [ ] Login with wrong password → error, no sensitive info
   - [ ] 5 failed attempts → account locked
   - [ ] Rate limiting → 20 requests blocked

2. **Onboarding Flow:**
   - [ ] New user → redirected to onboarding
   - [ ] Industry selection → saved to user.industryType
   - [ ] Try to bypass → blocked from protected routes
   - [ ] Complete onboarding → can access app

3. **Industry Enforcement:**
   - [ ] User without industryType → blocked from dashboard
   - [ ] Real estate user → sees real estate tools only
   - [ ] Trades user → sees trades tools only

### Automated Testing
- Run test suite before each deployment
- E2E tests in CI/CD pipeline
- Security tests for password hashing, rate limiting

---

## 📝 Notes

- **Breaking Changes:** Making industryType required will affect existing users - migration must set defaults
- **Session Security:** Changing SameSite to "strict" may break OAuth flows if any exist - test thoroughly
- **Testing:** Start with critical path tests, expand coverage over time
- **Rollout:** Deploy critical fixes first, then high priority, then medium priority

---

## 🎯 Success Criteria

- ✅ All users must select industry before accessing app
- ✅ Industry selection cannot be bypassed
- ✅ Cookies use strict SameSite policy
- ✅ All API endpoints have proper validation
- ✅ Test coverage for auth/onboarding flows
- ✅ No localStorage fallbacks (single source of truth: database)
- ✅ industryType is required in database schema

