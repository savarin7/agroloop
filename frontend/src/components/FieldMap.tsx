import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Ruler } from "lucide-react";

import Map from "ol/Map";
import View from "ol/View";

import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";

import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";

import Draw from "ol/interaction/Draw";
import GeoJSON from "ol/format/GeoJSON";

import { Fill, Stroke, Style } from "ol/style";

import "ol/ol.css";

function hexToRgba(hex, alpha) {
  const normalized = String(hex).replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return `rgba(250,204,21,${alpha})`;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function featureStyle(feature) {
  const color = feature.get("color") ?? "#facc15";
  const fillOpacity = feature.get("fillOpacity") ?? 0.22;
  return new Style({
    stroke: new Stroke({
      color,
      width: 2,
    }),
    fill: new Fill({
      color: hexToRgba(color, fillOpacity),
    }),
  });
}

function FieldMap({
  className = "",
  features,
  onPolygonDrawn,
  showControls = true,
}) {
  const mapRef = useRef();
  const mapInstance = useRef();
  const drawInteraction = useRef(null);
  const vectorSource = useRef(new VectorSource());
  const geoJson = useRef(new GeoJSON());
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url:
          "https://services.arcgisonline.com/ArcGIS/rest/services/" +
          "World_Imagery/MapServer/tile/{z}/{y}/{x}",
      }),
    });

    const polygonLayer = new VectorLayer({
      source: vectorSource.current,
      style: featureStyle,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [satelliteLayer, polygonLayer],
      view: new View({
        center: [0, 0],
        zoom: 3,
      }),
      controls: [],
    });

    mapInstance.current = map;

    return () => {
      if (drawInteraction.current) {
        map.removeInteraction(drawInteraction.current);
      }
      map.setTarget(undefined);
      mapInstance.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!features) return;

    vectorSource.current.clear();

    const normalizedFeatures = features
      .filter(Boolean)
      .map((feature) =>
        feature.type === "Feature"
          ? feature
          : { type: "Feature", geometry: feature, properties: {} },
      );

    if (!normalizedFeatures.length) return;

    const mapFeatures = geoJson.current.readFeatures(
      { type: "FeatureCollection", features: normalizedFeatures },
      {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      },
    );

    vectorSource.current.addFeatures(mapFeatures);

    const extent = vectorSource.current.getExtent();
    if (mapInstance.current && extent.every(Number.isFinite)) {
      mapInstance.current.getView().fit(extent, {
        duration: 250,
        maxZoom: 16,
        padding: [48, 48, 48, 48],
      });
    }
  }, [features]);

  const stopDrawing = () => {
    if (!mapInstance.current || !drawInteraction.current) return;

    mapInstance.current.removeInteraction(drawInteraction.current);
    drawInteraction.current = null;
    setIsDrawing(false);
  };

  const startFreehandPolygon = () => {
    if (!mapInstance.current) return;

    stopDrawing();

    const draw = new Draw({
      source: vectorSource.current,
      type: "Polygon",
      freehand: true,
    });

    draw.on("drawend", async (event) => {
      const geojson = geoJson.current.writeFeatureObject(event.feature, {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      });

      stopDrawing();
      onPolygonDrawn?.(geojson);
    });

    drawInteraction.current = draw;
    mapInstance.current.addInteraction(draw);
    setIsDrawing(true);
  };

  const zoomBy = (amount) => {
    const view = mapInstance.current?.getView();
    if (!view) return;

    view.animate({
      zoom: (view.getZoom() ?? 3) + amount,
      duration: 180,
    });
  };

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={mapRef} className={isDrawing ? "h-full w-full cursor-crosshair" : "h-full w-full"} />

      {showControls && (
        <div className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
          <button
            onClick={isDrawing ? stopDrawing : startFreehandPolygon}
            className={
              "rounded-xl border border-border bg-card/90 p-2.5 text-muted-foreground backdrop-blur hover:text-foreground " +
              (isDrawing ? "text-primary ring-1 ring-primary/50" : "")
            }
            aria-label="Draw freehand polygon"
            title="Draw freehand polygon"
            type="button"
          >
            <Ruler className="h-4 w-4" />
          </button>

          <div className="flex flex-col rounded-xl border border-border bg-card/90 backdrop-blur">
            <button
              onClick={() => zoomBy(1)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Zoom in"
              title="Zoom in"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="mx-1 h-px bg-border" />
            <button
              onClick={() => zoomBy(-1)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Zoom out"
              title="Zoom out"
              type="button"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FieldMap;
