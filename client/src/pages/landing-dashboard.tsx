import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { 
  Search,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Sun,
  CloudRain,
  Users,
  Heart,
  Baby,
  Sprout,
  Scale,
  Shield,
  BarChart3,
  Calendar,
  MessageSquare,
  Bell,
  ChevronRight,
  Activity,
  Milk,
  Syringe,
  MapPin,
  FileText,
  DollarSign,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";

// Pulse-unique: Live stat cards with trends (not just icons)
const quickStats = [
  { 
    label: 'Total Herd', 
    value: '847', 
    trend: '+12', 
    trendUp: true,
    icon: Users,
    color: 'from-emerald-500 to-emerald-600',
    path: '/app/animals'
  },
  { 
    label: 'Milking', 
    value: '412', 
    trend: '48.6%',
    trendUp: true,
    icon: Milk,
    color: 'from-sky-500 to-sky-600',
    path: '/app/milk-production'
  },
  { 
    label: 'In Calf', 
    value: '298', 
    trend: '72.3%',
    trendUp: true,
    icon: Baby,
    color: 'from-pink-500 to-pink-600',
    path: '/app/reproduction'
  },
  { 
    label: 'Treatments', 
    value: '23', 
    trend: 'Active',
    trendUp: false,
    icon: Heart,
    color: 'from-rose-500 to-rose-600',
    path: '/app/treatments/current'
  },
];

// Pulse-unique: Action hub with contextual seasonal actions
const getSeasonalActions = () => {
  const month = new Date().getMonth();
  // Summer/Autumn (Dec-May): Focus on mating, drying off
  // Winter/Spring (Jun-Nov): Focus on calving, feed
  if (month >= 5 && month <= 10) {
    return [
      { name: 'Record Calving', icon: Baby, path: '/app/reproduction', priority: true },
      { name: 'Pasture Walk', icon: Sprout, path: '/app/pasture-walk', priority: true },
      { name: 'Health Check', icon: Heart, path: '/app/treatments/current', priority: false },
      { name: 'Weigh Animals', icon: Scale, path: '/app/weight-growth', priority: false },
    ];
  }
  return [
    { name: 'Record Mating', icon: Baby, path: '/app/reproduction', priority: true },
    { name: 'Dry Off', icon: Milk, path: '/app/reproduction', priority: true },
    { name: 'Body Condition', icon: Scale, path: '/app/weight-growth', priority: false },
    { name: 'Vaccination', icon: Syringe, path: '/app/vaccination', priority: false },
  ];
};

// Pulse-unique: Module cards with preview data
const modules = [
  {
    id: 'herd',
    title: 'Herd Management',
    icon: Users,
    gradient: 'from-emerald-600 to-emerald-700',
    stats: [
      { label: 'Current', value: '847' },
      { label: 'Groups', value: '12' },
    ],
    links: [
      { name: 'All Animals', path: '/app/animals' },
      { name: 'Groups', path: '/app/groups' },
      { name: 'Stock Reconciliation', path: '/app/stock-reconciliation' },
    ],
  },
  {
    id: 'health',
    title: 'Health & Treatments',
    icon: Heart,
    gradient: 'from-rose-500 to-rose-600',
    stats: [
      { label: 'Active', value: '23' },
      { label: 'Due Today', value: '8' },
    ],
    links: [
      { name: 'Current Treatments', path: '/app/treatments/current' },
      { name: 'Medicine Inventory', path: '/app/medicines' },
      { name: 'Vaccination', path: '/app/vaccination' },
      { name: 'Field Mode', path: '/app/field-mode' },
    ],
  },
  {
    id: 'reproduction',
    title: 'Reproduction',
    icon: Baby,
    gradient: 'from-pink-500 to-pink-600',
    stats: [
      { label: 'In Calf', value: '298' },
      { label: 'Due Soon', value: '45' },
    ],
    links: [
      { name: 'Breeding Events', path: '/app/reproduction' },
      { name: 'Milk Production', path: '/app/milk-production' },
    ],
  },
  {
    id: 'pastures',
    title: 'Land & Pastures',
    icon: Sprout,
    gradient: 'from-green-600 to-green-700',
    stats: [
      { label: 'Paddocks', value: '42' },
      { label: 'Avg Cover', value: '2,450' },
    ],
    links: [
      { name: 'Pastures', path: '/app/pastures' },
      { name: 'Pasture Walk', path: '/app/pasture-walk' },
      { name: 'Rotation Planner', path: '/app/pasture-rotation' },
      { name: 'Farm Map', path: '/app/map-tasks' },
    ],
  },
  {
    id: 'weights',
    title: 'Weights & Performance',
    icon: Scale,
    gradient: 'from-indigo-500 to-indigo-600',
    stats: [
      { label: 'Avg Weight', value: '485kg' },
      { label: 'Last Weigh', value: '3d ago' },
    ],
    links: [
      { name: 'Weight & Growth', path: '/app/weight-growth' },
      { name: 'Performance', path: '/app/analytics' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: Shield,
    gradient: 'from-purple-500 to-purple-600',
    stats: [
      { label: 'NAIT', value: '100%' },
      { label: 'NZFAP', value: '94%' },
    ],
    links: [
      { name: 'NAIT Records', path: '/app/nait-compliance' },
      { name: 'NZFAP', path: '/app/nzfap-compliance' },
      { name: 'Health & Safety', path: '/app/compliance' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    gradient: 'from-amber-500 to-amber-600',
    stats: [
      { label: 'Reports', value: '24' },
      { label: 'Insights', value: '5 new' },
    ],
    links: [
      { name: 'Herd Reports', path: '/app/herd-reports' },
      { name: 'Analytics Dashboard', path: '/app/analytics' },
      { name: 'Benchmarking', path: '/app/benchmarking' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    icon: Wrench,
    gradient: 'from-slate-600 to-slate-700',
    stats: [
      { label: 'Tasks Today', value: '7' },
      { label: 'Staff On', value: '4' },
    ],
    links: [
      { name: 'Shed', path: '/app/shed' },
      { name: 'Calendar', path: '/app/calendar' },
      { name: 'Staff', path: '/app/operations/staff' },
      { name: 'Weather', path: '/app/weather' },
    ],
  },
  {
    id: 'financial',
    title: 'Financial',
    icon: DollarSign,
    gradient: 'from-teal-500 to-teal-600',
    stats: [
      { label: 'This Month', value: '$42.5k' },
      { label: 'vs Budget', value: '+8%' },
    ],
    links: [
      { name: 'Overview', path: '/app/financial' },
      { name: 'Alerts', path: '/app/alerts' },
    ],
  },
];

// Pulse-unique: Recent activity with rich context
const recentActivity = [
  { 
    type: 'treatment', 
    message: 'Batch treatment completed', 
    detail: '12 animals - Metacam', 
    time: '15 min ago',
    user: 'Sam',
    icon: Heart,
    color: 'text-rose-500'
  },
  { 
    type: 'calving', 
    message: 'Calving recorded', 
    detail: 'Cow #445 - Bull calf', 
    time: '2 hours ago',
    user: 'Rhys',
    icon: Baby,
    color: 'text-pink-500'
  },
  { 
    type: 'pasture', 
    message: 'Pasture walk completed', 
    detail: '33 paddocks measured', 
    time: '4 hours ago',
    user: 'Sam',
    icon: Sprout,
    color: 'text-green-500'
  },
  { 
    type: 'weight', 
    message: 'Liveweights recorded', 
    detail: '144 animals weighed', 
    time: 'Yesterday',
    user: 'Mark',
    icon: Scale,
    color: 'text-indigo-500'
  },
  { 
    type: 'nait', 
    message: 'NAIT movement sent', 
    detail: '96 animals to sale', 
    time: 'Yesterday',
    user: 'Sam',
    icon: MapPin,
    color: 'text-purple-500'
  },
];

// Pulse-unique: Alerts/notifications panel
const alerts = [
  { type: 'warning', message: '8 treatments due today', path: '/app/treatments/current' },
  { type: 'info', message: '3 animals due to calve this week', path: '/app/reproduction' },
  { type: 'success', message: 'NAIT sync completed', path: '/app/nait-compliance' },
];

export default function LandingDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const seasonalActions = getSeasonalActions();
  
  // Get current time greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20">
      {/* Hero Section - Pulse unique gradient header */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Welcome & Search */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{greeting}</h1>
              <p className="text-emerald-100 text-lg">Your farm at a glance</p>
              
              {/* Global Search - Pulse unique styling */}
              <div className="mt-4 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-300" />
                <Input
                  placeholder="Search animals, paddocks, records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-emerald-600 text-white placeholder:text-emerald-200 focus:bg-white/20 focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Stats Row - Pulse unique live data cards */}
            <div className="flex gap-3 flex-wrap">
              {quickStats.map((stat) => (
                <Link key={stat.label} href={stat.path}>
                  <a className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 hover:bg-white/20 transition-all cursor-pointer min-w-[120px] block">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="h-4 w-4 text-emerald-200" />
                      <span className="text-xs text-emerald-200">{stat.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{stat.value}</span>
                      <span className={`text-xs ${stat.trendUp ? 'text-green-300' : 'text-amber-300'}`}>
                        {stat.trend}
                      </span>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Alerts Banner - Pulse unique */}
        {alerts.length > 0 && (
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
            {alerts.map((alert, idx) => (
              <Link key={idx} href={alert.path}>
                <a className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-all hover:scale-105 ${
                  alert.type === 'warning' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                  alert.type === 'success' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' :
                  'bg-sky-100 text-sky-800 hover:bg-sky-200'
                }`}>
                  {alert.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                  {alert.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                  {alert.type === 'info' && <Bell className="h-4 w-4" />}
                  {alert.message}
                  <ChevronRight className="h-4 w-4" />
                </a>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Actions - Pulse unique seasonal context */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Quick Actions
            </h2>
            <Link href="/app/field-mode">
              <a>
                <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                  <Plus className="h-4 w-4 mr-1" />
                  Field Mode
                </Button>
              </a>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {seasonalActions.map((action) => (
              <Link key={action.name} href={action.path}>
                <a className="block">
                  <Button 
                    variant="outline" 
                    className={`w-full h-auto py-4 flex flex-col items-center gap-2 hover:scale-105 transition-all ${
                      action.priority 
                        ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-800' 
                        : 'hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    <action.icon className={`h-6 w-6 ${action.priority ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">{action.name}</span>
                    {action.priority && (
                      <Badge className="bg-amber-500 text-white text-xs">Seasonal</Badge>
                    )}
                  </Button>
                </a>
              </Link>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modules Grid - 2 columns on large screens */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Farm Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {modules.map((module) => (
                <Card 
                  key={module.id} 
                  className="overflow-hidden hover:shadow-lg transition-all group border-0 shadow-md"
                >
                  {/* Module Header with gradient */}
                  <div className={`bg-gradient-to-r ${module.gradient} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <module.icon className="h-6 w-6" />
                        <h3 className="font-semibold">{module.title}</h3>
                      </div>
                    </div>
                    {/* Mini stats */}
                    <div className="flex gap-4 mt-3">
                      {module.stats.map((stat) => (
                        <div key={stat.label} className="text-sm">
                          <span className="text-white/70">{stat.label}: </span>
                          <span className="font-semibold">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Module Links */}
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      {module.links.map((link) => (
                        <Link key={link.path} href={link.path}>
                          <a className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 text-sm text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer group/link">
                            <span>{link.name}</span>
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Activity Feed - Sidebar */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                Recent Activity
              </h2>
              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700">
                View All
              </Button>
            </div>
            
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg bg-slate-100 ${activity.color}`}>
                          <activity.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{activity.message}</p>
                          <p className="text-sm text-slate-500 truncate">{activity.detail}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{activity.time}</span>
                            <span className="text-xs text-slate-300">•</span>
                            <span className="text-xs text-emerald-600">{activity.user}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team Chat Quick Access */}
            <Link href="/app/chat">
              <a className="block">
                <Card className="mt-4 border-0 shadow-md bg-gradient-to-r from-cyan-500 to-cyan-600 text-white cursor-pointer hover:shadow-lg transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-6 w-6" />
                        <div>
                          <h3 className="font-semibold">Team Chat</h3>
                          <p className="text-sm text-cyan-100">3 unread messages</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
