import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Users, Sprout, Heart, Pill, Settings } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  const modules = [
    {
      icon: Activity,
      title: "Treatments",
      description: "Track animal treatments and withholding periods",
      path: "/app/treatments/current",
      color: "bg-emerald-800",
      iconColor: "text-white",
    },
    {
      icon: Users,
      title: "Animals",
      description: "Manage your herd and individual animal profiles",
      path: "/app/animals",
      color: "bg-emerald-700",
      iconColor: "text-white",
    },
    {
      icon: Pill,
      title: "Medicines",
      description: "Track inventory, stock levels, and expiry dates",
      path: "/app/medicines",
      color: "bg-amber-600",
      iconColor: "text-white",
    },
    {
      icon: Sprout,
      title: "Pastures",
      description: "Manage grazing rotation and paddock allocation",
      path: "/app/pastures",
      color: "bg-emerald-600",
      iconColor: "text-white",
    },
    {
      icon: Heart,
      title: "Reproduction",
      description: "Track heat detection, AI, and pregnancy status",
      path: "/app/reproduction",
      color: "bg-rose-600",
      iconColor: "text-white",
    },
    {
      icon: Settings,
      title: "Settings",
      description: "Configure staff, products, and preferences",
      path: "/app/settings",
      color: "bg-gray-600",
      iconColor: "text-white",
    },
  ];

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 md:p-12 bg-gradient-to-br from-slate-50 to-slate-100"
    >
      <div className="max-w-6xl w-full space-y-12">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-emerald-900" data-testid="text-landing-title">
              Comprehensive Farm Management
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto" data-testid="text-landing-subtitle">
              Optimized for tablets • Offline-capable • Designed for the field
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                className="hover-elevate active-elevate-2 cursor-pointer overflow-hidden bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200"
                onClick={() => setLocation(module.path)}
                data-testid={`card-module-${module.title.toLowerCase()}`}
              >
                <div className="p-6 space-y-4">
                  <div className={`w-14 h-14 rounded-xl ${module.color} flex items-center justify-center`}>
                    <Icon className={`w-7 h-7 ${module.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2 text-emerald-900">{module.title}</h2>
                    <p className="text-sm text-gray-600">{module.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="h-14 px-8 text-lg bg-emerald-800 hover:bg-emerald-900 text-white shadow-xl"
            onClick={() => setLocation("/app")}
            data-testid="button-get-started"
          >
            Go to Dashboard
          </Button>
        </div>

        <div className="text-center text-sm text-emerald-900/80 space-y-1">
          <p>Progressive Web App for Dairy Farm Management</p>
          <p className="text-xs text-amber-800/60">Glove-friendly • High contrast • Offline sync</p>
        </div>
      </div>
    </div>
  );
}
