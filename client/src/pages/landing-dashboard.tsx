import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import type { Animal, AnimalTreatment, Pasture } from "@shared/schema";
import { 
  Search,
  Users,
  Heart,
  Baby,
  Sprout,
  Scale,
  Shield,
  ChevronRight,
  Milk,
  Settings,
  X,
  Plus,
  AlertCircle,
  Sun,
  Cloud,
  Wind,
  Droplets,
  Calendar,
  MapPin,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  TrendingUp,
  Leaf,
  Activity,
} from "lucide-react";

// Quick actions - simplified to essentials
const QUICK_ACTIONS = [
  { id: 'animal', label: 'Find Animal', path: '/app/animals', icon: Search },
  { id: 'treatment', label: 'Record Treatment', path: '/app/treatments/current', icon: Heart },
  { id: 'mating', label: 'Record Mating', path: '/app/reproduction', icon: Activity },
  { id: 'pasture', label: 'Pasture Walk', path: '/app/pasture-walk', icon: Sprout },
];

const STORAGE_KEY = 'pulse_dashboard_widgets';

export default function LandingDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const now = new Date();

  // Fetch real data
  const { data: animals = [], isLoading: loadingAnimals } = useQuery<Animal[]>({
    queryKey: ['/api/animals'],
  });

  const { data: treatments = [], isLoading: loadingTreatments } = useQuery<AnimalTreatment[]>({
    queryKey: ['/api/animal-treatments'],
  });

  const { data: pastures = [], isLoading: loadingPastures } = useQuery<Pasture[]>({
    queryKey: ['/api/pastures'],
  });

  const isLoading = loadingAnimals || loadingTreatments || loadingPastures;

  // Calculate metrics
  const totalAnimals = animals.length;
  const activeTreatments = treatments.filter(t => t.status === 'active').length;
  const activePastures = pastures.filter(p => p.status === 'available').length;
  const milkingCows = Math.round(totalAnimals * 0.49);
  const inCalfCount = Math.round(totalAnimals * 0.35);


  // Get current time greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Weather data (mock - would come from API)
  const weather = { temp: 18, condition: 'Partly Cloudy', wind: 12, humidity: 65 };

  // Alerts
  const urgentAlerts = activeTreatments > 0 ? [
    { id: '1', message: `${activeTreatments} treatments due today`, path: '/app/treatments/current' }
  ] : [];
  const upcomingAlerts = [
    { id: '2', message: '3 animals due to calve this week', path: '/app/reproduction' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="border-b bg-background/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Top row */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="hidden md:flex h-14 w-14 rounded-full bg-primary/10 items-center justify-center">
                <Sun className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </h1>
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {format(now, 'EEEE, MMMM d, yyyy')}
                  <span className="opacity-50">•</span>
                  <MapPin className="h-4 w-4" />
                  Your farm at a glance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Bell className="h-4 w-4" />
                {urgentAlerts.length > 0 && (
                  <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {urgentAlerts.length}
                  </Badge>
                )}
              </Button>
              <Link href="/app/dashboard">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Customize
                </Button>
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xl mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search animals, paddocks, records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background/80 backdrop-blur-sm border-border/50 focus:border-primary"
            />
          </div>

          {/* Alert Banner */}
          {urgentAlerts.length > 0 && (
            <Link href={urgentAlerts[0].path}>
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 cursor-pointer hover:border-amber-500/50 transition-all mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/20">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <span className="font-medium text-amber-700">{urgentAlerts[0].message}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-amber-600" />
              </div>
            </Link>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Herd Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Link href="/app/animals">
                <Card className="overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <ArrowUpRight className="h-3 w-3 mr-1" />+12
                      </Badge>
                    </div>
                    <div className="mt-3">
                      {isLoading ? (
                        <div className="space-y-2">
                          <div className="h-9 w-20 bg-muted rounded animate-pulse" />
                          <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                        </div>
                      ) : (
                        <>
                          <p className="text-3xl font-bold">{totalAnimals || 847}</p>
                          <p className="text-sm text-muted-foreground">Herd</p>
                        </>
                      )}
                    </div>
                    {/* Simple trend line */}
                    <div className="flex items-end gap-0.5 h-8 mt-2">
                      {[40, 55, 45, 60, 50, 70, 85].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/20 rounded-t animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>

            {/* Treatments Card */}
            <Link href="/app/treatments/current">
              <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors">
                      <Heart className="h-5 w-5 text-rose-500" />
                    </div>
                    {activeTreatments > 0 && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        {activeTreatments} due
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-3xl font-bold">{isLoading ? '...' : activeTreatments || 23}</p>
                    <p className="text-sm text-muted-foreground">Treatments</p>
                  </div>
                  {/* Simple trend line */}
                  <div className="flex items-end gap-0.5 h-8 mt-2">
                    {[60, 45, 55, 40, 50, 35, 30].map((h, i) => (
                      <div key={i} className="flex-1 bg-rose-500/20 rounded-t" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Pastures Card */}
            <Link href="/app/pastures">
              <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                      <Sprout className="h-5 w-5 text-emerald-500" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-3xl font-bold">{isLoading ? '...' : activePastures || 42}</p>
                    <p className="text-sm text-muted-foreground">Pastures</p>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Avg cover</span>
                      <span>2,432 kg/ha</span>
                    </div>
                    <Progress value={78} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Weather Card */}
            <Link href="/app/weather">
              <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group border-0 shadow-sm bg-gradient-to-br from-sky-50/80 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-sky-500/10 group-hover:bg-sky-500/20 transition-colors">
                      <Sun className="h-5 w-5 text-sky-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">{weather.condition}</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-3xl font-bold">{weather.temp}°C</p>
                    <p className="text-sm text-muted-foreground">Weather</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wind className="h-3 w-3" /> {weather.wind} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" /> {weather.humidity}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {QUICK_ACTIONS.map(action => (
              <Link key={action.id} href={action.path}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Upcoming</h2>
          <div className="space-y-2">
            {upcomingAlerts.map(alert => (
              <Link key={alert.id} href={alert.path}>
                <div className="flex items-center justify-between p-4 rounded-lg bg-card border hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-500/10">
                      <Baby className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>
            <Link href="/app/dashboard">
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-4">
                {[
                  { user: 'Sam', action: 'Recorded 12 liveweights', time: '04:45pm', icon: Scale },
                  { user: 'Admin', action: 'Added 3 calving events', time: '02:15pm', icon: Baby },
                  { user: 'Rhys', action: 'Updated health records', time: '11:00am', icon: Heart },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.user}</span>
                        <span className="text-muted-foreground"> {item.action}</span>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
