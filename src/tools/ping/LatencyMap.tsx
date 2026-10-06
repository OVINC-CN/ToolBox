import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import type { FeatureCollection, Polygon } from 'geojson';
import landSnapshot from './land-110m.json';
import { alignWorldCoordinates, buildRoutes, greatCirclePoints, latencyBand, longitudeNear, type Route } from './model';
import { regionName, type Region } from './regions';

// Natural Earth v5.1.2, 1:110m land polygons; public domain.
// https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson
const LAND: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: landSnapshot.features.map(feature => ({
    type: 'Feature',
    properties: feature.properties,
    geometry: { type: 'Polygon', coordinates: feature.geometry.coordinates },
  })),
};
const WORLD_BOUNDS = L.latLngBounds([-90, 0], [90, 360]);
const WORLD_OFFSETS = [0, -360, 360];
const WORLD_PADDING = L.point(24, 36);
const ROUTE_PADDING = L.point(70, 80);
const ROUTE_COLORS = { low: '#70d9b3', medium: '#f0c780', high: '#9dbafa' };
const NODE_COLOR = '#c6a5fa';
const LABEL_SEGMENTER = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });

export type MapViewRequest = { kind: 'world' } | {
  kind: 'routes';
  regions: readonly Region[];
};

interface MapProps {
  regions: readonly Region[];
  routes: readonly Route[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  viewRequest: MapViewRequest;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Label {
  marker: L.Marker;
  leader: L.Polyline;
  anchors: L.LatLng[];
  width: number;
  height: number;
  isNode: boolean;
}

function updateMinimumZoom(map: L.Map): number {
  // getBoundsZoom clamps to the current minimum; clear it before recalculating.
  map.setMinZoom(-3);
  const size = map.getSize();
  const padding = WORLD_PADDING.multiplyBy(2);
  const minimumZoom = size.x > padding.x && size.y > padding.y
    ? map.getBoundsZoom(WORLD_BOUNDS, false, padding)
    : -3;
  map.setMinZoom(minimumZoom);
  return minimumZoom;
}

function showWorld(map: L.Map) {
  map.setView(WORLD_BOUNDS.getCenter(), updateMinimumZoom(map), { animate: false });
}

function overlapArea(first: Box, second: Box): number {
  return Math.max(0, Math.min(first.x + first.width + 5, second.x + second.width + 5) - Math.max(first.x, second.x))
    * Math.max(0, Math.min(first.y + first.height + 4, second.y + second.height + 4) - Math.max(first.y, second.y));
}

function textWidth(text: string): number {
  let width = 16;
  for (const { segment } of LABEL_SEGMENTER.segment(text)) {
    width += segment.charCodeAt(0) > 255 ? 11 : 6.7;
  }
  return Math.ceil(width);
}

function placeLabel(anchors: L.Point[], label: Label, size: L.Point, occupied: Box[]): { box: Box; anchor: L.Point } {
  const firstAnchor = anchors.at(0) ?? L.point(size.x / 2, size.y / 2);
  let best = { box: { x: firstAnchor.x, y: firstAnchor.y, width: label.width, height: label.height }, anchor: firstAnchor };
  let bestScore = Infinity;
  const verticalSteps = label.isNode ? [0, -24, 24, -48, 48, -72, 72, -96, 96, -120, 120, -160, 160] : [0, -28, 28, -56, 56, -84, 84, -112, 112, -154, 154, -196, 196, -252, 252];
  for (const anchor of anchors) {
    for (const vertical of verticalSteps) {
      const horizontalSteps = label.isNode ? [12, -label.width - 12] : [-label.width / 2, 24, -label.width - 24, 80, -label.width - 80];
      for (const horizontal of horizontalSteps) {
        const box = {
          x: Math.max(8, Math.min(size.x - label.width - 8, anchor.x + horizontal)),
          y: Math.max(46, Math.min(size.y - label.height - 26, anchor.y - label.height / 2 + vertical)),
          width: label.width,
          height: label.height,
        };
        const overlap = occupied.reduce((area, other) => area + overlapArea(box, other), 0);
        if (overlap === 0) {
          return { box, anchor };
        }
        const score = overlap * 100 + Math.hypot(box.x - anchor.x, box.y - anchor.y);
        if (score < bestScore) {
          best = { box, anchor };
          bestScore = score;
        }
      }
    }
  }
  return best;
}

function createLabel(layer: L.LayerGroup, element: HTMLElement, anchors: L.LatLng[], color: string, isNode: boolean, focused = false): Label {
  const width = textWidth(element.textContent);
  const height = isNode ? 22 : 24;
  const marker = L.marker(anchors.at(0) ?? [0, 180], {
    icon: L.divIcon({ html: element, className: 'ping-label-icon', iconSize: [width, height], iconAnchor: [0, 0] }),
    keyboard: false,
    interactive: false,
    opacity: 0,
    zIndexOffset: focused ? 1500 : isNode ? 800 : 400,
  }).addTo(layer);
  const leader = L.polyline([], { pane: 'ping-leaders', color, weight: 0.8, opacity: 0.55, interactive: false }).addTo(layer);
  return { marker, leader, anchors, width, height, isNode };
}

function layoutLabels(map: L.Map, labels: Label[]) {
  const size = map.getSize();
  if (size.x === 0 || size.y === 0) {
    return;
  }
  const occupied: Box[] = [
    { x: 8, y: 8, width: 180, height: 27 },
    { x: 8, y: size.y - 89, width: 42, height: 80 },
    { x: size.x - 190, y: size.y - 22, width: 190, height: 22 },
  ];
  for (const label of labels) {
    const anchors = label.anchors.map(anchor => map.latLngToContainerPoint(anchor))
      .filter(anchor => anchor.x >= 4 && anchor.x <= size.x - 4 && anchor.y >= 4 && anchor.y <= size.y - 4);
    if (anchors.length === 0) {
      label.marker.setOpacity(0);
      label.leader.setLatLngs([]);
      continue;
    }
    const { box, anchor } = placeLabel(anchors, label, size, occupied);
    occupied.push(box);
    label.marker.setLatLng(map.containerPointToLatLng([box.x, box.y])).setOpacity(1);
    const end = L.point(Math.max(box.x, Math.min(box.x + box.width, anchor.x)), Math.max(box.y, Math.min(box.y + box.height, anchor.y)));
    label.leader.setLatLngs([map.containerPointToLatLng(anchor), map.containerPointToLatLng(end)]);
  }
}

export default function LatencyMap({ regions, routes, focusedId, onFocus, viewRequest }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const map = L.map(container, {
      // Keep shortest great-circle paths without Mercator's polar stretching.
      crs: L.CRS.EPSG4326,
      center: WORLD_BOUNDS.getCenter(),
      zoom: 0,
      minZoom: -3,
      maxZoom: 7,
      zoomSnap: 0,
      zoomDelta: 0.5,
      zoomControl: false,
      maxBounds: L.latLngBounds([-90, -180], [90, 540]),
      maxBoundsViscosity: 0.8,
    });
    mapRef.current = map;
    for (const [name, zIndex] of [['ping-land', 210], ['ping-grid', 220], ['ping-routes', 350], ['ping-leaders', 410], ['ping-nodes', 430]] as const) {
      map.createPane(name).style.zIndex = String(zIndex);
    }
    for (const offset of WORLD_OFFSETS) {
      L.geoJSON(LAND, {
        pane: 'ping-land',
        coordsToLatLng: coordinates => L.latLng(coordinates[1], coordinates[0] + offset),
        style: { color: '#344f5d', weight: 0.75, fillColor: '#1d3543', fillOpacity: 1, interactive: false },
      }).addTo(map);
    }
    for (let longitude = -180; longitude <= 540; longitude += 30) {
      L.polyline([[-90, longitude], [90, longitude]], { pane: 'ping-grid', color: '#436170', opacity: 0.14, weight: 0.7, interactive: false }).addTo(map);
    }
    for (let latitude = -90; latitude <= 90; latitude += 15) {
      L.polyline([[latitude, -180], [latitude, 540]], { pane: 'ping-grid', color: '#436170', opacity: 0.14, weight: 0.7, interactive: false }).addTo(map);
    }
    L.control.zoom({ position: 'bottomleft', zoomInTitle: '放大地图', zoomOutTitle: '缩小地图' }).addTo(map);
    map.attributionControl.addAttribution('<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>');
    const resizeObserver = new ResizeObserver(() => {
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }
      const atMinimumZoom = Math.abs(map.getZoom() - map.getMinZoom()) < 1e-6;
      map.invalidateSize({ pan: false });
      const minimumZoom = updateMinimumZoom(map);
      if (atMinimumZoom) {
        map.setView(WORLD_BOUNDS.getCenter(), minimumZoom, { animate: false });
      }
    });
    resizeObserver.observe(container);
    let restorationFrame: number | null = null;
    const restoreView = () => {
      if (restorationFrame !== null) {
        window.cancelAnimationFrame(restorationFrame);
      }
      restorationFrame = window.requestAnimationFrame(() => {
        restorationFrame = null;
        map.invalidateSize({ pan: false });
        // Leaflet 1.9.4 accepts reset to rebuild even an unchanged cached view.
        const resetOptions = { animate: false, reset: true };
        map.setView(map.getCenter(), map.getZoom(), resetOptions);
      });
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        restoreView();
      }
    };
    window.addEventListener('pageshow', restoreView);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pageshow', restoreView);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (restorationFrame !== null) {
        window.cancelAnimationFrame(restorationFrame);
      }
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const layer = L.layerGroup().addTo(map);
    const labels: Label[] = [];
    const nodes: { region: Region; element: HTMLSpanElement }[] = [];

    for (const region of regions) {
      const active = !focusedId || routes.some(route => route.id === focusedId && [route.source.code, route.target.code].includes(region.code));
      for (const offset of WORLD_OFFSETS) {
        L.circleMarker([region.latitude, longitudeNear(region.longitude) + offset], {
          pane: 'ping-nodes',
          radius: 5,
          color: NODE_COLOR,
          weight: 1.5,
          fillColor: NODE_COLOR,
          fillOpacity: active ? 1 : 0.4,
          opacity: active ? 1 : 0.55,
        }).bindTooltip(region.code, { direction: 'top' }).addTo(layer);
      }
      const element = document.createElement('span');
      element.className = 'ping-node-label';
      element.textContent = region.code;
      element.title = region.code;
      nodes.push({ region, element });
    }

    const sortedRoutes = [...routes].sort((first, second) => Number(second.id === focusedId) - Number(first.id === focusedId));
    const routeLabels: Label[] = [];
    for (const route of sortedRoutes) {
      const points = greatCirclePoints(route.source, route.target);
      const focused = route.id === focusedId;
      const minimumRtt = route.estimate.minRttMs;
      const color = ROUTE_COLORS[latencyBand(minimumRtt)];
      const opacity = focusedId ? focused ? 1 : 0.22 : 0.7;
      for (const offset of WORLD_OFFSETS) {
        const routePoints = points.map(([latitude, longitude]) => L.latLng(latitude, longitude + offset));
        const path = L.polyline(routePoints, {
          pane: 'ping-routes',
          color,
          weight: focused ? 2.8 : 1.4,
          opacity,
          className: `ping-route-path${focused ? ' is-focused' : ''}`,
        }).addTo(layer);
        path.on('click', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event.originalEvent);
          onFocus(route.id);
        });
        if (focused) {
          path.bringToFront();
        }
      }
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `ping-route-label label-${latencyBand(minimumRtt)}${focused ? ' is-focused' : ''}`;
      element.textContent = `≈ ${minimumRtt} ms`;
      element.dataset.routeId = route.id;
      element.setAttribute('aria-pressed', String(focused));
      element.setAttribute('aria-label', `${regionName(route.source)}${route.bidirectional ? '与' : '到'}${regionName(route.target)}，预估最小 RTT ${minimumRtt} 毫秒`);
      element.title = `${route.source.code} ${route.bidirectional ? '↔' : '→'} ${route.target.code}\n预估最小 RTT ${minimumRtt} ms\n模型区间 ${route.estimate.minRttMs}–${route.estimate.maxRttMs} ms`;
      L.DomEvent.disableClickPropagation(element);
      L.DomEvent.disableScrollPropagation(element);
      element.addEventListener('click', () => {
        onFocus(route.id);
      });
      const sampleIndices = [48, 38, 58, 28, 68, 18, 78, 8, 88, ...points.map((_point, index) => index)];
      const anchors = WORLD_OFFSETS.flatMap(offset => sampleIndices.flatMap((index) => {
        const point = points.at(index);
        return point ? [L.latLng(point[0], point[1] + offset)] : [];
      }));
      routeLabels.push(createLabel(layer, element, anchors, color, false, focused));
    }

    const nodeLabels = nodes.map(({ region, element }) => createLabel(
      layer,
      element,
      WORLD_OFFSETS.map(offset => L.latLng(region.latitude, longitudeNear(region.longitude) + offset)),
      NODE_COLOR,
      true,
    ));
    labels.push(...nodeLabels, ...routeLabels);
    let frame: number | null = null;
    let active = true;
    const scheduleLayout = () => {
      if (frame !== null) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        layoutLabels(map, labels);
      });
    };
    // Leaflet markers and leaders follow pan/zoom natively; recompute collisions at rest.
    map.on('moveend zoomend resize', scheduleLayout);
    scheduleLayout();
    void document.fonts.ready.then(() => {
      if (active) {
        scheduleLayout();
      }
    });
    return () => {
      active = false;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      map.off('moveend zoomend resize', scheduleLayout);
      layer.remove();
    };
  }, [regions, routes, focusedId, onFocus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    if (viewRequest.kind === 'world') {
      showWorld(map);
      return;
    }
    const viewRoutes = buildRoutes(viewRequest.regions, viewRequest.regions);
    const coordinates = viewRoutes.flatMap(route => greatCirclePoints(route.source, route.target));
    if (coordinates.length === 0) {
      const regions = viewRequest.regions;
      if (regions.length === 0) {
        showWorld(map);
        return;
      }
      coordinates.push(...regions.map((region): [number, number] => [region.latitude, longitudeNear(region.longitude)]));
    }
    map.fitBounds(L.latLngBounds(alignWorldCoordinates(coordinates)), { padding: ROUTE_PADDING, maxZoom: 6, animate: false });
  }, [viewRequest]);

  return (
    <div className="ping-map-wrap">
      <div ref={containerRef} className="ping-map" role="region" aria-label="全球地区与预估最小网络延迟地图" />
      <div className="map-coordinate-note" aria-hidden="true">
        <span>GREAT CIRCLE</span>
        <span>EST. MIN RTT</span>
      </div>
    </div>
  );
}
