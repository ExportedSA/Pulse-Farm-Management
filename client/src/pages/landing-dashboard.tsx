import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, Heart, Baby, Sprout, Scale, Shield, ChevronRight, Milk, Settings, X, Plus, AlertCircle } from "lucide-react";

const AVAILABLE_WIDGETS = [
  { id: 'herd', title: 'Herd', icon: Users, value: '847', subtitle: 'Total animals', path: '/app/animals' },
  { id: 'milking', title: 'Milking', icon: Milk, value: '412', subtitle: '48.6% of herd', path: '/app/milk-production' },
  { id: 'incalf', title: 'In Calf', icon: Baby, value: '298', subtitle: '72% conception', path: '/app/reproduction' },
  { id: 'treatments', title: 'Treatments', icon: Heart, value: '23', subtitle: 'Active', path: '/app/treatments/current' },
  { id: 'pastures', title: 'Pastures', icon: Sprout, value: '42', subtitle: 'Paddocks', path: '/app/pastures' },
  { id: 'weights', title: 'Weights', icon: Scale, value: '485kg', subtitle: 'Avg weight', path: '/app/weight-growth' },
  { id: 'compliance', title: 'NAIT', icon: Shield, value: '100%', subtitle: 'Compliant', path: '/app/nait-compliance' },
];

const QUICK_ACTIONS = [
  { id: 'animal', label: 'Find Animal', path: '/app/animals', icon: Users },
  { id: 'treatment', label: 'Record Treatment', path: '/app/treatments/current', icon: Heart },
  { id: 'mating', label: 'Record Mating', path: '/app/reproduction', icon: Baby },
  { id: 'pasture', label: 'Pasture Walk', path: '/app/pasture-walk', icon: Sprout },
];

const DEFAULT_WIDGETS = ['herd', 'milking', 'incalf', 'treatments'];
const STORAGE_KEY = 'pulse_dashboard_widgets';

export default function LandingDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGETS);
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setActiveWidgets(JSON.parse(saved)); } catch {} }
  }, []);

  const saveWidgets = (widgets: string[]) => {
    setActiveWidgets(widgets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  };

  const toggleWidget = (widgetId: string) => {
    if (activeWidgets.includes(widgetId)) {
      saveWidgets(activeWidgets.filter(id => id !== widgetId));
    } else {
      saveWidgets([...activeWidgets, widgetId]);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const widgets = AVAILABLE_WIDGETS.filter(w => activeWidgets.includes(w.id));
  const alerts = [
    { id: '1', message: '8 treatments due today', path: '/app/treatments/current', urgent: true },
    { id: '2', message: '3 animals due to calve this week', path: '/app/reproduction', urgent: false },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>
      <div className="border-b" style={{ borderColor: '#e8e4de' }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: '#1a3a2f' }}>{greeting}</h1>
              <p className="text-sm mt-1" style={{ color: '#636e72' }}>Your farm at a glance</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsCustomizing(!isCustomizing)} style={{ color: '#636e72' }}>
              <Settings className="h-4 w-4 mr-2" />
              {isCustomizing ? 'Done' : 'Customize'}
            </Button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#636e72' }} />
            <Input placeholder="Search animals, paddocks, records..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-0 shadow-sm" style={{ backgroundColor: '#fff' }} />
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {alerts.filter(a => a.urgent).length > 0 && (
          <div className="mb-8">
            {alerts.filter(a => a.urgent).map(alert => (
              <Link key={alert.id} href={alert.path}>
                <a className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{alert.message}</span>
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </a>
              </Link>
            ))}
          </div>
        )}
        {isCustomizing && (
          <Card className="mb-8 border-0 shadow-sm" style={{ backgroundColor: '#fff' }}>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3" style={{ color: '#1a3a2f' }}>Choose which widgets to display:</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_WIDGETS.map(widget => (
                  <button key={widget.id} onClick={() => toggleWidget(widget.id)} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ backgroundColor: activeWidgets.includes(widget.id) ? '#1a3a2f' : '#fff', borderColor: '#e8e4de', color: activeWidgets.includes(widget.id) ? '#fff' : '#636e72', border: activeWidgets.includes(widget.id) ? 'none' : '1px solid #e8e4de' }}>
                    <widget.icon className="h-4 w-4" />
                    {widget.title}
                    {activeWidgets.includes(widget.id) && <X className="h-3 w-3 ml-1" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {widgets.map(widget => (
            <Link key={widget.id} href={widget.path}>
              <a className="block">
                <Card className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group" style={{ backgroundColor: '#fff' }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#f0ebe4' }}>
                        <widget.icon className="h-5 w-5" style={{ color: '#1a3a2f' }} />
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100" style={{ color: '#636e72' }} />
                    </div>
                    <div className="text-2xl font-semibold mb-1" style={{ color: '#1a3a2f' }}>{widget.value}</div>
                    <div className="text-sm" style={{ color: '#636e72' }}>{widget.title}</div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))}
          {isCustomizing && activeWidgets.length < AVAILABLE_WIDGETS.length && (
            <Card className="border-2 border-dashed flex items-center justify-center" style={{ borderColor: '#e8e4de', backgroundColor: 'transparent', minHeight: '120px' }}>
              <div className="text-center p-4">
                <Plus className="h-6 w-6 mx-auto mb-2" style={{ color: '#636e72' }} />
                <span className="text-sm" style={{ color: '#636e72' }}>Add Widget</span>
              </div>
            </Card>
          )}
        </div>
        <div className="mb-10">
          <h2 className="text-sm font-medium mb-4" style={{ color: '#636e72' }}>Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {QUICK_ACTIONS.map(action => (
              <Link key={action.id} href={action.path}>
                <a><Button variant="outline" className="border-0 shadow-sm" style={{ backgroundColor: '#fff', color: '#1a3a2f' }}><action.icon className="h-4 w-4 mr-2" />{action.label}</Button></a>
              </Link>
            ))}
          </div>
        </div>
        {alerts.filter(a => !a.urgent).length > 0 && (
          <div>
            <h2 className="text-sm font-medium mb-4" style={{ color: '#636e72' }}>Upcoming</h2>
            <div className="space-y-2">
              {alerts.filter(a => !a.urgent).map(alert => (
                <Link key={alert.id} href={alert.path}>
                  <a className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fff' }}>
                    <span className="text-sm" style={{ color: '#2d3436' }}>{alert.message}</span>
                    <ChevronRight className="h-4 w-4 ml-auto" style={{ color: '#636e72' }} />
                  </a>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
