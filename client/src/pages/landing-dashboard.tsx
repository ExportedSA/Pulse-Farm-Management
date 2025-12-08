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
    title: "Animals",
    description: "Herd management and tracking",
    icon: Users,
    color: "#3d8b5f",
    links: [
      { name: "All Animals", path: "/app/animals" },
      { name: "Groups", path: "/app/groups" },
      { name: "Stock Reconciliation", path: "/app/stock-reconciliation" },
      { name: "Weight & Growth", path: "/app/weight-growth" },
    ],
  },
  {
    title: "Health",
    description: "Treatments and veterinary care",
    icon: Heart,
    color: "#2d7a4a",
    links: [
      { name: "Treatments", path: "/app/treatments/current" },
      { name: "Medicine Inventory", path: "/app/medicines" },
      { name: "Vaccination", path: "/app/vaccination" },
      { name: "Field Mode", path: "/app/field-mode" },
    ],
  },
  {
    title: "Reproduction",
    description: "Breeding and milk production",
    icon: Droplets,
    color: "#4a9c6d",
    links: [
      { name: "Breeding", path: "/app/reproduction" },
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
    ],
  },
  {
    title: "Operations",
    description: "Daily tasks and scheduling",
    icon: Wrench,
    color: "#b8963e",
    links: [
      { name: "Shed", path: "/app/shed" },
      { name: "Calendar", path: "/app/calendar" },
      { name: "Staff & Contractors", path: "/app/operations" },
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
    ],
  },
  {
    title: "Compliance",
    description: "NAIT, NZFAP and H&S records",
    icon: Shield,
    color: "#8b5cf6",
    links: [
      { name: "NAIT", path: "/app/nait-compliance" },
      { name: "NZFAP", path: "/app/nzfap-compliance" },
      { name: "Health & Safety", path: "/app/compliance" },
    ],
  },
  {
    title: "Financial",
    description: "Income and expenses",
    icon: DollarSign,
    color: "#10b981",
    links: [
      { name: "Financial Overview", path: "/app/financial" },
      { name: "Alerts", path: "/app/alerts" },
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
