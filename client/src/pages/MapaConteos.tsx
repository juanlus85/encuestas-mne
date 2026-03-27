import DashboardLayout from "@/components/DashboardLayout";
import { MapView } from "@/components/Map";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, PersonStanding, Thermometer, MapPin } from "lucide-react";
import { useState } from "react";

type ViewMode = "heatmap" | "markers";

const SURVEY_POINTS = [
  "Mateos Gago",
  "Agua",
  "Rodrigo Caro",
  "Pimienta",
  "Mesón del Moro",
];

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-cyan-400" />
        <span>Baja densidad</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <span>Media</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span>Alta densidad</span>
      </div>
      <span className="text-muted-foreground/60">· peso proporcional al nº de personas</span>
    </div>
  );
}

export default function MapaConteos() {
  const [mode, setMode] = useState<ViewMode>("heatmap");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [surveyPoint, setSurveyPoint] = useState("");

  const { data: passes = [], isLoading } = trpc.passes.list.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    surveyPoint: surveyPoint || undefined,
  });

  const validPasses = (passes as any[]).filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const totalPersonas = validPasses.reduce((sum: number, p: any) => sum + (p.count ?? 1), 0);

  const handleMapReady = (map: google.maps.Map) => {
    const center = { lat: 37.3861, lng: -5.9915 };
    map.setCenter(center);
    map.setZoom(17);

    if (mode === "heatmap") {
      // Cada pase tiene peso = count (número de personas)
      const heatmapData = validPasses.map((p: any) =>
        ({
          location: new google.maps.LatLng(Number(p.latitude), Number(p.longitude)),
          weight: Math.max(1, p.count ?? 1),
        })
      );

      new (google.maps as any).visualization.HeatmapLayer({
        data: heatmapData,
        map,
        radius: 30,
        opacity: 0.75,
        gradient: [
          "rgba(0, 255, 255, 0)",
          "rgba(0, 255, 255, 1)",
          "rgba(0, 191, 255, 1)",
          "rgba(0, 127, 255, 1)",
          "rgba(0, 63, 255, 1)",
          "rgba(0, 0, 255, 1)",
          "rgba(0, 0, 223, 1)",
          "rgba(0, 0, 191, 1)",
          "rgba(0, 0, 159, 1)",
          "rgba(0, 0, 127, 1)",
          "rgba(63, 0, 91, 1)",
          "rgba(127, 0, 63, 1)",
          "rgba(191, 0, 31, 1)",
          "rgba(255, 0, 0, 1)",
        ],
      });
    } else {
      // Marcadores con tamaño proporcional al count
      validPasses.forEach((p: any) => {
        const scale = Math.max(6, Math.min(20, 6 + Math.sqrt(p.count ?? 1) * 2));
        const marker = new google.maps.Marker({
          position: { lat: Number(p.latitude), lng: Number(p.longitude) },
          map,
          title: `${p.count} persona(s) · ${p.directionLabel ?? "Sin sentido"} · ${p.surveyPoint}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale,
            fillColor: "#f59e0b",
            fillOpacity: 0.8,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: Inter, sans-serif; padding: 4px; min-width: 180px;">
              <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">${p.count} persona(s)</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Punto: ${p.surveyPoint}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Sentido: ${p.directionLabel ?? "—"}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Encuestador: ${p.encuestadorName ?? "—"}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Fecha: ${new Date(p.recordedAt).toLocaleDateString("es-ES")}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Hora: ${new Date(p.recordedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          `,
        });

        marker.addListener("click", () => infoWindow.open(map, marker));
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Calor · Conteos Peatonales</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {validPasses.length} pases registrados · {totalPersonas.toLocaleString("es-ES")} personas en total
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Mode toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Visualización</label>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setMode("heatmap")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      mode === "heatmap"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Thermometer className="h-4 w-4" />
                    Mapa de calor
                  </button>
                  <button
                    onClick={() => setMode("markers")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      mode === "markers"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <MapPin className="h-4 w-4" />
                    Marcadores
                  </button>
                </div>
              </div>

              {/* Punto filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Punto de conteo</label>
                <select
                  value={surveyPoint}
                  onChange={(e) => setSurveyPoint(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todos los puntos</option>
                  {SURVEY_POINTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Date filters */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {mode === "heatmap" && (
                <div className="ml-auto">
                  <HeatmapLegend />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="h-[520px] md:h-[620px] relative">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : validPasses.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <PersonStanding className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No hay pases con GPS registrados para el período seleccionado.</p>
                <p className="text-xs mt-1">Los conteos con GPS capturado aparecerán aquí.</p>
              </div>
            ) : (
              <MapView
                key={`conteos-${mode}-${dateFrom}-${dateTo}-${surveyPoint}`}
                onMapReady={handleMapReady}
                className="w-full h-full"
              />
            )}
          </div>
        </Card>

        {/* Stats summary */}
        {validPasses.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Pases con GPS", value: validPasses.length, color: "text-green-600" },
              { label: "Total personas", value: totalPersonas.toLocaleString("es-ES"), color: "text-amber-600" },
              {
                label: "Media por pase",
                value: (totalPersonas / validPasses.length).toFixed(1),
                color: "text-primary",
              },
              {
                label: "Puntos activos",
                value: new Set(validPasses.map((p: any) => p.surveyPoint)).size,
                color: "text-blue-600",
              },
            ].map((stat) => (
              <Card key={stat.label} className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
