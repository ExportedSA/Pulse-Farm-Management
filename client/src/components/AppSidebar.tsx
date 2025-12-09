import { Home, Syringe, Pill, Users, Sprout, Heart, Settings, BarChart3, ChevronDown, MessageSquare, Shield, FileText, Briefcase, Wrench, Scale, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, ComponentProps } from "react";
import { useChatContext } from "@/contexts/ChatContext";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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

type AppSidebarProps = ComponentProps<typeof Sidebar>;
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Simplified menu structure - Minda-inspired flat navigation
// Key principle: Most used items at top, minimal nesting, logical grouping
const menuItems = [
  // Primary navigation - always visible
  { title: "Dashboard", url: "/app", icon: Home },
  
  // Animals - core functionality
  {
    title: "Animals",
    icon: Users,
    subItems: [
      { title: "All Animals", url: "/app/animals" },
      { title: "Groups", url: "/app/groups" },
      { title: "Import CSV", url: "/app/import" },
    ],
  },
  
  // Health & Treatments - consolidated (batch treatment now inside treatments)
  {
    title: "Health",
    icon: Syringe,
    subItems: [
      { title: "Treatments", url: "/app/treatments/current" },
      { title: "Vaccination", url: "/app/vaccination" },
      { title: "Medicines", url: "/app/medicines" },
    ],
  },
  
  // Reproduction - simplified
  {
    title: "Reproduction",
    icon: Heart,
    subItems: [
      { title: "Events", url: "/app/reproduction" },
      { title: "Milk Production", url: "/app/milk-production" },
    ],
  },
  
  // Weights
  { title: "Weights", url: "/app/weight-growth", icon: Scale },
  
  // Pastures - simplified
  {
    title: "Pastures",
    icon: Sprout,
    subItems: [
      { title: "All Pastures", url: "/app/pastures" },
      { title: "Pasture Walk", url: "/app/pasture-walk" },
      { title: "Rotation", url: "/app/pasture-rotation" },
    ],
  },
  
  // Operations - consolidated
  {
    title: "Operations",
    icon: Wrench,
    subItems: [
      { title: "Hub", url: "/app/operations" },
      { title: "Jobs", url: "/app/jobs" },
      { title: "Calendar", url: "/app/task-calendar" },
      { title: "Staff", url: "/app/operations/staff" },
    ],
  },
  
  // Compliance - consolidated
  {
    title: "Compliance",
    icon: Shield,
    subItems: [
      { title: "NAIT", url: "/app/nait" },
      { title: "NZFAP", url: "/app/nzfap-compliance" },
      { title: "Farm Compliance", url: "/app/farm-compliance" },
    ],
  },
  
  // Reports
  {
    title: "Reports",
    icon: BarChart3,
    subItems: [
      { title: "Analytics", url: "/app/analytics" },
      { title: "Export", url: "/app/reports" },
    ],
  },
  
  // System
  { title: "Chat", url: "/app/chat", icon: MessageSquare },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar({ ...props }: AppSidebarProps) {
  const [location] = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const { setOpen, setOpenMobile } = useSidebar();
  const { getTotalUnreadCount } = useChatContext();

  const handleMenuClick = () => {
    setOpen(false);
    setOpenMobile(false);
  };

  const toggleSubmenu = (title: string) => {
    setOpenMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  // Divvi-inspired colors
  const colors = {
    bg: '#faf8f5',
    bgHover: '#f0ebe4',
    text: '#1a3a2f',
    textMuted: '#636e72',
    border: '#e8e4de',
    active: '#1a3a2f',
  };

  return (
    <Sidebar data-testid="sidebar-main" style={{ backgroundColor: colors.bg }}>
      <SidebarHeader className="p-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.active }}>
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="font-semibold text-lg" style={{ color: colors.text }}>Pulse</span>
        </div>
      </SidebarHeader>
      <SidebarContent style={{ backgroundColor: colors.bg }}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
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
                            className="hover:bg-[#f0ebe4]"
                          >
                            <item.icon className="w-5 h-5" style={{ color: colors.textMuted }} strokeWidth={1.5} />
                            <span className="text-sm font-medium" style={{ color: colors.text }}>{item.title}</span>
                            <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${openMenus.includes(item.title) ? 'rotate-90' : ''}`} style={{ color: colors.textMuted }} />
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
                                  className="hover:bg-[#f0ebe4] data-[active=true]:bg-[#1a3a2f] data-[active=true]:text-white"
                                >
                                  <Link href={subItem.url}>
                                    <span className="text-sm" style={{ color: colors.textMuted }}>{subItem.title}</span>
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
                      className="hover:bg-[#f0ebe4] data-[active=true]:bg-[#1a3a2f] data-[active=true]:text-white"
                    >
                      <Link href={item.url!}>
                        <item.icon className="w-5 h-5" style={{ color: colors.textMuted }} strokeWidth={1.5} />
                        <span className="text-sm font-medium" style={{ color: colors.text }}>{item.title}</span>
                        {item.title === "Chat" && getTotalUnreadCount() > 0 && (
                          <Badge className="text-xs px-1.5 py-0.5 min-w-[20px] text-center ml-auto" style={{ backgroundColor: '#c9a227', color: '#fff' }}>
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
      </SidebarContent>
      <SidebarFooter className="p-4" style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.bg }}>
        <div className="text-xs" style={{ color: colors.textMuted }}>
          Pulse v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
