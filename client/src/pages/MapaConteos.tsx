import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_MAP_CENTER, resolveConfiguredMapCenter } from "@/lib/mapFocus";
import { trpc } from "@/lib/trpc";
import { Loader2, PersonStanding, Thermometer, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "heatmap" | "markers";

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

// Carga el script de Google Maps con la librería visualization incluida
let mapScriptPromise: Promise<void> | null = null;
function loadMapScript(): Promise<void> {
  if (mapScriptPromise) return mapScriptPromise;
  // Si ya está cargado, resolver inmediatamente
  if (typeof window !== "undefined" && (window as any).google?.maps?.visualization) {
    return Promise.resolve();
  }
  mapScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry,visualization`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      mapScriptPromise = null;
      reject(new Error("Could not load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return mapScriptPromise;
}

function HeatmapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span>Low density</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <span>Medium</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span>High density</span>
      </div>
      <span className="text-muted-foreground/60">· weight proportional to the number of people</span>
    </div>
  );
}

export default function MapaConteos() {
  const [mode, setMode] = useState<ViewMode>("heatmap");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [surveyPoint, setSurveyPoint] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data: appSettings } = trpc.appSettings.get.useQuery();
  const { data: countingPoints = [] } = trpc.countingPoints.list.useQuery();

  const { data: passes = [], isLoading } = trpc.passes.list.useQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    surveyPoint: surveyPoint || undefined,
  });

  const validPasses = (passes as any[]).filter(
    (p) => p.latitude != null && p.longitude != null
  );

  const defaultCenter = useMemo(
    () => resolveConfiguredMapCenter(validPasses, appSettings?.mapPrimaryPointCode, DEFAULT_MAP_CENTER),
    [validPasses, appSettings?.mapPrimaryPointCode],
  );

  const totalPersonas = validPasses.reduce((sum: number, p: any) => sum + (Number(p.count) ?? 1), 0);

  // Inicializar el mapa y dibujar los datos cuando tengamos tanto el mapa como los datos
  useEffect(() => {
    if (isLoading) return;
    if (validPasses.length === 0) return;
    if (!mapContainerRef.current) return;

    let cancelled = false;

    loadMapScript()
      .then(() => {
        if (cancelled || !mapContainerRef.current) return;

        // Crear o reutilizar el mapa
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
            zoom: 17,
            center: defaultCenter,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true,
            streetViewControl: false,
            mapId: "DEMO_MAP_ID",
          });
        } else {
          // Limpiar capas anteriores recreando el mapa en el mismo contenedor
          mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
            zoom: 17,
            center: defaultCenter,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true,
            streetViewControl: false,
            mapId: "DEMO_MAP_ID",
          });
        }

        const map = mapInstanceRef.current;

        if (mode === "heatmap") {
          const heatmapData = validPasses.map((p: any) => ({
            location: new window.google.maps.LatLng(Number(p.latitude), Number(p.longitude)),
            weight: Math.max(1, Number(p.count) ?? 1),
          }));

          new (window.google.maps as any).visualization.HeatmapLayer({
            data: heatmapData,
            map,
            radius: 35,
            opacity: 0.8,
            gradient: [
              "rgba(0, 255, 0, 0)",
              "rgba(0, 255, 0, 1)",
              "rgba(64, 220, 0, 1)",
              "rgba(128, 200, 0, 1)",
              "rgba(180, 180, 0, 1)",
              "rgba(220, 160, 0, 1)",
              "rgba(255, 140, 0, 1)",
              "rgba(255, 100, 0, 1)",
              "rgba(255, 60, 0, 1)",
              "rgba(255, 0, 0, 1)",
            ],
          });
        } else {
          // Markers con tamaño proporcional al count
          validPasses.forEach((p: any) => {
            const scale = Math.max(8, Math.min(24, 8 + Math.sqrt(Number(p.count) ?? 1) * 2));
            const marker = new window.google.maps.Marker({
              position: { lat: Number(p.latitude), lng: Number(p.longitude) },
              map,
              title: `${p.count} people · ${p.directionLabel ?? "No direction"}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale,
                fillColor: "#f59e0b",
                fillOpacity: 0.85,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="font-family: Inter, sans-serif; padding: 4px; min-width: 180px;">
                  <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">${p.count} people</p>
                  <p style="margin: 0; font-size: 12px; color: #666;">Point: ${p.surveyPoint}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #666;">Direction: ${p.directionLabel ?? "—"}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #666;">Interviewer: ${p.encuestadorName ?? "—"}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #666;">Date: ${new Date(p.recordedAt).toLocaleDateString("en-GB")}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #666;">Time: ${new Date(p.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              `,
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setMapError("Could not load the map. Please check the connection.");
        console.error(err);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, validPasses.length, mode, dateFrom, dateTo, surveyPoint, defaultCenter]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Heat Map · Pedestrian Counts</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isLoading ? "Loading..." : `${validPasses.length} GPS passes · ${totalPersonas.toLocaleString("en-GB")} people`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Mode toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">View</label>
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
                    Heat map
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
                    Markers
                  </button>
                </div>
              </div>

              {/* Punto filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Counting point</label>
                <select
                  value={surveyPoint}
                  onChange={(e) => setSurveyPoint(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">All points</option>
                  {countingPoints.map((point) => (
                    <option key={point.code} value={point.fullName}>{point.fullName}</option>
                  ))}
                </select>

              </div>

              {/* Date filters */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
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
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {!isLoading && validPasses.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-10">
                <PersonStanding className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">There are no GPS passes for the selected period.</p>
                <p className="text-xs mt-1">Counts with captured GPS will appear here.</p>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center text-destructive z-10">
                <p className="text-sm">{mapError}</p>
              </div>
            )}
            {/* El div del mapa siempre está montado para que el ref funcione */}
            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={{ display: (!isLoading && validPasses.length > 0 && !mapError) ? "block" : "none" }}
            />
          </div>
        </Card>

        {/* Stats summary */}
        {!isLoading && validPasses.length > 0 && (
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
                label: "Active points",
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
