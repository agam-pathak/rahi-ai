"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Stop = {
  id: string;
  name: string;
  day?: number;
  sequence?: number;
  cost?: number;
  duration?: number;
  coordinates?: [number, number];
};

type Props = {
  stops: Stop[];
  destination: string;
  mapboxToken?: string;
};

const DEFAULT_CENTER: [number, number] = [78.9629, 20.5937];
const MAX_STOPS = 20;

export default function TripMap({ stops, destination, mapboxToken = "" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocodeCache = useRef(new Map<string, [number, number]>());
  const animationRef = useRef<number | null>(null);
  const [activeDay, setActiveDay] = useState<number | "all">("all");
  const [fullscreen, setFullscreen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [resolvedStops, setResolvedStops] = useState<Stop[]>([]);
  const [fallbackCoord, setFallbackCoord] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const availableDays = useMemo(() => {
    const days = new Set<number>();
    stops.forEach((stop) => {
      if (typeof stop.day === "number") days.add(stop.day);
    });
    return Array.from(days).sort((a, b) => a - b);
  }, [stops]);

  const filteredStops = useMemo(() => {
    if (activeDay === "all") return stops;
    return stops.filter((stop) => stop.day === activeDay);
  }, [stops, activeDay]);

  const orderedStops = useMemo(() => {
    return [...filteredStops].sort((a, b) => {
      const dayA = a.day ?? 0;
      const dayB = b.day ?? 0;
      if (dayA !== dayB) return dayA - dayB;
      const seqA = a.sequence ?? 0;
      const seqB = b.sequence ?? 0;
      return seqA - seqB;
    });
  }, [filteredStops]);

  const trimmedStops = useMemo(() => orderedStops.slice(0, MAX_STOPS), [orderedStops]);

  const routeCoords = useMemo(
    () => resolvedStops.map((stop) => stop.coordinates).filter(Boolean) as [number, number][],
    [resolvedStops]
  );

  const formatCurrency = (value?: number) => {
    if (!Number.isFinite(value || 0)) return null;
    return new Intl.NumberFormat("en-IN").format(value || 0);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const geocode = async (query: string) => {
    if (!mapboxToken) return null;
    const key = query.toLowerCase();
    const cached = geocodeCache.current.get(key);
    if (cached) return cached;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${mapboxToken}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    if (Array.isArray(center) && center.length === 2) {
      geocodeCache.current.set(key, [center[0], center[1]]);
      return [center[0], center[1]] as [number, number];
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;

    const resolveStops = async () => {
      if (!mapboxToken) {
        setResolvedStops(trimmedStops);
        return;
      }

      setStatus("loading");
      try {
        const next = await Promise.all(
          trimmedStops.map(async (stop) => {
            if (stop.coordinates) return stop;
            const query = destination
              ? `${stop.name}, ${destination}`
              : stop.name;
            const coord = await geocode(query);
            return coord ? { ...stop, coordinates: coord } : stop;
          })
        );

        if (!cancelled) {
          setResolvedStops(next.filter((stop) => stop.coordinates));
          setStatus("idle");
        }

        if (!destination || cancelled) return;
        const destCoord = await geocode(destination);
        if (!cancelled) setFallbackCoord(destCoord);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    resolveStops();

    return () => {
      cancelled = true;
    };
  }, [trimmedStops, destination, mapboxToken]);

  useEffect(() => {
    if (!mapboxToken || !containerRef.current) return;

    let mounted = true;
    setReady(false);

    const init = async () => {
      const mapboxglModule = await import("mapbox-gl");
      if (!mounted || !containerRef.current) return;

      const mapboxgl: any = mapboxglModule.default ?? mapboxglModule;
      mapboxgl.accessToken = mapboxToken;
      mapboxRef.current = mapboxgl;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: DEFAULT_CENTER,
        zoom: 4,
        pitch: 0,
        antialias: true,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (mounted) setReady(true);
      });

      map.on("error", () => {
        if (mounted) setStatus("error");
      });
    };

    init();

    return () => {
      mounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapboxToken, fullscreen]);

  useEffect(() => {
    if (!ready || !mapRef.current || !mapboxRef.current) return;
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const coords = resolvedStops
      .map((stop) => stop.coordinates)
      .filter(Boolean) as [number, number][];

    if (coords.length === 0 && fallbackCoord) {
      const el = document.createElement("div");
      el.className = "rahi-map-pin";
      el.innerHTML = "<span>◎</span>";
      const marker = new mapboxgl.Marker(el).setLngLat(fallbackCoord).addTo(map);
      markersRef.current.push(marker);
      map.flyTo({ center: fallbackCoord, zoom: 9 });
      return;
    }

    resolvedStops.forEach((stop, index) => {
      if (!stop.coordinates) return;
      const el = document.createElement("div");
      el.className = "rahi-map-pin";
      el.innerHTML = `<span>${index + 1}</span>`;
      const marker = new mapboxgl.Marker(el).setLngLat(stop.coordinates).addTo(map);
      const cost = formatCurrency(stop.cost);
      const subtitleParts: string[] = [];
      if (stop.day) subtitleParts.push(`Day ${stop.day}`);
      if (cost) subtitleParts.push(`₹${cost}`);
      if (stop.duration) subtitleParts.push(`${stop.duration} min`);
      const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" • ") : "Tap for details";
      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, closeOnClick: false })
        .setHTML(`
          <div class="rahi-map-popup">
            <p class="rahi-map-popup-title">${stop.name}</p>
            <p class="rahi-map-popup-sub">${subtitle}</p>
          </div>
        `);
      marker.setPopup(popup);
      const element = marker.getElement();
      element.addEventListener("mouseenter", () => {
        if (!marker.getPopup().isOpen()) marker.togglePopup();
      });
      element.addEventListener("mouseleave", () => {
        if (marker.getPopup().isOpen()) marker.togglePopup();
      });
      markersRef.current.push(marker);
    });

    if (coords.length < 2) {
      if (map.getLayer("rahi-route-anim")) map.removeLayer("rahi-route-anim");
      if (map.getLayer("rahi-route-line")) map.removeLayer("rahi-route-line");
      if (map.getSource("rahi-route")) map.removeSource("rahi-route");
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (coords.length >= 2) {
      const data = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {},
      };

      const existingSource = map.getSource("rahi-route");
      if (existingSource) {
        (existingSource as any).setData(data);
      } else {
        map.addSource("rahi-route", { type: "geojson", data, lineMetrics: true });
        map.addLayer({
          id: "rahi-route-line",
          type: "line",
          source: "rahi-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-width": 3,
            "line-opacity": 0.7,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0,
              "#14b8a6",
              0.5,
              "#22d3ee",
              1,
              "#38bdf8",
            ],
          },
        });
        map.addLayer({
          id: "rahi-route-anim",
          type: "line",
          source: "rahi-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-width": 5,
            "line-opacity": 0.6,
            "line-color": "#7dd3fc",
            "line-blur": 0.6,
            "line-dasharray": [0.2, 1.8],
          },
        });
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      let phase = 0;
      const animate = () => {
        phase += 0.02;
        const dash = Math.abs(Math.sin(phase)) * 1.6 + 0.2;
        if (map.getLayer("rahi-route-anim")) {
          map.setPaintProperty("rahi-route-anim", "line-dasharray", [dash, 2]);
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    if (coords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
    }
  }, [ready, resolvedStops, fallbackCoord]);

  useEffect(() => {
    if (!mapboxToken) return;
    if (routeCoords.length < 2) {
      setRouteSummary(null);
      return;
    }

    const controller = new AbortController();
    const fetchRoute = async () => {
      setRouteLoading(true);
      try {
        const coordsString = routeCoords.map((coord) => coord.join(",")).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Route fetch failed");
        const data = await res.json();
        const route = data?.routes?.[0];
        if (!route) {
          setRouteSummary(null);
          return;
        }
        setRouteSummary({
          distanceKm: Math.round((route.distance || 0) / 100) / 10,
          durationMin: Math.round((route.duration || 0) / 60),
        });
      } catch {
        setRouteSummary(null);
      } finally {
        setRouteLoading(false);
      }
    };

    fetchRoute();

    return () => controller.abort();
  }, [mapboxToken, routeCoords]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const timer = window.setTimeout(() => map.resize(), 250);
    return () => window.clearTimeout(timer);
  }, [fullscreen]);

  const staticMapUrl = useMemo(() => {
    if (!mapboxToken) return "";
    const coord =
      resolvedStops[0]?.coordinates || fallbackCoord || DEFAULT_CENTER;
    const [lng, lat] = coord;
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lng},${lat},10,0/640x360?access_token=${mapboxToken}`;
  }, [mapboxToken, resolvedStops, fallbackCoord]);

  if (!mapboxToken) {
    return (
      <div className="rahi-map-shell">
        <div className="rahi-map-overlay">
          <div>
            <p className="text-sm font-semibold text-white">Mapbox token required</p>
            <p className="text-xs text-gray-400 mt-2">
              Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the live map.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mapShell = (
    <div className={`rahi-map-shell ${fullscreen ? "is-fullscreen" : ""}`}>
      <div ref={containerRef} className="rahi-map-container" />
      <div className="rahi-map-toolbar">
        <div className="rahi-map-chips">
          <button
            className={`rahi-map-chip ${activeDay === "all" ? "is-active" : ""}`}
            onClick={() => setActiveDay("all")}
            type="button"
          >
            All Days
          </button>
          {availableDays.map((day) => (
            <button
              key={day}
              className={`rahi-map-chip ${activeDay === day ? "is-active" : ""}`}
              onClick={() => setActiveDay(day)}
              type="button"
            >
              Day {day}
            </button>
          ))}
        </div>
        <button
          className="rahi-map-fullscreen"
          onClick={() => setFullscreen((prev) => !prev)}
          type="button"
        >
          {fullscreen ? "Exit" : "Expand"}
        </button>
      </div>

      {(routeLoading || routeSummary) && (
        <div className="rahi-map-summary">
          {routeLoading && <span>Calculating route...</span>}
          {!routeLoading && routeSummary && (
            <span>
              ETA {routeSummary.durationMin} min • {routeSummary.distanceKm} km
            </span>
          )}
        </div>
      )}

      {status === "loading" && (
        <div className="rahi-map-status">Resolving map pins...</div>
      )}
      {status === "error" && (
        <div className="rahi-map-fallback">
          {staticMapUrl ? (
            <img src={staticMapUrl} alt="Static map" />
          ) : (
            <span>Map data unavailable.</span>
          )}
        </div>
      )}
    </div>
  );

  if (fullscreen && portalTarget) {
    return createPortal(mapShell, portalTarget);
  }

  return mapShell;
}
