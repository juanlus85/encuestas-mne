import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ArrowUpDown,
  BarChart3,
  Calendar,
  ClipboardList,
  FileDown,
  LayoutDashboard,
  LogOut,
  Map,
  PanelLeft,
  Settings,
  Users,
  FolderKanban,
  PersonStanding,
  Flame,
  Target,
  DoorOpen,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { OfflineIndicator } from "./OfflineIndicator";

// ─── Navigation config ────────────────────────────────────────────────────────

const supervisorMenuItems = [
  { icon: FolderKanban, label: "Studies", path: "/studies" },
  { icon: Users, label: "Users", path: "/usuarios" },
  { icon: Settings, label: "Settings", path: "/configuracion" },
];

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: BarChart3, label: "Statistics", path: "/estadisticas" },
  { icon: Map, label: "Field Map", path: "/mapa" },
  { icon: Flame, label: "Counting Map", path: "/mapa-conteos" },
  { icon: ClipboardList, label: "Results", path: "/resultados" },
  { icon: PersonStanding, label: "Pedestrian Counts", path: "/conteo-resultados" },
  { icon: ArrowUpDown, label: "Counting Directions", path: "/conteo-sentidos" },
  { icon: Target, label: "Quotas", path: "/cuotas" },
  { icon: FileDown, label: "Export", path: "/exportar" },
  { icon: Users, label: "Users", path: "/usuarios" },
  { icon: Settings, label: "Settings", path: "/configuracion" },
];

const revisorMenuItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: BarChart3, label: "Statistics", path: "/estadisticas" },
  { icon: Map, label: "Field Map", path: "/mapa" },
  { icon: Flame, label: "Counting Map", path: "/mapa-conteos" },
  { icon: ClipboardList, label: "Results", path: "/resultados" },
  { icon: PersonStanding, label: "Pedestrian Counts", path: "/conteo-resultados" },
  { icon: Target, label: "Quotas", path: "/cuotas" },
  { icon: FileDown, label: "Export", path: "/exportar" },
];

const encuestadorMenuItems = [
  { icon: LayoutDashboard, label: "Home", path: "/" },
  { icon: ClipboardList, label: "New Survey", path: "/encuesta" },
  { icon: PersonStanding, label: "Pedestrian Counting", path: "/conteo" },
  { icon: Target, label: "Quotas", path: "/cuotas" },
  { icon: Calendar, label: "My Schedules", path: "/mis-horarios" },
  { icon: DoorOpen, label: "Shift Close", path: "/cierre-turno" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// ─── Version indicator ────────────────────────────────────────────────────────
const APP_VERSION = "v1.0";
const BUILD_DATE = new Date().toLocaleDateString("en-GB", {
  day: "2-digit", month: "2-digit", year: "numeric"
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    // Redirect to dedicated login page
    window.location.replace("/login");
    return null;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      {user?.role === "encuestador" && <OfflineIndicator />}
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ─── Inner layout ─────────────────────────────────────────────────────────────

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const studiesQuery = trpc.studies.list.useQuery(undefined, { enabled: Boolean(user) });
  const setActiveStudyMutation = trpc.studies.setActive.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.studies.current.invalidate();
      await studiesQuery.refetch();
    },
  });
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const menuItems = user?.platformRole === "supervisor" ? supervisorMenuItems
    : user?.role === "revisor" ? revisorMenuItems
    : user?.role === "encuestador" ? encuestadorMenuItems
    : adminMenuItems;
  const activeMenuItem = menuItems.find((item) => item.path === location);

  const roleLabel = user?.platformRole === "supervisor" ? "Supervisor"
    : user?.role === "admin" ? "Administrator"
    : user?.role === "revisor" ? "Reviewer"
    : user?.role === "encuestador" ? "Interviewer"
    : "User";
  const availableStudies = studiesQuery.data ?? [];
  const hasActiveStudy = Boolean(user?.activeStudyId);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    if (!user) return;
    if (studiesQuery.isLoading) return;
    if (hasActiveStudy) return;
    if (location === "/studies") return;
    if (availableStudies.length === 0 && user.platformRole !== "supervisor") return;
    setLocation("/studies");
  }, [availableStudies.length, hasActiveStudy, location, setLocation, studiesQuery.isLoading, user]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 h-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center min-w-0 overflow-hidden">
                  <img
                    src="/survexia-logo.png"
                    alt="Survexia logo"
                    className="h-10 w-auto max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 py-2">
            <SidebarGroup>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/40 text-xs uppercase tracking-wider px-3 mb-1">
                  Navigation
                </SidebarGroupLabel>
              )}
              {!isCollapsed && availableStudies.length > 0 && (
                <div className="px-3 mb-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40">Active study</p>
                    {!hasActiveStudy && (
                      <button
                        type="button"
                        onClick={() => setLocation("/studies")}
                        className="text-[10px] uppercase tracking-[0.16em] text-sidebar-primary"
                      >
                        Select
                      </button>
                    )}
                  </div>
                  <select
                    className="flex h-9 w-full rounded-md border border-sidebar-border bg-sidebar px-2 text-sm text-sidebar-foreground"
                    value={user?.activeStudyId ?? ""}
                    onChange={(e) => setActiveStudyMutation.mutate({ studyId: Number(e.target.value) })}
                    disabled={setActiveStudyMutation.isPending}
                  >
                    {!hasActiveStudy && <option value="">Select a study</option>}
                    {availableStudies.map((study: any) => (
                      <option key={study.id} value={study.id}>
                        {study.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <SidebarMenu className="px-2 gap-0.5">
                {menuItems.map((item) => {
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-9 font-normal"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border space-y-1">
            {/* User info row */}
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar className="h-8 w-8 shrink-0 border border-sidebar-border">
                <AvatarFallback className="text-xs font-semibold bg-sidebar-primary text-sidebar-primary-foreground">
                  {user?.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50 truncate mt-0.5">{roleLabel}</p>
                  {user?.activeStudy?.name ? (
                    <p className="text-[11px] text-sidebar-foreground/40 truncate mt-0.5">{user.activeStudy.name}</p>
                  ) : availableStudies.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setLocation("/studies")}
                      className="text-[11px] text-sidebar-primary truncate mt-0.5 text-left"
                    >
                      Select an active study
                    </button>
                  ) : (
                    <p className="text-[11px] text-sidebar-foreground/40 truncate mt-0.5">No study assigned yet</p>
                  )}
                </div>
              )}
            </div>
            {/* Logout button — always visible */}
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
            {!isCollapsed && (
              <p className="text-xs text-muted-foreground px-2 pb-1">
                Survexia · {APP_VERSION} · {BUILD_DATE}
              </p>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "Survexia"}</span>
            </div>
            <div className="flex items-center">
              <img
                src="/survexia-logo.png"
                alt="Survexia logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 space-y-4">
          {!hasActiveStudy && availableStudies.length > 0 && location !== "/studies" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              Please select an active study before continuing. All templates, responses, counts and exports now work inside the currently selected study.
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
