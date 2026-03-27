import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MapPin,
  PersonStanding,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// ─── Encuestador Home ─────────────────────────────────────────────────────────

function EncuestadorHome() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: myResponses } = trpc.responses.myList.useQuery();
  const { data: templates } = trpc.templates.active.useQuery();

  // GPS para rechazos
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const addRejection = trpc.rejections.add.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Rechazo ${vars.surveyType === "residentes" ? "residente" : "visitante"} registrado`, { duration: 1500 });
    },
    onError: (err) => toast.error("Error al registrar rechazo: " + err.message),
  });

  const handleRejection = (surveyType: "residentes" | "visitantes", surveyPoint?: string) => {
    addRejection.mutate({
      surveyType,
      surveyPoint,
      latitude: gps?.lat,
      longitude: gps?.lng,
      gpsAccuracy: gps?.acc,
      rejectedAt: new Date(),
    });
  };

  const todayStr = new Date().toDateString();
  const todayCount = myResponses?.filter(
    (r) => new Date(r.startedAt).toDateString() === todayStr
  ).length ?? 0;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-6 md:px-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-primary-foreground/70 text-sm font-medium uppercase tracking-wider mb-1">
            IATUR · Trabajo de Campo
          </p>
          <h1 className="text-2xl font-bold">{greeting}, {user?.name?.split(" ")[0]}</h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-primary-foreground/70 text-sm">
              {user?.identifier && <span className="font-mono bg-primary-foreground/10 px-2 py-0.5 rounded mr-2">{user.identifier}</span>}
              Barrio de Santa Cruz · Sevilla
            </p>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-primary-foreground/60 hover:text-primary-foreground text-xs transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 md:px-8 space-y-6">
        {/* Today stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{todayCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Encuestas hoy</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{myResponses?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Total realizadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Conteo Peatonal */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Conteo Peatonal</h2>
          <button
            onClick={() => setLocation("/conteo")}
            className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <PersonStanding className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Conteo Peatonal</p>
                <p className="text-sm text-muted-foreground">Registrar pases de personas por sentido</p>
              </div>
            </div>
          </button>
        </div>

        {/* Active surveys */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">Encuestas Activas</h2>
          <div className="space-y-3">
            {templates?.map((t) => (
              <div key={t.id} className="flex items-stretch gap-2">
                {/* Botón principal de encuesta */}
                <button
                  onClick={() => setLocation(`/encuesta/${t.id}`)}
                  className="flex-1 text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.type === "residentes"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {t.type === "residentes" ? "Residentes" : "Visitantes"}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground">{t.name}</p>
                      {t.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </button>
                {/* Botón de rechazo rápido */}
                <button
                  onClick={() => handleRejection(t.type as "residentes" | "visitantes")}
                  disabled={addRejection.isPending}
                  title={`Registrar rechazo ${t.type === "residentes" ? "residente" : "visitante"}`}
                  className={`shrink-0 flex flex-col items-center justify-center gap-1 px-3 rounded-xl border-2 transition-all active:scale-95 ${
                    t.type === "residentes"
                      ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400"
                      : "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100 hover:border-orange-400"
                  }`}
                >
                  <XCircle className="h-5 w-5" />
                  <span className="text-[10px] font-semibold leading-tight text-center">
                    Rechazo<br />{t.type === "residentes" ? "resid." : "visit."}
                  </span>
                </button>
              </div>
            ))}
            {(!templates || templates.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay encuestas activas en este momento.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent */}
        {myResponses && myResponses.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Últimas Encuestas</h2>
            <div className="space-y-2">
              {myResponses.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Encuesta #{r.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.startedAt).toLocaleString("es-ES", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <span className={`badge-${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer version */}
        <div className="text-center pt-4 pb-2">
          <p className="text-xs text-muted-foreground">
            IATUR Encuestas · Universidad de Sevilla · Versión v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Admin / Revisor Home ─────────────────────────────────────────────────────

function AdminHome() {
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: encuestadores } = trpc.users.encuestadores.useQuery();

  const TARGET_RESIDENTES = 300;
  const TARGET_VISITANTES = 450;
  const TARGET_TOTAL = 750;

  const residentes = Number(stats?.residentes ?? 0);
  const visitantes = Number(stats?.visitantes ?? 0);
  const total = Number(stats?.total ?? 0);

  const pctResidentes = Math.min(100, Math.round((residentes / TARGET_RESIDENTES) * 100));
  const pctVisitantes = Math.min(100, Math.round((visitantes / TARGET_VISITANTES) * 100));
  const pctTotal = Math.min(100, Math.round((total / TARGET_TOTAL) * 100));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Control</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Estudio de Movilidad Turística · Barrio de Santa Cruz, Sevilla
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Encuestas</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{total}</p>
                  <p className="text-xs text-muted-foreground mt-1">de {TARGET_TOTAL} objetivo</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctTotal}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pctTotal}% completado</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Residentes</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{residentes}</p>
                  <p className="text-xs text-muted-foreground mt-1">de {TARGET_RESIDENTES} objetivo</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pctResidentes}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pctResidentes}% completado</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visitantes</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{visitantes}</p>
                  <p className="text-xs text-muted-foreground mt-1">de {TARGET_VISITANTES} objetivo</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pctVisitantes}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pctVisitantes}% completado</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Encuestadores</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{encuestadores?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">activos en campo</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setLocation("/estadisticas")}
            className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Estadísticas</p>
            <p className="text-sm text-muted-foreground mt-1">Gráficos y análisis del trabajo de campo</p>
          </button>

          <button
            onClick={() => setLocation("/mapa")}
            className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3 group-hover:bg-amber-100 transition-colors">
              <MapPin className="h-5 w-5 text-amber-600" />
            </div>
            <p className="font-semibold text-foreground">Mapa de Campo</p>
            <p className="text-sm text-muted-foreground mt-1">Ubicaciones GPS y mapa de calor</p>
          </button>

          <button
            onClick={() => setLocation("/resultados")}
            className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
              <ClipboardList className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-foreground">Resultados</p>
            <p className="text-sm text-muted-foreground mt-1">Listado completo de encuestas</p>
          </button>
        </div>

        {/* Footer version */}
        <div className="text-right pt-2">
          <p className="text-xs text-muted-foreground">
            IATUR Encuestas · Versión v1.0 · {new Date().toLocaleDateString("es-ES")}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Root router ──────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    window.location.replace("/login");
    return null;
  }

  if (user.role === "encuestador") return <EncuestadorHome />;
  return <AdminHome />;
}
