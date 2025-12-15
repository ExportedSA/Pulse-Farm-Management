# Compliance Module Components

This directory contains React components for the compliance and safety module of the Pulse Farm Management System.

## Components

### HazardList
- Fetches and displays farm hazards from `/api/compliance/hazards`
- Shows hazard details: title, type, risk level, status, location
- Provides "Resolve" button for active hazards
- Updates local state when hazards are resolved

### HazardForm
- Form to report new hazards
- Fields: title, description, type, risk level, location
- Submits to `/api/compliance/hazards`
- Shows success/error feedback
- Clears form on successful submission

### IncidentList
- Fetches and displays incidents from `/api/compliance/incidents`
- Shows incident details: type, description, severity, status
- Dropdown to update incident status (open/investigating/resolved/closed)
- Color-coded severity indicators

### IncidentForm
- Form to report new incidents
- Fields: type, description, date/time, severity, location
- Submits to `/api/compliance/incidents`
- Includes safety notice for emergencies

### InductionList
- Displays induction modules from `/api/compliance/inductions`
- Shows module type, mandatory status, completion status
- Fetches completion data for logged-in user
- "Start" and "Review" buttons for modules

### CheckInForm
- Visitor/staff check-in form
- Fields: name, type, company, reason, contact details
- Submits to `/api/compliance/checkins` (endpoint may need to be created)
- Includes safety notice

### CompliancePage
- Main page component with tab navigation
- Integrates all compliance components
- Shows quick stats dashboard
- Handles refresh triggers for lists

## Integration

To add the compliance module to your application:

1. **Add to Navigation**
   ```tsx
   import { CompliancePage } from '@/components/compliance';
   
   // Add to your route configuration
   <Route path="/compliance" component={CompliancePage} />
   ```

2. **Add Navigation Link**
   ```tsx
   <Link to="/compliance" className="nav-item">
     <span className="icon">⚠️</span>
     Compliance
   </Link>
   ```

3. **Ensure API Endpoints Exist**
   The following endpoints should be implemented on the backend:
   - `GET /api/compliance/hazards`
   - `POST /api/compliance/hazards`
   - `POST /api/compliance/hazards/:id/resolve`
   - `GET /api/compliance/incidents`
   - `POST /api/compliance/incidents`
   - `PATCH /api/compliance/incidents/:id/status`
   - `GET /api/compliance/inductions`
   - `GET /api/compliance/inductions/completions?userId=:id`
   - `POST /api/compliance/checkins` (optional)

## Styling

Components use Tailwind CSS classes for styling. The design follows a clean, professional pattern with:
- Card-based layouts with shadows
- Color-coded status indicators
- Responsive grid layouts
- Consistent spacing and typography

## State Management

Components use React hooks for local state management:
- `useState` for form data and UI state
- `useEffect` for data fetching
- Error handling with user-friendly messages
- Loading states during API calls

## Testing

To test the components:
1. Ensure backend API endpoints are running
2. Navigate to `/compliance` in your application
3. Test creating new hazards and incidents
4. Verify status updates work correctly
5. Check form validation and error handling

## Notes

- Components are fully typed with TypeScript
- API calls use the centralized `api` helper from `@/lib/api`
- Forms include proper validation
- Components handle API errors gracefully
- Responsive design works on mobile and desktop
