import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Clock, Syringe, Heart, Scale, MapPin, Users, Receipt, 
  PlusCircle, ArrowLeft, Filter, Calendar, Activity,
  ChevronRight, Loader2, AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import type { Animal } from "@shared/schema";

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  icon?: string;
  color?: string;
}

interface TimelineResponse {
  animalId: string;
  animalName: string;
  totalEvents: number;
  events: TimelineEvent[];
}

interface TimelineSummary {
  animalId: string;
  animalName: string;
  status: string;
  breed: string | null;
  sex: string | null;
  ageMonths: number | null;
  currentPasture: string | null;
  latestWeight: {
    weight: string;
    date: string;
    bcs: number | null;
  } | null;
  counts: {
    treatments: number;
    reproductionEvents: number;
    weightRecords: number;
    pastureMovements: number;
  };
  registeredAt: string;
}

// Icon mapping
const getEventIcon = (type: string) => {
  switch (type) {
    case 'created': return <PlusCircle className="h-4 w-4" />;
    case 'treatment': return <Syringe className="h-4 w-4" />;
    case 'reproduction': return <Heart className="h-4 w-4" />;
    case 'weight_record': return <Scale className="h-4 w-4" />;
    case 'pasture_move': return <MapPin className="h-4 w-4" />;
    case 'group_add':
    case 'group_remove': return <Users className="h-4 w-4" />;
    case 'transaction': return <Receipt className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

// Color mapping
const getEventColor = (type: string, color?: string) => {
  if (color) {
    const colorMap: Record<string, string> = {
      'green': 'bg-green-100 text-green-700 border-green-200',
      'blue': 'bg-blue-100 text-blue-700 border-blue-200',
      'pink': 'bg-pink-100 text-pink-700 border-pink-200',
      'orange': 'bg-orange-100 text-orange-700 border-orange-200',
      'purple': 'bg-purple-100 text-purple-700 border-purple-200',
      'indigo': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'gray': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colorMap[color] || 'bg-gray-100 text-gray-700 border-gray-200';
  }
  
  const typeColorMap: Record<string, string> = {
    'created': 'bg-green-100 text-green-700 border-green-200',
    'treatment': 'bg-blue-100 text-blue-700 border-blue-200',
    'reproduction': 'bg-pink-100 text-pink-700 border-pink-200',
    'weight_record': 'bg-orange-100 text-orange-700 border-orange-200',
    'pasture_move': 'bg-purple-100 text-purple-700 border-purple-200',
    'group_add': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'group_remove': 'bg-red-100 text-red-700 border-red-200',
    'transaction': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return typeColorMap[type] || 'bg-gray-100 text-gray-700 border-gray-200';
};

export default function AnimalTimelinePage() {
  const [, params] = useRoute("/app/animals/:animalId/timeline");
  const animalId = params?.animalId;
  
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("timeline");

  // Fetch animal details
  const { data: animal, isLoading: loadingAnimal } = useQuery<Animal>({
    queryKey: ["/api/animals", animalId],
    queryFn: async () => {
      const res = await fetch(`/api/animals/${animalId}`);
      if (!res.ok) throw new Error("Failed to fetch animal");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch timeline
  const { data: timeline, isLoading: loadingTimeline } = useQuery<TimelineResponse>({
    queryKey: ["/api/animals", animalId, "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/animals/${animalId}/timeline?limit=100`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Fetch summary
  const { data: summary } = useQuery<TimelineSummary>({
    queryKey: ["/api/animals", animalId, "timeline/summary"],
    queryFn: async () => {
      const res = await fetch(`/api/animals/${animalId}/timeline/summary`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!animalId,
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!timeline?.events) return [];
    if (typeFilter === "all") return timeline.events;
    return timeline.events.filter(e => e.type === typeFilter);
  }, [timeline?.events, typeFilter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of filteredEvents) {
      const dateKey = format(new Date(event.date), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredEvents]);

  if (!animalId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No animal selected</p>
            <Link href="/app/animals">
              <Button className="mt-4">Go to Animals</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = loadingAnimal || loadingTimeline;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/app/animals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8 text-primary" />
            Animal Timeline
          </h1>
          <p className="text-muted-foreground mt-1">
            {animal?.cowId || animal?.naitTag || "Loading..."} - Complete activity history
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={summary.status === "active" ? "default" : "secondary"} className="mt-1">
                {summary.status}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Age</p>
              <p className="text-lg font-semibold">
                {summary.ageMonths !== null ? `${summary.ageMonths} mo` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Current Pasture</p>
              <p className="text-sm font-medium truncate">
                {summary.currentPasture || "Not assigned"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Latest Weight</p>
              <p className="text-lg font-semibold">
                {summary.latestWeight ? `${summary.latestWeight.weight} kg` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Treatments</p>
              <p className="text-lg font-semibold text-blue-600">
                {summary.counts.treatments}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-lg font-semibold text-primary">
                {timeline?.totalEvents || 0}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          {activeTab === "timeline" && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="treatment">Treatments</SelectItem>
                <SelectItem value="reproduction">Reproduction</SelectItem>
                <SelectItem value="weight_record">Weight Records</SelectItem>
                <SelectItem value="pasture_move">Pasture Moves</SelectItem>
                <SelectItem value="group_add">Group Changes</SelectItem>
                <SelectItem value="transaction">Transactions</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="mt-2 text-muted-foreground">Loading timeline...</p>
              </CardContent>
            </Card>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No events found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {typeFilter !== "all" ? "Try changing the filter" : "This animal has no recorded history yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-4">
                    {groupedEvents.map(([dateKey, events], groupIndex) => (
                      <div key={dateKey} className="mb-6">
                        {/* Date Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {events.length} event{events.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        
                        {/* Events for this date */}
                        <div className="relative ml-2 pl-6 border-l-2 border-muted">
                          {events.map((event, eventIndex) => (
                            <div key={event.id} className="relative mb-4 last:mb-0">
                              {/* Timeline dot */}
                              <div className={`absolute -left-[29px] w-4 h-4 rounded-full border-2 ${getEventColor(event.type, event.color)}`} />
                              
                              {/* Event card */}
                              <div className={`p-3 rounded-lg border ${getEventColor(event.type, event.color)}`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    {getEventIcon(event.type)}
                                    <span className="font-medium">{event.title}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(event.date), "h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm mt-1 opacity-80">{event.description}</p>
                                
                                {/* Metadata */}
                                {event.metadata && Object.keys(event.metadata).length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-current/10">
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(event.metadata)
                                        .filter(([_, v]) => v !== null && v !== undefined)
                                        .slice(0, 3)
                                        .map(([key, value]) => (
                                          <Badge key={key} variant="outline" className="text-xs">
                                            {key}: {typeof value === "object" ? "..." : String(value)}
                                          </Badge>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {groupIndex < groupedEvents.length - 1 && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pasture Movement History
              </CardTitle>
              <CardDescription>
                Track where this animal has been located over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline?.events.filter(e => e.type === "pasture_move").length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pasture movements recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeline?.events
                    .filter(e => e.type === "pasture_move")
                    .map((event) => (
                      <div key={event.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-purple-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{format(new Date(event.date), "MMM d, yyyy")}</p>
                          <p>{formatDistanceToNow(new Date(event.date), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Animal Info */}
            <Card>
              <CardHeader>
                <CardTitle>Animal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-medium">{animal?.cowId || animal?.id}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NAIT Tag</span>
                  <span className="font-medium">{animal?.naitTag || "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Breed</span>
                  <span className="font-medium">{animal?.breed || "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sex</span>
                  <span className="font-medium">{animal?.sex || "—"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span className="font-medium">
                    {animal?.dateOfBirth 
                      ? format(new Date(animal.dateOfBirth), "MMM d, yyyy")
                      : "—"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={animal?.status === "active" ? "default" : "secondary"}>
                    {animal?.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-blue-600" />
                    <span>Treatments</span>
                  </div>
                  <Badge variant="secondary">{summary?.counts.treatments || 0}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-600" />
                    <span>Reproduction Events</span>
                  </div>
                  <Badge variant="secondary">{summary?.counts.reproductionEvents || 0}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-orange-600" />
                    <span>Weight Records</span>
                  </div>
                  <Badge variant="secondary">{summary?.counts.weightRecords || 0}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span>Pasture Movements</span>
                  </div>
                  <Badge variant="secondary">{summary?.counts.pastureMovements || 0}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <span>Registered</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {summary?.registeredAt 
                      ? formatDistanceToNow(new Date(summary.registeredAt), { addSuffix: true })
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
