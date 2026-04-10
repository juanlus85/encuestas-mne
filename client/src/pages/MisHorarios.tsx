import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Calendar, Clock, MapPin, ClipboardList, AlertCircle, CheckCircle2 } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}

function isPast(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr < today;
}

const SURVEY_TYPE_LABELS: Record<string, string> = {
  visitantes: "Encuesta Visitantes",
  residentes: "Encuesta Residentes",
  conteo: "Conteo Peatonal",
};

const SURVEY_TYPE_COLORS: Record<string, string> = {
  visitantes: "bg-blue-100 text-blue-700 border-blue-200",
  residentes: "bg-green-100 text-green-700 border-green-200",
  conteo: "bg-orange-100 text-orange-700 border-orange-200",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MisHorarios() {
  const { data: shifts, isLoading } = trpc.shifts.getMine.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Cargando horarios...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const sortedShifts = [...(shifts ?? [])].sort((a, b) =>
    (a.shiftDate + a.startTime).localeCompare(b.shiftDate + b.startTime)
  );

  const upcoming = sortedShifts.filter((s) => !isPast(s.shiftDate) || isToday(s.shiftDate));
  const past = sortedShifts.filter((s) => isPast(s.shiftDate) && !isToday(s.shiftDate));

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Mis Horarios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Turnos asignados por el coordinador de campo.
          </p>
        </div>

        {/* Sin turnos */}
        {sortedShifts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No tienes turnos asignados</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              El coordinador te asignará turnos próximamente.
            </p>
          </div>
        )}

        {/* Próximos turnos */}
        {upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Próximos turnos
            </h2>
            {upcoming.map((shift) => {
              const today = isToday(shift.shiftDate);
              return (
                <div
                  key={shift.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    today
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Date + today badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {fmtDate(shift.shiftDate)}
                      </span>
                    </div>
                    {today && (
                      <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {shift.startTime} – {shift.endTime}
                    </span>
                  </div>

                  {/* Survey point */}
                  {shift.surveyPoint && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{shift.surveyPoint}</span>
                    </div>
                  )}

                  {/* Survey type */}
                  {shift.surveyType && (
                    <div className="flex items-center gap-2 text-sm">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          SURVEY_TYPE_COLORS[shift.surveyType] ?? "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {SURVEY_TYPE_LABELS[shift.surveyType] ?? shift.surveyType}
                      </span>
                    </div>
                  )}

                  {/* Notes */}
                  {shift.notes && (
                    <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground italic">
                      {shift.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Turnos pasados */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Turnos anteriores
            </h2>
            {past.map((shift) => (
              <div
                key={shift.id}
                className="rounded-xl border border-border bg-card/50 p-4 space-y-2 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-foreground text-sm">
                      {fmtDate(shift.shiftDate)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {shift.startTime} – {shift.endTime}
                  </span>
                </div>
                {shift.surveyPoint && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{shift.surveyPoint}</span>
                  </div>
                )}
                {shift.surveyType && (
                  <span className="text-xs text-muted-foreground">
                    {SURVEY_TYPE_LABELS[shift.surveyType] ?? shift.surveyType}
                  </span>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
