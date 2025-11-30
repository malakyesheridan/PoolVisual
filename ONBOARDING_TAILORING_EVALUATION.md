# Onboarding-Based App Tailoring - Evaluation & Implementation Plan

## Current State Evaluation

### ✅ What's Already Implemented

1. **Industry-Based Tailoring**
   - ✅ Industry saved to organization during onboarding
   - ✅ Materials filtered by industry (backend + frontend)
   - ✅ Material categories are industry-specific (trade_category_mapping)
   - ✅ Terminology is industry-specific (jobs/quotes pages use `getIndustryTerm()`)
   - ✅ Organization industry stored in `orgStore` and accessible throughout app

2. **Onboarding Data Storage**
   - ✅ Onboarding responses stored in database (`user_onboarding` table)
   - ✅ Responses include: `industry`, `role`, `useCase`, `experience`
   - ✅ API endpoints exist: `/api/onboarding/status`, `/api/onboarding/update`, `/api/onboarding/complete`

### ❌ What's Missing

1. **No Centralized Onboarding Data Access**
   - ❌ No React hook or store to access onboarding data throughout the app
   - ❌ Components must manually fetch onboarding status
   - ❌ No caching or persistence of onboarding data

2. **No Feature Customization Based on Onboarding**
   - ❌ Dashboard doesn't use onboarding data to customize content
   - ❌ No feature flags or conditional rendering based on `role`, `useCase`, or `experience`
   - ❌ All users see the same features regardless of their onboarding responses

3. **No Progressive Disclosure**
   - ❌ No experience-based feature visibility (beginner vs advanced)
   - ❌ No contextual help/tooltips based on experience level
   - ❌ No guided tours or onboarding tooltips for new users

4. **No Role-Based Customization**
   - ❌ No role-specific dashboards or views
   - ❌ No role-based feature visibility (e.g., estimators see different features than designers)
   - ❌ No role-based workflows or shortcuts

5. **No Use Case Customization**
   - ❌ Dashboard doesn't prioritize features based on `useCase` (quotes vs design vs project management)
   - ❌ No use-case-specific quick actions or shortcuts
   - ❌ No contextual suggestions based on primary use case

6. **No Post-Onboarding Personalization**
   - ❌ No personalized welcome messages or tips
   - ❌ No contextual help based on onboarding responses
   - ❌ No feature discovery based on user's stated goals

## Research: How Top Apps Implement Conditional Functionality

### 1. **Feature Flags & Conditional Rendering**
- **Slack**: Uses feature flags to show/hide features based on user tier and preferences
- **Notion**: Progressive disclosure - shows basic features first, advanced features as users explore
- **Figma**: Role-based UI - designers see different tools than developers
- **Implementation**: React context + conditional rendering based on user state

### 2. **Progressive Disclosure**
- **Duolingo**: Shows features gradually based on user progress and goals
- **Canva**: Post-signup survey determines which templates and features to highlight
- **Implementation**: Experience level determines feature visibility and complexity

### 3. **Personalized Dashboards**
- **Monday.com**: Dashboard layout and widgets customized based on user role and preferences
- **Asana**: Different views for different user types (project managers vs team members)
- **Implementation**: Dynamic dashboard composition based on onboarding data

### 4. **Contextual Help & Guidance**
- **Intercom**: Shows contextual tooltips and help based on user's current task and experience
- **Zendesk**: Progressive help system that adapts to user expertise
- **Implementation**: Experience level determines help visibility and detail level

### 5. **User Segmentation**
- **HubSpot**: Different onboarding flows and features for different user personas
- **Salesforce**: Role-based feature sets and workflows
- **Implementation**: Segment users by industry + role + useCase + experience

## Implementation Plan

### Phase 1: Foundation - Onboarding Data Access Layer

**Goal**: Create centralized, cached access to onboarding data throughout the app

**Tasks**:
1. Create `useOnboarding()` hook that:
   - Fetches onboarding data from API
   - Caches in React Query
   - Provides typed access to responses
   - Auto-refreshes when onboarding is updated

2. Create `onboardingStore` (Zustand) for:
   - Client-side caching
   - Quick access without API calls
   - Type-safe access to responses

3. Add onboarding data to user context/store:
   - Include onboarding in auth store or create separate store
   - Make it available globally

**Files to Create/Modify**:
- `client/src/hooks/useOnboarding.ts` (NEW)
- `client/src/stores/onboardingStore.ts` (NEW)
- `client/src/lib/api-client.ts` (already has methods, ensure they're used)

**Success Criteria**:
- Any component can access onboarding data with `const { onboarding } = useOnboarding()`
- Data is cached and doesn't require repeated API calls
- Type-safe access to `industry`, `role`, `useCase`, `experience`

---

### Phase 2: Feature Flags & Conditional Rendering System

**Goal**: Implement feature flags and conditional rendering based on onboarding data

**Tasks**:
1. Create `FeatureFlags` component/utility:
   - `useFeatureFlag(feature, conditions)` hook
   - Supports conditions based on: `industry`, `role`, `useCase`, `experience`
   - Type-safe feature flag definitions

2. Create feature flag definitions:
   ```typescript
   const FEATURE_FLAGS = {
     advancedMaterials: { minExperience: 'intermediate' },
     bulkOperations: { roles: ['owner', 'manager'] },
     aiEnhancement: { industries: ['real_estate', 'pool'] },
     projectTemplates: { useCases: ['project_management', 'all'] },
     // etc.
   }
   ```

3. Implement conditional rendering helpers:
   - `<FeatureGate feature="advancedMaterials">...</FeatureGate>`
   - `ifFeature('bulkOperations', () => ...)`
   - `useFeatureVisibility('aiEnhancement')`

**Files to Create**:
- `client/src/lib/featureFlags.ts` (NEW)
- `client/src/components/common/FeatureGate.tsx` (NEW)
- `client/src/hooks/useFeatureFlag.ts` (NEW)

**Success Criteria**:
- Features can be conditionally shown/hidden based on onboarding
- Type-safe feature flag system
- Easy to add new feature flags

---

### Phase 3: Dashboard Personalization

**Goal**: Customize dashboard based on onboarding responses

**Tasks**:
1. Create personalized dashboard layouts:
   - **By Use Case**:
     - `quotes`: Show quote-focused widgets (recent quotes, quote templates, quick quote actions)
     - `design`: Show design-focused widgets (material library, recent designs, design templates)
     - `project_management`: Show project-focused widgets (active projects, deadlines, team activity)
     - `all`: Show comprehensive dashboard

   - **By Role**:
     - `owner`: Show business metrics, revenue, team activity
     - `manager`: Show project pipeline, team workload, deadlines
     - `estimator`: Show quote templates, pricing tools, material costs
     - `designer`: Show design tools, material library, recent work

   - **By Experience**:
     - `beginner`: Show guided tours, tips, simplified views
     - `intermediate`: Show standard features with occasional tips
     - `advanced`: Show all features, keyboard shortcuts, power user tools

2. Create dynamic dashboard composition:
   - Dashboard reads onboarding data
   - Composes widgets based on user profile
   - Allows user to customize (save preferences)

3. Add contextual quick actions:
   - Show relevant quick actions based on useCase
   - Prioritize features based on role

**Files to Modify**:
- `client/src/components/dashboard/ProjectDashboard.tsx`
- `client/src/components/dashboard/SimplifiedDashboard.tsx`
- `client/src/components/dashboard/DashboardWidgets.tsx` (NEW - modular widgets)

**Success Criteria**:
- Dashboard layout changes based on onboarding
- Users see relevant features prioritized
- Can still access all features (just reordered/prioritized)

---

### Phase 4: Progressive Disclosure & Experience-Based Features

**Goal**: Show/hide features and help based on experience level

**Tasks**:
1. Implement experience-based feature visibility:
   - `beginner`: Hide advanced features, show tooltips, simplified UI
   - `intermediate`: Show most features, occasional tips
   - `advanced`: Show all features, keyboard shortcuts, power tools

2. Create contextual help system:
   - Tooltips that appear based on experience level
   - Guided tours for beginners
   - Advanced tips for experienced users
   - Help content tailored to industry

3. Add feature discovery:
   - Highlight new features based on useCase
   - Suggest features based on role
   - Progressive feature unlocking

**Files to Create/Modify**:
- `client/src/components/common/ContextualHelp.tsx` (NEW)
- `client/src/components/common/FeatureTooltip.tsx` (NEW)
- `client/src/lib/helpContent.ts` (NEW - help content by industry/role/experience)
- All feature components (add conditional help)

**Success Criteria**:
- Beginners see simplified UI with help
- Advanced users see all features
- Help content is contextual and relevant

---

### Phase 5: Role-Based Customization

**Goal**: Customize app based on user role

**Tasks**:
1. Create role-specific views:
   - **Owner**: Business metrics, team management, settings
   - **Manager**: Project pipeline, team workload, deadlines
   - **Estimator**: Quote tools, pricing, material costs
   - **Designer**: Design tools, material library, visualizations

2. Implement role-based navigation:
   - Show/hide menu items based on role
   - Prioritize relevant sections
   - Role-specific shortcuts

3. Add role-based workflows:
   - Estimators: Quick quote creation flow
   - Designers: Material selection and visualization flow
   - Managers: Project overview and team coordination flow

**Files to Modify**:
- `client/src/layout/AppShell.tsx` (navigation)
- `client/src/components/layout/sidebar-nav.tsx` (menu items)
- `client/src/components/layout/top-navigation.tsx` (quick actions)
- Create role-specific workflow components

**Success Criteria**:
- Navigation adapts to role
- Workflows optimized for each role
- Features relevant to role are prioritized

---

### Phase 6: Use Case Customization

**Goal**: Prioritize features and workflows based on primary use case

**Tasks**:
1. Create use-case-specific quick actions:
   - `quotes`: Quick quote creation, quote templates, pricing tools
   - `design`: Material library, design tools, visualization
   - `project_management`: Project overview, team coordination, deadlines

2. Implement use-case-based feature prioritization:
   - Show relevant features first
   - Hide or de-prioritize irrelevant features
   - Suggest features based on use case

3. Add use-case-specific onboarding tips:
   - Tips for quote-focused users
   - Tips for design-focused users
   - Tips for project management users

**Files to Modify**:
- `client/src/components/dashboard/ActionCenter.tsx`
- `client/src/components/common/QuickActions.tsx` (NEW)
- All major feature pages (prioritize based on useCase)

**Success Criteria**:
- Quick actions match user's primary use case
- Features are prioritized appropriately
- Users can discover features relevant to their use case

---

### Phase 7: Post-Onboarding Personalization

**Goal**: Continue personalization after onboarding is complete

**Tasks**:
1. Add personalized welcome messages:
   - Welcome back messages based on role/industry
   - Tips based on onboarding responses
   - Feature suggestions based on use case

2. Implement contextual suggestions:
   - Suggest features based on onboarding
   - Recommend workflows based on role
   - Show relevant templates/examples based on industry

3. Add onboarding-based analytics:
   - Track feature usage by onboarding segment
   - Identify features that need better discovery
   - Optimize onboarding based on user behavior

**Files to Create/Modify**:
- `client/src/components/common/WelcomeMessage.tsx` (NEW)
- `client/src/components/common/FeatureSuggestions.tsx` (NEW)
- `client/src/lib/personalization.ts` (NEW - personalization logic)

**Success Criteria**:
- Users see personalized content after onboarding
- Features are suggested based on onboarding
- Analytics track personalization effectiveness

---

## Implementation Priority

### High Priority (Core Functionality)
1. **Phase 1**: Foundation - Onboarding Data Access Layer
2. **Phase 2**: Feature Flags & Conditional Rendering System
3. **Phase 3**: Dashboard Personalization

### Medium Priority (Enhanced Experience)
4. **Phase 4**: Progressive Disclosure & Experience-Based Features
5. **Phase 5**: Role-Based Customization

### Lower Priority (Polish & Optimization)
6. **Phase 6**: Use Case Customization
7. **Phase 7**: Post-Onboarding Personalization

---

## Technical Architecture

### Data Flow
```
Onboarding Data (DB) 
  → API Endpoint (/api/onboarding/status)
  → useOnboarding() Hook
  → onboardingStore (Zustand)
  → Feature Flags System
  → Conditional Rendering
  → Personalized UI
```

### Key Components
1. **Onboarding Hook**: `useOnboarding()` - Centralized data access
2. **Feature Flags**: `useFeatureFlag()` - Conditional feature visibility
3. **Personalization Engine**: `getPersonalizedContent()` - Content customization
4. **Dashboard Composer**: Dynamic widget composition based on onboarding

### Data Structures
```typescript
interface OnboardingData {
  industry: 'pool' | 'landscaping' | 'building' | 'electrical' | 'plumbing' | 'real_estate' | 'other';
  role: 'owner' | 'manager' | 'estimator' | 'designer' | 'other';
  useCase: 'quotes' | 'design' | 'project_management' | 'all';
  experience: 'beginner' | 'intermediate' | 'advanced';
  completed: boolean;
}

interface FeatureFlag {
  id: string;
  conditions: {
    industries?: string[];
    roles?: string[];
    useCases?: string[];
    minExperience?: 'beginner' | 'intermediate' | 'advanced';
  };
}
```

---

## Success Metrics

1. **User Engagement**: Track feature usage by onboarding segment
2. **Time to Value**: Measure time to first meaningful action by experience level
3. **Feature Discovery**: Track which features users discover based on onboarding
4. **User Satisfaction**: Survey users on personalization relevance
5. **Retention**: Compare retention rates by onboarding segment

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (Foundation)
3. Implement incrementally, testing after each phase
4. Gather user feedback and iterate
5. Monitor metrics and optimize

