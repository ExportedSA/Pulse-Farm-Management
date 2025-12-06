import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { MessageSquare, Sprout, Shield, Heart, Users, Syringe, BarChart3, Warehouse, DollarSign } from "lucide-react";

const categories = [
  {
    title: "Communication",
    description: "Team chat, notifications, and collaboration",
    icon: MessageSquare,
    color: "#2d5a3d",
    links: [
      { name: "Team Chat", path: "/app/chat" },
      { name: "Task Planner", path: "/app/jobs" }
    ],
  },
  {
    title: "Animal Health",
    description: "Treatments, medicines, and health records",
    icon: Heart,
    color: "#1e3932",
    links: [
      { name: "Treatments", path: "/app/treatments/current" },
      { name: "Medicine Inventory", path: "/app/medicines" },
      { name: "Reproduction", path: "/app/reproduction" },
    ],
  },
  {
    title: "Animal Management",
    description: "Track animals, groups, and movements",
    icon: Users,
    color: "#3d7550",
    links: [
      { name: "All Animals", path: "/app/animals" },
      { name: "Stock Reconciliation", path: "/app/stock-reconciliation" },
      { name: "Groups", path: "/app/groups" },
      { name: "NAIT Records", path: "/app/nait" },
    ],
  },
  {
    title: "Pasture",
    description: "Manage pastures and rotation planning",
    icon: Sprout,
    color: "#264a34",
    links: [
      { name: "Pastures", path: "/app/pastures" },
      { name: "Rotation Planner", path: "/app/pasture-rotation" },
      { name: "Map Tasks", path: "/app/map-tasks" },
    ],
  },
  {
    title: "Health & Safety",
    description: "Compliance, hazards, and incident reporting",
    icon: Shield,
    color: "#b8963e",
    links: [
      { name: "Compliance", path: "/app/compliance" },
      { name: "Alerts", path: "/app/alerts" },
    ],
  },
  {
    title: "Operations",
    description: "Shed management and analytics",
    icon: Warehouse,
    color: "#2d5a3d",
    links: [
      { name: "Shed", path: "/app/shed" },
      { name: "Analytics", path: "/app/analytics" },
    ],
  },
  {
    title: "Financial",
    description: "Track expenses, income, and profitability",
    icon: DollarSign,
    color: "#967a52",
    links: [
      { name: "Expenses & Income", path: "/app/financial" },
      { name: "Killsheets", path: "/app/financial" },
    ],
  },
];


export default function LandingDashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto bg-background min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">Pulse Farm Management</h1>
        <p className="text-xl text-muted-foreground">Everything you need to manage your dairy farm</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Card key={category.title} className="p-6 hover:shadow-lg transition-all hover:scale-[1.02] border-pulse-200 bg-card">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: category.color }}>
                <category.icon className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-1">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              {category.links.map((link) => (
                <Link key={link.path} href={link.path}>
                  <a className="block text-sm text-pulse-forest hover:text-pulse-gold hover:underline font-medium">→ {link.name}</a>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
