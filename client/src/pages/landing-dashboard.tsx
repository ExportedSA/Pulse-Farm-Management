import { Link } from "wouter";
import { Card } from "@/components/ui/card";
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
  Zap,
  Activity,
  Award,
  FileText,
  Wrench,
  CalendarDays,
  CloudSun,
  LayoutGrid,
  Briefcase,
  Repeat,
  Timer,
  Building2,
  Car,
  UserCheck,
  QrCode,
  GitBranch,
  BookTemplate,
  Tag,
  Smartphone,
  CheckSquare,
  Scale,
  Stethoscope,
  FlaskConical,
  Droplets,
  Leaf,
  Shuffle,
  MapPin
} from "lucide-react";

const categories = [
  {
    title: "Animal Management",
    description: "Track animals, groups, and movements",
    icon: Users,
    color: "#3d8b5f",
    links: [
      { name: "All Animals", path: "/app/animals" },
      { name: "Stock Reconciliation", path: "/app/stock-reconciliation" },
      { name: "Groups", path: "/app/groups" },
      { name: "Smart Groups", path: "/app/smart-groups" },
      { name: "Bulk Operations", path: "/app/bulk-operations" },
      { name: "Animal Timeline", path: "/app/animals/123/timeline" },
      { name: "Weight & Growth", path: "/app/weight-growth" },
      { name: "Equipment Linking", path: "/app/equipment" },
    ],
  },
  {
    title: "Health & Treatments",
    description: "Treatments, medicines, and health records",
    icon: Heart,
    color: "#2d7a4a",
    links: [
      { name: "Treatments", path: "/app/treatments/current" },
      { name: "Batch Treatment", path: "/app/batch-treatment" },
      { name: "Medicine Inventory", path: "/app/medicines" },
      { name: "Vaccination", path: "/app/vaccination" },
      { name: "Health Monitoring", path: "/app/health-monitoring" },
      { name: "Veterinary", path: "/app/veterinary" },
      { name: "Lab Results", path: "/app/lab-results" },
      { name: "Health Analytics", path: "/app/health-analytics" },
      { name: "Field Mode", path: "/app/field-mode" },
    ],
  },
  {
    title: "Reproduction & Production",
    description: "Breeding management and milk production",
    icon: Droplets,
    color: "#4a9c6d",
    links: [
      { name: "Reproduction", path: "/app/reproduction" },
      { name: "Breeding Management", path: "/app/reproduction-management" },
      { name: "Milk Production", path: "/app/milk-production" },
    ],
  },
  {
    title: "Land & Pasture Management",
    description: "Manage pastures, rotation planning, and mapping",
    icon: Sprout,
    color: "#1e5631",
    links: [
      { name: "Pastures", path: "/app/pastures" },
      { name: "Pasture Rotation", path: "/app/pasture-rotation" },
      { name: "Pasture Walk", path: "/app/pasture-walk" },
      { name: "Map Tasks", path: "/app/map-tasks" },
    ],
  },
  {
    title: "Operations & Tasks",
    description: "Shed management, scheduling, and daily operations",
    icon: Wrench,
    color: "#b8963e",
    links: [
      { name: "Operations", path: "/app/operations" },
      { name: "Shed", path: "/app/shed" },
      { name: "Staff Management", path: "/app/operations/staff" },
      { name: "Contractors", path: "/app/operations/contractors" },
      { name: "Visitor Management", path: "/app/operations/visitors" },
      { name: "Vehicle Registry", path: "/app/operations/vehicles" },
      { name: "QR Code Generation", path: "/app/operations/qrcodes" },
      { name: "Task Calendar", path: "/app/calendar" },
      { name: "Weather & Planning", path: "/app/weather" },
      { name: "Kanban Board", path: "/app/kanban" },
      { name: "Job Scheduler", path: "/app/jobs" },
      { name: "Recurring Tasks", path: "/app/recurring-tasks" },
      { name: "Task Templates", path: "/app/task-templates" },
      { name: "Task Dependencies", path: "/app/dependencies" },
      { name: "Timesheets", path: "/app/timesheets" },
    ],
  },
  {
    title: "Analytics & Reporting",
    description: "Reports, analytics, and business intelligence",
    icon: BarChart3,
    color: "#c9a227",
    links: [
      { name: "Analytics", path: "/app/analytics" },
      { name: "Herd Reports", path: "/app/herd-reports" },
      { name: "Benchmarking", path: "/app/benchmarking" },
      { name: "AI Health Predictions", path: "/app/health-predictions" },
      { name: "Alerts", path: "/app/alerts" },
    ],
  },
  {
    title: "Compliance & Records",
    description: "Regulatory compliance and documentation",
    icon: Shield,
    color: "#8b5cf6",
    links: [
      { name: "NAIT Records", path: "/app/nait" },
      { name: "NAIT Compliance", path: "/app/nait-compliance" },
      { name: "NZFAP Compliance", path: "/app/nzfap-compliance" },
      { name: "H&S Compliance", path: "/app/compliance" },
      { name: "Farm Compliance", path: "/app/farm-compliance" },
      { name: "Compliance Tagging", path: "/app/compliance-tags" },
    ],
  },
  {
    title: "Communication",
    description: "Team chat and collaboration",
    icon: MessageSquare,
    color: "#06b6d4",
    links: [
      { name: "Team Chat", path: "/app/chat" },
    ],
  },
  {
    title: "Financial Management",
    description: "Track expenses, income, and profitability",
    icon: DollarSign,
    color: "#10b981",
    links: [
      { name: "Financial", path: "/app/financial" },
    ],
  },
];


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
            <Card key={category.title} className="p-6 hover:shadow-xl transition-all hover:scale-[1.02] border border-slate-200 bg-white shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl shadow-md" style={{ backgroundColor: category.color }}>
                  <category.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1 text-emerald-900">{category.title}</h2>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
              <div className="space-y-2 pl-1">
                {category.links.map((link) => (
                  <Link key={link.path} href={link.path}>
                    <a className="block text-sm text-emerald-700 hover:text-amber-600 hover:translate-x-1 transition-transform font-medium">→ {link.name}</a>
                  </Link>
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
