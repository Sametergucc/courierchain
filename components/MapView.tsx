"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { db } from "@/lib/db";
import type L from "leaflet";

export interface MapCourier {
  id: string;
  name: string;
  initials: string;
  lat: number;
  lng: number;
  rating: number;
  deliveries: number;
  priceSOL: number;
  available: boolean;
}

interface MapViewProps {
  selectedCourier: MapCourier | null;
  onSelectCourier: (c: MapCourier) => void;
  userLocation: [number, number];
  locationPickMode?: boolean;
  onLocationPick?: (lat: number, lng: number) => void;
  locationSource?: "gps" | "manual" | "default";
  /** Pickup & delivery noktaları */
  pickupPoint?: { lat: number; lng: number } | null;
  deliveryPoint?: { lat: number; lng: number } | null;
  /** Kurye dashboard modu — sadece kendi konumunu ve job noktalarını gösterir */
  courierMode?: boolean;
  /** Dashboard'daki aktif job noktaları */
  jobMarkers?: Array<{ id: string; pickupLat: number; pickupLng: number; deliveryLat: number; deliveryLng: number; status: string }>;
  /** Navigation mode: focus on a single courier <-> target route */
  navigationMode?: {
    type: "to-pickup" | "to-delivery";
    courierLat: number;
    courierLng: number;
    targetLat: number;
    targetLng: number;
    courierName: string;
    courierInitials?: string;
  } | null;
  /** When true, hide all other courier markers (used in customer navigation) */
  hideOtherCouriers?: boolean;
}

function jitter(base: number, range = 0.0003): number {
  return base + (Math.random() - 0.5) * range;
}

export default function MapView({
  selectedCourier,
  onSelectCourier,
  userLocation,
  locationPickMode = false,
  onLocationPick,
  locationSource = "default",
  pickupPoint,
  deliveryPoint,
  courierMode = false,
  jobMarkers,
  navigationMode = null,
  hideOtherCouriers = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const deliveryMarkerRef = useRef<L.Marker | null>(null);
  const deliveryRouteRef = useRef<L.Polyline | null>(null);
  const jobMarkersRef = useRef<Map<string, { pickup: L.Marker; delivery: L.Marker; route: L.Polyline }>>(new Map());
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const couriersRef = useRef<MapCourier[]>([]);
  const livePositions = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Stale closure önlemek için ref'ler
  const pickModeRef = useRef(locationPickMode);
  const onPickRef = useRef(onLocationPick);
  pickModeRef.current = locationPickMode;
  onPickRef.current = onLocationPick;
  // Track if we've already auto-centered on GPS to avoid hijacking user pan/zoom
  const gpsCenteredRef = useRef(false);
  // Navigation mode refs
  const navCourierMarkerRef = useRef<L.Marker | null>(null);
  const navTargetMarkerRef = useRef<L.Marker | null>(null);
  const navRouteRef = useRef<L.Polyline | null>(null);
  const navFittedRef = useRef(false);

  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Build courier icon
  const buildIcon = useCallback(
    (L: typeof import("leaflet"), courier: MapCourier, isSelected: boolean) => {
      const color = courier.available ? "#14F195" : "#ff6b6b";
      const selColor = "#9945FF";
      const useColor = isSelected ? selColor : color;
      const size = isSelected ? 46 : 40;
      const pulse = courier.available && !isSelected;

      return L.divIcon({
        html: `
          <div style="position:relative;width:${size}px;height:${size}px;">
            ${pulse ? `<div style="
                position:absolute;inset:-4px;border-radius:50%;
                border:2px solid ${color};opacity:0.2;
                animation:ping 2s ease-in-out infinite;
              "></div>` : ""}
            <div style="
              width:${size}px;height:${size}px;
              background:${isSelected ? "rgba(153,69,255,0.22)" : courier.available ? "rgba(20,241,149,0.16)" : "rgba(255,107,107,0.14)"};
              border-radius:50%;
              border:${isSelected ? "3px" : "2px"} solid ${useColor};
              display:flex;align-items:center;justify-content:center;
              font-weight:800;font-size:11px;color:${useColor};
              box-shadow:${isSelected ? "0 0 24px rgba(153,69,255,0.7)" : courier.available ? "0 0 12px rgba(20,241,149,0.5)" : "none"};
              cursor:${courier.available ? "pointer" : "default"};
              font-family:Inter,sans-serif;letter-spacing:-0.5px;user-select:none;
            ">${courier.initials}</div>
          </div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2 + 4)],
      });
    },
    []
  );

  // Build user icon
  const buildUserIcon = useCallback((L: typeof import("leaflet"), source: string) => {
    const color = source === "gps" ? "#14F195" : source === "manual" ? "#f59e0b" : "#9945FF";
    return L.divIcon({
      html: `
        <div style="position:relative;width:22px;height:22px;">
          <div style="
            position:absolute;inset:-6px;border-radius:50%;
            border:2px solid ${color}80;
            animation:ping 1.5s ease-in-out infinite;
          "></div>
          <div style="
            width:22px;height:22px;background:${color};
            border-radius:50%;border:3px solid white;
            box-shadow:0 0 20px ${color}cc;
          "></div>
        </div>`,
      className: "",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }, []);

  // Load couriers from API and update positions
  const loadAndPlaceCouriers = useCallback(async () => {
    if (!leafletMap.current || !LRef.current) return;
    const L = LRef.current;

    try {
      const couriers = await db.users.allCouriers();
      const mapCouriers: MapCourier[] = couriers.map((c) => ({
        id: c.id,
        name: c.name,
        initials: c.name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2),
        lat: c.lat || 41.008,
        lng: c.lng || 28.978,
        rating: c.rating || 0,
        deliveries: c.deliveries || 0,
        priceSOL: c.priceSOL || 0.08,
        available: c.available !== false,
      }));

      couriersRef.current = mapCouriers;

      mapCouriers.forEach((courier) => {
        // Her zaman API'den gelen konumu güncelle
        livePositions.current.set(courier.id, { lat: courier.lat, lng: courier.lng });

        const existingMarker = markersRef.current.get(courier.id);

        // Hide all couriers except the active navigation courier (customer-side nav mode)
        const shouldHide = hideOtherCouriers && navigationMode &&
          courier.name !== navigationMode.courierName;

        if (existingMarker) {
          if (shouldHide) {
            existingMarker.remove();
            markersRef.current.delete(courier.id);
            return;
          }
          existingMarker.setLatLng([courier.lat, courier.lng]);
        } else {
          if (shouldHide) return;
          const isSelected = selectedCourier?.id === courier.id;
          const icon = buildIcon(L, courier, isSelected);
          const marker = L.marker([courier.lat, courier.lng], { icon }).addTo(leafletMap.current!);

          const color = courier.available ? "#14F195" : "#ff6b6b";
          marker.bindPopup(
            `<div style="font-family:Inter,sans-serif;min-width:150px;padding:2px 0">
              <div style="font-weight:700;color:#f0f0ff;margin-bottom:4px;font-size:14px">${courier.name}</div>
              <div style="color:${color};font-size:12px;margin-bottom:3px">
                ${courier.available ? "✅ Available" : "🔴 Busy"}
              </div>
              <div style="color:#9090b0;font-size:12px">⭐ ${courier.rating} · ${courier.deliveries} deliveries</div>
              <div style="color:#9945FF;font-weight:700;margin-top:5px;font-size:13px">${courier.priceSOL} SOL</div>
            </div>`
          );

          if (courier.available) {
            marker.on("click", () => onSelectCourier(courier));
          }
          markersRef.current.set(courier.id, marker);
        }
      });
    } catch (e) {
      console.error("Harita kurye yükleme hatası:", e);
    }
  }, [buildIcon, onSelectCourier, selectedCourier, hideOtherCouriers, navigationMode]);

  // Init map
  useEffect(() => {
    import("leaflet").then((L) => {
      if (!mapRef.current || leafletMap.current) return;
      LRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: userLocation,
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
        tap: true,
        tapTolerance: 25,
        touchZoom: true,
      } as any);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;

      // User marker
      const userIcon = buildUserIcon(L, locationSource);
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, draggable: true })
        .addTo(map)
        .bindPopup("<b style='color:#9945FF;font-family:Inter'>📍 Konumunuz</b>");

      // Marker sürükleme ile konum seçme
      userMarkerRef.current.on("dragend", () => {
        const pos = userMarkerRef.current?.getLatLng();
        if (pos && onLocationPick) {
          onLocationPick(pos.lat, pos.lng);
        }
      });

      // Haritaya tıklama ile konum seçme (ref kullan — stale closure önlemi)
      map.on("click", (e: any) => {
        if (pickModeRef.current && onPickRef.current) {
          const { lat, lng } = e.latlng;
          onPickRef.current(lat, lng);
        }
      });

      // Make sure container sizing is correct after layout settles (esp. on mobile)
      setTimeout(() => map.invalidateSize(), 120);
      setTimeout(() => map.invalidateSize(), 400);

      setLeafletLoaded(true);
    });

    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);

  // userLocation değişince marker güncelle
  useEffect(() => {
    if (!leafletLoaded || !userMarkerRef.current || !LRef.current) return;
    userMarkerRef.current.setLatLng(userLocation);
    userMarkerRef.current.setIcon(buildUserIcon(LRef.current, locationSource));

    // GPS konumu *ilk kez* alındığında haritayı oraya taşı, sonra dokunma
    // (kullanıcının zoom/pan'ini ezmemek için)
    if (locationSource === "gps" && !gpsCenteredRef.current) {
      leafletMap.current?.setView(userLocation, 14, { animate: true });
      gpsCenteredRef.current = true;
    }
  }, [userLocation, leafletLoaded, locationSource, buildUserIcon]);

  // Load couriers
  useEffect(() => {
    if (!leafletLoaded) return;
    loadAndPlaceCouriers();
    const iv = setInterval(loadAndPlaceCouriers, 5000);
    return () => clearInterval(iv);
  }, [leafletLoaded, loadAndPlaceCouriers]);

  // Animate — sadece görsel titreşim, base konumu değiştirmez
  useEffect(() => {
    if (!leafletLoaded || !LRef.current) return;
    const iv = setInterval(() => {
      if (!leafletMap.current) return;
      couriersRef.current.forEach((courier) => {
        if (!courier.available) return;
        const marker = markersRef.current.get(courier.id);
        const basePos = livePositions.current.get(courier.id);
        if (!marker || !basePos) return;
        // Küçük görsel titreşim — base konumu korur
        const vizLat = basePos.lat + (Math.random() - 0.5) * 0.0002;
        const vizLng = basePos.lng + (Math.random() - 0.5) * 0.0002;
        marker.setLatLng([vizLat, vizLng]);
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [leafletLoaded]);

  // Selection route
  useEffect(() => {
    if (!leafletLoaded || !leafletMap.current || !LRef.current) return;
    const L = LRef.current;

    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }

    couriersRef.current.forEach((courier) => {
      const marker = markersRef.current.get(courier.id);
      if (!marker) return;
      marker.setIcon(buildIcon(L, courier, selectedCourier?.id === courier.id));
    });

    if (selectedCourier) {
      const pos = livePositions.current.get(selectedCourier.id) || { lat: selectedCourier.lat, lng: selectedCourier.lng };
      routeRef.current = L.polyline([[pos.lat, pos.lng], userLocation], {
        color: "#9945FF", weight: 2.5, opacity: 0.85, dashArray: "10 8",
      }).addTo(leafletMap.current);

      let offset = 0;
      const dashAnim = setInterval(() => {
        if (!routeRef.current) return clearInterval(dashAnim);
        offset = (offset + 1) % 18;
        routeRef.current.setStyle({ dashOffset: String(offset) });
      }, 80);

      const bounds = L.latLngBounds([pos.lat, pos.lng], userLocation);
      leafletMap.current?.fitBounds(bounds, { padding: [70, 70] });
      return () => clearInterval(dashAnim);
    }
  }, [selectedCourier, leafletLoaded, buildIcon, userLocation]);

  // ── Pickup & Delivery markers ──
  useEffect(() => {
    if (!leafletLoaded || !leafletMap.current || !LRef.current) return;
    const L = LRef.current;

    // Remove old markers
    if (pickupMarkerRef.current) { pickupMarkerRef.current.remove(); pickupMarkerRef.current = null; }
    if (deliveryMarkerRef.current) { deliveryMarkerRef.current.remove(); deliveryMarkerRef.current = null; }
    if (deliveryRouteRef.current) { deliveryRouteRef.current.remove(); deliveryRouteRef.current = null; }

    // Pickup marker
    if (pickupPoint) {
      const pickupIcon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:rgba(20,241,149,0.9);border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;box-shadow:0 0 20px rgba(20,241,149,0.6);
          font-weight:800;color:#000;
        ">A</div>`,
        className: "", iconSize: [32, 32], iconAnchor: [16, 16],
      });
      pickupMarkerRef.current = L.marker([pickupPoint.lat, pickupPoint.lng], { icon: pickupIcon })
        .addTo(leafletMap.current)
        .bindPopup("<b style='color:#14F195;font-family:Inter'>📍 Alış Noktası</b>");
    }

    // Delivery marker
    if (deliveryPoint) {
      const deliveryIcon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:rgba(153,69,255,0.9);border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;box-shadow:0 0 20px rgba(153,69,255,0.6);
          font-weight:800;color:white;
        ">B</div>`,
        className: "", iconSize: [32, 32], iconAnchor: [16, 16],
      });
      deliveryMarkerRef.current = L.marker([deliveryPoint.lat, deliveryPoint.lng], { icon: deliveryIcon })
        .addTo(leafletMap.current)
        .bindPopup("<b style='color:#9945FF;font-family:Inter'>🏁 Teslimat Noktası</b>");
    }

    // Route line A → B
    if (pickupPoint && deliveryPoint) {
      deliveryRouteRef.current = L.polyline(
        [[pickupPoint.lat, pickupPoint.lng], [deliveryPoint.lat, deliveryPoint.lng]],
        { color: "#14F195", weight: 3, opacity: 0.9, dashArray: "8 6" }
      ).addTo(leafletMap.current);

      // Fit bounds
      const pts: [number, number][] = [
        [pickupPoint.lat, pickupPoint.lng],
        [deliveryPoint.lat, deliveryPoint.lng],
      ];
      const bounds = L.latLngBounds(pts);
      leafletMap.current?.fitBounds(bounds, { padding: [80, 80] });
    } else if (pickupPoint) {
      leafletMap.current?.setView([pickupPoint.lat, pickupPoint.lng], 15, { animate: true });
    } else if (deliveryPoint) {
      leafletMap.current?.setView([deliveryPoint.lat, deliveryPoint.lng], 15, { animate: true });
    }
  }, [pickupPoint, deliveryPoint, leafletLoaded]);

  // ── Courier dashboard: job markers ──
  useEffect(() => {
    if (!leafletLoaded || !leafletMap.current || !LRef.current || !courierMode) return;
    const L = LRef.current;

    // Clear old job markers
    jobMarkersRef.current.forEach(({ pickup, delivery, route }) => {
      pickup.remove(); delivery.remove(); route.remove();
    });
    jobMarkersRef.current.clear();

    if (!jobMarkers?.length) return;

    jobMarkers.forEach((job) => {
      const pickIcon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${job.status === "picked_up" ? "rgba(245,158,11,0.9)" : "rgba(20,241,149,0.9)"};
          border:2.5px solid white;display:flex;align-items:center;justify-content:center;
          font-size:12px;box-shadow:0 0 14px rgba(20,241,149,0.5);font-weight:800;color:#000;
        ">A</div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const delIcon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:rgba(153,69,255,0.9);border:2.5px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:12px;box-shadow:0 0 14px rgba(153,69,255,0.5);font-weight:800;color:white;
        ">B</div>`,
        className: "", iconSize: [28, 28], iconAnchor: [14, 14],
      });

      const pickup = L.marker([job.pickupLat, job.pickupLng], { icon: pickIcon }).addTo(leafletMap.current!);
      const delivery = L.marker([job.deliveryLat, job.deliveryLng], { icon: delIcon }).addTo(leafletMap.current!);
      const route = L.polyline(
        [[job.pickupLat, job.pickupLng], [job.deliveryLat, job.deliveryLng]],
        { color: job.status === "picked_up" ? "#f59e0b" : "#14F195", weight: 2.5, dashArray: "6 4", opacity: 0.8 }
      ).addTo(leafletMap.current!);

      jobMarkersRef.current.set(job.id, { pickup, delivery, route });
    });

    // Fit all job points
    const allPts: [number, number][] = [];
    jobMarkers.forEach(j => {
      allPts.push([j.pickupLat, j.pickupLng]);
      allPts.push([j.deliveryLat, j.deliveryLng]);
    });
    allPts.push(userLocation);
    if (allPts.length > 1) {
      leafletMap.current?.fitBounds(L.latLngBounds(allPts), { padding: [60, 60] });
    }
  }, [jobMarkers, leafletLoaded, courierMode, userLocation]);

  // ── Navigation mode (single courier → target route) ──
  useEffect(() => {
    if (!leafletLoaded || !leafletMap.current || !LRef.current) return;
    const L = LRef.current;
    const map = leafletMap.current;

    // Cleanup previous navigation overlay
    if (navCourierMarkerRef.current) { navCourierMarkerRef.current.remove(); navCourierMarkerRef.current = null; }
    if (navTargetMarkerRef.current) { navTargetMarkerRef.current.remove(); navTargetMarkerRef.current = null; }
    if (navRouteRef.current) { navRouteRef.current.remove(); navRouteRef.current = null; }

    if (!navigationMode) {
      navFittedRef.current = false;
      return;
    }

    const isToPickup = navigationMode.type === "to-pickup";
    const routeColor = isToPickup ? "#14F195" : "#9945FF";
    const targetEmoji = isToPickup ? "📍" : "🏁";
    const targetLabel = isToPickup ? "A" : "B";
    const targetBg = isToPickup ? "rgba(20,241,149,0.95)" : "rgba(153,69,255,0.95)";

    // Courier marker (riding emoji)
    const courierIcon = L.divIcon({
      html: `<div style="
        position:relative;width:48px;height:48px;
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          position:absolute;inset:-6px;border-radius:50%;
          background:${routeColor}40;animation:pulse-glow 1.6s ease-in-out infinite;
        "></div>
        <div style="
          width:42px;height:42px;border-radius:50%;
          background:linear-gradient(135deg, ${routeColor}, ${isToPickup ? '#0fd47e' : '#c76bff'});
          border:3px solid white;display:flex;align-items:center;justify-content:center;
          font-size:18px;box-shadow:0 6px 20px ${routeColor}66;
        ">🏍️</div>
      </div>`,
      className: "", iconSize: [48, 48], iconAnchor: [24, 24],
    });

    // Target marker (A or B)
    const targetIcon = L.divIcon({
      html: `<div style="
        position:relative;display:flex;flex-direction:column;align-items:center;
      ">
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:${targetBg};border:3px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;font-weight:900;color:white;
          box-shadow:0 6px 20px ${routeColor}66;
        ">${targetLabel}</div>
        <div style="
          margin-top:4px;padding:3px 9px;border-radius:10px;
          background:${targetBg};color:white;
          font-size:10px;font-weight:800;white-space:nowrap;
          box-shadow:0 4px 12px rgba(0,0,0,0.4);
        ">${targetEmoji} ${isToPickup ? 'PICKUP' : 'DELIVERY'}</div>
      </div>`,
      className: "", iconSize: [80, 60], iconAnchor: [40, 20],
    });

    navCourierMarkerRef.current = L.marker(
      [navigationMode.courierLat, navigationMode.courierLng],
      { icon: courierIcon, zIndexOffset: 1000 }
    ).addTo(map);
    navCourierMarkerRef.current.bindPopup(
      `<div style="font-family:Inter,sans-serif;padding:2px 0">
        <div style="font-weight:700;color:#f0f0ff;font-size:13px">🏍️ ${navigationMode.courierName}</div>
        <div style="color:${routeColor};font-size:11px;margin-top:3px">
          ${isToPickup ? 'Heading to PICKUP' : 'Heading to DELIVERY'}
        </div>
      </div>`
    );

    navTargetMarkerRef.current = L.marker(
      [navigationMode.targetLat, navigationMode.targetLng],
      { icon: targetIcon, zIndexOffset: 900 }
    ).addTo(map);

    // Animated dashed polyline
    navRouteRef.current = L.polyline(
      [[navigationMode.courierLat, navigationMode.courierLng],
       [navigationMode.targetLat, navigationMode.targetLng]],
      { color: routeColor, weight: 4, opacity: 0.85, dashArray: "12 10" }
    ).addTo(map);

    let offset = 0;
    const dashAnim = setInterval(() => {
      if (!navRouteRef.current) return clearInterval(dashAnim);
      offset = (offset + 1) % 22;
      navRouteRef.current.setStyle({ dashOffset: String(offset) });
    }, 80);

    // Fit bounds once on first activation, otherwise let user pan/zoom freely
    if (!navFittedRef.current) {
      const bounds = L.latLngBounds(
        [navigationMode.courierLat, navigationMode.courierLng],
        [navigationMode.targetLat, navigationMode.targetLng]
      );
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      navFittedRef.current = true;
    }

    return () => clearInterval(dashAnim);
  }, [navigationMode, leafletLoaded]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0a12" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

      {/* Location pick mode banner */}
      {locationPickMode && (
        <div style={{
          position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, pointerEvents: "none",
        }}>
          <div style={{
            background: "rgba(245,158,11,0.95)", color: "#000",
            padding: "8px 20px", borderRadius: 14, fontWeight: 700,
            fontSize: "0.82rem", boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
            display: "flex", alignItems: "center", gap: 8,
            animation: "pulse-glow 2s ease-in-out infinite",
          }}>
            <span>📍</span> Haritaya tıklayın veya işaretçiyi sürükleyin
          </div>
        </div>
      )}

      {/* Location source badge */}
      <div style={{
        position: "absolute", bottom: 12, left: 12, zIndex: 1000,
      }}>
        <div style={{
          background: "var(--bg-glass, rgba(10,10,18,0.85))",
          border: `1px solid ${locationSource === "gps" ? "#14F19540" : locationSource === "manual" ? "#f59e0b40" : "#9945FF40"}`,
          borderRadius: 12, padding: "6px 12px",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: "0.7rem", fontWeight: 600,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: locationSource === "gps" ? "#14F195" : locationSource === "manual" ? "#f59e0b" : "#9945FF",
            boxShadow: `0 0 8px ${locationSource === "gps" ? "#14F195" : locationSource === "manual" ? "#f59e0b" : "#9945FF"}`,
          }}/>
          <span style={{ color: locationSource === "gps" ? "#14F195" : locationSource === "manual" ? "#f59e0b" : "#9945FF" }}>
            {locationSource === "gps" ? "📡 GPS Konum" : locationSource === "manual" ? "📍 Manuel Konum" : "📍 Varsayılan"}
          </span>
        </div>
      </div>

      {/* Loading */}
      {!leafletLoaded && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 10,
          background: "rgba(0,0,0,0.4)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span className="anim-spin" style={{
              width: 40, height: 40, border: "2px solid rgba(153,69,255,0.3)",
              borderTopColor: "#9945FF", borderRadius: "50%", display: "inline-block",
            }}/>
            <span style={{ fontSize: "0.85rem", color: "#9945FF" }}>Harita yükleniyor...</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(245,158,11,0.4); }
          50% { box-shadow: 0 4px 30px rgba(245,158,11,0.7); }
        }
      `}</style>
    </div>
  );
}
