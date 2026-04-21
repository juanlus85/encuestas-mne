import { Calendar, Clock, Home as HomeIcon, PieChart } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Home", icon: HomeIcon, path: "/" },
  { label: "Quotas", icon: PieChart, path: "/cuotas" },
  { label: "Schedules", icon: Calendar, path: "/mis-horarios" },
  { label: "Shift Close", icon: Clock, path: "/cierre-turno" },
];

interface EncuestadorLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function EncuestadorLayout({ children, title }: EncuestadorLayoutProps) {
  const [currentPath, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Compact header */}
      {title && (
        <div className="bg-primary text-primary-foreground px-4 py-4 md:px-8">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              aria-label="Back to home"
            >
              <HomeIcon className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg">
        <div className="flex items-stretch h-16 max-w-2xl mx-auto relative">
          {navItems.map(({ label, icon: Icon, path }) => {
            const isActive = currentPath === path;
            return (
              <button
                key={path}
                onClick={() => setLocation(path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-primary" : ""}`}>{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
