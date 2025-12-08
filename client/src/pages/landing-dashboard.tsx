import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { 
  MessageSquare, 
  Sprout, 
  Shield, 
  Heart, 
  Users, 
  Syringe, 
  BarChart3, 
  Warehouse, 
  DollarSign,
  Wrench,
  Droplets,
} from "lucide-react";

type SubLink = { name: string; path: string };
type LinkGroup = { 
  name: string; 
  path?: string; 
  subLinks?: SubLink[];
};

const categories = [
  {
    title: "Animals",
    description: "Herd management and tracking",
    icon: Users,
    color: "#3d8b5f",
    links: [
      { name: "All Animals", path: "/app/animals" },
      { 
        name: "Groups & Organization", 
        subLinks: [
          { name: "Animal Groups", path: "/app/groups" },
          { name: "Smart Groups", path: "/app/smart-groups" },
          { name: "Bulk Operations", path: "/app/bulk-operations" },
        ]
      },
      { name: "Stock Reconciliation", path: "/app/stock-reconciliation" },
      { 
        name: "Weight & Performance", 
        subLinks: [
          { name: "Weight & Growth", path: "/app/weight-growth" },
          { name: "Animal Timeline", path: "/app/animals/123/timeline" },
          { name: "Equipment Linking", path: "/app/equipment" },
        ]
      },
    ],
  },
  {
    title: "Health",
    description: "Treatments and veterinary care",
    icon: Heart,
    color: "#2d7a4a",
    links: [
      { 
        name: "Treatments", 
        subLinks: [
          { name: "Current Treatments", path: "/app/treatments/current" },
          { name: "Batch Treatment", path: "/app/batch-treatment" },
          { name: "Treatment History", path: "/app/treatments" },
        ]
      },
      { name: "Medicine Inventory", path: "/app/medicines" },
      { name: "Vaccination", path: "/app/vaccination" },
      { 
        name: "Veterinary", 
        subLinks: [
          { name: "Vet Records", path: "/app/veterinary" },
          { name: "Lab Results", path: "/app/lab-results" },
          { name: "Health Monitoring", path: "/app/health-monitoring" },
          { name: "Health Analytics", path: "/app/health-analytics" },
        ]
      },
      { name: "Field Mode", path: "/app/field-mode" },
    ],
  },
  {
    title: "Reproduction",
    description: "Breeding and milk production",
    icon: Droplets,
    color: "#4a9c6d",
    links: [
      { 
        name: "Breeding", 
        subLinks: [
          { name: "Reproduction Events", path: "/app/reproduction" },
          { name: "Breeding Management", path: "/app/reproduction-management" },
        ]
      },
      { name: "Milk Production", path: "/app/milk-production" },
    ],
  },
  {
    title: "Pastures",
    description: "Land and grazing management",
    icon: Sprout,
    color: "#1e5631",
    links: [
      { name: "Pastures", path: "/app/pastures" },
      { name: "Pasture Walk", path: "/app/pasture-walk" },
      { name: "Rotation Planning", path: "/app/pasture-rotation" },
      { name: "Map Tasks", path: "/app/map-tasks" },
    ],
  },
  {
    title: "Operations",
    description: "Daily tasks and scheduling",
    icon: Wrench,
    color: "#b8963e",
    links: [
      { name: "Shed", path: "/app/shed" },
      { 
        name: "Scheduling", 
        subLinks: [
          { name: "Task Calendar", path: "/app/calendar" },
          { name: "Kanban Board", path: "/app/kanban" },
          { name: "Job Scheduler", path: "/app/jobs" },
          { name: "Recurring Tasks", path: "/app/recurring-tasks" },
          { name: "Task Templates", path: "/app/task-templates" },
        ]
      },
      { 
        name: "Team", 
        subLinks: [
          { name: "Staff Management", path: "/app/operations/staff" },
          { name: "Contractors", path: "/app/operations/contractors" },
          { name: "Timesheets", path: "/app/timesheets" },
        ]
      },
      { 
        name: "Visitors & Vehicles", 
        subLinks: [
          { name: "Visitor Management", path: "/app/operations/visitors" },
          { name: "Vehicle Registry", path: "/app/operations/vehicles" },
          { name: "QR Codes", path: "/app/operations/qrcodes" },
        ]
      },
      { name: "Weather", path: "/app/weather" },
    ],
  },
  {
    title: "Analytics",
    description: "Reports and insights",
    icon: BarChart3,
    color: "#c9a227",
    links: [
      { name: "Dashboard", path: "/app/analytics" },
      { name: "Herd Reports", path: "/app/herd-reports" },
      { name: "Benchmarking", path: "/app/benchmarking" },
      { name: "AI Health Predictions", path: "/app/health-predictions" },
      { name: "Alerts", path: "/app/alerts" },
    ],
  },
  {
    title: "Compliance",
    description: "NAIT, NZFAP and H&S records",
    icon: Shield,
    color: "#8b5cf6",
    links: [
      { 
        name: "NAIT", 
        subLinks: [
          { name: "NAIT Records", path: "/app/nait" },
          { name: "NAIT Compliance", path: "/app/nait-compliance" },
        ]
      },
      { name: "NZFAP", path: "/app/nzfap-compliance" },
      { 
        name: "Health & Safety", 
        subLinks: [
          { name: "H&S Compliance", path: "/app/compliance" },
          { name: "Farm Compliance", path: "/app/farm-compliance" },
          { name: "Compliance Tags", path: "/app/compliance-tags" },
        ]
      },
    ],
  },
  {
    title: "Financial",
    description: "Income and expenses",
    icon: DollarSign,
    color: "#10b981",
    links: [
      { name: "Financial Overview", path: "/app/financial" },
    ],
  },
  {
    title: "Chat",
    description: "Team communication",
    icon: MessageSquare,
    color: "#06b6d4",
    links: [
      { name: "Team Chat", path: "/app/chat" },
    ],
  },
] as const;


// Component for expandable link groups
function LinkItem({ link }: { link: LinkGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Simple link without sub-items
  if (link.path && !link.subLinks) {
    return (
      <Link href={link.path}>
        <a className="block text-sm text-emerald-700 hover:text-amber-600 hover:translate-x-1 transition-transform font-medium py-1">
          → {link.name}
        </a>
      </Link>
    );
  }
  
  // Expandable group with sub-items
  if (link.subLinks) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-emerald-700 hover:text-amber-600 font-medium py-1 w-full text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {link.name}
        </button>
        {isOpen && (
          <div className="ml-4 border-l-2 border-emerald-200 pl-3 space-y-1">
            {link.subLinks.map((subLink) => (
              <Link key={subLink.path} href={subLink.path}>
                <a className="block text-sm text-emerald-600 hover:text-amber-600 hover:translate-x-1 transition-transform py-0.5">
                  {subLink.name}
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return null;
}

export default function LandingDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-2 text-emerald-900">Pulse Farm Management</h1>
          <p className="text-xl text-slate-600">Everything you need to manage your dairy farm</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.title} className="p-6 hover:shadow-xl transition-all border border-slate-200 bg-white shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: category.color }}>
                  <category.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1 text-emerald-900">{category.title}</h2>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
              <div className="space-y-1 pl-1">
                {category.links.map((link, idx) => (
                  <LinkItem key={link.name + idx} link={link as LinkGroup} />
                ))}
              </div>
            </Card>
          ))}
        </div>
        
        {/* Footer */}
        <div className="mt-10 text-center text-sm text-amber-800/70">
          <p>Progressive Web App for Dairy Farm Management</p>
        </div>
      </div>
    </div>
  );
}
