/**
 * Weather API Integration Service
 * 
 * Integrates with MetService and NIWA for NZ-specific weather data.
 * Also supports OpenWeatherMap as a fallback.
 * 
 * Required Environment Variables:
 * - METSERVICE_API_KEY: MetService API key
 * - NIWA_API_KEY: NIWA API key for climate data
 * - OPENWEATHER_API_KEY: OpenWeatherMap API key (fallback)
 * - FARM_LATITUDE: Farm location latitude
 * - FARM_LONGITUDE: Farm location longitude
 */

interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  windGust?: number;
  pressure: number;
  visibility: number;
  uvIndex: number;
  cloudCover: number;
  condition: string;
  conditionCode: string;
  icon: string;
  sunrise: string;
  sunset: string;
  updatedAt: string;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  precipProbability: number;
  condition: string;
  icon: string;
}

interface DailyForecast {
  date: string;
  dayName: string;
  tempMax: number;
  tempMin: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  precipProbability: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  condition: string;
  conditionDescription: string;
  icon: string;
}

interface RainfallData {
  date: string;
  amount: number; // mm
  duration?: number; // hours
}

interface GrowingDegreeDays {
  date: string;
  gdd: number;
  cumulativeGdd: number;
  baseTemp: number;
}

interface FrostAlert {
  date: string;
  minTemp: number;
  frostRisk: 'none' | 'light' | 'moderate' | 'severe';
  groundFrostLikely: boolean;
}

interface DroughtIndicator {
  soilMoistureDeficit: number; // mm
  potentialEvapotranspiration: number;
  daysWithoutRain: number;
  droughtStatus: 'normal' | 'watch' | 'warning' | 'emergency';
}

interface WeatherApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
}

class WeatherApiService {
  private metserviceKey: string;
  private niwaKey: string;
  private openweatherKey: string;
  private latitude: number;
  private longitude: number;
  private isConfigured: boolean;

  constructor() {
    this.metserviceKey = process.env.METSERVICE_API_KEY || '';
    this.niwaKey = process.env.NIWA_API_KEY || '';
    this.openweatherKey = process.env.OPENWEATHER_API_KEY || '';
    this.latitude = parseFloat(process.env.FARM_LATITUDE || '-37.7870'); // Default: Hamilton
    this.longitude = parseFloat(process.env.FARM_LONGITUDE || '175.2793');
    this.isConfigured = !!(this.metserviceKey || this.niwaKey || this.openweatherKey);

    if (!this.isConfigured) {
      console.log('[Weather API] No API keys configured - using mock data mode');
    }
  }

  /**
   * Get current weather conditions
   */
  async getCurrentWeather(): Promise<WeatherApiResponse<CurrentWeather>> {
    // Try OpenWeatherMap first (most reliable free tier)
    if (this.openweatherKey) {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${this.latitude}&lon=${this.longitude}&appid=${this.openweatherKey}&units=metric`
        );

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            source: 'OpenWeatherMap',
            data: this.transformOpenWeatherCurrent(data),
          };
        }
      } catch (error) {
        console.error('[Weather API] OpenWeatherMap error:', error);
      }
    }

    // Fallback to mock data
    return this.mockGetCurrentWeather();
  }

  /**
   * Get hourly forecast (48 hours)
   */
  async getHourlyForecast(): Promise<WeatherApiResponse<HourlyForecast[]>> {
    if (this.openweatherKey) {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${this.latitude}&lon=${this.longitude}&appid=${this.openweatherKey}&units=metric`
        );

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            source: 'OpenWeatherMap',
            data: this.transformOpenWeatherHourly(data),
          };
        }
      } catch (error) {
        console.error('[Weather API] Hourly forecast error:', error);
      }
    }

    return this.mockGetHourlyForecast();
  }

  /**
   * Get daily forecast (7 days)
   */
  async getDailyForecast(): Promise<WeatherApiResponse<DailyForecast[]>> {
    if (this.openweatherKey) {
      try {
        // OpenWeatherMap One Call API for daily forecast
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${this.latitude}&lon=${this.longitude}&appid=${this.openweatherKey}&units=metric`
        );

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            source: 'OpenWeatherMap',
            data: this.transformOpenWeatherDaily(data),
          };
        }
      } catch (error) {
        console.error('[Weather API] Daily forecast error:', error);
      }
    }

    return this.mockGetDailyForecast();
  }

  /**
   * Get rainfall data for a date range
   */
  async getRainfallData(startDate: string, endDate: string): Promise<WeatherApiResponse<RainfallData[]>> {
    // NIWA would be the primary source for historical rainfall
    if (this.niwaKey) {
      try {
        // NIWA CliFlo API endpoint
        const response = await fetch(
          `https://cliflo.niwa.co.nz/api/rainfall?lat=${this.latitude}&lon=${this.longitude}&start=${startDate}&end=${endDate}`,
          {
            headers: { 'Authorization': `Bearer ${this.niwaKey}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return { success: true, source: 'NIWA', data };
        }
      } catch (error) {
        console.error('[Weather API] NIWA rainfall error:', error);
      }
    }

    return this.mockGetRainfallData(startDate, endDate);
  }

  /**
   * Calculate Growing Degree Days
   */
  async getGrowingDegreeDays(startDate: string, endDate: string, baseTemp: number = 10): Promise<WeatherApiResponse<GrowingDegreeDays[]>> {
    // Get temperature data and calculate GDD
    const rainfallResponse = await this.getRainfallData(startDate, endDate);
    
    // In production, fetch actual temperature data
    return this.mockGetGrowingDegreeDays(startDate, endDate, baseTemp);
  }

  /**
   * Get frost alerts for upcoming days
   */
  async getFrostAlerts(): Promise<WeatherApiResponse<FrostAlert[]>> {
    const forecastResponse = await getDailyForecast();
    
    if (forecastResponse.success && forecastResponse.data) {
      const alerts: FrostAlert[] = forecastResponse.data.map(day => ({
        date: day.date,
        minTemp: day.tempMin,
        frostRisk: this.calculateFrostRisk(day.tempMin),
        groundFrostLikely: day.tempMin < 4,
      }));
      
      return { success: true, data: alerts };
    }

    return this.mockGetFrostAlerts();
  }

  /**
   * Get drought indicators
   */
  async getDroughtIndicators(): Promise<WeatherApiResponse<DroughtIndicator>> {
    // In production, integrate with NIWA drought monitoring
    return this.mockGetDroughtIndicators();
  }

  /**
   * Get weather alerts and warnings
   */
  async getWeatherAlerts(): Promise<WeatherApiResponse<{
    alerts: { type: string; severity: string; title: string; description: string; validFrom: string; validTo: string }[];
  }>> {
    // MetService severe weather warnings
    if (this.metserviceKey) {
      try {
        const response = await fetch(
          `https://api.metservice.com/v1/warnings?lat=${this.latitude}&lon=${this.longitude}`,
          {
            headers: { 'Authorization': `Bearer ${this.metserviceKey}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return { success: true, source: 'MetService', data };
        }
      } catch (error) {
        console.error('[Weather API] MetService alerts error:', error);
      }
    }

    return { success: true, data: { alerts: [] } };
  }

  // ============ Transform Methods ============

  private transformOpenWeatherCurrent(data: any): CurrentWeather {
    return {
      temperature: Math.round(data.main.temp * 10) / 10,
      feelsLike: Math.round(data.main.feels_like * 10) / 10,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6 * 10) / 10, // m/s to km/h
      windDirection: this.degreesToDirection(data.wind.deg),
      windGust: data.wind.gust ? Math.round(data.wind.gust * 3.6 * 10) / 10 : undefined,
      pressure: data.main.pressure,
      visibility: data.visibility / 1000, // m to km
      uvIndex: 0, // Not available in basic API
      cloudCover: data.clouds.all,
      condition: data.weather[0].main,
      conditionCode: data.weather[0].id.toString(),
      icon: data.weather[0].icon,
      sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
      sunset: new Date(data.sys.sunset * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private transformOpenWeatherHourly(data: any): HourlyForecast[] {
    return data.list.slice(0, 48).map((item: any) => ({
      time: item.dt_txt,
      temperature: Math.round(item.main.temp * 10) / 10,
      feelsLike: Math.round(item.main.feels_like * 10) / 10,
      humidity: item.main.humidity,
      windSpeed: Math.round(item.wind.speed * 3.6 * 10) / 10,
      windDirection: this.degreesToDirection(item.wind.deg),
      precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0,
      precipProbability: Math.round((item.pop || 0) * 100),
      condition: item.weather[0].main,
      icon: item.weather[0].icon,
    }));
  }

  private transformOpenWeatherDaily(data: any): DailyForecast[] {
    // Group by day and get min/max
    const dailyMap = new Map<string, any[]>();
    
    data.list.forEach((item: any) => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, []);
      }
      dailyMap.get(date)!.push(item);
    });

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return Array.from(dailyMap.entries()).slice(0, 7).map(([date, items]) => {
      const temps = items.map(i => i.main.temp);
      const dayDate = new Date(date);
      
      return {
        date,
        dayName: days[dayDate.getDay()],
        tempMax: Math.round(Math.max(...temps) * 10) / 10,
        tempMin: Math.round(Math.min(...temps) * 10) / 10,
        humidity: Math.round(items.reduce((s, i) => s + i.main.humidity, 0) / items.length),
        windSpeed: Math.round(items.reduce((s, i) => s + i.wind.speed * 3.6, 0) / items.length * 10) / 10,
        windDirection: this.degreesToDirection(items[0].wind.deg),
        precipitation: items.reduce((s, i) => s + (i.rain?.['3h'] || 0), 0),
        precipProbability: Math.round(Math.max(...items.map(i => i.pop || 0)) * 100),
        uvIndex: 5, // Not available
        sunrise: '',
        sunset: '',
        condition: items[Math.floor(items.length / 2)].weather[0].main,
        conditionDescription: items[Math.floor(items.length / 2)].weather[0].description,
        icon: items[Math.floor(items.length / 2)].weather[0].icon,
      };
    });
  }

  private degreesToDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private calculateFrostRisk(minTemp: number): 'none' | 'light' | 'moderate' | 'severe' {
    if (minTemp > 4) return 'none';
    if (minTemp > 2) return 'light';
    if (minTemp > 0) return 'moderate';
    return 'severe';
  }

  // ============ Mock Data Methods ============

  private mockGetCurrentWeather(): WeatherApiResponse<CurrentWeather> {
    return {
      success: true,
      source: 'Mock',
      data: {
        temperature: 18.5,
        feelsLike: 17.2,
        humidity: 72,
        windSpeed: 15.5,
        windDirection: 'SW',
        windGust: 25.0,
        pressure: 1015,
        visibility: 10,
        uvIndex: 6,
        cloudCover: 45,
        condition: 'Partly Cloudy',
        conditionCode: '802',
        icon: '03d',
        sunrise: '2024-12-08T06:15:00Z',
        sunset: '2024-12-08T20:45:00Z',
        updatedAt: new Date().toISOString(),
      },
    };
  }

  private mockGetHourlyForecast(): WeatherApiResponse<HourlyForecast[]> {
    const hours: HourlyForecast[] = [];
    const now = new Date();
    
    for (let i = 0; i < 48; i++) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = time.getHours();
      const isDay = hour >= 6 && hour <= 20;
      
      hours.push({
        time: time.toISOString(),
        temperature: 15 + Math.sin((hour - 6) * Math.PI / 12) * 8 + Math.random() * 2,
        feelsLike: 14 + Math.sin((hour - 6) * Math.PI / 12) * 7 + Math.random() * 2,
        humidity: 60 + Math.random() * 30,
        windSpeed: 10 + Math.random() * 15,
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        precipitation: Math.random() > 0.7 ? Math.random() * 5 : 0,
        precipProbability: Math.floor(Math.random() * 50),
        condition: isDay ? 'Partly Cloudy' : 'Clear',
        icon: isDay ? '03d' : '01n',
      });
    }
    
    return { success: true, source: 'Mock', data: hours };
  }

  private mockGetDailyForecast(): WeatherApiResponse<DailyForecast[]> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Showers'];
    const forecast: DailyForecast[] = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const baseTemp = 18 + Math.random() * 6;
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        dayName: days[date.getDay()],
        tempMax: Math.round((baseTemp + 5 + Math.random() * 3) * 10) / 10,
        tempMin: Math.round((baseTemp - 5 + Math.random() * 3) * 10) / 10,
        humidity: 55 + Math.floor(Math.random() * 30),
        windSpeed: 10 + Math.floor(Math.random() * 20),
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        precipitation: Math.random() > 0.6 ? Math.round(Math.random() * 15 * 10) / 10 : 0,
        precipProbability: Math.floor(Math.random() * 60),
        uvIndex: 5 + Math.floor(Math.random() * 6),
        sunrise: '06:15',
        sunset: '20:45',
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        conditionDescription: 'Expect a mix of sun and clouds',
        icon: '03d',
      });
    }
    
    return { success: true, source: 'Mock', data: forecast };
  }

  private mockGetRainfallData(startDate: string, endDate: string): WeatherApiResponse<RainfallData[]> {
    const data: RainfallData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      data.push({
        date: d.toISOString().split('T')[0],
        amount: Math.random() > 0.6 ? Math.round(Math.random() * 20 * 10) / 10 : 0,
        duration: Math.random() > 0.6 ? Math.floor(Math.random() * 8) + 1 : 0,
      });
    }
    
    return { success: true, source: 'Mock', data };
  }

  private mockGetGrowingDegreeDays(startDate: string, endDate: string, baseTemp: number): WeatherApiResponse<GrowingDegreeDays[]> {
    const data: GrowingDegreeDays[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let cumulative = 0;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const avgTemp = 15 + Math.random() * 10;
      const gdd = Math.max(0, avgTemp - baseTemp);
      cumulative += gdd;
      
      data.push({
        date: d.toISOString().split('T')[0],
        gdd: Math.round(gdd * 10) / 10,
        cumulativeGdd: Math.round(cumulative * 10) / 10,
        baseTemp,
      });
    }
    
    return { success: true, source: 'Mock', data };
  }

  private mockGetFrostAlerts(): WeatherApiResponse<FrostAlert[]> {
    const alerts: FrostAlert[] = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const minTemp = 2 + Math.random() * 10;
      
      alerts.push({
        date: date.toISOString().split('T')[0],
        minTemp: Math.round(minTemp * 10) / 10,
        frostRisk: this.calculateFrostRisk(minTemp),
        groundFrostLikely: minTemp < 4,
      });
    }
    
    return { success: true, source: 'Mock', data: alerts };
  }

  private mockGetDroughtIndicators(): WeatherApiResponse<DroughtIndicator> {
    return {
      success: true,
      source: 'Mock',
      data: {
        soilMoistureDeficit: 45,
        potentialEvapotranspiration: 4.5,
        daysWithoutRain: 8,
        droughtStatus: 'watch',
      },
    };
  }

  /**
   * Check if service is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; sources: string[] } {
    const sources: string[] = [];
    if (this.metserviceKey) sources.push('MetService');
    if (this.niwaKey) sources.push('NIWA');
    if (this.openweatherKey) sources.push('OpenWeatherMap');
    
    return {
      configured: this.isConfigured,
      sources: sources.length > 0 ? sources : ['Mock Data'],
    };
  }

  /**
   * Set farm location
   */
  setLocation(latitude: number, longitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
  }
}

// Helper function reference
async function getDailyForecast() {
  return weatherApiService.getDailyForecast();
}

// Export singleton instance
export const weatherApiService = new WeatherApiService();

// Export types
export type { CurrentWeather, HourlyForecast, DailyForecast, RainfallData, GrowingDegreeDays, FrostAlert, DroughtIndicator };
