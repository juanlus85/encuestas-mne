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
  ClipboardList,
  FileDown,
  LayoutDashboard,
  LogOut,
  Map,
  PanelLeft,
  Settings,
  Users,
  PersonStanding,
  Flame,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

// ─── Navigation config ────────────────────────────────────────────────────────

const adminMenuItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/" },
  { icon: BarChart3, label: "Estadísticas", path: "/estadisticas" },
  { icon: Map, label: "Mapa de Campo", path: "/mapa" },
  { icon: Flame, label: "Mapa Conteos", path: "/mapa-conteos" },
  { icon: ClipboardList, label: "Resultados", path: "/resultados" },
  { icon: PersonStanding, label: "Conteos Peatonales", path: "/conteo-resultados" },
  { icon: ArrowUpDown, label: "Sentidos de Conteo", path: "/conteo-sentidos" },
  { icon: FileDown, label: "Exportar", path: "/exportar" },
  { icon: Users, label: "Usuarios", path: "/usuarios" },
  { icon: Settings, label: "Configuración", path: "/configuracion" },
];

const revisorMenuItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/" },
  { icon: BarChart3, label: "Estadísticas", path: "/estadisticas" },
  { icon: Map, label: "Mapa de Campo", path: "/mapa" },
  { icon: Flame, label: "Mapa Conteos", path: "/mapa-conteos" },
  { icon: ClipboardList, label: "Resultados", path: "/resultados" },
  { icon: PersonStanding, label: "Conteos Peatonales", path: "/conteo-resultados" },
  { icon: FileDown, label: "Exportar", path: "/exportar" },
];

const encuestadorMenuItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/" },
  { icon: ClipboardList, label: "Nueva Encuesta", path: "/encuesta" },
  { icon: PersonStanding, label: "Conteo Peatonal", path: "/conteo" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// ─── Version indicator ────────────────────────────────────────────────────────
const APP_VERSION = "v1.0";
const BUILD_DATE = new Date().toLocaleDateString("es-ES", {
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
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const menuItems = user?.role === "revisor" ? revisorMenuItems
    : user?.role === "encuestador" ? encuestadorMenuItems
    : adminMenuItems;
  const activeMenuItem = menuItems.find((item) => item.path === location);

  const roleLabel = user?.role === "admin" ? "Administrador"
    : user?.role === "revisor" ? "Revisor"
    : user?.role === "encuestador" ? "Encuestador"
    : "Usuario";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

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
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
                    <span className="text-sidebar-primary-foreground font-bold text-xs">IA</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">IATUR</p>
                    <p className="text-xs text-sidebar-foreground/50 truncate">Encuestas de Campo</p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 py-2">
            <SidebarGroup>
              {!isCollapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/40 text-xs uppercase tracking-wider px-3 mb-1">
                  Navegación
                </SidebarGroupLabel>
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
                    {user?.name || "Usuario"}
                  </p>
                  <p className="text-xs text-sidebar-foreground/50 truncate mt-0.5">{roleLabel}</p>
                </div>
              )}
            </div>
            {/* Logout button — always visible */}
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Cerrar sesión</span>}
            </button>
            {!isCollapsed && (
              <p className="text-xs text-muted-foreground px-2 pb-1">
                {APP_VERSION} · {BUILD_DATE}
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
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "IATUR Encuestas"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">IA</span>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
