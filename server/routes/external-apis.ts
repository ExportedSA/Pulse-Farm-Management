/**
 * External API Routes
 * 
 * Exposes endpoints for NAIT, Weather, LIC, and Fonterra integrations
 */

import { Router, Request, Response } from 'express';
import { naitApiService } from '../services/nait-api';
import { weatherApiService } from '../services/weather-api';
import { licApiService } from '../services/lic-api';
import { fonterraApiService } from '../services/fonterra-api';

const router = Router();

// ============ NAIT API Routes ============

// Get NAIT status
router.get('/api/integrations/nait/status', async (req: Request, res: Response) => {
  res.json(naitApiService.getStatus());
});

// Get registered animals
router.get('/api/integrations/nait/animals', async (req: Request, res: Response) => {
  try {
    const { species, status, limit, offset } = req.query;
    const result = await naitApiService.getAnimals({
      species: species as any,
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch NAIT animals' });
  }
});

// Register animal
router.post('/api/integrations/nait/animals', async (req: Request, res: Response) => {
  try {
    const result = await naitApiService.registerAnimal(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to register animal' });
  }
});

// Get movements
router.get('/api/integrations/nait/movements', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, movementType, limit } = req.query;
    const result = await naitApiService.getMovements({
      startDate: startDate as string,
      endDate: endDate as string,
      movementType: movementType as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch movements' });
  }
});

// Record movement
router.post('/api/integrations/nait/movements', async (req: Request, res: Response) => {
  try {
    const result = await naitApiService.recordMovement(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record movement' });
  }
});

// Record death
router.post('/api/integrations/nait/deaths', async (req: Request, res: Response) => {
  try {
    const result = await naitApiService.recordDeath(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record death' });
  }
});

// Validate NAIT tag
router.get('/api/integrations/nait/validate/:tag', async (req: Request, res: Response) => {
  const result = naitApiService.validateNaitTag(req.params.tag);
  res.json(result);
});

// Search location
router.get('/api/integrations/nait/locations/:number', async (req: Request, res: Response) => {
  try {
    const result = await naitApiService.searchLocation(req.params.number);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to search location' });
  }
});

// Get compliance status
router.get('/api/integrations/nait/compliance', async (req: Request, res: Response) => {
  try {
    const result = await naitApiService.getComplianceStatus();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get compliance status' });
  }
});

// ============ Weather API Routes ============

// Get weather status
router.get('/api/integrations/weather/status', async (req: Request, res: Response) => {
  res.json(weatherApiService.getStatus());
});

// Get current weather
router.get('/api/integrations/weather/current', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getCurrentWeather();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch current weather' });
  }
});

// Get hourly forecast
router.get('/api/integrations/weather/hourly', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getHourlyForecast();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch hourly forecast' });
  }
});

// Get daily forecast
router.get('/api/integrations/weather/daily', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getDailyForecast();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch daily forecast' });
  }
});

// Get rainfall data
router.get('/api/integrations/weather/rainfall', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await weatherApiService.getRainfallData(
      startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate as string || new Date().toISOString().split('T')[0]
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch rainfall data' });
  }
});

// Get growing degree days
router.get('/api/integrations/weather/gdd', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, baseTemp } = req.query;
    const result = await weatherApiService.getGrowingDegreeDays(
      startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate as string || new Date().toISOString().split('T')[0],
      baseTemp ? parseFloat(baseTemp as string) : 10
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch GDD data' });
  }
});

// Get frost alerts
router.get('/api/integrations/weather/frost', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getFrostAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch frost alerts' });
  }
});

// Get drought indicators
router.get('/api/integrations/weather/drought', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getDroughtIndicators();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch drought indicators' });
  }
});

// Get weather alerts
router.get('/api/integrations/weather/alerts', async (req: Request, res: Response) => {
  try {
    const result = await weatherApiService.getWeatherAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch weather alerts' });
  }
});

// Set farm location
router.post('/api/integrations/weather/location', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    weatherApiService.setLocation(latitude, longitude);
    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

// ============ LIC API Routes ============

// Get LIC status
router.get('/api/integrations/lic/status', async (req: Request, res: Response) => {
  res.json(licApiService.getStatus());
});

// Get herd test results
router.get('/api/integrations/lic/herdtests', async (req: Request, res: Response) => {
  try {
    const { testDate } = req.query;
    const result = await licApiService.getHerdTestResults(testDate as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch herd test results' });
  }
});

// Get herd test summary
router.get('/api/integrations/lic/herdtests/summary', async (req: Request, res: Response) => {
  try {
    const { testDate } = req.query;
    const result = await licApiService.getHerdTestSummary(testDate as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch herd test summary' });
  }
});

// Get herd test history
router.get('/api/integrations/lic/herdtests/history', async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const result = await licApiService.getHerdTestHistory(season as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch herd test history' });
  }
});

// Get breeding values
router.get('/api/integrations/lic/breeding-values', async (req: Request, res: Response) => {
  try {
    const { animalIds } = req.query;
    const ids = animalIds ? (animalIds as string).split(',') : undefined;
    const result = await licApiService.getBreedingValues(ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch breeding values' });
  }
});

// Search sires
router.get('/api/integrations/lic/sires/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const result = await licApiService.searchSires(query as string || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to search sires' });
  }
});

// Get sire details
router.get('/api/integrations/lic/sires/:code', async (req: Request, res: Response) => {
  try {
    const result = await licApiService.getSireDetails(req.params.code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch sire details' });
  }
});

// Get recommended sires
router.post('/api/integrations/lic/sires/recommended', async (req: Request, res: Response) => {
  try {
    const result = await licApiService.getRecommendedSires(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch recommended sires' });
  }
});

// Get AB records
router.get('/api/integrations/lic/ab-records', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await licApiService.getABRecords(startDate as string, endDate as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch AB records' });
  }
});

// ============ Fonterra API Routes ============

// Get Fonterra status
router.get('/api/integrations/fonterra/status', async (req: Request, res: Response) => {
  res.json(fonterraApiService.getStatus());
});

// Get milk collections
router.get('/api/integrations/fonterra/collections', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fonterraApiService.getCollections(startDate as string, endDate as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
});

// Get latest collection
router.get('/api/integrations/fonterra/collections/latest', async (req: Request, res: Response) => {
  try {
    const result = await fonterraApiService.getLatestCollection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch latest collection' });
  }
});

// Get quality results
router.get('/api/integrations/fonterra/quality', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await fonterraApiService.getQualityResults(startDate as string, endDate as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch quality results' });
  }
});

// Get payout statements
router.get('/api/integrations/fonterra/payouts', async (req: Request, res: Response) => {
  try {
    const { season } = req.query;
    const result = await fonterraApiService.getPayoutStatements(season as string);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch payout statements' });
  }
});

// Get season forecast
router.get('/api/integrations/fonterra/forecast', async (req: Request, res: Response) => {
  try {
    const result = await fonterraApiService.getSeasonForecast();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch season forecast' });
  }
});

// Get supply data
router.get('/api/integrations/fonterra/supply', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    const result = await fonterraApiService.getSupplyData(period as any);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch supply data' });
  }
});

// Get season summary
router.get('/api/integrations/fonterra/season', async (req: Request, res: Response) => {
  try {
    const result = await fonterraApiService.getSeasonSummary();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch season summary' });
  }
});

// Calculate payout
router.post('/api/integrations/fonterra/calculate-payout', async (req: Request, res: Response) => {
  try {
    const { milkSolidsKg } = req.body;
    const result = await fonterraApiService.calculatePayout(milkSolidsKg);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate payout' });
  }
});

// ============ Integration Status Overview ============

router.get('/api/integrations/status', async (req: Request, res: Response) => {
  res.json({
    nait: naitApiService.getStatus(),
    weather: weatherApiService.getStatus(),
    lic: licApiService.getStatus(),
    fonterra: fonterraApiService.getStatus(),
  });
});

export default router;
