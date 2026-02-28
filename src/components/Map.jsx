import React, { useEffect, useRef, useState } from "react";
import { database, ref, onValue } from "../firebase";

// ── Module-level singleton so the script is only ever appended ONCE ──────────
// React StrictMode double-invokes effects; a component-local guard isn't enough.
let _mapsPromise = null;
function loadGoogleMapsOnce(apiKey) {
  if (_mapsPromise) return _mapsPromise;
  if (window.google?.maps) {
    _mapsPromise = Promise.resolve();
    return _mapsPromise;
  }
  _mapsPromise = new Promise((resolve, reject) => {
    const cb = `__gmCb_${Date.now()}`;
    window[cb] = () => {
      resolve();
      delete window[cb];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing&loading=async&callback=${cb}`;
    s.async = true;
    s.defer = true;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

const MapComponent = ({
  user,
  drawingModeEnabled,
  onPolygonDrawn,
  energyData,
}) => {
  const mapRef = useRef(null);
  const [locations, setLocations] = useState([]);
  const [add, setAdd] = useState([]);
  const [polygons, setPolygons] = useState({});
  const [map, setMap] = useState(null);
  const drawingManagerRef = useRef(null);

  // Track markers and circles so we can clear them on re-render
  const signalMarkersRef = useRef([]);
  const signalCirclesRef = useRef([]);
  const adminMarkersRef = useRef([]);
  const polygonRefs = useRef([]);

  useEffect(() => {
    const dbRef = ref(database, "signals");
    const adRef = ref(database, "admins");

    const extractLocations = (data) => {
      const locs = [];
      Object.entries(data).forEach(([key, val]) => {
        if (val && val.latitude !== undefined && val.longitude !== undefined) {
          locs.push({
            latitude: val.latitude,
            longitude: val.longitude,
            type: "regular",
            signalId: key,
            ...val,
          });
        } else if (typeof val === "object" && val !== null) {
          Object.values(val).forEach((nested) => {
            if (
              nested &&
              nested.latitude !== undefined &&
              nested.longitude !== undefined
            ) {
              locs.push({
                latitude: nested.latitude,
                longitude: nested.longitude,
                type:
                  key === "lPZFvExCaAMur9OJ9b6B3eRLOqt2"
                    ? "special_uid"
                    : "regular",
                userId: key,
                ...nested,
              });
            }
          });
        }
      });
      return locs;
    };

    const unsubSignals = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setLocations(extractLocations(snapshot.val()));
      }
    });

    const unsubAdmins = onValue(adRef, (sp) => {
      if (sp.exists()) {
        const dt = sp.val();
        setAdd(Object.entries(dt).map(([uid, data]) => ({ uid, ...data })));
      }
    });

    return () => {
      unsubSignals();
      unsubAdmins();
    };
  }, []);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "your_google_maps_api_key_here") {
      console.warn(
        "[Faltric] VITE_GOOGLE_MAPS_API_KEY not set in .env — map will not render.",
      );
      return;
    }

    let cancelled = false;
    loadGoogleMapsOnce(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        initializeGoogleMap();
      })
      .catch((err) => {
        console.error("[Faltric] Google Maps failed to load:", err);
      });

    return () => {
      cancelled = true;
    };

    function initializeGoogleMap() {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 21.04718, lng: 75.769189 },
        zoom: 18,
        mapTypeId: "hybrid",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
        },
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM,
          style: window.google.maps.ZoomControlStyle.SMALL,
        },
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "road",
            elementType: "labels.text",
            stylers: [{ visibility: "on" }],
          },
          {
            featureType: "administrative.locality",
            elementType: "labels",
            stylers: [{ visibility: "on" }],
          },
          {
            featureType: "water",
            elementType: "labels",
            stylers: [{ visibility: "on" }],
          },
        ],
      });
      setMap(map);

      // Store globally for ext tools (custom + / - zoom buttons)
      window.faltricMap = map;
      window.faltricCenter = {
        lat: 18.531581666666668,
        lng: 73.86704833333333,
      };
    }
  }, []);

  // Sync drawn polygons from firebase
  useEffect(() => {
    const unsub = onValue(ref(database, "faltric_polygons"), (snapshot) => {
      if (snapshot.exists()) {
        setPolygons(snapshot.val());
      } else {
        setPolygons({});
      }
    });
    return () => unsub();
  }, []);

  // Manage Drawing Manager State
  useEffect(() => {
    if (!map || !window.google?.maps?.drawing) return;

    if (user?.email === "test@admin.com" && drawingModeEnabled) {
      if (!drawingManagerRef.current) {
        drawingManagerRef.current =
          new window.google.maps.drawing.DrawingManager({
            drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
            drawingControl: true,
            drawingControlOptions: {
              position: window.google.maps.ControlPosition.TOP_CENTER,
              drawingModes: [
                window.google.maps.drawing.OverlayType.MARKER,
                window.google.maps.drawing.OverlayType.POLYGON,
              ],
            },
            polygonOptions: {
              fillColor: "#10b981",
              fillOpacity: 0.4,
              strokeWeight: 2,
              strokeColor: "#10b981",
              clickable: true,
              editable: false,
              zIndex: 1,
            },
          });

        // Listen for new drawings
        window.google.maps.event.addListener(
          drawingManagerRef.current,
          "overlaycomplete",
          (e) => {
            if (e.type === "polygon") {
              const path = e.overlay.getPath();
              const coords = [];
              for (let i = 0; i < path.getLength(); i++) {
                const pt = path.getAt(i);
                coords.push({ lat: pt.lat(), lng: pt.lng() });
              }
              // Pass back to parent to save to Firebase
              if (onPolygonDrawn) onPolygonDrawn(coords);
              // Remove the local overlay since it will redraw from Firebase
              e.overlay.setMap(null);
            }
          },
        );
      }
      drawingManagerRef.current.setMap(map);
    } else {
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
      }
    }
  }, [map, drawingModeEnabled, user]);

  // Render Polygons from Firebase
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear old polygons
    polygonRefs.current.forEach((p) => p.setMap(null));
    polygonRefs.current = [];

    Object.entries(polygons).forEach(([id, polyData]) => {
      const type = (polyData.type || "").toLowerCase();
      let color = "#10b981"; // default emerald
      if (type.includes("solar"))
        color = "#fbbf24"; // yellow
      else if (type.includes("wind"))
        color = "#3b82f6"; // blue
      else if (type.includes("biogas") || type === "bio") color = "#22c55e"; // green

      const nodeData = (energyData || []).find(
        (d) =>
          d.node_id === id ||
          d.node_id.includes(polyData.name) ||
          (polyData.name && polyData.name.includes(d.node_id.split("-")[1])),
      );

      const output = nodeData
        ? nodeData.output_kwh
        : polyData.capacity * 0.8 || "...";
      const demand = nodeData
        ? nodeData.demand_kwh
        : polyData.capacity * 0.7 || "...";

      const polygon = new window.google.maps.Polygon({
        paths: polyData.coordinates,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.35,
        map: map,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: black; padding: 10px; font-family: sans-serif; min-width: 150px;">
            <h3 style="margin: 0 0 8px 0; color: #10b981; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 4px;">⚡ ${polyData.name || "Grid Zone"}</h3>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Type:</strong> ${polyData.type || "Power Plant"}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #059669;"><strong>Live Output:</strong> ${output} kWh</p>
            <p style="margin: 4px 0; font-size: 12px; color: #dc2626;"><strong>Live Demand:</strong> ${demand} kWh</p>
            <p style="margin: 8px 0 0 0; font-size: 10px; color: #6b7280; font-style: italic;">Status: Operational</p>
          </div>
        `,
      });

      polygon.addListener("click", (e) => {
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });

      polygonRefs.current.push(polygon);
    });
  }, [map, polygons]);

  // Plot signal markers + circles — clear old ones first
  useEffect(() => {
    if (!map) return;

    // Clear ALL old signal markers
    signalMarkersRef.current.forEach((m) => m.setMap(null));
    signalMarkersRef.current = [];

    // Clear ALL old signal circles
    signalCirclesRef.current.forEach((c) => c.setMap(null));
    signalCirclesRef.current = [];

    if (locations.length === 0) return;

    locations.forEach((location) => {
      // Marker color by status
      let iconColor = "red";
      if (location.status === "resolved") iconColor = "green";
      else if (location.status === "dispatched") iconColor = "orange";

      const marker = new window.google.maps.Marker({
        position: { lat: location.latitude, lng: location.longitude },
        map,
        title: `Distress Signal from ${location.userId || location.signalId || "Unknown"}`,
        icon: `http://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png`,
      });
      signalMarkersRef.current.push(marker);

      // Circle only for non-resolved signals
      if (location.status !== "resolved") {
        const circleColor =
          location.status === "dispatched" ? "#f59e0b" : "#ef4444";
        const circle = new window.google.maps.Circle({
          strokeColor: circleColor,
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: circleColor,
          fillOpacity: 0.15,
          map,
          center: { lat: location.latitude, lng: location.longitude },
          radius: 200,
        });
        signalCirclesRef.current.push(circle);
      }

      const statusLabel = location.status || "Active";
      const statusColor =
        statusLabel === "resolved"
          ? "#22c55e"
          : statusLabel === "dispatched"
            ? "#f59e0b"
            : "#ef4444";

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="color: black; padding: 5px; min-width: 200px; font-family: sans-serif;">
            <h3 style="margin-top: 0; color: #d93025; font-size: 16px;">🚨 Distress Signal</h3>
            <div style="font-size: 13px; line-height: 1.5;">
              <p style="margin: 4px 0;"><strong>UID:</strong> ${location.userId || location.signalId || "N/A"}</p>
              <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${location.timestamp ? new Date(location.timestamp).toLocaleString() : "N/A"}</p>
              <p style="margin: 4px 0;"><strong>Device Build:</strong> ${location.buildNumber || "Unknown"}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold; text-transform: capitalize;">${statusLabel}</span></p>
              <p style="margin: 4px 0; font-size: 11px; color: #5f6368;">Lat: ${location.latitude}, Lng: ${location.longitude}</p>
            </div>
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open({ anchor: marker, map });
      });
    });
  }, [map, locations]);

  // Plot admin markers — type-specific colors, clear old ones first
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear ALL old admin markers
    adminMarkersRef.current.forEach((m) => m.setMap(null));
    adminMarkersRef.current = [];

    if (add.length === 0) return;

    // Type → icon color mapping
    const typeColors = {
      police: "blue",
      ndrf: "blue",
      crpf: "blue",
      rpf: "blue",
      hospital: "orange",
      firedepartment: "yellow",
    };
    const typeEmoji = {
      police: "🚔",
      ndrf: "🛡️",
      crpf: "🛡️",
      rpf: "🛡️",
      hospital: "🏥",
      firedepartment: "🚒",
    };

    let geocoder = null; // lazy init only if needed

    add.forEach((admin) => {
      const color = typeColors[admin.type] || "blue";
      const emoji = typeEmoji[admin.type] || "🛡️";

      const placeAdminMarker = (position) => {
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: `${admin.deptname || admin.type || "Department"}`,
          icon: `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`,
        });
        adminMarkersRef.current.push(marker);

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="color: black; padding: 5px; min-width: 150px; font-family: sans-serif;">
              <h3 style="margin-top: 0; font-size: 15px;">${emoji} ${admin.deptname || "Department"}</h3>
              <div style="font-size: 13px; line-height: 1.5;">
                <p style="margin: 4px 0;"><strong>Type:</strong> <span style="text-transform: capitalize;">${admin.type || "N/A"}</span></p>
                <p style="margin: 4px 0;"><strong>Address:</strong> ${admin.address || "N/A"}</p>
                ${admin.commanderName ? `<p style="margin: 4px 0;"><strong>Commander:</strong> ${admin.commanderName}</p>` : ""}
                ${admin.contactPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${admin.contactPhone}</p>` : ""}
                ${admin.personnelCount ? `<p style="margin: 4px 0;"><strong>Personnel:</strong> ${admin.personnelCount}</p>` : ""}
                ${admin.isNdrfCrpf ? '<p style="margin: 4px 0; color: green; font-weight: bold;">NDRF/CRPF Certified</p>' : ""}
              </div>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open({ anchor: marker, map });
        });
      };

      // Prefer stored lat/lng (instant), fallback to geocoding (slow)
      const lat = parseFloat(admin.latitude);
      const lng = parseFloat(admin.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        placeAdminMarker({ lat, lng });
      } else if (admin.address && admin.address.trim() !== "") {
        if (!geocoder) geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: admin.address }, (results, status) => {
          if (status === "OK" && results[0]) {
            placeAdminMarker(results[0].geometry.location);
          } else {
            console.warn(
              `Geocode failed for: ${admin.address}, status: ${status}`,
            );
          }
        });
      }
    });
  }, [map, add]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "400px" }}>
      <style>{`
        .mpp {
          width: 100%;
          height: 100%;
          min-height: 400px;
        }
        .mpp .gm-bundled-control,
        .mpp .gmnoprint,
        .mpp .gm-fullscreen-control,
        .mpp .gm-style-cc,
        .mpp .gm-style a[href^="https://maps.google.com"],
        .mpp .gm-style a[title="Report errors in the road map or imagery to Google"] {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `}</style>
      <div
        ref={mapRef}
        className="mpp"
        style={{ width: "100%", height: "100%", minHeight: "400px" }}
      ></div>
    </div>
  );
};

export default MapComponent;
