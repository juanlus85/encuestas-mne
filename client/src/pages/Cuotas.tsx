import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Users, MapPin, Globe, Briefcase, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import EncuestadorLayout from "@/components/EncuestadorLayout";

function QuotaBar({
  label,
  current,
  target,
  color = "blue",
}: {
  label: string;
  current: number;
  target: number;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const completed = current >= target;

  const colorMap = {
    blue: { bar: "bg-blue-600", bg: "bg-blue-100", text: "text-blue-700" },
    green: { bar: "bg-green-600", bg: "bg-green-100", text: "text-green-700" },
    amber: { bar: "bg-amber-500", bg: "bg-amber-100", text: "text-amber-700" },
    red: { bar: "bg-red-600", bg: "bg-red-100", text: "text-red-700" },
    purple: { bar: "bg-purple-600", bg: "bg-purple-100", text: "text-purple-700" },
  };

  const c = colorMap[color];

  return (
    <div className={`rounded-xl p-3 ${completed ? "bg-green-50 border border-green-200" : "bg-white border border-gray-100"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {completed ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <div className={`w-3 h-3 rounded-full ${c.bar} shrink-0`} />
          )}
          <span className={`text-sm font-medium ${completed ? "text-green-800" : "text-gray-800"}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-sm font-bold ${completed ? "text-green-700" : c.text}`}>
            {current}/{target}
          </span>
          {completed && (
              <Badge className="bg-green-600 text-white text-xs px-1.5 py-0.5">COMPLETA</Badge>
          )}
        </div>
      </div>
      <div className={`w-full h-2.5 rounded-full ${completed ? "bg-green-200" : c.bg}`}>
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${completed ? "bg-green-500" : c.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{pct}%</span>
        <span className="text-xs text-gray-400">Remaining: {Math.max(0, target - current)}</span>
      </div>
    </div>
  );
}

function QuotaSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function CuotasContent({
  data,
  refetch,
  isFetching,
  surveyTypeFilter,
}: {
  data: any;
  refetch: () => void;
  isFetching: boolean;
  surveyTypeFilter?: "visitantes" | "residentes" | "ambos" | null;
}) {
  const showVisitantes = !surveyTypeFilter || surveyTypeFilter === "ambos" || surveyTypeFilter === "visitantes";
  const showResidentes = !surveyTypeFilter || surveyTypeFilter === "ambos" || surveyTypeFilter === "residentes";

  const v = showVisitantes ? data?.visitantes : null;
  const r = showResidentes ? data?.residentes : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuotas de encuestas</h1>
          <p className="text-gray-500 text-sm mt-1">
            Progreso en tiempo real. Cuando una cuota esté completa, deja de buscar perfiles de ese tipo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
Actualizar
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Importante:</strong> cuando una cuota muestre <Badge className="bg-green-600 text-white text-xs mx-1">COMPLETA</Badge>,
          no busques más personas de ese perfil. Continúa con el siguiente perfil que siga pendiente.
        </div>
      </div>

      {v && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Globe className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Encuesta de visitantes</h2>
              <p className="text-sm text-gray-500">N={v.total.target} encuestas objetivo</p>
            </div>
            <div className="ml-auto">
              <span className={`text-2xl font-bold ${v.total.current >= v.total.target ? "text-green-600" : "text-blue-700"}`}>
                {v.total.current}
              </span>
              <span className="text-gray-400 text-lg">/{v.total.target}</span>
            </div>
          </div>

          <QuotaSection title="Total general" icon={<Users className="h-4 w-4 text-blue-600" />}>
            <QuotaBar label="Total visitantes" current={v.total.current} target={v.total.target} color="blue" />
          </QuotaSection>

          <QuotaSection title="Por género" icon={<Users className="h-4 w-4 text-purple-600" />}>
            <QuotaBar label={v.genero.hombre.label} current={v.genero.hombre.current} target={v.genero.hombre.target} color="blue" />
            <QuotaBar label={v.genero.mujer.label} current={v.genero.mujer.current} target={v.genero.mujer.target} color="purple" />
          </QuotaSection>

          <QuotaSection title="Por procedencia" icon={<Globe className="h-4 w-4 text-green-600" />}>
            <QuotaBar label={v.procedencia.sevilla.label} current={v.procedencia.sevilla.current} target={v.procedencia.sevilla.target} color="green" />
            <QuotaBar label={v.procedencia.nacional.label} current={v.procedencia.nacional.current} target={v.procedencia.nacional.target} color="blue" />
            <QuotaBar label={v.procedencia.extranjero.label} current={v.procedencia.extranjero.current} target={v.procedencia.extranjero.target} color="amber" />
          </QuotaSection>

          <QuotaSection title="Por punto de encuesta" icon={<MapPin className="h-4 w-4 text-red-600" />}>
            {v.puntos.map((p: { key: string; label: string; current: number; target: number }) => (
              <QuotaBar key={p.key} label={p.label} current={p.current} target={p.target} color="red" />
            ))}
          </QuotaSection>
        </div>
      )}

      {r && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Encuesta de residentes</h2>
              <p className="text-sm text-gray-500">N={r.total.target} encuestas objetivo</p>
            </div>
            <div className="ml-auto">
              <span className={`text-2xl font-bold ${r.total.current >= r.total.target ? "text-green-600" : "text-green-700"}`}>
                {r.total.current}
              </span>
              <span className="text-gray-400 text-lg">/{r.total.target}</span>
            </div>
          </div>

          <QuotaSection title="Total general" icon={<Users className="h-4 w-4 text-green-600" />}>
            <QuotaBar label="Total residentes" current={r.total.current} target={r.total.target} color="green" />
          </QuotaSection>

          <QuotaSection title="Por género" icon={<Users className="h-4 w-4 text-purple-600" />}>
            <QuotaBar label={r.genero.hombre.label} current={r.genero.hombre.current} target={r.genero.hombre.target} color="blue" />
            <QuotaBar label={r.genero.mujer.label} current={r.genero.mujer.current} target={r.genero.mujer.target} color="purple" />
          </QuotaSection>

          <QuotaSection title="Por grupo de edad" icon={<Users className="h-4 w-4 text-amber-600" />}>
            <QuotaBar label={r.edad["18_44"].label} current={r.edad["18_44"].current} target={r.edad["18_44"].target} color="blue" />
            <QuotaBar label={r.edad["45_65"].label} current={r.edad["45_65"].current} target={r.edad["45_65"].target} color="amber" />
            <QuotaBar label={r.edad["65_mas"].label} current={r.edad["65_mas"].current} target={r.edad["65_mas"].target} color="red" />
          </QuotaSection>

          <QuotaSection title="Por vínculo laboral con el turismo" icon={<Briefcase className="h-4 w-4 text-blue-600" />}>
            <QuotaBar label={r.vinculo.con_vinculo.label} current={r.vinculo.con_vinculo.current} target={r.vinculo.con_vinculo.target} color="blue" />
            <QuotaBar label={r.vinculo.sin_vinculo.label} current={r.vinculo.sin_vinculo.current} target={r.vinculo.sin_vinculo.target} color="green" />
          </QuotaSection>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        Actualización automática cada 60 segundos · Última actualización: {new Date().toLocaleTimeString("es-ES")}
      </p>
    </div>
  );
}

export default function Cuotas() {
  const { user } = useAuth();
  const isEncuestador = user?.role === "encuestador";

  const { data, isLoading, refetch, isFetching } = trpc.quotas.progress.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isLoading) {
    const spinner = (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando cuotas...</p>
        </div>
      </div>
    );
    if (isEncuestador) {
      return <EncuestadorLayout title="Cuotas">{spinner}</EncuestadorLayout>;
    }
    return <DashboardLayout><div className="p-6">{spinner}</div></DashboardLayout>;
  }

  const surveyTypeFilter = isEncuestador
    ? ((user as any)?.surveyTypeAssigned ?? "ambos")
    : null;

  if (isEncuestador) {
    return (
      <EncuestadorLayout title="Cuotas">
        <CuotasContent data={data} refetch={refetch} isFetching={isFetching} surveyTypeFilter={surveyTypeFilter} />
      </EncuestadorLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <CuotasContent data={data} refetch={refetch} isFetching={isFetching} />
      </div>
    </DashboardLayout>
  );
}
