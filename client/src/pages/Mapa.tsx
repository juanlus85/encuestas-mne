import DashboardLayout from "@/components/DashboardLayout";
import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, MapPin, Radio, RefreshCw, Thermometer, UserCheck } from "lucide-react";
import { useState } from "react";

type ViewMode = "markers" | "heatmap" | "live";

// ─── Legend ───────────────────────────────────────────────────────────────────
function MapLegend({ mode }: { mode: ViewMode }) {
  if (mode === "heatmap") {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
      </div>
    );
  }
  if (mode === "live") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Automatic refresh every 30 s</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-blue-600" />
        <span>Resident</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full bg-amber-500" />
        <span>Visitor</span>
      </div>
    </div>
  );
}

// ─── Live Locations Panel ──────────────────────────────────────────────────────
function LiveLocationsPanel() {
  const { data: liveData = [], isLoading, refetch, isFetching } = trpc.dashboard.latestLocations.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  const formatTime = (ts: any) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-500" />
            Real-time location
          </CardTitle>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Latest GPS position recorded for each interviewer</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!isLoading && liveData.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">There are no GPS locations recorded yet.</p>
            <p className="text-xs mt-1">They will appear here when interviewers start surveys with GPS enabled.</p>
          </div>
        )}
        <div className="space-y-2">
          {(liveData as any[]).map((loc) => {
            const lastSeenDate = new Date(loc.lastSeen);
            const diffMins = Math.floor((Date.now() - lastSeenDate.getTime()) / 60000);
            const isRecent = diffMins < 30;
            return (
              <div
                key={loc.encuestadorId}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isRecent ? "bg-green-500" : "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">
                      {loc.encuestadorName ?? `Interviewer #${loc.encuestadorId}`}
                    </p>
                    {loc.encuestadorIdentifier && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {loc.encuestadorIdentifier}
                      </span>
                    )}
                    {isRecent && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 py-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground">{formatTime(loc.lastSeen)}</p>
                    {loc.surveyPoint && (
                      <p className="text-xs text-muted-foreground">· {loc.surveyPoint}</p>
                    )}
                    {loc.latitude && loc.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      >
                        <MapPin className="h-3 w-3" />
                        View on Maps
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Live Map ─────────────────────────────────────────────────────────────────
function LiveMapView() {
  const { data: liveData = [], isLoading } = trpc.dashboard.latestLocations.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  const validLive = (liveData as any[]).filter((l) => l.latitude != null && l.longitude != null);

  const handleMapReady = (map: google.maps.Map) => {
    const center = { lat: 37.3861, lng: -5.9915 };
    map.setCenter(center);
    map.setZoom(16);

    validLive.forEach((loc) => {
      const diffMins = Math.floor((Date.now() - new Date(loc.lastSeen).getTime()) / 60000);
      const isRecent = diffMins < 30;
      const marker = new google.maps.Marker({
        position: { lat: Number(loc.latitude), lng: Number(loc.longitude) },
        map,
        title: loc.encuestadorName ?? `Encuestador #${loc.encuestadorId}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: isRecent ? "#22c55e" : "#9ca3af",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        },
      });

      const diffText = diffMins < 1 ? "Just now" : diffMins < 60 ? `${diffMins} min ago` : new Date(loc.lastSeen).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: Inter, sans-serif; padding: 4px; min-width: 180px;">
            <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">${loc.encuestadorName ?? "Interviewer"}</p>
            ${loc.encuestadorIdentifier ? `<p style="margin: 0; font-size: 12px; color: #666;">ID: ${loc.encuestadorIdentifier}</p>` : ""}
            <p style="margin: 2px 0; font-size: 12px; color: #666;">Last signal: ${diffText}</p>
            ${loc.surveyPoint ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">Point: ${loc.surveyPoint}</p>` : ""}
            ${loc.gpsAccuracy ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">Accuracy: ±${Math.round(Number(loc.gpsAccuracy))} m</p>` : ""}
          </div>
        `,
      });

      marker.addListener("click", () => infoWindow.open(map, marker));
    });
  };

  if (isLoading) {
    return (
      <div className="h-[480px] flex items-center justify-center bg-muted/30 rounded-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (validLive.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center text-muted-foreground rounded-xl border border-dashed border-border">
        <MapPin className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">There are no interviewers with recorded GPS data.</p>
      </div>
    );
  }

  return (
    <MapView
      key={`live-${validLive.map((l: any) => l.encuestadorId).join("-")}`}
      onMapReady={handleMapReady}
      className="w-full h-[480px]"
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Mapa() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>("markers");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: locations = [], isLoading } = trpc.dashboard.gpsLocations.useQuery({
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo + "T23:59:59") : undefined,
  });

  const validLocations = (locations as any[]).filter(
    (l) => l.latitude != null && l.longitude != null
  );

  const handleMapReady = (map: google.maps.Map) => {
    const center = { lat: 37.3861, lng: -5.9915 };
    map.setCenter(center);
    map.setZoom(16);

    if (mode === "markers") {
      validLocations.forEach((loc) => {
        const isResidente = loc.templateType === "residentes";
        const marker = new google.maps.Marker({
          position: { lat: Number(loc.latitude), lng: Number(loc.longitude) },
          map,
          title: `#${loc.id} - ${loc.encuestadorName ?? "Interviewer"} (${new Date(loc.startedAt).toLocaleDateString("en-GB")})`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: isResidente ? "#1e4d8c" : "#d97706",
            fillOpacity: 0.85,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="font-family: Inter, sans-serif; padding: 4px; min-width: 180px;">
              <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">Survey #${loc.id}</p>
              <p style="margin: 0; font-size: 12px; color: #666;">Interviewer: ${loc.encuestadorName ?? "—"}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Type: ${isResidente ? "Resident" : "Visitor"}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Date: ${new Date(loc.startedAt).toLocaleDateString("en-GB")}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">Time: ${new Date(loc.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              ${loc.surveyPoint ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">Point: ${loc.surveyPoint}</p>` : ""}
            </div>
          `,
        });
        marker.addListener("click", () => infoWindow.open(map, marker));
      });
    } else if (mode === "heatmap") {
      const heatmapData = validLocations.map((loc) =>
        new google.maps.LatLng(Number(loc.latitude), Number(loc.longitude))
      );
      new (google.maps as any).visualization.HeatmapLayer({
        data: heatmapData,
        map,
        radius: 25,
        opacity: 0.75,
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
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Field Map</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Geographic view of surveys and interviewer locations
          </p>
        </div>

        {/* Mode toggle */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">View</label>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setMode("markers")}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${mode === "markers" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
                  >
                    <MapPin className="h-4 w-4" />
                    Markers
                  </button>
                  <button
                    onClick={() => setMode("heatmap")}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${mode === "heatmap" ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}
                  >
                    <Thermometer className="h-4 w-4" />
                    Heatmap
                  </button>
                  <button
                    onClick={() => setMode("live")}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${mode === "live" ? "bg-green-600 text-white" : "bg-background text-foreground hover:bg-muted"}`}
                  >
                    <Radio className="h-4 w-4" />
                    Live
                  </button>
                </div>
              </div>

              {mode !== "live" && (
                <>
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
                </>
              )}

              <div className="ml-auto">
                <MapLegend mode={mode} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live mode */}
        {mode === "live" && (
          <>
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-[480px] relative">
                <LiveMapView />
              </div>
            </Card>
            <LiveLocationsPanel />
          </>
        )}

        {/* Historical modes */}
        {mode !== "live" && (
          <>
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="h-[520px] md:h-[620px] relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : validLocations.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">There are no GPS locations recorded for the selected period.</p>
                    <p className="text-xs mt-1">Surveys with captured GPS data will appear here.</p>
                  </div>
                ) : (
                  <MapView
                    key={`${mode}-${dateFrom}-${dateTo}`}
                    onMapReady={handleMapReady}
                    className="w-full h-full"
                  />
                )}
              </div>
            </Card>

            {validLocations.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "With GPS", value: validLocations.length, color: "text-green-600" },
                  { label: "Residentes", value: validLocations.filter((l: any) => l.templateType === "residentes").length, color: "text-blue-600" },
                  { label: "Visitantes", value: validLocations.filter((l: any) => l.templateType !== "residentes").length, color: "text-amber-600" },
                  { label: "Encuestadores", value: new Set(validLocations.map((l: any) => l.encuestadorId)).size, color: "text-primary" },
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
