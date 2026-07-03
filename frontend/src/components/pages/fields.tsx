import { List, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FieldMap from "@/components/FieldMap";
import { api } from "@/lib/api";

type Option = {
  crop_id?: number;
  soil_id?: number;
  name?: string;
  texture?: string;
};

type FieldRecord = {
  id: number;
  name: string;
  planting_date?: string | null;
  area_ha: string | number;
  geometry?: unknown;
  crop_type?: Option | null;
  crop_type_id?: number;
  soil_type?: Option | null;
  soil_type_id?: number;
};

type Draft = {
  name: string;
  planting_date: string;
  crop_type_id: string;
  soil_type_id: string;
};

const initialDraft: Draft = {
  name: "",
  planting_date: "",
  crop_type_id: "",
  soil_type_id: "",
};

const fallbackCropTypes: Option[] = [
  { crop_id: 1, name: "Maize" },
  { crop_id: 2, name: "Rice" },
  { crop_id: 3, name: "Wheat" },
  { crop_id: 4, name: "Tomato" },
  { crop_id: 5, name: "Potato" },
  { crop_id: 6, name: "Onion" },
  { crop_id: 7, name: "Soybean" },
  { crop_id: 8, name: "Groundnut" },
];


const fallbackSoilTypes: Option[] = [
  { soil_id: 1, name: "Sand" },
  { soil_id: 2, name: "Loamy Sand" },
  { soil_id: 3, name: "Sandy Loam" },
  { soil_id: 4, name: "Loam" },
  { soil_id: 5, name: "Silt Loam" },
  { soil_id: 6, name: "Clay Loam" },
  { soil_id: 7, name: "Silty Clay Loam" },
  { soil_id: 8, name: "Clay" },
];

export function FieldsPage() {
  const [mode, setMode] = useState<"list" | "polygon">("list");
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [cropTypes, setCropTypes] = useState<Option[]>([]);
  const [soilTypes, setSoilTypes] = useState<Option[]>([]);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [pendingFeature, setPendingFeature] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchFields = async () => {
    const response = await api.get<FieldRecord[]>("/fields/");
    setFields(response.data);
    setSelectedId((current) => current ?? response.data[0]?.id ?? null);
  };

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [fieldsResponse, cropsResponse, soilsResponse] = await Promise.all([
          api.get<FieldRecord[]>("/fields/"),
          api.get<Option[]>("/crop-types/"),
          api.get<Option[]>("/soil-types/"),
        ]);

        if (ignore) return;

        setFields(fieldsResponse.data);
        setCropTypes(cropsResponse.data);
        setSoilTypes(soilsResponse.data);
        setSelectedId(fieldsResponse.data[0]?.id ?? null);
        setDraft((current) => ({
          ...current,
          crop_type_id: current.crop_type_id || String(cropsResponse.data[0]?.crop_id ?? fallbackCropTypes[0].crop_id),
          soil_type_id: current.soil_type_id || String(soilsResponse.data[0]?.soil_id ?? fallbackSoilTypes[0].soil_id),
        }));
      } catch {
        if (!ignore) setError("Unable to load fields from the backend.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredFields = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return fields;

    return fields.filter((field) =>
      [
        field.name,
        field.crop_type?.name,
        field.soil_type?.name,
        String(field.area_ha),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [fields, query]);

  const mapFeatures = useMemo(
    () => [
      ...fields.map((field) => field.geometry).filter(Boolean),
      pendingFeature?.geometry,
    ].filter(Boolean),
    [fields, pendingFeature],
  );

  const handlePolygonDrawn = (feature: any) => {
    setPendingFeature(feature);
    setMode("polygon");
    setError("");
  };

  const createField = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingFeature?.geometry) {
      setError("Draw a polygon before creating a field.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await api.post<FieldRecord>("/field/create/", {
        name: draft.name || `Field ${fields.length + 1}`,
        planting_date: draft.planting_date || null,
        crop_type_id: Number(draft.crop_type_id || cropTypes[0]?.crop_id || fallbackCropTypes[0].crop_id),
        soil_type_id: Number(draft.soil_type_id || soilTypes[0]?.soil_id || fallbackSoilTypes[0].soil_id),
        geometry: pendingFeature.geometry,
      });

      setPendingFeature(null);
      setDraft(initialDraft);
      setMode("list");
      await fetchFields();
      setSelectedId(response.data.id);
    } catch {
      setError("Unable to create the field. Check crop, soil, and polygon data.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 md:gap-4 h-full">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
        <FieldMap
          className="absolute inset-0"
          features={mapFeatures}
          onPolygonDrawn={handlePolygonDrawn}
        />
        <div className="absolute inset-0 bg-background/20 pointer-events-none" />

        <div className="absolute left-4 top-4 right-4 z-20 md:right-auto md:w-80">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/90 backdrop-blur px-3 py-2.5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Location or field..."
              className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted-foreground"
            />
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {mode === "list" ? (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary">Fields</h2>
            <span className="text-xs text-muted-foreground">{fields.length}</span>
          </div>

          {error && <p className="rounded-lg border border-destructive/40 p-2 text-xs text-destructive">{error}</p>}

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading fields...</p>
            ) : filteredFields.length ? (
              filteredFields.map((field, index) => (
                <a
                  key={field.id}
                  href={`/field?fieldId=${field.id}`}
                  onClick={() => setSelectedId(field.id)}
                  className={
                    "rounded-xl border p-3 flex items-center gap-3 hover:bg-secondary/60 " +
                    (field.id === selectedId ? "border-primary/60 bg-primary/5" : "border-border")
                  }
                >
                  <div
                    className="h-10 w-10 rounded-md flex items-center justify-center"
                    style={{
                      background: fieldColor(index) + "20",
                      border: `1px solid ${fieldColor(index)}`,
                    }}
                  >
                    <span className="h-4 w-4 rounded-sm" style={{ background: fieldColor(index) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{field.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatArea(field.area_ha)} ha · {field.crop_type?.name ?? "Crop not set"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {field.soil_type?.name ?? "Soil not set"}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No fields found.</p>
            )}
          </div>

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setMode("polygon")}
              className="w-full rounded-xl bg-primary py-2.5 text-sm text-primary-foreground hover:opacity-90"
            >
              Create Field
            </button>
          </div>
        </div>
      ) : (
        <PolygonPanel
          cropTypes={cropTypes}
          draft={draft}
          error={error}
          hasGeometry={Boolean(pendingFeature?.geometry)}
          onBack={() => setMode("list")}
          onChange={setDraft}
          onSubmit={createField}
          saving={saving}
          soilTypes={soilTypes}
        />
      )}
    </div>
  );
}

function PolygonPanel({
  cropTypes,
  draft,
  error,
  hasGeometry,
  onBack,
  onChange,
  onSubmit,
  saving,
  soilTypes,
}: {
  cropTypes: Option[];
  draft: Draft;
  error: string;
  hasGeometry: boolean;
  onBack: () => void;
  onChange: (draft: Draft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  soilTypes: Option[];
}) {
  const cropOptions = cropTypes.length ? cropTypes : fallbackCropTypes;
  const soilOptions = soilTypes.length ? soilTypes : fallbackSoilTypes;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-5 overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">New</p>
          <h2 className="text-3xl font-light tracking-tight text-foreground">Field</h2>
        </div>
        <button onClick={onBack} type="button" className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground" aria-label="List">
          <List className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="rounded-lg border border-destructive/40 p-2 text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-[92px_1fr] items-center gap-3">
        <label className="text-sm text-muted-foreground">Name</label>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder="Field name"
        />

        <label className="text-sm text-muted-foreground">Crop</label>
        <select
          value={draft.crop_type_id || String(cropOptions[0]?.crop_id ?? "")}
          onChange={(event) => onChange({ ...draft, crop_type_id: event.target.value })}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          {cropOptions.map((crop) => (
            <option key={crop.crop_id} value={crop.crop_id}>
              {crop.name ?? "Unnamed crop"}
            </option>
          ))}
        </select>

        <label className="text-sm text-muted-foreground">Soil</label>
        <select
          value={draft.soil_type_id || String(soilOptions[0]?.soil_id ?? "")}
          onChange={(event) => onChange({ ...draft, soil_type_id: event.target.value })}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
        >
          {soilOptions.map((soil) => (
            <option key={soil.soil_id} value={soil.soil_id}>
              {soil.name ?? "Unnamed soil"}
            </option>
          ))}
        </select>

        <label className="text-sm text-muted-foreground">Planting</label>
        <input
          type="date"
          value={draft.planting_date}
          onChange={(event) => onChange({ ...draft, planting_date: event.target.value })}
          className="rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-xl border border-border p-3 text-sm">
        <p className={hasGeometry ? "text-primary" : "text-muted-foreground"}>
          {hasGeometry ? "Polygon ready" : "No polygon selected"}
        </p>
      </div>

      <div className="mt-auto flex justify-end gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border border-border px-6 py-2.5 text-sm font-medium hover:bg-secondary">
          Cancel
        </button>
        <button
          disabled={saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

function fieldColor(index: number) {
  const colors = [
    "oklch(0.85 0.16 95)",
    "oklch(0.65 0.2 350)",
    "oklch(0.7 0.15 230)",
    "oklch(0.75 0.18 145)",
  ];

  return colors[index % colors.length];
}

function formatArea(area: string | number) {
  const value = Number(area);
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}
