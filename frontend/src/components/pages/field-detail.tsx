import { ChevronRight, Download, Maximize2, MoreHorizontal, Plus as PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import FieldMap from "@/components/FieldMap";
import { api } from "@/lib/api";

type RecommendationItem = {
  zone: number;
  mad: number;
  depletion: number;
  triggered: boolean;
  recommended_amount: number;
  colour: string;
};

type RecommendationResponse = {
  message: string;
  recommendations: RecommendationItem[];
};

type SatellitePoint = {
  acquisition_date: string;
  ndvi: number;
  rvi: number;
};

type ZoneRecord = {
  zone_id: number;
  cluster: number;
  area_m2: number;
  geometry?: unknown;
  satellite_data?: SatellitePoint[];
  latest_satellite?: SatellitePoint | null;
  latest_weather?: {
    observation_time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    rain: number;
    surface_pressure: number;
    soil_moisture_1_to_3cm: number;
    soil_temperature_6cm: number;
  } | null;
  latest_recommendation?: {
    recommendation_id: number;
    recommendation_time: string;
    irrigation_required: boolean;
    recommended_amount: number;
    zone_color?: string;
  } | null;
};

type FieldRecord = {
  id: number;
  name: string;
  planting_date?: string | null;
  area_ha: string | number;
  geometry?: unknown;
  crop_type?: { name: string } | null;
  soil_type?: { name: string; texture?: string } | null;
  zones?: ZoneRecord[];
  created_at?: string;
  updated_at?: string;
};

export function FieldDetail() {
  const [field, setField] = useState<FieldRecord | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [zoneColors, setZoneColors] = useState<Map<number, string>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async (fieldId: number) => {
    try {
      const response = await api.get<RecommendationResponse>(`/recommendation/${fieldId}/`);
      const colorMap = new Map<number, string>();
      for (const item of response.data.recommendations) {
        colorMap.set(item.zone, item.colour);
      }
      setZoneColors(colorMap);

      const refreshed = await api.get<FieldRecord>(`/fields/${fieldId}/`);
      setField(refreshed.data);
      setSelectedZoneId((current) => {
        const zoneIds = refreshed.data.zones?.map((zone) => zone.zone_id) ?? [];
        if (current != null && zoneIds.includes(current)) return current;
        return zoneIds[0] ?? null;
      });
    } catch {
      setZoneColors(new Map());
    }
  }, []);

  const loadField = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const fieldIdParam = new URLSearchParams(window.location.search).get("fieldId");
      let fieldId: number | null = fieldIdParam ? Number(fieldIdParam) : null;
      let fieldData: FieldRecord | null = null;

      if (fieldId != null && Number.isFinite(fieldId)) {
        const response = await api.get<FieldRecord>(`/fields/${fieldId}/`);
        fieldData = response.data;
      } else {
        const response = await api.get<FieldRecord[]>("/fields/");
        fieldData = response.data[0] ?? null;
        fieldId = fieldData?.id ?? null;
      }

      setField(fieldData);
      setSelectedZoneId(fieldData?.zones?.[0]?.zone_id ?? null);

      if (fieldId != null) {
        await loadRecommendations(fieldId);
      } else {
        setZoneColors(new Map());
      }
    } catch {
      setError("Unable to load field details from the backend.");
      setField(null);
      setSelectedZoneId(null);
      setZoneColors(new Map());
    } finally {
      setLoading(false);
    }
  }, [loadRecommendations]);

  useEffect(() => {
    loadField();
  }, [loadField]);

  const zones = useMemo(() => field?.zones ?? [], [field]);
  const activeZone = useMemo(
    () => zones.find((zone) => zone.zone_id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  const mapFeatures = useMemo(() => {
    const features: Array<{ type: "Feature"; geometry: unknown; properties: Record<string, unknown> }> = [];

    if (field?.geometry) {
      features.push({
        type: "Feature",
        geometry: field.geometry,
        properties: { color: "#94a3b8", fillOpacity: 0.06 },
      });
    }

    if (activeZone?.geometry) {
      const color =
        zoneColors.get(activeZone.cluster) ??
        activeZone.latest_recommendation?.zone_color ??
        "#4ade80";

      features.push({
        type: "Feature",
        geometry: activeZone.geometry,
        properties: { color, fillOpacity: 0.35 },
      });
    }

    // Show all zones with a color based on NDVI/RVI (healthy=green, near-stress=yellow, stress=red).
    // If a recommendation-based color exists, prefer it.
    const ndviToColor = (ndvi?: number) => {
      if (ndvi === undefined) return "#60a5fa";
      if (ndvi >= 0.55) return "#22c55e"; // healthy
      if (ndvi >= 0.35) return "#facc15"; // almost stressed
      return "#ef4444"; // stress
    };

    const rviToColor = (rvi?: number) => {
      if (rvi === undefined) return "#60a5fa";
      const scaled = rvi / 4; // rvi is 0..4 in backend logic
      if (scaled >= 0.55) return "#22c55e";
      if (scaled >= 0.35) return "#facc15";
      return "#ef4444";
    };

    for (const z of zones) {
      if (!z.geometry) continue;

      const recColor = zoneColors.get(z.cluster) ?? z.latest_recommendation?.zone_color;
      const ndvi = z.latest_satellite?.ndvi;
      const rvi = z.latest_satellite?.rvi;

      const baseColor = ndviToColor(ndvi);
      const altColor = rviToColor(rvi);

      const color = recColor ?? (baseColor ?? altColor);

      features.push({
        type: "Feature",
        geometry: z.geometry,
        properties: {
          color,
          fillOpacity: 0.35,
        },
      });
    }

    return features;
  }, [field, activeZone, zoneColors]);

  const handleZoneSelect = (zoneId: number) => {
    if (selectedZoneId === zoneId) return;
    setSelectedZoneId(zoneId);
  };
  const latestWeather = zones.map((zone) => zone.latest_weather).find(Boolean);
  const recommendations = zones
    .map((zone) => ({ zone, recommendation: zone.latest_recommendation }))
    .filter((item) => item.recommendation);

  const satelliteSeries = useMemo(
    () =>
      zones
        .flatMap((zone) =>
          (zone.satellite_data ?? []).map((point) => ({
            ...point,
            zone: zone.cluster,
          })),
        )
        .sort((a, b) => new Date(a.acquisition_date).getTime() - new Date(b.acquisition_date).getTime()),
    [zones],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 md:gap-4 h-full min-h-0">
      <div className="flex flex-col gap-3 md:gap-4 min-h-0 overflow-auto">
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card flex-1 min-h-[280px]">
          <FieldMap className="absolute inset-0" features={mapFeatures} showControls={false} />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/90 backdrop-blur text-xs">
              NDVI <ChevronRight className="h-3 w-3 rotate-90" />
            </div>
            <IconBtn><Download className="h-4 w-4" /></IconBtn>
            <IconBtn><Maximize2 className="h-4 w-4" /></IconBtn>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 flex gap-4 overflow-hidden">
          <div className="w-40 shrink-0 flex flex-col gap-3">
            <div className="flex gap-1 p-1 rounded-lg bg-secondary">
              <button className="flex-1 px-2 py-1.5 rounded-md bg-card text-xs">Field</button>
            </div>
            <Field label="Index" value={latestNdvi(zones)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Planted" value={formatDate(field?.planting_date)} small />
              <Field label="Updated" value={formatDate(field?.updated_at)} small />
            </div>
          </div>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <NdviChartBlock series={satelliteSeries} />
          </div>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-border bg-card p-4 flex flex-col gap-4 min-h-0 overflow-auto">
        <div className="flex items-center justify-center">
          <h2 className="text-base font-semibold text-primary">
            {loading ? "Loading field..." : field?.name ?? "No field selected"}
          </h2>
        </div>

        {error && <p className="rounded-lg border border-destructive/40 p-2 text-xs text-destructive">{error}</p>}

        {!loading && !field ? (
          <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
            Create a field from the Fields page to see database-backed details here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Info label="Field Area" value={`${formatArea(field?.area_ha)} ha`} />
              <Info label="Crop" value={field?.crop_type?.name ?? "-"} />
              <Info label="Soil" value={field?.soil_type?.name ?? "-"} />
            </div>

            <Collapsible>
              {zones.length ? (
                <div className="grid grid-cols-3 gap-3">
                  {zones.map((zone) => (
                    <ZoneInfo
                      key={zone.zone_id}
                      zone={zone}
                      selected={zone.zone_id === selectedZoneId}
                      color={
                        zoneColors.get(zone.cluster) ??
                        zone.latest_recommendation?.zone_color ??
                        "#4ade80"
                      }
                      onSelect={handleZoneSelect}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No zones generated yet.</p>
              )}
            </Collapsible>

            <Collapsible>
              <div className="grid grid-cols-2 gap-3">
                <Info label="Created" value={formatDate(field?.created_at)} />
                <Info label="Updated" value={formatDate(field?.updated_at)} />
              </div>
            </Collapsible>

            <Collapsible>
              <div>
                <p className="text-[11px] text-muted-foreground">Weather Now</p>
                {latestWeather ? (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Info label="Temperature" value={`${latestWeather.temperature_2m.toFixed(1)}°`} />
                    <Info label="Rain" value={`${latestWeather.rain.toFixed(2)} mm`} />
                    <Info label="Humidity" value={`${latestWeather.relative_humidity_2m.toFixed(0)}%`} />
                    <Info label="Soil temp" value={`${latestWeather.soil_temperature_6cm.toFixed(1)}°`} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No weather records yet.</p>
                )}
              </div>
            </Collapsible>

            <div className="rounded-xl border border-border p-3 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <button className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <PlusIcon className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-medium flex-1">Recommendations</h3>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {recommendations.length ? (
                  recommendations.map(({ zone, recommendation }) => (
                    <TaskRow
                      key={recommendation!.recommendation_id}
                      title={`Zone ${zone.cluster}`}
                      desc={recommendation!.irrigation_required ? "Irrigation required" : "No irrigation required"}
                      date={formatDate(recommendation!.recommendation_time)}
                      amount={recommendation!.recommended_amount}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recommendations yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NdviChartBlock({ series }: { series: Array<SatellitePoint & { zone: number }> }) {
  if (!series.length) {
    return (
      <div className="flex h-[260px] min-w-[600px] items-center justify-center rounded-xl border border-border text-sm text-muted-foreground">
        No satellite history yet.
      </div>
    );
  }

  const w = 900;
  const h = 260;
  const padL = 48;
  const padR = 24;
  const padT = 56;
  const padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const points = series.slice(-25);

  const toX = (index: number) => padL + (index / Math.max(points.length - 1, 1)) * chartW;
  const toY = (value: number) => padT + chartH - Math.max(0, Math.min(value, 1)) * chartH;
  const linePath = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"} ${toX(index).toFixed(1)},${toY(value).toFixed(1)}`).join(" ");

  const ndviValues = points.map((point) => point.ndvi);
  const rviValues = points.map((point) => point.rvi / 4);
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, arr) => arr.indexOf(value) === index);

  return (
    <div className="min-w-[600px]">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ minWidth: 600 }}>
        <text x={padL} y={22} fontSize="11" fill="oklch(0.65 0.04 150)">Historical</text>
        <text x={padL} y={44} fontSize="22" fill="oklch(0.95 0.01 150)" fontWeight="300">NDVI / RVI</text>

        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={padL + chartW} y1={y} y2={y} stroke="oklch(0.30 0.04 150)" strokeWidth="0.5" />
              <text x={padL - 8} y={y + 4} fontSize="10" fill="oklch(0.55 0.04 150)" textAnchor="end">{tick.toFixed(2)}</text>
            </g>
          );
        })}

        <path d={linePath(ndviValues)} fill="none" stroke="oklch(0.70 0.16 145)" strokeWidth="2" />
        <path d={linePath(rviValues)} fill="none" stroke="oklch(0.65 0.12 250)" strokeWidth="2" />

        {points.map((point, index) => (
          <circle key={`${point.acquisition_date}-${index}`} cx={toX(index)} cy={toY(point.ndvi)} r="3" fill="oklch(0.70 0.16 145)" />
        ))}

        {labels.map((index) => (
          <text key={index} x={toX(index)} y={h - 8} fontSize="10" fill="oklch(0.55 0.04 150)" textAnchor="middle">
            {formatDate(points[index].acquisition_date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="p-2 rounded-lg border border-border bg-card/90 backdrop-blur text-muted-foreground hover:text-foreground">
      {children}
    </button>
  );
}

function Field({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={"rounded-lg border border-border px-3 py-2 " + (small ? "text-[11px]" : "text-xs")}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-foreground text-sm">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function ZoneInfo({
  zone,
  selected,
  color,
  onSelect,
}: {
  zone: ZoneRecord;
  selected: boolean;
  color: string;
  onSelect: (zoneId: number) => void;
}) {
  const satellite = zone.latest_satellite;

  return (
    <button
      type="button"
      onClick={() => onSelect(zone.zone_id)}
      className={
        "rounded-lg border p-2 text-left transition-colors " +
        (selected
          ? "border-primary/60 bg-primary/10"
          : "border-transparent hover:border-border hover:bg-secondary/40")
      }
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-[11px] text-muted-foreground">Zone {zone.cluster}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-foreground">NDVI {formatMetric(satellite?.ndvi)}</p>
        <p className="text-sm text-foreground">RVI {formatMetric(satellite?.rvi)}</p>
      </div>
    </button>
  );
}

function Collapsible({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
      <div className="flex-1">{children}</div>
      <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
    </div>
  );
}

function TaskRow({ title, desc, date, amount }: { title: string; desc: string; date: string; amount: number }) {
  return (
    <div className="rounded-lg border border-border p-2.5 flex gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-muted-foreground">{date} · {amount.toFixed(2)} mm</p>
          <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function latestNdvi(zones: ZoneRecord[]) {
  const ndvi = zones.map((zone) => zone.latest_satellite?.ndvi).find((value) => value !== undefined);
  return ndvi === undefined ? "NDVI -" : `NDVI · ${ndvi.toFixed(2)}`;
}

function formatMetric(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

function formatArea(area?: string | number) {
  const value = Number(area);
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
