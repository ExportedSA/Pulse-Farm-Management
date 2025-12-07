import { Home, Syringe, Pill, Users, Sprout, Heart, Settings, Activity, FolderTree, Shuffle, BarChart3, ChevronDown, Warehouse, MessageSquare, Shield, FileText, Briefcase, Leaf, Wrench, Car, QrCode, UserCheck, MapPin, DollarSign, Droplets, Award, Building2, Repeat, BookTemplate, CalendarDays, CloudSun, Timer, LayoutGrid, Tag, GitBranch, Stethoscope, Smartphone, Bell, Scale, FlaskConical, Zap, CheckSquare, UserCog, ClipboardList, Clock, GraduationCap, AlertTriangle, Package } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const categoryOrder = ["Navigation", "Livestock Management", "Land Management", "Team", "Operations", "Analytics & Compliance", "System"];

const menuItems = [
  {
    title: "Dashboard",
    url: "/app",
    icon: Home,
    category: "Navigation"
  },
  // Livestock Management
  {
    title: "Animals",
    icon: Users,
    subItems: [
      { title: "All Animals", url: "/app/animals" },
      { title: "Stock Reconciliation", url: "/app/stock-reconciliation" },
      {
        title: "Groups",
        url: "/app/groups",
        icon: Users,
        category: "Livestock Management"
      },
      {
        title: "Smart Groups",
        url: "/app/smart-groups",
        icon: Zap,
        category: "Livestock Management"
      },
    ],
    category: "Livestock Management"
  },
  {
    title: "Treatments",
    url: "/app/treatments/current",
    icon: Syringe,
    category: "Livestock Management"
  },
  {
    title: "Batch Treatment",
    url: "/app/batch-treatment",
    icon: Users,
    category: "Livestock Management"
  },
  {
    title: "Milk Production",
    url: "/app/milk-production",
    icon: Droplets,
    category: "Livestock Management"
  },
  {
    title: "Milk Analytics",
    url: "/app/milk-analytics",
    icon: BarChart3,
    category: "Livestock Management"
  },
  {
    title: "Reproduction",
    url: "/app/reproduction",
    icon: Heart,
    category: "Livestock Management"
  },
  {
    title: "Breeding Management",
    url: "/app/reproduction-management",
    icon: Heart,
    category: "Livestock Management"
  },
  {
    title: "Weight & Growth",
    url: "/app/weight-growth",
    icon: Scale,
    category: "Livestock Management"
  },
  {
    title: "Vaccination",
    url: "/app/vaccination",
    icon: Shield,
    category: "Livestock Management"
  },
  {
    title: "Health Monitoring",
    url: "/app/health-monitoring",
    icon: Heart,
    category: "Livestock Management"
  },
  {
    title: "Veterinary",
    url: "/app/veterinary",
    icon: Stethoscope,
    category: "Livestock Management"
  },
  {
    title: "Lab Results",
    url: "/app/lab-results",
    icon: FlaskConical,
    category: "Livestock Management"
  },
  {
    title: "Health Analytics",
    url: "/app/health-analytics",
    icon: BarChart3,
    category: "Livestock Management"
  },
  {
    title: "Benchmarking",
    url: "/app/benchmarking",
    icon: Award,
    category: "Analytics & Compliance"
  },
  {
    title: "AI Health Predictions",
    url: "/app/health-predictions",
    icon: Activity,
    category: "Analytics & Compliance"
  },
  {
    title: "Field Mode",
    url: "/app/field-mode",
    icon: Smartphone,
    category: "Livestock Management"
  },
  {
    title: "Smart Groups",
    url: "/app/smart-groups",
    icon: Zap,
    category: "Livestock Management"
  },
  {
    title: "Bulk Operations",
    url: "/app/bulk-operations",
    icon: CheckSquare,
    category: "Livestock Management"
  },
  {
    title: "Medicine Inventory",
    url: "/app/medicines",
    icon: Pill,
    category: "Livestock Management"
  },
  {
    title: "Equipment Linking",
    url: "/app/equipment",
    icon: Tag,
    category: "Livestock Management"
  },
  // Land Management
  {
    title: "Pastures",
    url: "/app/pastures",
    icon: Sprout,
    category: "Land Management"
  },
  {
    title: "Pasture Rotation",
    url: "/app/pasture-rotation",
    icon: Shuffle,
    category: "Land Management"
  },
  {
    title: "Pasture Walk",
    url: "/app/pasture-walk",
    icon: Leaf,
    category: "Land Management"
  },
  {
    title: "Map Tasks",
    url: "/app/map-tasks",
    icon: MapPin,
    category: "Land Management"
  },
  // Operations
  {
    title: "Operations Hub",
    url: "/app/operations",
    icon: Wrench,
    category: "Operations"
  },
  {
    title: "Visitor Management",
    url: "/app/operations/visitors",
    icon: UserCheck,
    category: "Operations"
  },
  {
    title: "Vehicle Registry",
    url: "/app/operations/vehicles",
    icon: Car,
    category: "Operations"
  },
  {
    title: "QR Codes",
    url: "/app/operations/qrcodes",
    icon: QrCode,
    category: "Operations"
  },
  {
    title: "Team Management",
    icon: UserCog,
    subItems: [
      { title: "Staff Directory", url: "/app/operations/staff", icon: Users },
      { title: "Timesheets", url: "/app/timesheets", icon: Clock },
      { title: "Roster & Shifts", url: "/app/operations/roster", icon: CalendarDays },
      { title: "Contractors", url: "/app/operations/contractors", icon: Building2 },
    ],
    category: "Operations"
  },
  {
    title: "Health & Safety",
    icon: AlertTriangle,
    subItems: [
      { title: "Dashboard", url: "/app/health-safety", icon: Shield },
      { title: "Incidents", url: "/app/health-safety?tab=incidents", icon: AlertTriangle },
      { title: "Hazards", url: "/app/health-safety?tab=hazards", icon: AlertTriangle },
      { title: "Emergency Plans", url: "/app/health-safety?tab=emergency", icon: FileText },
    ],
    category: "Operations"
  },
  {
    title: "Shed",
    url: "/app/shed",
    icon: Warehouse,
    category: "Operations"
  },
  {
    title: "Job Scheduler",
    icon: Briefcase,
    subItems: [
      { title: "All Jobs", url: "/app/jobs", icon: Briefcase },
      { title: "Recurring Tasks", url: "/app/recurring-tasks", icon: Repeat },
      { title: "Task Templates", url: "/app/task-templates", icon: BookTemplate },
      { title: "Task Calendar", url: "/app/task-calendar", icon: CalendarDays },
      { title: "Kanban Board", url: "/app/kanban", icon: LayoutGrid },
    ],
    category: "Operations"
  },
  {
    title: "Asset Registry",
    url: "/app/asset-registry",
    icon: Package,
    category: "Operations"
  },
  {
    title: "Farm Finance",
    url: "/app/farm-finance",
    icon: DollarSign,
    category: "Operations"
  },
  {
    title: "Weather & Planning",
    url: "/app/weather",
    icon: CloudSun,
    category: "Operations"
  },
    // Analytics & Compliance
  {
    title: "Analytics Dashboard",
    icon: BarChart3,
    subItems: [
      { title: "Overview", url: "/app/analytics" },
      { title: "Medical Analytics", url: "/app/health-analytics" },
      { title: "Pasture Analytics", url: "/app/pasture-analytics" },
      { title: "Reproduction Analytics", url: "/app/reproduction" },
      { title: "Financial Analytics", url: "/app/financial-analytics" },
      { title: "Performance Benchmarks", url: "/app/performance-benchmarking" },
      { title: "Animal Performance", url: "/app/animal-performance" },
      { title: "Milk Analytics", url: "/app/milk-analytics" },
    ],
    category: "Analytics & Compliance"
  },
  {
    title: "Alerts",
    url: "/app/alerts",
    icon: AlertTriangle,
    category: "Analytics & Compliance"
  },
  {
    title: "NZFAP Compliance",
    url: "/app/nzfap-compliance",
    icon: Award,
    category: "Analytics & Compliance"
  },
  {
    title: "H&S Compliance",
    url: "/app/compliance",
    icon: Shield,
    category: "Analytics & Compliance"
  },
  {
    title: "Farm Compliance",
    icon: Leaf,
    subItems: [
      { title: "Overview", url: "/app/farm-compliance" },
      { title: "Effluent Management", url: "/app/environmental-compliance" },
      { title: "Fertilizer Records", url: "/app/environmental-compliance" },
      { title: "Spray Records", url: "/app/farm-compliance" },
      { title: "Biosecurity", url: "/app/farm-compliance" },
      { title: "Environmental", url: "/app/environmental-compliance" },
      { title: "Freshwater Farm Plan", url: "/app/freshwater-farm-plan" },
    ],
    category: "Analytics & Compliance"
  },
  {
    title: "NAIT Records",
    url: "/app/nait",
    icon: FileText,
    category: "Analytics & Compliance"
  },
  {
    title: "Reports & Export",
    url: "/app/reports",
    icon: FileText,
    category: "Analytics & Compliance"
  },
  // System
  {
    title: "Chat",
    url: "/app/chat",
    icon: MessageSquare,
    category: "System"
  },
  {
    title: "Settings",
    url: "/app/settings",
    icon: Settings,
    category: "System"
  },
];

export function AppSidebar({ ...props }: AppSidebarProps) {
  const [location] = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const { state: sidebarState } = useSidebar();
  const { getTotalUnreadCount } = useChatContext();

  const handleMenuClick = () => {
    sidebarState.setOpen(false);
    sidebarState.setOpenMobile(false);
  };

  const toggleSubmenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="border-b border-pulse-700 bg-pulse-950 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-pulse-forest rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="text-pulse-text-primary font-semibold text-lg">Pulse Farm</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {categoryOrder.map((category) => {
          const items = menuItems.filter(item => item.category === category);
          if (items.length === 0) return null;
          
          return (
            <SidebarGroup key={category}>
              <SidebarGroupLabel className="text-pulse-text-muted text-xs font-semibold uppercase tracking-wider px-3 py-2">
                {category}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    if (item.subItems) {
                      return (
                        <Collapsible
                          key={item.title}
                          open={openMenus.includes(item.title)}
                          onOpenChange={() => toggleSubmenu(item.title)}
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                data-testid={`link-sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                                className="hover:bg-pulse-800 data-[active=true]:bg-pulse-accent data-[active=true]:text-white"
                              >
                                <item.icon className="w-5 h-5 text-pulse-text-muted" strokeWidth={1.5} />
                                <span className="text-base font-bold text-black">{item.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform text-pulse-text-muted" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.subItems.map((subItem) => (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton
                                      asChild
                                      isActive={location === subItem.url}
                                      data-testid={`link-sidebar-${subItem.title.toLowerCase().replace(/ /g, '-')}`}
                                      onClick={handleMenuClick}
                                      className="hover:bg-pulse-800 data-[active=true]:bg-pulse-accent data-[active=true]:text-white"
                                    >
                                      <Link href={subItem.url}>
                                        <span className="text-base font-semibold text-black">{subItem.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url || (item.url !== "/app" && location.startsWith(item.url!))}
                          data-testid={`link-sidebar-${item.title.toLowerCase().replace(/ /g, '-')}`}
                          onClick={handleMenuClick}
                          className="hover:bg-pulse-800 data-[active=true]:bg-pulse-accent data-[active=true]:text-white"
                        >
                          <Link href={item.url!}>
                            <item.icon className="w-5 h-5 text-pulse-text-muted" strokeWidth={1.5} />
                            <span className="text-base font-bold text-black">{item.title}</span>
                            {/* Unread badge for Chat menu item */}
                            {item.title === "Chat" && getTotalUnreadCount() > 0 && (
                              <Badge className="bg-pulse-gold text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center ml-auto">
                                {getTotalUnreadCount() > 99 ? '99+' : getTotalUnreadCount()}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-pulse-700 bg-pulse-950 p-4">
        <div className="text-xs text-pulse-text-muted">
          Pulse Farm Management v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
