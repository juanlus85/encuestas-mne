import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import EncuestadorLayout from "@/components/EncuestadorLayout";

// ─── Componente de estrella de valoración ─────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none"
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Historial de cierres ─────────────────────────────────────────────────────

function HistorialCierres() {
  const { data: cierres, isLoading } = trpc.shiftClosures.getMine.useQuery();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return <div className="text-sm text-gray-400 text-center py-4">Loading history...</div>;
  if (!cierres?.length) return <div className="text-sm text-gray-400 text-center py-4">There are no recorded closures yet.</div>;

  const shown = expanded ? cierres : cierres.slice(0, 3);

  return (
    <div className="space-y-3">
      {shown.map((c) => {
        const dt = new Date(c.closedAt);
        return (
          <div key={c.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  {dt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Closure: {dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {c.surveyPoint && ` · ${c.surveyPoint}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.valoracion && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-3 w-3 ${s <= c.valoracion! ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center bg-white rounded-lg py-2 border border-gray-100">
                <p className="text-lg font-bold text-blue-700">{c.totalEncuestas}</p>
                <p className="text-xs text-gray-500">Surveys</p>
              </div>
              <div className="text-center bg-white rounded-lg py-2 border border-gray-100">
                <p className="text-lg font-bold text-green-700">{c.totalConteos ?? 0}</p>
                <p className="text-xs text-gray-500">Counts</p>
              </div>
              <div className="text-center bg-white rounded-lg py-2 border border-gray-100">
                <p className="text-lg font-bold text-red-600">{c.totalRechazos ?? 0}</p>
                <p className="text-xs text-gray-500">Rejections</p>
              </div>
            </div>
            {c.incidencias && (
              <div className="mt-3 bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 mb-1">Incidents:</p>
                <p className="text-xs text-amber-800">{c.incidencias}</p>
              </div>
            )}
          </div>
        );
      })}
      {cierres.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-sm text-blue-600 font-medium flex items-center justify-center gap-1 py-2"
        >
          {expanded ? <><ChevronUp className="h-4 w-4" /> Show less</> : <><ChevronDown className="h-4 w-4" /> View the previous {cierres.length - 3}</>}
        </button>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CierreTurno() {
  const utils = trpc.useUtils();

  // Resumen automático del día desde la BD
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.shiftClosures.todaySummary.useQuery();

  // Turno asignado hoy
  const { data: myShifts } = trpc.shifts.getMine.useQuery();

  const closeMutation = trpc.shiftClosures.close.useMutation({
    onSuccess: () => {
      toast.success("Shift closed successfully. Good job!");
      utils.shiftClosures.getMine.invalidate();
      utils.shiftClosures.todaySummary.invalidate();
      setSubmitted(true);
    },
    onError: (e) => toast.error(`Error closing shift: ${e.message}`),
  });

  // Estado del formulario
  const [incidencias, setIncidencias] = useState("");
  const [valoracion, setValoracion] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Turno de hoy
  const today = new Date().toISOString().split("T")[0];
  const todayShift = (myShifts ?? []).find((s) => s.shiftDate === today);

  const handleClose = () => {
    closeMutation.mutate({
      shiftId: todayShift?.id,
      totalEncuestas: summary?.totalEncuestas ?? 0,
      totalConteos: summary?.totalConteos ?? 0,
      totalRechazos: summary?.totalRechazos ?? 0,
      surveyPoint: todayShift?.surveyPoint || undefined,
      surveyType: todayShift?.surveyType as "visitantes" | "residentes" | "conteo" | undefined,
      incidencias: incidencias || undefined,
      valoracion: valoracion || undefined,
    });
  };

  return (
    <EncuestadorLayout>
      <div className="p-4 max-w-2xl mx-auto space-y-5 pb-24">
        {/* Cabecera */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Closure</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Turno asignado hoy */}
        {todayShift && (
          <Card className="border-blue-100 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-800 text-sm">Assigned shift today</p>
                  <p className="text-blue-600 text-sm">
                    {todayShift.startTime} – {todayShift.endTime}
                    {todayShift.surveyPoint && ` · ${todayShift.surveyPoint}`}
                    {todayShift.surveyType && ` · ${todayShift.surveyType}`}
                  </p>
                  {todayShift.notes && (
                    <p className="text-blue-500 text-xs mt-1">{todayShift.notes}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumen automático del día */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Today's summary
              <button
                type="button"
                onClick={() => refetchSummary()}
                className="ml-auto text-gray-400 hover:text-blue-600 transition-colors"
                title="Refresh summary"
              >
                <RefreshCw className={`h-4 w-4 ${summaryLoading ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-blue-50 rounded-xl py-4 border border-blue-100">
                    <p className="text-3xl font-bold text-blue-700">{summary?.totalEncuestas ?? 0}</p>
                    <p className="text-xs text-blue-600 font-medium mt-1">Surveys</p>
                  </div>
                  <div className="text-center bg-green-50 rounded-xl py-4 border border-green-100">
                    <p className="text-3xl font-bold text-green-700">{summary?.totalConteos ?? 0}</p>
                    <p className="text-xs text-green-600 font-medium mt-1">Counts</p>
                  </div>
                  <div className="text-center bg-red-50 rounded-xl py-4 border border-red-100">
                    <p className="text-3xl font-bold text-red-600">{summary?.totalRechazos ?? 0}</p>
                    <p className="text-xs text-red-600 font-medium mt-1">Rejections</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Datos calculados automáticamente desde la base de datos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Formulario de cierre */}
        {!submitted ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Registrar cierre de turno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Incidencias */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
                  Incidents, problems, or comments
                </label>
                <textarea
                  value={incidencias}
                  onChange={(e) => setIncidencias(e.target.value)}
                  rows={4}
                  placeholder="Describe cualquier incidencia, problema técnico, situación especial, o comentario sobre el turno..."
                  className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Valoración */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-3">
                  <Star className="h-4 w-4 inline mr-1 text-amber-400" />
                  Shift rating
                </label>
                <StarRating value={valoracion} onChange={setValoracion} />
                {valoracion > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {["", "Muy difícil", "Difícil", "Normal", "Bueno", "Excelente"][valoracion]}
                  </p>
                )}
              </div>

              {/* Botón de cierre */}
              <Button
                onClick={handleClose}
                disabled={closeMutation.isPending}
                className="w-full h-12 text-base font-semibold bg-blue-700 hover:bg-blue-800"
              >
                {closeMutation.isPending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Cerrar turno
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-green-800">Turno cerrado correctamente</h3>
              <p className="text-green-600 text-sm mt-1">¡Gracias por tu trabajo hoy!</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSubmitted(false)}
              >
                Registrar otro cierre
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Historial */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              Historial de cierres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistorialCierres />
          </CardContent>
        </Card>
      </div>
    </EncuestadorLayout>
  );
}
