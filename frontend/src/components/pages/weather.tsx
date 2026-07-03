import { MoreHorizontal, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import FieldMap from "@/components/FieldMap";
import { api } from "@/lib/api";

type WeatherRecord = {
  weather_id: number;
  observation_time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  rain: number;
  surface_pressure: number;
  et0_fao_evapotranspiration: number;
  wind_speed_10m: number;
  soil_moisture_1_to_3cm: number;
  soil_temperature_6cm: number;
};

type FieldZone = {
  zone_id: number;
  cluster: number;
  area_m2: number;
  geometry?: unknown;
};

type FieldRecord = {
  id: number;
  name: string;
  area_ha: string | number;
  geometry?: unknown;
  crop_type?: { name: string } | null;
  zones?: FieldZone[];
};

type WeatherDownloadResponse = {
  message: string;
  field_id: number;
  zone_id?: number;
  zones: {
    zone_id: number;
    cluster: number;
    weather: WeatherRecord[];
  }[];
};

type HourlyRow = {
  h: string;
  cond: string;
  t: string;
  mm: string;
  ws: string;
  p: string;
  hum: string;
  soil: string;
  et0: string;
  bar: number;
  line: number;
};

export function WeatherPage() {
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [selectedField, setSelectedField] = useState<FieldRecord | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [weatherRecords, setWeatherRecords] = useState<WeatherRecord[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingFieldDetail, setLoadingFieldDetail] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState("");

  const fieldZones = selectedField?.zones ?? [];
  const activeZone = useMemo(
    () => fieldZones.find((zone) => zone.zone_id === selectedZoneId) ?? fieldZones[0] ?? null,
    [fieldZones, selectedZoneId],
  );
  const latestWeather = weatherRecords.length ? weatherRecords[weatherRecords.length - 1] : null;

  const loadWeather = useCallback(async (fieldId: number, zoneId: number) => {
    setLoadingWeather(true);
    setError("");

    try {
      const response = await api.get<WeatherDownloadResponse>(`/download-weather/${fieldId}/`, {
        params: { zone_id: zoneId },
      });
      const zoneWeather = response.data.zones.find((zone) => zone.zone_id === zoneId);
      setWeatherRecords(zoneWeather?.weather ?? []);
    } catch {
      setError("Unable to load hourly forecast for this zone.");
      setWeatherRecords([]);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  const loadFieldDetail = useCallback(async (fieldId: number) => {
    setLoadingFieldDetail(true);
    setError("");

    try {
      const response = await api.get<FieldRecord>(`/fields/${fieldId}/`);
      const field = response.data;
      setSelectedField(field);

      const firstZoneId = field.zones?.[0]?.zone_id ?? null;
      setSelectedZoneId(firstZoneId);

      if (firstZoneId != null) {
        await loadWeather(fieldId, firstZoneId);
      } else {
        setWeatherRecords([]);
      }
    } catch {
      setError("Unable to load field zones.");
      setSelectedField(null);
      setSelectedZoneId(null);
      setWeatherRecords([]);
    } finally {
      setLoadingFieldDetail(false);
    }
  }, [loadWeather]);

  useEffect(() => {
    let ignore = false;

    const loadFields = async () => {
      setLoadingFields(true);
      setError("");

      try {
        const response = await api.get<FieldRecord[]>("/fields/");
        if (ignore) return;

        setFields(response.data);
        const firstId = response.data[0]?.id ?? null;
        if (firstId != null) {
          await loadFieldDetail(firstId);
        }
      } catch {
        if (!ignore) setError("Unable to load fields from the backend.");
      } finally {
        if (!ignore) setLoadingFields(false);
      }
    };

    loadFields();

    return () => {
      ignore = true;
    };
  }, [loadFieldDetail]);

  const handleFieldSelect = (fieldId: number) => {
    if (selectedField?.id === fieldId) return;
    setWeatherRecords([]);
    loadFieldDetail(fieldId);
  };

  const handleZoneSelect = (zoneId: number) => {
    if (selectedZoneId === zoneId || selectedField?.id == null) return;
    setSelectedZoneId(zoneId);
    loadWeather(selectedField.id, zoneId);
  };

  const handleRefresh = () => {
    if (selectedField?.id == null || selectedZoneId == null) return;
    loadWeather(selectedField.id, selectedZoneId);
  };

  const hourlyRows = useMemo(() => buildHourlyRows(weatherRecords), [weatherRecords]);
  const mapFeatures = useMemo(() => {
    if (activeZone?.geometry) return [activeZone.geometry];
    if (selectedField?.geometry) return [selectedField.geometry];
    return [];
  }, [activeZone, selectedField]);

  return (
    <div className="flex flex-col gap-3 md:gap-4 h-full min-h-0 overflow-hidden scrollbar-hide">
      <div className="flex gap-3 md:gap-4 flex-1 min-h-0">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 w-64 shrink-0 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Weather Now</p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingWeather || selectedField?.id == null || selectedZoneId == null}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Refresh weather"
            >
              <RefreshCw className={"h-3.5 w-3.5 " + (loadingWeather ? "animate-spin" : "")} />
            </button>
          </div>

          {loadingFieldDetail || (loadingWeather && !latestWeather) ? (
            <p className="text-sm text-muted-foreground">Loading weather...</p>
          ) : latestWeather && activeZone ? (
            <>
              <p className="text-2xl font-medium">{describeCondition(latestWeather.rain)}</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl text-primary">{formatTemp(latestWeather.temperature_2m)}</span>
                <span className="text-4xl">{weatherEmoji(latestWeather.rain)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Air temperature</span>
                  <span className="text-foreground">{formatTemp(latestWeather.temperature_2m)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temp at 6cm depth</span>
                  <span className="text-foreground">{formatTemp(latestWeather.soil_temperature_6cm)}</span>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Precipitation</p>
                <p className="text-xs text-foreground">
                  {latestWeather.rain > 0
                    ? `${latestWeather.rain.toFixed(2)} mm at ${formatHour(latestWeather.observation_time)}`
                    : "No precipitation at latest observation"}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {weatherRecords.length} observation{weatherRecords.length === 1 ? "" : "s"} · Zone {activeZone.cluster}
              </p>
            </>
          ) : fieldZones.length ? (
            <p className="text-sm text-muted-foreground">Select a zone to load its forecast.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No zones available for this field.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 w-[360px] shrink-0 min-h-0 overflow-hidden">
          <h2 className="text-center text-base font-semibold text-primary">Field List</h2>
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-2 pr-1">
            {loadingFields ? (
              <p className="text-sm text-muted-foreground">Loading fields...</p>
            ) : fields.length ? (
              fields.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => handleFieldSelect(field.id)}
                  className={
                    "rounded-xl border p-3 flex items-center gap-3 text-left w-full " +
                    (field.id === selectedField?.id ? "border-primary/60 bg-primary/5" : "border-border")
                  }
                >
                  <div className="h-12 w-14 rounded-md overflow-hidden relative" style={{ background: "oklch(0.3 0.05 145)" }}>
                    <div className="h-full w-full bg-[oklch(0.55_0.15_145)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm truncate">{field.name}, {formatArea(field.area_ha)} ha</p>
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-xs">🌽 {field.crop_type?.name ?? "Crop"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">Field #{field.id}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Create a field to view weather data.</p>
            )}
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-border bg-card flex-1 min-w-0">
          <FieldMap className="absolute inset-0" features={mapFeatures} />

          <div className="absolute left-3 top-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 bg-card/90 backdrop-blur">
              <input
                placeholder="Field…"
                value={selectedField?.name ?? ""}
                readOnly
                className="bg-transparent outline-none flex-1 text-sm"
              />
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex gap-3 md:gap-4 h-[500px] shrink-0 min-h-0">
        <HourlyForecast
          rows={hourlyRows}
          loading={loadingWeather || loadingFieldDetail}
          fieldName={selectedField?.name}
          zones={fieldZones}
          selectedZoneId={activeZone?.zone_id ?? null}
          onZoneSelect={handleZoneSelect}
        />
      </div>
    </div>
  );
}

function HourlyForecast({
  rows,
  loading,
  fieldName,
  zones,
  selectedZoneId,
  onZoneSelect,
}: {
  rows: HourlyRow[];
  loading: boolean;
  fieldName?: string;
  zones: FieldZone[];
  selectedZoneId: number | null;
  onZoneSelect: (zoneId: number) => void;
}) {
  const activeZone = zones.find((zone) => zone.zone_id === selectedZoneId);

  return (
    <div className="rounded-2xl border border-border bg-card flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Hourly</p>
          <h2 className="text-2xl font-light">Forecast</h2>
          {fieldName && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {fieldName}
              {activeZone ? ` · Zone ${activeZone.cluster}` : ""}
            </p>
          )}
        </div>
        {zones.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end shrink-0">
            {zones.map((zone) => (
              <button
                key={zone.zone_id}
                type="button"
                onClick={() => onZoneSelect(zone.zone_id)}
                disabled={loading && zone.zone_id === selectedZoneId}
                className={
                  "rounded-md border px-2.5 py-1 text-xs transition-colors " +
                  (zone.zone_id === selectedZoneId
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary/60")
                }
              >
                Zone {zone.cluster}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scrollbar-hide">
        {!zones.length && !loading ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No zones available for this field.</p>
        ) : loading && !rows.length ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Loading hourly forecast for selected zone...</p>
        ) : rows.length ? (
          <ForecastTable rows={rows} />
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">No hourly weather observations available.</p>
        )}
      </div>
    </div>
  );
}

function ForecastTable({ rows }: { rows: HourlyRow[] }) {
  const colW = 78;
  const chartH = 110;
  const w = rows.length * colW;
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartTop, setChartTop] = useState(72);
  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeRow = activeIndex != null ? rows[activeIndex] : null;

  useLayoutEffect(() => {
    if (chartRef.current) {
      setChartTop(chartRef.current.offsetTop);
    }
  }, [rows.length]);

  useEffect(() => {
    setHoveredIndex(null);
    setSelectedIndex(null);
  }, [rows]);

  const points = rows.map((d, i) => ({ x: i * colW + colW / 2, y: chartH - d.line * (chartH - 10) - 4 }));
  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `Q ${prev.x},${prev.y} ${cx},${(prev.y + p.y) / 2} T ${p.x},${p.y}`;
    })
    .join(" ");

  useEffect(() => {
    if (selectedIndex == null) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-forecast-column]")) {
        setSelectedIndex(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedIndex]);

  const tooltipLeft =
    activeIndex != null
      ? activeIndex >= rows.length - 2
        ? activeIndex * colW - 168
        : (activeIndex + 1) * colW + 6
      : 0;
  const tooltipTop = chartTop + 8;

  return (
    <div style={{ width: w }} className="relative text-xs">
      {activeIndex != null && (
        <div
          className="absolute inset-y-0 z-10 bg-[oklch(0.55_0.2_310_/_0.18)] pointer-events-none transition-opacity"
          style={{ left: activeIndex * colW, width: colW }}
        />
      )}

      {activeRow != null && activeIndex != null && (
        <ForecastColumnTooltip row={activeRow} left={tooltipLeft} top={tooltipTop} caretOnRight={activeIndex >= rows.length - 2} />
      )}

      <div className="absolute inset-0 z-20 flex touch-pan-x">
        {rows.map((row, i) => (
          <button
            key={row.h}
            type="button"
            data-forecast-column
            className="shrink-0 h-full touch-pan-x bg-transparent cursor-pointer border-0 p-0"
            style={{ width: colW }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex((prev) => (prev === i ? null : i))}
            aria-label={`Forecast details for ${row.h}`}
          />
        ))}
      </div>

      <Row>
        {rows.map((d) => (
          <Cell key={d.h} className="text-foreground font-medium">{d.h}</Cell>
        ))}
      </Row>
      <Row>
        {rows.map((d, i) => (
          <Cell key={i} className="text-muted-foreground leading-tight whitespace-normal">{d.cond}</Cell>
        ))}
      </Row>
      <Row>
        {rows.map((d, i) => (
          <Cell key={i} className="text-primary">{d.t}</Cell>
        ))}
      </Row>
      <div ref={chartRef} className="relative border-b border-border/40" style={{ height: chartH }}>
        <svg width={w} height={chartH} className="absolute inset-0">
          {rows.map((_, i) => (
            <line
              key={i}
              x1={i * colW + colW / 2}
              x2={i * colW + colW / 2}
              y1={0}
              y2={chartH}
              stroke="oklch(0.3 0.02 240 / 0.5)"
              strokeWidth="1"
            />
          ))}
          {rows.map((d, i) => {
            if (!d.bar) return null;
            const h = d.bar * (chartH - 12);
            const x = i * colW + colW / 2 - 16;
            return (
              <rect
                key={i}
                x={x}
                y={chartH - h - 2}
                width="32"
                height={h}
                fill="none"
                stroke="oklch(0.7 0.18 245)"
                strokeWidth="1.5"
              />
            );
          })}
          <path d={linePath} fill="none" stroke="oklch(0.7 0.22 310)" strokeWidth="2" />
        </svg>
      </div>
      <Row>{rows.map((d, i) => <Cell key={i} className="text-[oklch(0.7_0.18_245)]">{d.mm}</Cell>)}</Row>
      <Row>{rows.map((d, i) => <Cell key={i}>{d.ws}</Cell>)}</Row>
      <Row>{rows.map((d, i) => <Cell key={i}>{d.p}</Cell>)}</Row>
      <Row>{rows.map((d, i) => <Cell key={i}>{d.hum}</Cell>)}</Row>
      <Row>{rows.map((d, i) => <Cell key={i}>{d.soil}</Cell>)}</Row>
      <Row>{rows.map((d, i) => <Cell key={i}>{d.et0}</Cell>)}</Row>
    </div>
  );
}

function ForecastColumnTooltip({
  row,
  left,
  top,
  caretOnRight,
}: {
  row: HourlyRow;
  left: number;
  top: number;
  caretOnRight: boolean;
}) {
  const tempLabel = row.t.replace(/^\+/, "");

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ left, top }}
    >
      <div className="relative rounded-lg bg-white px-3 py-2.5 shadow-[0_4px_20px_oklch(0_0_0_/_0.18)] min-w-[158px]">
        <div
          className={
            "absolute top-4 h-2.5 w-2.5 rotate-45 bg-white " +
            (caretOnRight ? "-right-1 shadow-[2px_-2px_4px_oklch(0_0_0_/_0.06)]" : "-left-1 shadow-[-2px_2px_4px_oklch(0_0_0_/_0.06)]")
          }
        />
        <p className="text-sm font-semibold text-gray-800">{row.h}</p>
        <p className="text-sm font-semibold text-gray-800">{row.cond}</p>
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-[oklch(0.7_0.22_310)]" />
            <span>Temperature: {tempLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-700">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm border-2 border-[oklch(0.7_0.18_245)]" />
            <span>Precipitation: {row.mm}</span>
          </div>
        </div>
        <div className="mt-2 space-y-0.5 text-[11px] text-gray-500">
          <p>Wind speed: {row.ws}</p>
          <p>Pressure: {row.p}</p>
          <p>Humidity: {row.hum}</p>
          <p>Soil temp: {row.soil.replace(/^\+/, "")}</p>
          <p>ET0: {row.et0}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex border-b border-border/30">{children}</div>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"shrink-0 px-2 py-1.5 text-center " + className} style={{ width: 78 }}>
      {children}
    </div>
  );
}

function buildHourlyRows(records: WeatherRecord[]): HourlyRow[] {
  if (!records.length) return [];

  const temps = records.map((record) => record.temperature_2m);
  const rains = records.map((record) => record.rain);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const maxRain = Math.max(...rains, 0.01);

  return records.map((record) => ({
    h: formatHour(record.observation_time),
    cond: describeCondition(record.rain),
    t: formatTemp(record.temperature_2m),
    mm: `${record.rain.toFixed(2)}mm`,
    ws: `${record.wind_speed_10m.toFixed(1)}m/s`,
    p: `${record.surface_pressure.toFixed(0)}hPa`,
    hum: `${record.relative_humidity_2m.toFixed(0)}%`,
    soil: formatTemp(record.soil_temperature_6cm),
    et0: `${record.et0_fao_evapotranspiration.toFixed(2)}mm`,
    bar: record.rain / maxRain,
    line: (record.temperature_2m - minTemp) / (maxTemp - minTemp || 1),
  }));
}

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTemp(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}°`;
}

function formatArea(value: string | number | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : "0.0";
}

function describeCondition(rain: number) {
  if (rain >= 1) return "Moderate rain";
  if (rain > 0) return "Light rain";
  return "Mostly clear";
}

function weatherEmoji(rain: number) {
  if (rain >= 1) return "🌧";
  if (rain > 0) return "🌦";
  return "⛅";
}
