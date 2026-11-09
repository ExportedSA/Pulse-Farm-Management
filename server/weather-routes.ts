import { Router } from 'express';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { getFarmId } from './middleware/auth';
import { rowsOf } from './domain/farm-map';

const router = Router();

// Yr.no API (Norwegian Meteorological Institute - free, no API key required)
// Documentation: https://api.met.no/weatherapi/locationforecast/2.0/documentation
const YR_API_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0';
const USER_AGENT = 'PulseFarmApp/1.0 (contact@pulse.farm)'; // Required by Yr.no


// Weather condition mappings from Yr.no symbol codes
const WEATHER_CONDITIONS: Record<string, { label: string; icon: string; isRainy: boolean; isBadForOutdoor: boolean }> = {
  clearsky_day: { label: 'Clear Sky', icon: '☀️', isRainy: false, isBadForOutdoor: false },
  clearsky_night: { label: 'Clear Night', icon: '🌙', isRainy: false, isBadForOutdoor: false },
  fair_day: { label: 'Fair', icon: '🌤️', isRainy: false, isBadForOutdoor: false },
  fair_night: { label: 'Fair Night', icon: '🌙', isRainy: false, isBadForOutdoor: false },
  partlycloudy_day: { label: 'Partly Cloudy', icon: '⛅', isRainy: false, isBadForOutdoor: false },
  partlycloudy_night: { label: 'Partly Cloudy', icon: '☁️', isRainy: false, isBadForOutdoor: false },
  cloudy: { label: 'Cloudy', icon: '☁️', isRainy: false, isBadForOutdoor: false },
  fog: { label: 'Fog', icon: '🌫️', isRainy: false, isBadForOutdoor: true },
  lightrain: { label: 'Light Rain', icon: '🌧️', isRainy: true, isBadForOutdoor: true },
  rain: { label: 'Rain', icon: '🌧️', isRainy: true, isBadForOutdoor: true },
  heavyrain: { label: 'Heavy Rain', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  lightrainshowers_day: { label: 'Light Showers', icon: '🌦️', isRainy: true, isBadForOutdoor: true },
  lightrainshowers_night: { label: 'Light Showers', icon: '🌧️', isRainy: true, isBadForOutdoor: true },
  rainshowers_day: { label: 'Showers', icon: '🌦️', isRainy: true, isBadForOutdoor: true },
  rainshowers_night: { label: 'Showers', icon: '🌧️', isRainy: true, isBadForOutdoor: true },
  heavyrainshowers_day: { label: 'Heavy Showers', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  heavyrainshowers_night: { label: 'Heavy Showers', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  sleet: { label: 'Sleet', icon: '🌨️', isRainy: true, isBadForOutdoor: true },
  snow: { label: 'Snow', icon: '❄️', isRainy: false, isBadForOutdoor: true },
  lightsnow: { label: 'Light Snow', icon: '🌨️', isRainy: false, isBadForOutdoor: true },
  heavysnow: { label: 'Heavy Snow', icon: '❄️', isRainy: false, isBadForOutdoor: true },
  thunder: { label: 'Thunder', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  lightrainandthunder: { label: 'Rain & Thunder', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  rainandthunder: { label: 'Rain & Thunder', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
  heavyrainandthunder: { label: 'Heavy Rain & Thunder', icon: '⛈️', isRainy: true, isBadForOutdoor: true },
};

// Cache for weather data (to respect Yr.no rate limits)
const weatherCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  pressure: number;
  condition: string;
  conditionIcon?: string;
  isRainy?: boolean;
  isBadForOutdoor?: boolean;
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    precipitation: number;
    icon?: string;
    isRainy?: boolean;
    isBadForOutdoor?: boolean;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    validFrom: string;
    validTo: string;
  }>;
}

// Fetch weather from Yr.no API
async function fetchYrWeather(lat: number, lon: number): Promise<any> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await fetch(
      `${YR_API_BASE}/compact?lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Yr.no API error: ${response.status}`);
    }
    
    const data = await response.json();
    weatherCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error('Failed to fetch from Yr.no:', error);
    return null;
  }
}

// Parse Yr.no response into our format
function parseYrWeather(yrData: any, location: string): WeatherData | null {
  const timeseries = yrData?.properties?.timeseries || [];
  const current = timeseries[0]?.data;
  const instant = current?.instant?.details || {};
  // Without the current readings there's no forecast to show; don't fill gaps with typical values
  if (instant.air_temperature == null || instant.relative_humidity == null || instant.wind_speed == null) return null;
  const next1h = current?.next_1_hours || {};
  const next6h = current?.next_6_hours || {};
  
  // Get symbol code for condition
  const symbolCode = next1h?.summary?.symbol_code || next6h?.summary?.symbol_code || 'cloudy';
  const conditionInfo = WEATHER_CONDITIONS[symbolCode] || { label: 'Unknown', icon: '❓', isRainy: false, isBadForOutdoor: false };
  
  // Build 7-day forecast
  const forecast: WeatherData['forecast'] = [];
  const dailyData: Map<string, { temps: number[]; conditions: string[]; precip: number }> = new Map();
  
  timeseries.forEach((ts: any) => {
    const date = ts.time.split('T')[0];
    const temp = ts.data?.instant?.details?.air_temperature;
    const symbol = ts.data?.next_6_hours?.summary?.symbol_code || ts.data?.next_1_hours?.summary?.symbol_code;
    const precip = ts.data?.next_6_hours?.details?.precipitation_amount || ts.data?.next_1_hours?.details?.precipitation_amount || 0;
    
    if (!dailyData.has(date)) {
      dailyData.set(date, { temps: [], conditions: [], precip: 0 });
    }
    
    const day = dailyData.get(date)!;
    if (temp !== undefined) day.temps.push(temp);
    if (symbol) day.conditions.push(symbol);
    day.precip += precip;
  });
  
  let dayCount = 0;
  dailyData.forEach((day, date) => {
    if (dayCount >= 7 || !day.temps.length) return;
    const condSymbol = day.conditions[Math.floor(day.conditions.length / 2)] || 'cloudy';
    const cond = WEATHER_CONDITIONS[condSymbol] || { label: 'Cloudy', icon: '☁️', isRainy: false, isBadForOutdoor: false };
    
    forecast.push({
      date,
      high: Math.round(Math.max(...day.temps)),
      low: Math.round(Math.min(...day.temps)),
      condition: cond.label,
      precipitation: Math.round(day.precip),
      icon: cond.icon,
      isRainy: cond.isRainy,
      isBadForOutdoor: cond.isBadForOutdoor,
    });
    dayCount++;
  });
  
  return {
    location,
    temperature: Math.round(instant.air_temperature),
    humidity: Math.round(instant.relative_humidity),
    windSpeed: Math.round(instant.wind_speed * 3.6), // m/s to km/h
    windDirection: instant.wind_from_direction == null ? 'Unknown' : getWindDirection(instant.wind_from_direction),
    pressure: instant.air_pressure_at_sea_level == null ? null as unknown as number : Math.round(instant.air_pressure_at_sea_level),
    condition: conditionInfo.label,
    conditionIcon: conditionInfo.icon,
    isRainy: conditionInfo.isRainy,
    isBadForOutdoor: conditionInfo.isBadForOutdoor,
    forecast,
    alerts: [],
  };
}

// Convert wind degrees to direction
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Mock weather data for demo purposes (fallback)
class WeatherUnavailable extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Where the farm is: coordinates the caller passes, else the middle of the farm's mapped paddocks
async function farmLocation(req: any): Promise<{ lat: number; lon: number }> {
  const qLat = req.query?.lat ?? req.body?.lat;
  const qLon = req.query?.lon ?? req.body?.lon;
  if (qLat != null && qLon != null && Number.isFinite(Number(qLat)) && Number.isFinite(Number(qLon))) {
    return { lat: Number(qLat), lon: Number(qLon) };
  }
  const farmId = getFarmId(req);
  if (farmId) {
    const [row] = rowsOf(await db.execute(sql`
      SELECT ST_Y(c) AS lat, ST_X(c) AS lon FROM (
        SELECT ST_Centroid(ST_Collect(geom::geometry)) AS c FROM paddock_boundaries
        WHERE farm_id = ${farmId} AND valid_to IS NULL) s
      WHERE c IS NOT NULL`));
    if (row) return { lat: Number(row.lat), lon: Number(row.lon) };
  }
  throw new WeatherUnavailable(409, "Draw your paddocks on the farm map so Pulse knows where the farm is");
}

// The Yr.no forecast for the farm. When it can't be had, say so: never stand-in weather.
async function farmWeather(req: any, location = 'Farm'): Promise<WeatherData> {
  const { lat, lon } = await farmLocation(req);
  const yrData = await fetchYrWeather(lat, lon);
  const weather = yrData && parseYrWeather(yrData, location);
  if (!weather) throw new WeatherUnavailable(503, 'Weather is unavailable right now: the Yr.no forecast could not be reached');
  return weather;
}

function sendWeatherError(res: any, error: unknown, message: string) {
  if (error instanceof WeatherUnavailable) return res.status(error.status).json({ error: error.message });
  console.error(message, error);
  res.status(500).json({ error: message });
}

// Get current weather for a location
router.get('/current/:location', async (req, res) => {
  try {
    const { location } = req.params;
    
    const weatherData = await farmWeather(req, location);
    
    // Add farm-specific recommendations
    const recommendations = generateFarmRecommendations(weatherData);
    
    res.json({
      ...weatherData,
      recommendations,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to fetch weather data');
  }
});

// Get weather forecast
router.get('/forecast/:location', async (req, res) => {
  try {
    const { location } = req.params;
    const { days = 7 } = req.query;
    
    const weatherData = await farmWeather(req, location);
    const forecastDays = Math.min(parseInt(days as string), 14);
    
    res.json({
      location,
      forecast: weatherData.forecast.slice(0, forecastDays),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to fetch weather forecast');
  }
});

// Get weather alerts
router.get('/alerts/:location', async (req, res) => {
  try {
    const { location } = req.params;
    
    const weatherData = await farmWeather(req, location);
    
    res.json({
      location,
      alerts: weatherData.alerts,
      activeAlerts: weatherData.alerts.length,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to fetch weather alerts');
  }
});

// Get agricultural weather summary
router.get('/agricultural/:location', async (req, res) => {
  try {
    const { location } = req.params;
    
    const weatherData = await farmWeather(req, location);
    
    // Calculate growing degree days
    const baseTemp = 10; // Base temperature for most crops
    const gdd = Math.max(0, weatherData.temperature - baseTemp);
    
    // Calculate pasture growth conditions
    const pastureConditions = calculatePastureConditions(weatherData);
    
    // Calculate spray conditions
    const sprayConditions = calculateSprayConditions(weatherData);
    
    res.json({
      location,
      current: {
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
        condition: weatherData.condition,
      },
      agricultural: {
        growingDegreeDays: gdd,
        pastureConditions,
        sprayConditions,
        frostRisk: weatherData.temperature <= 2,
        heatStressRisk: weatherData.temperature >= 30,
        soilMoisture: calculateSoilMoisture(weatherData),
      },
      recommendations: generateAgriculturalRecommendations(weatherData),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to fetch agricultural weather data');
  }
});

// Get weather impact on farm operations
router.get('/impact/:location', async (req, res) => {
  try {
    const { location } = req.params;
    
    const weatherData = await farmWeather(req, location);
    
    const impact = {
      milking: {
        status: weatherData.temperature > 5 && weatherData.temperature < 35 ? 'optimal' : 'caution',
        impact: weatherData.temperature < 5 ? 'Cold stress - consider extra shelter' : 
                weatherData.temperature > 35 ? 'Heat stress - ensure cooling and water' : 'Good conditions',
      },
      grazing: {
        status: weatherData.condition !== 'Heavy Rain' ? 'good' : 'poor',
        impact: weatherData.condition === 'Heavy Rain' ? 'Pasture damage risk - consider supplemental feeding' : 'Suitable for grazing',
      },
      spraying: {
        status: weatherData.windSpeed < 20 && weatherData.humidity < 85 ? 'good' : 'poor',
        impact: weatherData.windSpeed >= 20 ? 'Too windy for spraying' :
                weatherData.humidity >= 85 ? 'Too humid for spraying - poor coverage' : 'Good spraying conditions',
      },
      fencing: {
        status: weatherData.condition !== 'Heavy Rain' ? 'good' : 'poor',
        impact: weatherData.condition === 'Heavy Rain' ? 'Wet conditions - postpone fencing work' : 'Good conditions for fencing',
      },
      machinery: {
        status: weatherData.condition !== 'Heavy Rain' ? 'good' : 'poor',
        impact: weatherData.condition === 'Heavy Rain' ? 'Wet fields - avoid machinery use' : 'Good conditions for machinery',
      },
    };
    
    res.json({
      location,
      weather: {
        temperature: weatherData.temperature,
        condition: weatherData.condition,
        windSpeed: weatherData.windSpeed,
        humidity: weatherData.humidity,
      },
      impact,
      overallStatus: Object.values(impact).every(i => i.status === 'good') ? 'optimal' : 'caution',
      recommendations: generateOperationalRecommendations(weatherData, impact),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to calculate weather impact');
  }
});

// Helper functions
function generateFarmRecommendations(weather: WeatherData): string[] {
  const recommendations: string[] = [];
  
  if (weather.temperature < 5) {
    recommendations.push('Cold temperatures - provide extra shelter for livestock');
    recommendations.push('Check water troughs for freezing');
  }
  
  if (weather.temperature > 30) {
    recommendations.push('Hot conditions - ensure adequate shade and water');
    recommendations.push('Consider adjusting milking times to cooler parts of the day');
  }
  
  if (weather.windSpeed > 25) {
    recommendations.push('Strong winds - secure loose items and check fencing');
  }
  
  if (weather.condition === 'Heavy Rain') {
    recommendations.push('Heavy rain - avoid grazing on wet paddocks');
    recommendations.push('Check drainage and monitor for flooding');
  }
  
  if (weather.humidity > 85) {
    recommendations.push('High humidity - increased risk of fungal diseases');
    recommendations.push('Monitor livestock for heat stress');
  }
  
  return recommendations;
}

function calculatePastureConditions(weather: WeatherData): string {
  if (weather.temperature >= 15 && weather.temperature <= 25 && 
      weather.condition !== 'Heavy Rain' && weather.humidity < 80) {
    return 'Excellent growth conditions';
  } else if (weather.temperature >= 10 && weather.temperature <= 30 && 
             weather.windSpeed < 30) {
    return 'Good growth conditions';
  } else {
    return 'Poor growth conditions';
  }
}

function calculateSprayConditions(weather: WeatherData): string {
  if (weather.windSpeed < 10 && weather.humidity < 70 && weather.condition !== 'Rain') {
    return 'Excellent spraying conditions';
  } else if (weather.windSpeed < 20 && weather.humidity < 85) {
    return 'Good spraying conditions';
  } else {
    return 'Poor spraying conditions';
  }
}

function calculateSoilMoisture(weather: WeatherData): string {
  if (weather.condition === 'Heavy Rain') {
    return 'Saturated';
  } else if (weather.condition === 'Light Rain' || weather.humidity > 80) {
    return 'Wet';
  } else if (weather.humidity > 60) {
    return 'Moist';
  } else {
    return 'Dry';
  }
}

function generateAgriculturalRecommendations(weather: WeatherData): string[] {
  const recommendations: string[] = [];
  
  if (weather.temperature < 10) {
    recommendations.push('Slow pasture growth - consider supplemental feeding');
  }
  
  if (weather.temperature > 25) {
    recommendations.push('High evaporation - ensure adequate water supply');
  }
  
  if (weather.windSpeed < 5 && weather.humidity < 60) {
    recommendations.push('Ideal conditions for spraying');
  }
  
  if (weather.windSpeed > 20) {
    recommendations.push('Too windy for spraying or fertilizer application');
  }
  
  if (weather.condition === 'Heavy Rain') {
    recommendations.push('Avoid field operations - risk of soil compaction');
  }
  
  return recommendations;
}

function generateOperationalRecommendations(weather: WeatherData, impact: any): string[] {
  const recommendations: string[] = [];
  
  if (impact.milking.status !== 'optimal') {
    recommendations.push('Monitor livestock comfort during milking');
  }
  
  if (impact.grazing.status === 'poor') {
    recommendations.push('Consider moving livestock to sheltered paddocks');
  }
  
  if (impact.spraying.status === 'good') {
    recommendations.push('Good window for spraying operations');
  }
  
  if (impact.machinery.status === 'poor') {
    recommendations.push('Postpone machinery operations to prevent field damage');
  }
  
  return recommendations;
}

// ============================================
// TASK RESCHEDULING ENDPOINTS
// ============================================

// Weather-sensitive task categories
const WEATHER_SENSITIVE_CATEGORIES = ['fencing', 'spraying', 'pasture', 'maintenance', 'equipment', 'hay'];

// Get reschedule suggestions for weather-sensitive tasks
router.post('/reschedule-suggestions', async (req, res) => {
  try {
    const { tasks } = req.body;
    
    // Get weather forecast
    const weatherData = await farmWeather(req);
    
    const suggestions: any[] = [];
    
    // Analyze each task
    for (const task of tasks || []) {
      const taskDate = task.date || task.scheduledDate;
      if (!taskDate) continue;
      
      // Check if task is weather-sensitive
      const isWeatherSensitive = task.weatherSensitive || 
        WEATHER_SENSITIVE_CATEGORIES.includes(task.category?.toLowerCase());
      
      if (!isWeatherSensitive) continue;
      
      // Find weather for task date
      const taskForecast = weatherData.forecast.find(f => f.date === taskDate);
      if (!taskForecast) continue;
      
      // Check if weather is bad for this task
      const needsReschedule = taskForecast.isBadForOutdoor || 
        (task.skipIfRaining && taskForecast.isRainy) ||
        taskForecast.precipitation > 5;
      
      if (needsReschedule) {
        // Find next good day
        const goodDays = weatherData.forecast.filter(f => 
          f.date > taskDate && 
          !f.isBadForOutdoor && 
          !f.isRainy &&
          f.precipitation < 3
        );
        
        const suggestedDate = goodDays.length > 0 ? goodDays[0].date : null;
        
        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          originalDate: taskDate,
          reason: taskForecast.isRainy 
            ? `Rain expected (${taskForecast.precipitation}mm)` 
            : `Poor conditions: ${taskForecast.condition}`,
          weatherOnDate: {
            condition: taskForecast.condition,
            icon: taskForecast.icon,
            precipitation: taskForecast.precipitation,
            high: taskForecast.high,
            low: taskForecast.low,
          },
          suggestedDate,
          suggestedWeather: suggestedDate ? weatherData.forecast.find(f => f.date === suggestedDate) : null,
          severity: taskForecast.precipitation > 10 ? 'high' : 'medium',
        });
      }
    }
    
    res.json({
      suggestions,
      totalAffected: suggestions.length,
      forecast: weatherData.forecast,
      currentWeather: {
        temperature: weatherData.temperature,
        condition: weatherData.condition,
        icon: weatherData.conditionIcon,
        isRainy: weatherData.isRainy,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to generate reschedule suggestions');
  }
});

// Get weather-based task alerts
router.get('/task-alerts', async (req, res) => {
  try {
    
    const weatherData = await farmWeather(req);
    
    const alerts: any[] = [];
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Check today's weather
    const todayForecast = weatherData.forecast.find(f => f.date === today);
    const tomorrowForecast = weatherData.forecast.find(f => f.date === tomorrow);
    
    if (todayForecast?.isRainy || todayForecast?.isBadForOutdoor) {
      alerts.push({
        type: 'weather_warning',
        severity: todayForecast.precipitation > 10 ? 'high' : 'medium',
        title: 'Poor Weather Today',
        message: `${todayForecast.condition} expected. Consider rescheduling outdoor tasks.`,
        icon: todayForecast.icon,
        affectedCategories: WEATHER_SENSITIVE_CATEGORIES,
        date: today,
      });
    }
    
    if (tomorrowForecast?.isRainy || tomorrowForecast?.isBadForOutdoor) {
      alerts.push({
        type: 'weather_forecast',
        severity: 'info',
        title: 'Weather Alert for Tomorrow',
        message: `${tomorrowForecast.condition} expected tomorrow. Plan accordingly.`,
        icon: tomorrowForecast.icon,
        affectedCategories: WEATHER_SENSITIVE_CATEGORIES,
        date: tomorrow,
      });
    }
    
    // Check for good spraying windows
    const goodSprayDays = weatherData.forecast.filter(f => 
      !f.isRainy && 
      !f.isBadForOutdoor && 
      f.precipitation < 2
    );
    
    if (goodSprayDays.length > 0 && goodSprayDays[0].date === today) {
      alerts.push({
        type: 'opportunity',
        severity: 'info',
        title: 'Good Spraying Conditions',
        message: 'Today has ideal conditions for spraying operations.',
        icon: '🌤️',
        affectedCategories: ['spraying'],
        date: today,
      });
    }
    
    // Frost warning
    const frostRisk = weatherData.forecast.find(f => f.low <= 2);
    if (frostRisk) {
      alerts.push({
        type: 'frost_warning',
        severity: 'high',
        title: 'Frost Risk',
        message: `Low of ${frostRisk.low}°C expected on ${new Date(frostRisk.date).toLocaleDateString('en-NZ', { weekday: 'short', month: 'short', day: 'numeric' })}. Protect sensitive crops and check water troughs.`,
        icon: '❄️',
        affectedCategories: ['pasture', 'water'],
        date: frostRisk.date,
      });
    }
    
    res.json({
      alerts,
      totalAlerts: alerts.length,
      currentWeather: {
        temperature: weatherData.temperature,
        condition: weatherData.condition,
        icon: weatherData.conditionIcon,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
      },
      forecast: weatherData.forecast.slice(0, 3),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to fetch task alerts');
  }
});

// Get best days for specific task types
router.get('/best-days/:taskType', async (req, res) => {
  try {
    const { taskType } = req.params;
    const { days = 7 } = req.query;
    
    const weatherData = await farmWeather(req);
    
    const forecast = weatherData.forecast.slice(0, Number(days));
    
    // Rate each day for the task type
    const ratedDays = forecast.map(day => {
      let score = 100;
      let reasons: string[] = [];
      
      switch (taskType.toLowerCase()) {
        case 'spraying':
          if (day.isRainy) { score -= 80; reasons.push('Rain expected'); }
          if (day.precipitation > 0) { score -= day.precipitation * 5; reasons.push(`${day.precipitation}mm precipitation`); }
          if (day.isBadForOutdoor) { score -= 30; reasons.push('Poor outdoor conditions'); }
          break;
          
        case 'fencing':
          if (day.isRainy) { score -= 60; reasons.push('Rain makes work difficult'); }
          if (day.precipitation > 5) { score -= 30; reasons.push('Wet ground conditions'); }
          if (day.low < 5) { score -= 20; reasons.push('Cold conditions'); }
          break;
          
        case 'hay':
        case 'haymaking':
          if (day.isRainy) { score -= 100; reasons.push('Cannot make hay in rain'); }
          if (day.precipitation > 0) { score -= 50; reasons.push('Moisture risk'); }
          if (day.isBadForOutdoor) { score -= 40; reasons.push('Poor drying conditions'); }
          break;
          
        case 'pasture':
        case 'grazing':
          if (day.precipitation > 15) { score -= 40; reasons.push('Pugging risk'); }
          if (day.low < 0) { score -= 30; reasons.push('Frost risk'); }
          break;
          
        default:
          if (day.isRainy) { score -= 30; reasons.push('Rain expected'); }
          if (day.isBadForOutdoor) { score -= 20; reasons.push('Poor conditions'); }
      }
      
      return {
        date: day.date,
        dayName: new Date(day.date).toLocaleDateString('en-NZ', { weekday: 'long' }),
        weather: day,
        score: Math.max(0, score),
        rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
        reasons: reasons.length > 0 ? reasons : ['Good conditions'],
      };
    });
    
    // Sort by score
    const sortedDays = [...ratedDays].sort((a, b) => b.score - a.score);
    
    res.json({
      taskType,
      bestDay: sortedDays[0],
      allDays: ratedDays,
      recommendation: sortedDays[0].score >= 60 
        ? `Best day for ${taskType}: ${sortedDays[0].dayName}` 
        : `No ideal days for ${taskType} in the next ${days} days`,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendWeatherError(res, error, 'Failed to find best days');
  }
});

export default router;
