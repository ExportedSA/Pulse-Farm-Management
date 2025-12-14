import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PWAProvider, usePWA } from "@/lib/pwa-context";
import { FarmProvider } from "@/lib/farm-context";
import { RequireAuth } from "@/components/RequireAuth";
import { ChatProvider } from "@/contexts/ChatContext";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { FarmSwitcher } from "@/components/FarmSwitcher";
import { Home as HomeIcon, LogOut, Wifi, WifiOff, Bell, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Alert } from "@shared/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Dashboard from "@/pages/dashboard";
import LandingDashboard from "@/pages/landing-dashboard";
import ChatPage from "@/pages/chat-page";
import CompliancePage from "@/pages/compliance-page";
import FarmCompliancePage from "@/pages/farm-compliance-page";
import NaitRecordsPage from "@/pages/nait-records";
import Home from "@/pages/home";
import AnimalsList from "@/pages/animals-list";
import GroupsManagement from "@/pages/groups-management";
import PasturesList from "@/pages/pastures-list";
import PastureRotationPlanner from "@/pages/pasture-rotation-planner";
import MedicinesInventory from "@/pages/medicines-inventory";
import ReproductionPlanner from "@/pages/reproduction-planner";
import AnalyticsDashboard from "@/pages/analytics-dashboard";
import SettingsPage from "@/pages/settings-page";
import AlertsPage from "@/pages/alerts-page";
import LoginPage from "@/pages/login-page";
import NotFound from "@/pages/not-found";
import VisitorPortalPage from "@/pages/visitor-portal";
import OperationsPage from "@/pages/operations-page";
import VehicleRegistryPage from "@/pages/vehicle-registry-page";
import StockReconciliationPage from "@/pages/stock-reconciliation-page";
import MapTasksPage from "@/pages/map-tasks-page";
import FinancialPage from "@/pages/financial-page";
import MilkProductionPage from "@/pages/milk-production-page";
import NZFAPCompliancePage from "@/pages/nzfap-compliance-page";
import { ShedPage } from "@/pages/ShedPage";
import JobsPage from "@/pages/jobs-page";
import StaffManagementPage from "@/pages/staff-management-page";
import ContractorManagementPage from "@/pages/contractor-management-page";
import RecurringTasksPage from "@/pages/recurring-tasks-page";
import TaskTemplatesPage from "@/pages/task-templates-page";
import TaskCalendarPage from "@/pages/task-calendar-page";
import FarmCalendarPage from "@/pages/farm-calendar-page";
import WeatherPage from "@/pages/weather-page";
import { NotificationCenter } from "@/components/NotificationCenter";
import TimesheetsPage from "@/pages/timesheets-page";
import KanbanPage from "@/pages/kanban-page";
import EquipmentPage from "@/pages/equipment-page";
import TaskDependenciesPage from "@/pages/task-dependencies-page";
import ComplianceTagsPage from "@/pages/compliance-tags-page";
import VaccinationDashboard from "@/pages/vaccination-dashboard";
import HealthMonitoringDashboard from "@/pages/health-monitoring-dashboard";
import ReproductionDashboardNew from "@/pages/reproduction-dashboard";
import VeterinaryDashboard from "@/pages/veterinary-dashboard";
import HealthAnalyticsDashboard from "@/pages/health-analytics-dashboard";
import FieldModeDashboard from "@/pages/field-mode-dashboard";
import AlertsNotificationsDashboard from "@/pages/alerts-notifications-dashboard";
import WeightTrackingDashboard from "@/pages/weight-tracking-dashboard";
import BatchTreatmentPage from "@/pages/batch-treatment-page";
import LabResultsImportPage from "@/pages/lab-results-import";
import BenchmarkingPage from "@/pages/benchmarking-page";
import HealthPredictionsPage from "@/pages/health-predictions-page";
import NaitCompliancePage from "@/pages/nait-compliance-page";
import WeightGrowthTrackingPage from "@/pages/weight-growth-tracking";
import SmartGroupsPage from "@/pages/smart-groups-page";
import BulkOperationsPage from "@/pages/bulk-operations-page";
import AnimalTimelinePage from "@/pages/animal-timeline-page";
import AnimalLineagePage from "@/pages/animal-lineage-page";
import HerdReportsPage from "@/pages/herd-reports-page";
import PastureWalkPage from "@/pages/pasture-walk-page";
import RosterSchedulingPage from "@/pages/roster-scheduling-page";
import HealthSafetyPage from "@/pages/health-safety-page";
import SafetyPage from "@/pages/safety-page";
import PeoplePage from "@/pages/people-page";
import AssetRegistryPage from "@/pages/asset-registry-page";
import FarmFinancePage from "@/pages/farm-finance-page";
import QRCodeManagementPage from "@/pages/qr-code-management-page";
import FinancialAnalyticsPage from "@/pages/financial-analytics-page";
import PerformanceBenchmarkingPage from "@/pages/performance-benchmarking-page";
import AnimalPerformancePage from "@/pages/animal-performance-page";
import FreshwaterFarmPlanPage from "@/pages/freshwater-farm-plan-page";
import EnvironmentalCompliancePage from "@/pages/environmental-compliance-page";
import ReportsExportPage from "@/pages/reports-export-page";
import WeatherIntegrationPage from "@/pages/weather-integration-page";
import MilkAnalyticsPage from "@/pages/milk-analytics-page";
import GISMappingPage from "@/pages/gis-mapping-page";
import GeneticMeritPage from "@/pages/genetic-merit-page";
import FeedPlanningPage from "@/pages/feed-planning-page";
import IoTDashboardPage from "@/pages/iot-dashboard-page";
import MultiFarmPage from "@/pages/multi-farm-page";
import CSVImportPage from "@/pages/csv-import-page";
import MobileScanner from "@/pages/mobile-scanner";
// Phase overlay imports
import RunSheet from "@/pages/RunSheet";
import PregQuick from "@/pages/PregQuick";
import Treat from "@/pages/Treat";
import Medicines from "@/pages/Medicines";
import Inventory from "@/pages/Inventory";
import HealthReports from "@/pages/Reports";
import OnboardingWizard from "@/pages/OnboardingWizard";

function Router() {
  const [location] = useLocation();
  const isPublicRoute = location === "/login" || location.startsWith("/visitor-signin/") || location.startsWith("/app/mobile-scanner");

  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/visitor-signin/:code" component={VisitorPortalPage} />
        <Route path="/app/mobile-scanner" component={MobileScanner} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <RequireAuth>
      <Switch>
        <Route path="/" component={LandingDashboard} />
        <Route path="/app" component={LandingDashboard} />
        <Route path="/app/dashboard" component={Dashboard} />
        <Route path="/app/chat" component={ChatPage} />
        <Route path="/app/jobs" component={JobsPage} />
        <Route path="/app/recurring-tasks" component={RecurringTasksPage} />
        <Route path="/app/task-templates" component={TaskTemplatesPage} />
        <Route path="/app/calendar" component={FarmCalendarPage} />
        <Route path="/app/weather" component={WeatherPage} />
        <Route path="/app/timesheets" component={TimesheetsPage} />
        <Route path="/app/kanban" component={KanbanPage} />
        <Route path="/app/equipment" component={EquipmentPage} />
        <Route path="/app/dependencies" component={TaskDependenciesPage} />
        <Route path="/app/compliance-tags" component={ComplianceTagsPage} />
        <Route path="/app/operations" component={OperationsPage} />
        <Route path="/app/operations/vehicles" component={VehicleRegistryPage} />
        <Route path="/app/operations/vehicles/inspections" component={VehicleRegistryPage} />
        <Route path="/app/operations/visitors" component={VisitorPortalPage} />
        <Route path="/app/operations/qrcodes" component={QRCodeManagementPage} />
        <Route path="/app/operations/staff" component={StaffManagementPage} />
        <Route path="/app/operations/contractors" component={ContractorManagementPage} />
        <Route path="/app/operations/roster" component={RosterSchedulingPage} />
        <Route path="/app/health-safety" component={HealthSafetyPage} />
        <Route path="/app/safety" component={SafetyPage} />
        <Route path="/app/people" component={PeoplePage} />
        <Route path="/app/asset-registry" component={AssetRegistryPage} />
        <Route path="/app/farm-finance" component={FarmFinancePage} />
        <Route path="/app/financial-analytics" component={FinancialAnalyticsPage} />
        <Route path="/app/performance-benchmarking" component={PerformanceBenchmarkingPage} />
        <Route path="/app/animal-performance" component={AnimalPerformancePage} />
        <Route path="/app/freshwater-farm-plan" component={FreshwaterFarmPlanPage} />
        <Route path="/app/environmental-compliance" component={EnvironmentalCompliancePage} />
        <Route path="/app/reports" component={ReportsExportPage} />
        <Route path="/app/weather" component={WeatherIntegrationPage} />
        <Route path="/app/milk-analytics" component={MilkAnalyticsPage} />
        <Route path="/app/compliance" component={CompliancePage} />
        <Route path="/app/farm-compliance" component={FarmCompliancePage} />
        <Route path="/app/nait" component={NaitRecordsPage} />
        <Route path="/app/treatments/:section?" component={Home} />
        <Route path="/app/batch-treatment" component={BatchTreatmentPage} />
        <Route path="/app/animals" component={AnimalsList} />
        <Route path="/app/import" component={CSVImportPage} />
        <Route path="/app/stock-reconciliation" component={StockReconciliationPage} />
        <Route path="/app/map-tasks" component={MapTasksPage} />
        <Route path="/app/groups" component={GroupsManagement} />
        <Route path="/app/pastures" component={PasturesList} />
        <Route path="/app/pasture-rotation" component={PastureRotationPlanner} />
        <Route path="/app/pasture-walk" component={PastureWalkPage} />
        <Route path="/app/medicines" component={MedicinesInventory} />
        <Route path="/app/reproduction" component={ReproductionPlanner} />
        <Route path="/app/reproduction-management" component={ReproductionDashboardNew} />
        <Route path="/app/vaccination" component={VaccinationDashboard} />
        <Route path="/app/health-monitoring" component={HealthMonitoringDashboard} />
        <Route path="/app/veterinary" component={VeterinaryDashboard} />
        <Route path="/app/lab-results" component={LabResultsImportPage} />
        <Route path="/app/health-analytics" component={HealthAnalyticsDashboard} />
        <Route path="/app/benchmarking" component={BenchmarkingPage} />
        <Route path="/app/health-predictions" component={HealthPredictionsPage} />
        <Route path="/app/field-mode" component={FieldModeDashboard} />
        <Route path="/app/smart-alerts" component={AlertsNotificationsDashboard} />
        <Route path="/app/weight-tracking" component={WeightTrackingDashboard} />
        <Route path="/app/weight-growth" component={WeightGrowthTrackingPage} />
        <Route path="/app/smart-groups" component={SmartGroupsPage} />
        <Route path="/app/bulk-operations" component={BulkOperationsPage} />
        <Route path="/app/animals/:animalId/timeline" component={AnimalTimelinePage} />
        <Route path="/app/animals/:animalId/lineage" component={AnimalLineagePage} />
        <Route path="/app/herd-reports" component={HerdReportsPage} />
        <Route path="/app/analytics" component={AnalyticsDashboard} />
        <Route path="/app/financial" component={FinancialPage} />
        <Route path="/app/milk-production" component={MilkProductionPage} />
        <Route path="/app/nzfap-compliance" component={NZFAPCompliancePage} />
        <Route path="/app/nait-compliance" component={NaitCompliancePage} />
        <Route path="/app/shed" component={ShedPage} />
        <Route path="/app/settings" component={SettingsPage} />
        <Route path="/app/alerts" component={AlertsPage} />
        <Route path="/app/gis-mapping" component={GISMappingPage} />
        <Route path="/app/genetic-merit" component={GeneticMeritPage} />
        <Route path="/app/feed-planning" component={FeedPlanningPage} />
        <Route path="/app/iot" component={IoTDashboardPage} />
        <Route path="/app/multi-farm" component={MultiFarmPage} />
        {/* Phase overlay routes */}
        <Route path="/app/repro/runsheet" component={RunSheet} />
        <Route path="/app/repro/preg" component={PregQuick} />
        <Route path="/app/health/treat" component={Treat} />
        <Route path="/app/health/medicines" component={Medicines} />
        <Route path="/app/health/inventory" component={Inventory} />
        <Route path="/app/health/reports" component={HealthReports} />
        <Route path="/app/setup" component={OnboardingWizard} />
        <Route component={NotFound} />
      </Switch>
    </RequireAuth>
  );
}

function AlertsNotification() {
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 60000,
  });

  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await apiRequest(`/api/alerts/${alertId}/dismiss`, 'PUT', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    },
  });

  const activeAlerts = alerts.filter(alert => !alert.dismissedAt);

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getAlertIcon = (type: string) => {
    return '•';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-alerts"
          title={`${activeAlerts.length} active alerts`}
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          {activeAlerts.length > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium bg-red-500 text-white rounded-full" data-testid="badge-alerts-count">
              {activeAlerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Alerts</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading alerts...</div>
          ) : activeAlerts.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No active alerts</div>
          ) : (
            <div className="divide-y">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="p-4 space-y-2" data-testid={`alert-item-${alert.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getAlertColor(alert.severity) as any} className="text-xs" data-testid={`badge-severity-${alert.id}`}>
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground" data-testid={`text-alert-type-${alert.id}`}>{alert.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm font-medium" data-testid={`text-alert-message-${alert.id}`}>{alert.message}</p>
                      {alert.animalId && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-animal-id-${alert.id}`}>Animal ID: {alert.animalId}</p>
                      )}
                      <p className="text-xs text-muted-foreground" data-testid={`text-alert-time-${alert.id}`}>
                        {format(new Date(alert.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlertMutation.mutate(alert.id)}
                      data-testid={`button-dismiss-alert-${alert.id}`}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {activeAlerts.length > 0 && (
          <div className="p-3 border-t">
            <Button asChild variant="ghost" size="sm" className="w-full" data-testid="button-view-all-alerts">
              <Link href="/app/alerts">View All Alerts</Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AppHeader() {
  const { user, signOut } = useAuth();
  const { isOnline, canInstall, installApp, offlineQueueCount } = usePWA();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await signOut();
    setLocation("/login");
  };

  return (
    <header className="flex items-center justify-between h-16 px-4 border-b border-pulse-200 bg-white shadow-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="h-12 w-12" />
        <Button
          asChild
          variant="ghost"
          size="default"
          data-testid="button-return-home"
          title="Return to Dashboard"
          className="gap-2"
        >
          <Link href="/">
            <HomeIcon className="h-5 w-5" strokeWidth={1.5} />
            <span className="hidden md:inline font-medium">Dashboard</span>
          </Link>
        </Button>
        <div className="hidden md:block border-l h-6 mx-2" />
        <FarmSwitcher />
      </div>
      <div className="flex items-center gap-3">
        <NotificationCenter />
        <AlertsNotification />
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <div title="Online">
              <Wifi className="h-4 w-4 text-pulse-forest" data-testid="icon-online" />
            </div>
          ) : (
            <div title="Offline - Changes will sync when reconnected">
              <WifiOff className="h-4 w-4 text-red-500" data-testid="icon-offline" />
            </div>
          )}
          {offlineQueueCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-red-500 text-white rounded-full" data-testid="badge-offline-queue" title={`${offlineQueueCount} changes queued for sync`}>
              {offlineQueueCount}
            </span>
          )}
        </div>
        {user && (
          <span className="text-sm text-muted-foreground hidden md:inline">
            {user.name}
          </span>
        )}
        <span className="text-sm text-muted-foreground hidden md:inline">Pulse Farm Management</span>
        {canInstall && (
          <Button
            variant="default"
            size="sm"
            onClick={installApp}
            title="Install Pulse on your device"
            data-testid="button-install-app"
            className="hidden md:inline-flex"
          >
            Install App
          </Button>
        )}
        {user && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function AppShell() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isPublicRoute = location === "/login";
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isPublicRoute) {
    return (
      <>
        <Router />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Router />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <>
      <SidebarProvider defaultOpen={false} style={style as React.CSSProperties}>
        <div className="flex h-screen w-full app-background">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <AppHeader />
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <GlobalSearch />
      <KeyboardShortcuts />
      <Toaster position="bottom-right" />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PWAProvider>
        <AuthProvider>
          <FarmProvider>
            <ChatProvider>
              <TooltipProvider>
                <AppShell />
              </TooltipProvider>
            </ChatProvider>
          </FarmProvider>
        </AuthProvider>
      </PWAProvider>
    </QueryClientProvider>
  );
}

export default App;
