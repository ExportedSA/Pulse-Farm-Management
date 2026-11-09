import { Link } from 'wouter';
import { AlertTriangle, Beef, ClipboardCheck, Clock, Download, FileText, HeartPulse, Map, Shield, Sprout } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Every report and export Pulse makes, in one place. Each is built from the farm's own records
// when it's opened, so it shows what's recorded and nothing else.

const EXPORTS = [
  {
    href: '/app/compliance-overview', icon: ClipboardCheck, title: 'Audit pack',
    text: "Each Dairy Diary / Farm Dairy Records requirement checked against the season's records, with the evidence. Print, save as PDF, or download each section as CSV.",
  },
  {
    href: '/app/farm-map/reports', icon: Map, title: 'Fertiliser, spray and effluent reports',
    text: 'Jobs and nutrients by paddock and season, with dockets and restrictions. Print or download as CSV.',
  },
  {
    href: '/app/herd-reports', icon: Beef, title: 'Herd reports',
    text: 'The herd by status, sex, age and breed, and deaths, from the animal records.',
  },
  {
    href: '/app/reports/animals', icon: FileText, title: 'Animal report',
    text: 'The stock list and health records for a date range. Download as CSV.',
  },
  {
    href: '/app/health/reports', icon: HeartPulse, title: 'Health reports',
    text: 'Ready-made and custom reports from the treatment records.',
  },
  {
    href: '/app/reports/timesheets', icon: Clock, title: 'Timesheet report',
    text: 'Hours worked by each person over a period. Download as CSV.',
  },
  {
    href: '/app/reports/safety', icon: Shield, title: 'Safety report',
    text: 'Open hazards by risk, safety tasks and equipment status.',
  },
  {
    href: '/app/farm-map/hazards/print', icon: AlertTriangle, title: 'Hazard map',
    text: "The farm's hazards and points of interest on the map, with the emergency details, for visitors and inductions.",
  },
  {
    href: '/app/pasture-walk', icon: Sprout, title: 'Pasture covers',
    text: 'Covers, the feed wedge and walk history from the pasture walks.',
  },
];

export default function ReportsExportPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Download className="h-6 w-6 text-pulse-forest" />Reports and exports</h1>
        <p className="text-sm text-muted-foreground mt-1">Built from this farm's records each time you open them. The farm map can also be exported as KML or GeoJSON from its Layers panel.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {EXPORTS.map(e => (
          <Card key={e.href} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><e.icon className="h-5 w-5 text-pulse-forest" />{e.title}</CardTitle>
              <CardDescription>{e.text}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" size="sm"><Link href={e.href}>Open</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
