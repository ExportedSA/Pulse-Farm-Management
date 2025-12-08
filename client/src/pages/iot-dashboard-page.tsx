import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  Wifi, WifiOff, Thermometer, Droplets, Wind, Gauge, Battery, Signal,
  AlertTriangle, CheckCircle, Clock, RefreshCw, Settings, Plus, Trash2,
  Activity, Milk, Scale, MapPin, Fence, Radio, Camera, Waves, Zap
} from 'lucide-react';

// Types
interface IoTDevice {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeen: string;
  batteryLevel?: number;
  signalStrength?: number;
  location?: { latitude: number; longitude: number };
}

interface IoTAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  type: 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

// Mock data
const mockDevices: IoTDevice[] = [
  { id: 'mm-001', name: 'Milking Shed Meter 1', type: 'milk_meter', manufacturer: 'Waikato Milking', model: 'WM-500', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'eid-001', name: 'Race EID Reader', type: 'eid_reader', manufacturer: 'Gallagher', model: 'HR5', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'ws-001', name: 'Main Weather Station', type: 'weather_station', manufacturer: 'Davis', model: 'Vantage Pro2', status: 'online', lastSeen: new Date().toISOString(), batteryLevel: 85, signalStrength: 92 },
  { id: 'soil-001', name: 'North Block Soil Sensor', type: 'soil_sensor', manufacturer: 'Wildeye', model: 'SM-100', status: 'online', lastSeen: new Date().toISOString(), batteryLevel: 72, signalStrength: 78 },
  { id: 'soil-002', name: 'South Block Soil Sensor', type: 'soil_sensor', manufacturer: 'Wildeye', model: 'SM-100', status: 'online', lastSeen: new Date().toISOString(), batteryLevel: 65, signalStrength: 71 },
  { id: 'water-001', name: 'Main Water Meter', type: 'water_meter', manufacturer: 'Harvest', model: 'FlowMaster 200', status: 'online', lastSeen: new Date().toISOString(), batteryLevel: 90 },
  { id: 'fence-001', name: 'Main Energizer Monitor', type: 'fence_monitor', manufacturer: 'Gallagher', model: 'i Series', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'gps-001', name: 'Halter Collar - A001', type: 'gps_collar', manufacturer: 'Halter', model: 'Halter Pro', status: 'online', lastSeen: new Date().toISOString(), batteryLevel: 78, signalStrength: 85 },
  { id: 'vat-001', name: 'Milk Vat Sensor', type: 'vat_sensor', manufacturer: 'DeLaval', model: 'DXCE', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'scale-001', name: 'Race Weigh Scale', type: 'scale', manufacturer: 'Tru-Test', model: 'XR5000', status: 'online', lastSeen: new Date().toISOString() },
];

const mockAlerts: IoTAlert[] = [
  { id: 'a1', deviceId: 'fence-001', deviceName: 'Main Energizer Monitor', type: 'warning', category: 'Fence', message: 'Voltage dropped below 5kV on north line', timestamp: new Date(Date.now() - 30 * 60000).toISOString(), acknowledged: false },
  { id: 'a2', deviceId: 'soil-002', deviceName: 'South Block Soil Sensor', type: 'warning', category: 'Battery', message: 'Battery level at 15%', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), acknowledged: false },
  { id: 'a3', deviceId: 'water-001', deviceName: 'Main Water Meter', type: 'error', category: 'Flow', message: 'Unusual flow rate detected - possible leak', timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), acknowledged: true },
];

const mockWeatherData = Array.from({ length: 24 }, (_, i) => {
  const hour = new Date(Date.now() - (23 - i) * 3600000);
  return {
    time: hour.toLocaleTimeString('en-NZ', { hour: '2-digit' }),
    temperature: 12 + Math.sin((i - 6) * Math.PI / 12) * 8 + Math.random() * 2,
    humidity: 60 + Math.random() * 30,
    rainfall: Math.random() > 0.8 ? Math.random() * 5 : 0,
  };
});

const mockSoilData = Array.from({ length: 7 }, (_, i) => {
  const day = new Date(Date.now() - (6 - i) * 86400000);
  return {
    date: day.toLocaleDateString('en-NZ', { weekday: 'short' }),
    moisture: 25 + Math.random() * 15,
    temperature: 14 + Math.random() * 4,
  };
});

const mockMilkData = Array.from({ length: 14 }, (_, i) => {
  const day = new Date(Date.now() - (13 - i) * 86400000);
  return {
    date: day.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' }),
    volume: 2800 + Math.random() * 600,
    cows: 290 + Math.floor(Math.random() * 20),
  };
});

export default function IoTDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);

  // Fetch IoT dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/iot/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/iot/dashboard');
      if (!res.ok) throw new Error('Failed to fetch IoT dashboard');
      return res.json();
    },
  });

  const devices = dashboardData?.data?.devices ? mockDevices : mockDevices;
  const alerts = mockAlerts;

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'milk_meter': return <Milk className="h-5 w-5" />;
      case 'eid_reader': return <Radio className="h-5 w-5" />;
      case 'weather_station': return <Thermometer className="h-5 w-5" />;
      case 'soil_sensor': return <Droplets className="h-5 w-5" />;
      case 'water_meter': return <Waves className="h-5 w-5" />;
      case 'fence_monitor': return <Fence className="h-5 w-5" />;
      case 'gps_collar': return <MapPin className="h-5 w-5" />;
      case 'vat_sensor': return <Gauge className="h-5 w-5" />;
      case 'scale': return <Scale className="h-5 w-5" />;
      case 'camera': return <Camera className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;
  const lowBatteryDevices = devices.filter(d => d.batteryLevel && d.batteryLevel < 20).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wifi className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">IoT Dashboard</h1>
                <p className="text-sm text-gray-500">Connected devices, sensors & real-time data</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowAddDevice(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Devices</p>
                  <p className="text-2xl font-bold">{devices.length}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Online</p>
                  <p className="text-2xl font-bold text-green-600">{onlineDevices}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Offline</p>
                  <p className="text-2xl font-bold text-gray-600">{offlineDevices}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <WifiOff className="h-5 w-5 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Alerts</p>
                  <p className="text-2xl font-bold text-amber-600">{alerts.filter(a => !a.acknowledged).length}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="weather">Weather</TabsTrigger>
            <TabsTrigger value="soil">Soil</TabsTrigger>
            <TabsTrigger value="milk">Milk Data</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Weather */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-orange-500" />
                    Current Weather
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-5xl font-bold text-gray-900">18.5°C</p>
                    <p className="text-gray-500">Partly Cloudy</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <Droplets className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                      <p className="text-sm text-gray-500">Humidity</p>
                      <p className="font-medium">72%</p>
                    </div>
                    <div>
                      <Wind className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                      <p className="text-sm text-gray-500">Wind</p>
                      <p className="font-medium">15 km/h</p>
                    </div>
                    <div>
                      <Droplets className="h-5 w-5 mx-auto text-blue-400 mb-1" />
                      <p className="text-sm text-gray-500">Rain</p>
                      <p className="font-medium">0 mm</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Milk Vat Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-blue-500" />
                    Milk Vat
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-5xl font-bold text-blue-600">6,850</p>
                    <p className="text-gray-500">litres</p>
                  </div>
                  <Progress value={57} className="h-3 mb-2" />
                  <p className="text-sm text-gray-500 text-center">57% of 12,000L capacity</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-500">Temperature</p>
                      <p className="font-medium text-green-600">4.2°C</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Pickup</p>
                      <p className="font-medium">Yesterday 8am</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Fence Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Electric Fence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-5xl font-bold text-green-600">7.2</p>
                    <p className="text-gray-500">kV</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">All Lines OK</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <p className="text-gray-500">Current</p>
                      <p className="font-medium">125 mA</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Check</p>
                      <p className="font-medium">5 min ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Temperature Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>24-Hour Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={mockWeatherData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="temperature" stroke="#f97316" fill="#fed7aa" name="Temperature (°C)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map(alert => (
                      <div key={alert.id} className={`p-3 rounded-lg border ${alert.type === 'critical' ? 'bg-red-50 border-red-200' : alert.type === 'error' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.type === 'critical' ? 'text-red-500' : alert.type === 'error' ? 'text-orange-500' : 'text-yellow-500'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{alert.message}</p>
                            <p className="text-xs text-gray-500">{alert.deviceName}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle>Connected Devices</CardTitle>
                <CardDescription>All registered IoT devices and sensors</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Battery</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map(device => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(device.type)}
                            <span className="font-medium">{device.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{device.type.replace('_', ' ')}</TableCell>
                        <TableCell>{device.manufacturer}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(device.status)}>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {device.batteryLevel !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Battery className={`h-4 w-4 ${device.batteryLevel < 20 ? 'text-red-500' : device.batteryLevel < 50 ? 'text-yellow-500' : 'text-green-500'}`} />
                              <span>{device.batteryLevel}%</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {device.signalStrength !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Signal className={`h-4 w-4 ${device.signalStrength < 30 ? 'text-red-500' : device.signalStrength < 60 ? 'text-yellow-500' : 'text-green-500'}`} />
                              <span>{device.signalStrength}%</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="h-3 w-3" />
                            {new Date(device.lastSeen).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weather">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Temperature & Humidity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockWeatherData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis yAxisId="temp" orientation="left" />
                      <YAxis yAxisId="humidity" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#f97316" name="Temperature (°C)" />
                      <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#3b82f6" name="Humidity (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rainfall</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockWeatherData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rainfall" fill="#3b82f6" name="Rainfall (mm)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="soil">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Soil Moisture</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={mockSoilData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="moisture" stroke="#22c55e" fill="#bbf7d0" name="Moisture (%)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Soil Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockSoilData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="temperature" stroke="#f97316" name="Temperature (°C)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="milk">
            <Card>
              <CardHeader>
                <CardTitle>Milk Production (Last 14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={mockMilkData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="volume" orientation="left" />
                    <YAxis yAxisId="cows" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="volume" dataKey="volume" fill="#3b82f6" name="Volume (L)" />
                    <Line yAxisId="cows" type="monotone" dataKey="cows" stroke="#22c55e" name="Cows Milked" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>IoT Alerts</CardTitle>
                <CardDescription>Device alerts and notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`p-4 rounded-lg border ${alert.acknowledged ? 'bg-gray-50' : alert.type === 'critical' ? 'bg-red-50 border-red-200' : alert.type === 'error' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.type === 'critical' ? 'text-red-500' : alert.type === 'error' ? 'text-orange-500' : 'text-yellow-500'}`} />
                          <div>
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-sm text-gray-500">{alert.deviceName} • {alert.category}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!alert.acknowledged && (
                            <Button size="sm" variant="outline" onClick={() => toast.success('Alert acknowledged')}>
                              Acknowledge
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => toast.success('Alert resolved')}>
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
