import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Database
} from 'lucide-react';
import { offlineApi, useOfflineStatus } from '@/utils/offlineApi';

interface OfflineStatusProps {
  showDetails?: boolean;
  compact?: boolean;
}

export function OfflineStatus({ showDetails = false, compact = false }: OfflineStatusProps) {
  const { isOnline, syncStatus, syncNow } = useOfflineStatus();
  const [storageStats, setStorageStats] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

  useEffect(() => {
    if (showDetails || showDetailsPanel) {
      loadStorageStats();
    }
  }, [showDetails, showDetailsPanel]);

  const loadStorageStats = async () => {
    try {
      const stats = await offlineApi.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await offlineApi.syncPendingActions();
      console.log('Sync result:', result);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = () => {
    if (isOnline && syncStatus.pendingActions === 0) return 'text-green-600';
    if (isOnline && syncStatus.pendingActions > 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (isOnline && syncStatus.pendingActions === 0) return <CheckCircle className="h-4 w-4" />;
    if (isOnline && syncStatus.pendingActions > 0) return <Clock className="h-4 w-4" />;
    return <WifiOff className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (isOnline && syncStatus.pendingActions === 0) return 'Online';
    if (isOnline && syncStatus.pendingActions > 0) return `Syncing (${syncStatus.pendingActions})`;
    return 'Offline';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">{getStatusText()}</span>
        </Badge>
        {!isOnline && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">{getStatusText()}</p>
                <p className="text-sm text-muted-foreground">
                  {isOnline ? 'Connected to server' : 'Working offline'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {syncStatus.pendingActions > 0 && (
                <Badge variant="secondary">
                  {syncStatus.pendingActions} pending
                </Badge>
              )}
              
              <Button 
                size="sm" 
                onClick={handleSync} 
                disabled={isSyncing || !isOnline}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              
              {showDetails && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                >
                  <Database className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Panel */}
      {(showDetails || showDetailsPanel) && storageStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Offline Storage Details
            </CardTitle>
            <CardDescription>
              Local storage usage and cached data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Storage Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {storageStats.pendingActions}
                </p>
                <p className="text-sm text-muted-foreground">Pending Actions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {storageStats.cachedData}
                </p>
                <p className="text-sm text-muted-foreground">Cached Items</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {storageStats.userPrefs}
                </p>
                <p className="text-sm text-muted-foreground">User Settings</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {storageStats.estimatedSize}
                </p>
                <p className="text-sm text-muted-foreground">Storage Used</p>
              </div>
            </div>

            {/* Sync Progress */}
            {syncStatus.pendingActions > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sync Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {syncStatus.pendingActions} items remaining
                  </span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            )}

            {/* Offline Features */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Offline</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Badge variant="outline" className="justify-start">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  Milk Records
                </Badge>
                <Badge variant="outline" className="justify-start">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  Financial Data
                </Badge>
                <Badge variant="outline" className="justify-start">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  Weather Info
                </Badge>
                <Badge variant="outline" className="justify-start">
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  Compliance Standards
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  await offlineApi.clearCache();
                  loadStorageStats();
                }}
              >
                Clear Cache
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={async () => {
                  await offlineApi.preloadData([
                    '/api/milk/records',
                    '/api/financial/expenses',
                    '/api/weather/current/Auckland',
                    '/api/nzfap/standards',
                  ]);
                  loadStorageStats();
                }}
              >
                Preload Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offline Warning */}
      {!isOnline && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-800">You're working offline</h4>
                <p className="text-sm text-orange-700 mt-1">
                  Some features may be limited. Data will be synced automatically when you reconnect.
                </p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-orange-600">• View cached records and data</p>
                  <p className="text-xs text-orange-600">• Create new records (queued for sync)</p>
                  <p className="text-xs text-orange-600">• Real-time updates unavailable</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
