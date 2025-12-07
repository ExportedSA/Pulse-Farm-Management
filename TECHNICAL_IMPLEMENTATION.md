# Pasture Walk Technical Implementation Guide

## Overview
This document provides the technical implementation details for the enhanced Pasture Walk system, including database schema, UI components, and integration instructions.

## 📁 New Files Created

### UI Components
1. **`FeedWedgeChart.tsx`** - Interactive feed wedge visualization with Recharts
2. **`PastureWalkForm.tsx`** - Quick and detailed measurement entry forms
3. **`FarmMetricsDashboard.tsx`** - KPI cards and farm performance metrics
4. **`RotationCalendar.tsx`** - Visual calendar for rotation planning
5. **`GrowthRateTrend.tsx`** - Growth rate analysis with environmental correlations

### Database Schema
6. **`schema_additions.sql`** - Complete SQL schema for new features

---

## 🗄️ Database Schema Implementation

### Core Tables

#### 1. `pasture_measurements`
```sql
-- Enhanced measurement tracking with GPS, weather, and method support
CREATE TABLE pasture_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pasture_id UUID NOT NULL REFERENCES pastures(id),
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    measured_by UUID NOT NULL REFERENCES users(id),
    cover_kg_dm_ha INTEGER NOT NULL,
    measurement_method VARCHAR(50) NOT NULL, -- 'plate_meter', 'visual', 'satellite', 'drone'
    pre_or_post VARCHAR(10) NOT NULL, -- 'pre', 'post'
    plate_reading_cm DECIMAL(4,1), -- Optional plate meter reading
    notes TEXT,
    weather_conditions JSONB,
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    measurement_session_id UUID REFERENCES pasture_walk_sessions(id)
);
```

#### 2. `farm_pasture_settings`
```sql
-- Centralized farm configuration
CREATE TABLE farm_pasture_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id),
    target_pre_grazing_cover INTEGER NOT NULL DEFAULT 2800,
    target_post_grazing_residual INTEGER NOT NULL DEFAULT 1500,
    target_rotation_length INTEGER NOT NULL DEFAULT 21,
    herd_size INTEGER NOT NULL DEFAULT 100,
    daily_demand_per_cow DECIMAL(5,2) NOT NULL DEFAULT 15.0,
    grazing_area_ha DECIMAL(8,2) NOT NULL,
    growth_rate_target INTEGER DEFAULT 45,
    optimal_ndvi_min DECIMAL(3,2) DEFAULT 0.6,
    optimal_ndvi_max DECIMAL(3,2) DEFAULT 0.8
);
```

#### 3. `growth_rate_records`
```sql
-- Automated growth rate tracking
CREATE TABLE growth_rate_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(id),
    recorded_at DATE NOT NULL,
    growth_rate INTEGER NOT NULL, -- kg DM/ha/day
    calculation_method VARCHAR(50) NOT NULL,
    measurement_count INTEGER NOT NULL DEFAULT 0,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    weather_factor DECIMAL(3,2) DEFAULT 1.0,
    seasonal_factor DECIMAL(3,2) DEFAULT 1.0
);
```

### Migration Steps
1. **Backup existing database**
2. **Run schema_additions.sql**:
   ```bash
   psql -d your_database -f database/schema_additions.sql
   ```
3. **Migrate existing data**:
   ```sql
   -- Migrate old measurements to new format
   INSERT INTO pasture_measurements (pasture_id, measured_at, measured_by, cover_kg_dm_ha, measurement_method, pre_or_post)
   SELECT pasture_id, measured_at, measured_by, cover_kg_dm_ha, 'visual', 'pre' FROM old_measurements;
   ```
4. **Update application configuration**

---

## 🧩 UI Components Integration

### 1. FeedWedgeChart Component

**Props Interface:**
```typescript
interface FeedWedgeData {
  name: string;
  cover: number;
  target: number;
  status: 'ready' | 'low' | 'high' | 'optimal';
}

interface FeedWedgeChartProps {
  data: FeedWedgeData[];
  targetPreGrazing: number;
  targetPostGrazing: number;
}
```

**Usage Example:**
```typescript
import FeedWedgeChart from '@/components/FeedWedgeChart';

const feedWedgeData = [
  { name: 'Paddock 1', cover: 2850, target: 2800, status: 'ready' },
  { name: 'Paddock 2', cover: 2200, target: 2800, status: 'low' },
  // ... more paddocks
];

<FeedWedgeChart 
  data={feedWedgeData}
  targetPreGrazing={2800}
  targetPostGrazing={1500}
/>
```

### 2. PastureWalkForm Component

**Features:**
- Quick entry cards for multiple paddocks
- Detailed measurement form with plate meter conversion
- Method selection (plate meter, visual, satellite)
- Pre/post grazing timing
- GPS coordinates support

**Usage Example:**
```typescript
import PastureWalkForm from '@/components/PastureWalkForm';

const handleMeasurementSubmit = (data) => {
  // Submit measurement to API
  api.submitMeasurement(data);
};

<PastureWalkForm 
  pastures={pastures}
  onSubmit={handleMeasurementSubmit}
  loading={false}
/>
```

### 3. FarmMetricsDashboard Component

**Key Metrics:**
- Paddocks measured vs total
- Average cover with trend indicators
- Growth rate monitoring
- Rotation length tracking
- Herd size and daily demand
- Paddock status distribution

**Usage Example:**
```typescript
import FarmMetricsDashboard from '@/components/FarmMetricsDashboard';

const metricsData = {
  totalPaddocks: 15,
  measuredPaddocks: 12,
  averageCover: 2450,
  averageGrowth: 42,
  targetPreGrazing: 2800,
  targetPostGrazing: 1500,
  herdSize: 120,
  dailyDemand: 15.5,
  grazingArea: 150.0,
  rotationLength: 21,
  readyPaddocks: 8,
  optimalPaddocks: 3,
  lowPaddocks: 2,
  highPaddocks: 2
};

<FarmMetricsDashboard data={metricsData} loading={false} />
```

### 4. RotationCalendar Component

**Features:**
- Visual weekly/monthly calendar view
- Paddock status color coding
- Drag-and-drop rotation planning
- Click-to-edit functionality
- Rotation efficiency metrics

**Usage Example:**
```typescript
import RotationCalendar from '@/components/RotationCalendar';

const handleDateChange = (date) => {
  setSelectedDate(date);
};

const handlePaddockClick = (paddock) => {
  setSelectedPaddock(paddock);
};

<RotationCalendar 
  paddocks={paddocks}
  rotationLength={21}
  onDateChange={handleDateChange}
  onPaddockClick={handlePaddockClick}
/>
```

### 5. GrowthRateTrend Component

**Features:**
- 30-day growth rate trend chart
- Environmental factor correlation
- Performance indicators
- Automated recommendations
- Data export functionality

**Usage Example:**
```typescript
import GrowthRateTrend from '@/components/GrowthRateTrend';

const growthData = [
  { date: '2024-12-01', growth_rate: 45, target_rate: 45, temperature: 18, rainfall: 12, measurement_count: 12 },
  // ... more data points
];

<GrowthRateTrend 
  data={growthData}
  targetGrowthRate={45}
  loading={false}
  onExport={() => exportGrowthData()}
/>
```

---

## 🔧 API Integration

### New Endpoints Required

#### 1. Pasture Measurements
```typescript
// GET /api/pasture-measurements
// POST /api/pasture-measurements
// PUT /api/pasture-measurements/:id
// DELETE /api/pasture-measurements/:id

interface MeasurementAPI {
  getMeasurements(pastureId?: string, dateRange?: DateRange): Promise<PastureMeasurement[]>;
  createMeasurement(data: CreateMeasurementData): Promise<PastureMeasurement>;
  updateMeasurement(id: string, data: UpdateMeasurementData): Promise<PastureMeasurement>;
  deleteMeasurement(id: string): Promise<void>;
}
```

#### 2. Farm Settings
```typescript
// GET /api/farm-settings
// PUT /api/farm-settings

interface FarmSettingsAPI {
  getSettings(farmId: string): Promise<FarmPastureSettings>;
  updateSettings(farmId: string, data: UpdateFarmSettingsData): Promise<FarmPastureSettings>;
}
```

#### 3. Growth Rates
```typescript
// GET /api/growth-rates
// POST /api/growth-rates/calculate

interface GrowthRateAPI {
  getGrowthRates(farmId: string, dateRange?: DateRange): Promise<GrowthRateRecord[]>;
  calculateGrowthRate(farmId: string, startDate: Date, endDate: Date): Promise<GrowthRateRecord>;
}
```

### Sample API Implementation
```typescript
// server/routes/pasture-measurements.ts
import express from 'express';
import { db } from '../db';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { pasture_id, start_date, end_date } = req.query;
  
  let query = `
    SELECT pm.*, p.name as pasture_name, u.email as measured_by_email
    FROM pasture_measurements pm
    JOIN pastures p ON pm.pasture_id = p.id
    JOIN users u ON pm.measured_by = u.id
    WHERE p.farm_id = $1
  `;
  
  const params = [req.user.farm_id];
  
  if (pasture_id) {
    query += ' AND pm.pasture_id = $2';
    params.push(pasture_id);
  }
  
  if (start_date && end_date) {
    query += ' AND pm.measured_at::DATE BETWEEN $3 AND $4';
    params.push(start_date, end_date);
  }
  
  query += ' ORDER BY pm.measured_at DESC';
  
  const result = await db.query(query, params);
  res.json(result.rows);
});

router.post('/', authenticate, async (req, res) => {
  const {
    pasture_id,
    cover_kg_dm_ha,
    measurement_method,
    pre_or_post,
    plate_reading_cm,
    notes,
    gps_latitude,
    gps_longitude
  } = req.body;
  
  const query = `
    INSERT INTO pasture_measurements 
    (pasture_id, measured_by, cover_kg_dm_ha, measurement_method, pre_or_post, plate_reading_cm, notes, gps_latitude, gps_longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  
  const values = [
    pasture_id,
    req.user.id,
    cover_kg_dm_ha,
    measurement_method,
    pre_or_post,
    plate_reading_cm,
    notes,
    gps_latitude,
    gps_longitude
  ];
  
  const result = await db.query(query, values);
  res.status(201).json(result.rows[0]);
});

export default router;
```

---

## 📱 Mobile Integration

### GPS Integration
```typescript
// Mobile GPS service
class MobileGPSService {
  async getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      });
    });
  }
  
  async watchPosition(callback: (position: GeolocationPosition) => void): Promise<number> {
    return navigator.geolocation.watchPosition(callback, null, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    });
  }
}
```

### Offline Storage
```typescript
// IndexedDB for offline measurements
class OfflineStorage {
  private db: IDBDatabase | null = null;
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PastureWalkOffline', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore('measurements', { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus');
        store.createIndex('createdAt', 'createdAt');
      };
    });
  }
  
  async saveMeasurement(measurement: any): Promise<void> {
    const transaction = this.db!.transaction(['measurements'], 'readwrite');
    const store = transaction.objectStore('measurements');
    await store.add({ ...measurement, syncStatus: 'pending', createdAt: Date.now() });
  }
  
  async getPendingMeasurements(): Promise<any[]> {
    const transaction = this.db!.transaction(['measurements'], 'readonly');
    const store = transaction.objectStore('measurements');
    const index = store.index('syncStatus');
    return index.getAll('pending');
  }
}
```

---

## 🛠️ Installation and Setup

### 1. Install Dependencies
```bash
# UI dependencies
npm install recharts date-fns

# Database dependencies (if using PostgreSQL)
npm install pg @types/pg

# Mobile dependencies
npm install @capacitor/geolocation @capacitor/storage
```

### 2. Update Import Statements
Add to your main component file:
```typescript
import FeedWedgeChart from '@/components/FeedWedgeChart';
import PastureWalkForm from '@/components/PastureWalkForm';
import FarmMetricsDashboard from '@/components/FarmMetricsDashboard';
import RotationCalendar from '@/components/RotationCalendar';
import GrowthRateTrend from '@/components/GrowthRateTrend';
```

### 3. Update Route Handlers
Add to your server routes:
```typescript
// server/routes.ts
import pastureMeasurementsRoutes from './routes/pasture-measurements';
import farmSettingsRoutes from './routes/farm-settings';
import growthRateRoutes from './routes/growth-rates';

app.use('/api/pasture-measurements', pastureMeasurementsRoutes);
app.use('/api/farm-settings', farmSettingsRoutes);
app.use('/api/growth-rates', growthRateRoutes);
```

### 4. Database Migration
```bash
# Run the schema additions
psql -d your_database -f database/schema_additions.sql

# Verify tables were created
\dt pasture_measurements
\dt farm_pasture_settings
\dt growth_rate_records
```

---

## 🧪 Testing

### Unit Tests
```typescript
// __tests__/components/FeedWedgeChart.test.tsx
import { render, screen } from '@testing-library/react';
import FeedWedgeChart from '@/components/FeedWedgeChart';

describe('FeedWedgeChart', () => {
  const mockData = [
    { name: 'Paddock 1', cover: 2850, target: 2800, status: 'ready' }
  ];

  it('renders feed wedge chart', () => {
    render(<FeedWedgeChart data={mockData} targetPreGrazing={2800} targetPostGrazing={1500} />);
    expect(screen.getByText('Feed Wedge Analysis')).toBeInTheDocument();
  });
});
```

### Integration Tests
```typescript
// __tests__/api/measurements.test.ts
import request from 'supertest';
import app from '../app';

describe('Measurements API', () => {
  it('should create a new measurement', async () => {
    const response = await request(app)
      .post('/api/pasture-measurements')
      .send({
        pasture_id: 'test-id',
        cover_kg_dm_ha: 2500,
        measurement_method: 'plate_meter',
        pre_or_post: 'pre'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.cover_kg_dm_ha).toBe(2500);
  });
});
```

---

## 📊 Performance Optimization

### Database Indexes
```sql
-- Additional performance indexes
CREATE INDEX CONCURRENTLY idx_pasture_measurements_composite 
ON pasture_measurements(pasture_id, measured_at DESC, pre_or_post);

CREATE INDEX CONCURRENTLY idx_growth_rate_records_composite 
ON growth_rate_records(farm_id, recorded_at DESC);
```

### Caching Strategy
```typescript
// Redis caching for frequently accessed data
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

class CacheService {
  async getFarmMetrics(farmId: string): Promise<FarmMetrics | null> {
    const cached = await redis.get(`farm_metrics:${farmId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async setFarmMetrics(farmId: string, metrics: FarmMetrics): Promise<void> {
    await redis.setex(`farm_metrics:${farmId}`, 300, JSON.stringify(metrics)); // 5 minutes
  }
}
```

---

## 🔒 Security Considerations

### Row-Level Security
```sql
-- Enable RLS on sensitive tables
ALTER TABLE pasture_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_pasture_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY farm_measurements_policy ON pasture_measurements
FOR ALL TO authenticated_users
USING (pasture_id IN (SELECT id FROM pastures WHERE farm_id = current_setting('app.current_farm_id')::UUID));

CREATE POLICY farm_settings_policy ON farm_pasture_settings
FOR ALL TO authenticated_users
USING (farm_id = current_setting('app.current_farm_id')::UUID);
```

### Data Validation
```typescript
// Input validation middleware
import Joi from 'joi';

const measurementSchema = Joi.object({
  pasture_id: Joi.string().uuid().required(),
  cover_kg_dm_ha: Joi.number().integer().min(0).max(10000).required(),
  measurement_method: Joi.string().valid('plate_meter', 'visual', 'satellite', 'drone').required(),
  pre_or_post: Joi.string().valid('pre', 'post').required(),
  plate_reading_cm: Joi.number().min(0).max(10).optional(),
  notes: Joi.string().max(1000).optional(),
  gps_latitude: Joi.number().min(-90).max(90).optional(),
  gps_longitude: Joi.number().min(-180).max(180).optional()
});

export const validateMeasurement = (req: Request, res: Response, next: NextFunction) => {
  const { error } = measurementSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
```

---

## 📈 Monitoring and Analytics

### Performance Metrics
```typescript
// Track component performance
import { performance } from 'perf_hooks';

class PerformanceMonitor {
  static trackComponentRender(componentName: string) {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      console.log(`${componentName} rendered in ${duration.toFixed(2)}ms`);
      // Send to analytics service
    };
  }
}

// Usage in components
const FeedWedgeChart: React.FC<FeedWedgeChartProps> = (props) => {
  useEffect(() => {
    const stopTiming = PerformanceMonitor.trackComponentRender('FeedWedgeChart');
    return stopTiming;
  }, []);
  
  // Component logic...
};
```

---

## 🚀 Deployment

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pasture_db
REDIS_URL=redis://localhost:6379

# API Keys
PASTURE_IO_API_KEY=your_api_key_here
WEATHER_API_KEY=your_weather_api_key

# Mobile
CAPACITOR_GEOLOCATION_ENABLED=true
OFFLINE_STORAGE_MAX_SIZE=50MB
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📚 Additional Resources

### Documentation
- [Recharts Documentation](https://recharts.org/en-US/)
- [PostgreSQL JSONB Guide](https://www.postgresql.org/docs/current/datatype-json.html)
- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation)

### Best Practices
- Implement proper error handling for all API calls
- Use TypeScript interfaces for all data structures
- Add comprehensive logging for debugging
- Implement proper data validation on both client and server
- Use environment-specific configurations
- Set up automated testing pipeline
- Monitor performance and optimize bottlenecks

---

This implementation provides a solid foundation for the enhanced Pasture Walk system with all requested features and technical considerations addressed.
