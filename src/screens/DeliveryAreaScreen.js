import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import {
  MapPin,
  ChevronLeft,
  Sliders,
  Compass,
  Plus,
  Minus,
  Map,
  X,
  Check,
} from 'lucide-react-native';
import MapView, { Marker, Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import Toast from 'react-native-toast-message';
import { useTranslation } from '../constants/translations';

const { width } = Dimensions.get('window');

// Surat default coordinates
const DEFAULT_SHOP_LOC = {
  latitude: 21.2401,
  longitude: 72.8735,
};


/**
 * Reads a shop's pin + delivery zone off the GET /owner/shop payload.
 *
 * The API returns `lat`/`lng` and a `delivery_zone` of
 * { method: 'radius'|'polygon', radius_m, ring }. The mock used
 * latitude/longitude/delivery_boundary_type/delivery_radius_km/delivery_polygon,
 * and every one of those resolved to undefined against the real API — which is
 * how a saved pin silently reverted to DEFAULT_SHOP_LOC.
 */
const geofenceFromShop = (shop) => {
  const lat = Number(shop?.lat);
  const lng = Number(shop?.lng);
  const zone = shop?.delivery_zone || {};

  // A ring is [[lng, lat], ...] and the server closes it, so the repeated final
  // point is dropped before it becomes an editable vertex.
  const ring = Array.isArray(zone.ring) ? zone.ring : [];
  const openRing =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  return {
    shopLoc:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { latitude: lat, longitude: lng }
        : DEFAULT_SHOP_LOC,
    boundaryMode: zone.method === 'polygon' ? 'custom' : 'radius',
    radiusKm: zone.radius_m ? zone.radius_m / 1000 : 3.0,
    customPoints:
      openRing.length >= 3
        ? openRing.map(([lngVal, latVal]) => ({ latitude: latVal, longitude: lngVal }))
        : [],
  };
};

const getCirclePoints = (latitude, longitude, radiusKm) => {
  if (!latitude || !longitude || !radiusKm) return [];
  const points = 32;
  const coords = [];
  const distance = radiusKm / 6371; 
  
  const latRad = (latitude * Math.PI) / 180;
  const lngRad = (longitude * Math.PI) / 180;
  
  for (let i = 0; i < points; i++) {
    const theta = (i * 2 * Math.PI) / points;
    const lat = Math.asin(Math.sin(latRad) * Math.cos(distance) + Math.cos(latRad) * Math.sin(distance) * Math.cos(theta));
    const lng = lngRad + Math.atan2(Math.sin(theta) * Math.sin(distance) * Math.cos(latRad), Math.cos(distance) - Math.sin(latRad) * Math.sin(lat));
    
    coords.push({
      latitude: (lat * 180) / Math.PI,
      longitude: (lng * 180) / Math.PI,
    });
  }
  return coords;
};

const RADIUS_OPTIONS = [
  { label: '500m', value: 0.5 },
  { label: '1 km', value: 1.0 },
  { label: '2 km', value: 2.0 },
  { label: '3 km', value: 3.0 },
  { label: '5 km', value: 5.0 },
  { label: '7 km', value: 7.0 },
  { label: '10 km', value: 10.0 },
  { label: '15 km', value: 15.0 },
  { label: '20 km', value: 20.0 },
];

const makeCircleGeoJson = (latitude, longitude, radiusKm) => {
  if (!latitude || !longitude || !radiusKm) return null;
  const points = 64;
  const coords = [];
  const distance = radiusKm / 6371; 
  
  const latRad = (latitude * Math.PI) / 180;
  const lngRad = (longitude * Math.PI) / 180;
  
  for (let i = 0; i < points; i++) {
    const theta = (i * 2 * Math.PI) / points;
    const lat = Math.asin(Math.sin(latRad) * Math.cos(distance) + Math.cos(latRad) * Math.sin(distance) * Math.cos(theta));
    const lng = lngRad + Math.atan2(Math.sin(theta) * Math.sin(distance) * Math.cos(latRad), Math.cos(distance) - Math.sin(latRad) * Math.sin(lat));
    
    coords.push([
      (lng * 180) / Math.PI,
      (lat * 180) / Math.PI
    ]);
  }
  coords.push(coords[0]); // Close polygon
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
        properties: {},
      },
    ],
  };
};

export const DeliveryAreaScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { shop, refreshShop } = useContext(AuthContext);
  const mapRef = useRef(null);

  // States — seeded from the shop already in context so the map opens on the
  // real pin rather than the Surat default.
  const initialGeofence = geofenceFromShop(shop);
  const [boundaryMode, setBoundaryMode] = useState(initialGeofence.boundaryMode); // 'radius' | 'custom'
  const [shopLoc, setShopLoc] = useState(initialGeofence.shopLoc);
  const [radiusKm, setRadiusKm] = useState(initialGeofence.radiusKm);

  // Initial state ref to revert changes on Reset Shape
  const initialStateRef = useRef(null);

  // Custom Boundary points state (green polygon)
  const [customPoints, setCustomPoints] = useState(initialGeofence.customPoints);

  const focusOnBoundary = (mode = boundaryMode, pts = customPoints, rad = radiusKm, loc = shopLoc) => {
    if (!mapRef.current || !loc || !loc.latitude || !loc.longitude) return;

    if (mode === 'custom' && Array.isArray(pts) && pts.length >= 3) {
      mapRef.current.fitToCoordinates(pts, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } else {
      const latDelta = (rad * 2.0) / 111;
      const lngDelta = (rad * 2.0) / (111 * Math.cos((loc.latitude * Math.PI) / 180));
      mapRef.current.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: Math.max(0.006, latDelta),
        longitudeDelta: Math.max(0.006, lngDelta),
      }, 800);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      let currentShop = shop;
      if (!currentShop || !currentShop.name) {
        try {
          const fresh = await refreshShop();
          if (fresh) currentShop = fresh;
        } catch (e) {
          console.warn('[DeliveryAreaScreen] Failed to load shop:', e);
        }
      }

      if (currentShop) {
        // Same reader as the initial state — see geofenceFromShop().
        const { shopLoc: initialShopLoc, boundaryMode: mode, radiusKm: rad, customPoints: pts } =
          geofenceFromShop(currentShop);

        setShopLoc(initialShopLoc);
        setBoundaryMode(mode);
        setRadiusKm(rad);
        setCustomPoints(pts);

        initialStateRef.current = {
          shopLoc: initialShopLoc,
          boundaryMode: mode,
          radiusKm: rad,
          customPoints: pts,
        };

        setTimeout(() => {
          focusOnBoundary(mode, pts, rad, initialShopLoc);
        }, 500);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  const handleZoom = (zoomIn) => {
    mapRef.current?.getCamera().then(cam => {
      if (cam) {
        cam.zoom = zoomIn ? (cam.zoom + 1) : (cam.zoom - 1);
        mapRef.current?.animateCamera(cam, { duration: 300 });
      }
    });
  };

  const handleRecenter = () => {
    focusOnBoundary(boundaryMode, customPoints, radiusKm, shopLoc);
  };

  const handleSelectMode = (newMode) => {
    setBoundaryMode(newMode);
    setTimeout(() => {
      focusOnBoundary(newMode, customPoints, radiusKm, shopLoc);
    }, 150);
  };

  const updateRadiusWithZoom = (newVal) => {
    setRadiusKm(newVal);
    if (mapRef.current && shopLoc.latitude && shopLoc.longitude) {
      const latDelta = (newVal * 2.0) / 111;
      const lngDelta = (newVal * 2.0) / (111 * Math.cos((shopLoc.latitude * Math.PI) / 180));
      mapRef.current.animateToRegion({
        latitude: shopLoc.latitude,
        longitude: shopLoc.longitude,
        latitudeDelta: Math.max(0.006, latDelta),
        longitudeDelta: Math.max(0.006, lngDelta),
      }, 600);
    }
  };

  // Radius adjustment
  const handleAdjustRadius = (value) => {
    const newVal = Math.max(0.5, Math.min(25, parseFloat((radiusKm + value).toFixed(1))));
    updateRadiusWithZoom(newVal);
  };

  const handleMapPress = (e) => {
    if (!e || !e.nativeEvent || !e.nativeEvent.coordinate) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;

    if (boundaryMode === 'radius') {
      setShopLoc({ latitude, longitude });
      if (mapRef.current) {
        const latDelta = (radiusKm * 2.0) / 111;
        const lngDelta = (radiusKm * 2.0) / (111 * Math.cos((latitude * Math.PI) / 180));
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: Math.max(0.006, latDelta),
          longitudeDelta: Math.max(0.006, lngDelta),
        }, 600);
      }
      Toast.show({ type: 'success', text1: t('locationSetTitle'), text2: t('locationSetSub') });
    } else {
      setCustomPoints(prev => [...prev, { latitude, longitude }]);
      Toast.show({ type: 'success', text1: t('vertexAdded'), text2: t('vertexAddedSub') });
    }
  };

  const handleVertexDrag = (index, newCoord) => {
    if (!newCoord || !newCoord.latitude || !newCoord.longitude) return;
    setCustomPoints(prev => {
      const updated = [...prev];
      updated[index] = { latitude: newCoord.latitude, longitude: newCoord.longitude };
      return updated;
    });
  };

  const handleDeletePoint = () => {
    if (customPoints.length === 0) {
      Toast.show({ type: 'info', text1: t('noVertices'), text2: t('noVerticesSub') });
      return;
    }
    setCustomPoints(prev => prev.slice(0, -1));
    Toast.show({ type: 'info', text1: t('pointRemoved'), text2: t('pointRemovedSub') });
  };

  const handleResetBoundary = () => {
    const init = initialStateRef.current || geofenceFromShop(shop);

    setShopLoc(init.shopLoc);
    setRadiusKm(init.radiusKm);
    setBoundaryMode(init.boundaryMode);
    setCustomPoints(init.customPoints);

    setTimeout(() => {
      focusOnBoundary(init.boundaryMode, init.customPoints, init.radiusKm, init.shopLoc);
    }, 100);

    Toast.show({ type: 'info', text1: t('changesReset'), text2: t('changesResetSub') });
  };

  const handleSaveAll = async () => {
    try {
      // The storefront pin is a SHOP field, not a zone field, so moving it has
      // to be persisted with PATCH /owner/shop — saving only the zone left the
      // pin wherever it was before.
      //
      // It also has to go FIRST: a radius zone is measured from the shop's own
      // location server-side, so writing the zone before the pin would centre
      // the circle on the old point. lat and lng must be sent together or the
      // server rejects the patch.
      if (
        typeof shopLoc?.latitude === 'number' &&
        typeof shopLoc?.longitude === 'number'
      ) {
        await api.shop.updateShop({ lat: shopLoc.latitude, lng: shopLoc.longitude });
      }

      // PUT /owner/shop/delivery-zone. Radius travels in METRES; a polygon ring
      // is [[lng, lat], ...] — note the order flip from the map's
      // { latitude, longitude } points — and the server closes the ring itself.
      if (boundaryMode === 'radius') {
        await api.shop.setDeliveryZone({
          method: 'radius',
          radius_m: Math.round((radiusKm || 1) * 1000),
        });
      } else {
        if ((customPoints || []).length < 3) {
          throw new Error('Tap at least 3 points on the map to define a boundary.');
        }
        await api.shop.setDeliveryZone({
          method: 'polygon',
          ring: customPoints.map((pt) => [pt.longitude, pt.latitude]),
        });
      }
      await refreshShop();
      Toast.show({
        type: 'success',
        text1: t('boundarySaved'),
        text2: t('boundarySavedSub')
      });
      // Saving is the end of the task — leaving the owner on the map made it
      // look as though nothing had happened.
      if (navigation.canGoBack()) navigation.goBack();
    } catch (e) {
      console.error('[DeliveryAreaScreen] Save failed:', e);
      Toast.show({
        type: 'error',
        text1: t('saveFailedTitle'),
        text2: e.message || 'Could not save boundary settings.'
      });
    }
  };

  // GeoJSON circles/polygons
  const circleGeoJson = useMemo(() => {
    return makeCircleGeoJson(shopLoc.latitude, shopLoc.longitude, radiusKm);
  }, [shopLoc, radiusKm]);

  const customPolygonGeoJson = useMemo(() => {
    const coords = customPoints.map(p => [p.longitude, p.latitude]);
    coords.push(coords[0]); // Close polygon
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
          properties: {},
        },
      ],
    };
  }, [customPoints]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6, height: 56 + insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color={theme.colors.textDark} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('deliveryManagement')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 140 : 100 }}>
        {/* Boundary Area method selector */}
        <Text style={styles.sectionHeader}>{t('deliveryBoundaryMethod')}</Text>
        <View style={styles.methodsRow}>
          <TouchableOpacity
            style={[styles.methodCard, boundaryMode === 'radius' && styles.methodCardActive]}
            onPress={() => handleSelectMode('radius')}
          >
            <Sliders color={boundaryMode === 'radius' ? theme.colors.primary : theme.colors.textLight} size={24} />
            <Text style={styles.methodTitle}>{t('radiusCircle')}</Text>
            <Text style={styles.methodDesc}>{t('radiusCircleSub')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodCard, boundaryMode === 'custom' && styles.methodCardActive]}
            onPress={() => handleSelectMode('custom')}
          >
            <Map color={boundaryMode === 'custom' ? theme.colors.primary : theme.colors.textLight} size={24} />
            <Text style={styles.methodTitle}>{t('customShape')}</Text>
            <Text style={styles.methodDesc}>{t('customShapeSub')}</Text>
          </TouchableOpacity>
        </View>

        {/* Map area */}
        <Text style={styles.sectionHeader}>{t('geofenceBoundMap')}</Text>
        <View style={styles.mapContainer}>
          <MapView 
            ref={mapRef}
            style={styles.mapView}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: shopLoc.latitude,
              longitude: shopLoc.longitude,
              latitudeDelta: (radiusKm * 2.6) / 111,
              longitudeDelta: (radiusKm * 2.6) / (111 * Math.cos((shopLoc.latitude * Math.PI) / 180)),
            }}
            onMapReady={() => {
              focusOnBoundary(boundaryMode, customPoints, radiusKm, shopLoc);
            }}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {/* Shop Pin Marker (Shown only in Radius Circle mode) */}
            {boundaryMode === 'radius' && (
              <Marker
                coordinate={{ latitude: shopLoc.latitude, longitude: shopLoc.longitude }}
                draggable
                onPress={(e) => handleMapPress(e)}
                onDragEnd={(e) => {
                  if (e && e.nativeEvent && e.nativeEvent.coordinate) {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setShopLoc({ latitude, longitude });
                    if (mapRef.current) {
                      const latDelta = (radiusKm * 2.0) / 111;
                      const lngDelta = (radiusKm * 2.0) / (111 * Math.cos((latitude * Math.PI) / 180));
                      mapRef.current.animateToRegion({
                        latitude,
                        longitude,
                        latitudeDelta: Math.max(0.006, latDelta),
                        longitudeDelta: Math.max(0.006, lngDelta),
                      }, 600);
                    }
                    Toast.show({ type: 'success', text1: t('storefrontPinMoved'), text2: t('storefrontPinMovedSub') });
                  }
                }}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerBubble}>
                    <MapPin color="#FFF" size={14} />
                  </View>
                  <View style={styles.markerTail} />
                </View>
              </Marker>
            )}

            {/* Radius Circle */}
            {boundaryMode === 'radius' && (
              <Circle
                center={{ latitude: shopLoc.latitude, longitude: shopLoc.longitude }}
                radius={radiusKm * 1000}
                strokeColor="#16A34A"
                strokeWidth={2.5}
                fillColor="rgba(22, 163, 74, 0.18)"
                tappable={true}
                onPress={handleMapPress}
              />
            )}

            {/* Custom Polygon */}
            {boundaryMode === 'custom' && customPoints.length > 0 && (
              <>
                <Polygon
                  coordinates={customPoints}
                  strokeColor="#15803D"
                  strokeWidth={3}
                  fillColor="rgba(34, 197, 94, 0.22)"
                  tappable={true}
                  onPress={handleMapPress}
                />
                {customPoints.map((pt, idx) => (
                  <Marker
                    key={idx.toString()}
                    coordinate={pt}
                    draggable
                    onDragEnd={(e) => handleVertexDrag(idx, e.nativeEvent.coordinate)}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={styles.vertexDot}>
                      <Text style={styles.vertexText}>{idx + 1}</Text>
                    </View>
                  </Marker>
                ))}
              </>
            )}
          </MapView>

          {/* Map Controls */}
          <View style={styles.mapOverlayControls}>
            <TouchableOpacity style={styles.mapControlBtn} onPress={() => handleZoom(true)}>
              <Plus color={theme.colors.textDark} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mapControlBtn, { marginTop: 6 }]} onPress={() => handleZoom(false)}>
              <Minus color={theme.colors.textDark} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mapControlBtn, { marginTop: 6 }]} onPress={handleRecenter}>
              <Compass color={theme.colors.primary} size={20} />
            </TouchableOpacity>
          </View>

          {boundaryMode === 'radius' ? (
            <View style={styles.radiusFloatBadge}>
              <Text style={styles.radiusFloatText}>Radius: {radiusKm} km</Text>
            </View>
          ) : (
            <View style={styles.radiusFloatBadge}>
              <Text style={styles.radiusFloatText}>{customPoints.length} Geofence Vertices</Text>
            </View>
          )}
        </View>

        {/* Dynamic Controls based on Boundary Method */}
        {boundaryMode === 'radius' ? (
          <View style={styles.configCard}>
            <Text style={styles.configHeader}>{t('selectRadiusLimit')}</Text>
            <View style={styles.sliderRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustRadius(-0.5)}>
                <Minus color="#FFF" size={16} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.sliderTrackContainer}
                onPress={(evt) => {
                  const x = evt.nativeEvent.locationX;
                  // estimated track container width
                  const trackWidth = width - 110;
                  const pct = Math.max(0, Math.min(1, x / trackWidth));
                  // map to 0.5km - 20km range
                  const calculated = Math.max(0.5, Math.min(20, Math.round((0.5 + pct * 19.5) * 2) / 2));
                  updateRadiusWithZoom(calculated);
                }}
              >
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderTrackFill, { width: `${((radiusKm - 0.5) / 19.5) * 100}%` }]} />
                  <View style={[styles.sliderThumb, { left: `${Math.max(0, Math.min(94, ((radiusKm - 0.5) / 19.5) * 100))}%` }]} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustRadius(0.5)}>
                <Plus color="#FFF" size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.chipsRow}>
              {RADIUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, radiusKm === opt.value && styles.chipActive]}
                  onPress={() => updateRadiusWithZoom(opt.value)}
                >
                  <Text style={[styles.chipText, radiusKm === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.coverageBox}>
              <Text style={styles.coverageLabel}>{t('estimatedCoverage')}</Text>
              <Text style={styles.coverageValue}>~{(Math.PI * radiusKm * radiusKm).toFixed(1)} sq. km</Text>
            </View>
          </View>
        ) : (
          <View style={styles.configCard}>
            <Text style={styles.configHeader}>{t('polygonVerticesEditor')}</Text>
            <Text style={styles.configDesc}>{t('polygonEditorHint')}</Text>
            
            <View style={styles.editorActionsGrid}>
              <TouchableOpacity style={styles.editorActionBtn} onPress={handleDeletePoint}>
                <Minus size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.editorActionText, { color: theme.colors.error }]}>{t('deleteLastPoint')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editorActionBtn} onPress={handleResetBoundary}>
                <X size={16} color={theme.colors.textLight} style={{ marginRight: 6 }} />
                <Text style={styles.editorActionText}>{t('resetShape')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Save Button */}
      <View style={[styles.stickySaveContainer, { paddingBottom: Platform.OS === 'android' ? 64 : Math.max(insets.bottom + 16, 28) }]}>
        <TouchableOpacity style={styles.saveAllBtn} onPress={handleSaveAll}>
          <Check color="#FFF" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.saveAllText}>{t('saveBoundarySettings')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  scrollContent: {
    padding: theme.spacing.m,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '850',
    color: theme.colors.textLight,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
  locationOptionsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  locationTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  locationTabActive: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  locationTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  locationTabTextActive: {
    color: theme.colors.primary,
  },
  shopDetailBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  detailTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shopNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  shopAddressText: {
    fontSize: 13,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  coordsGrid: {
    flexDirection: 'row',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  coordCol: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  coordVal: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 2,
  },
  mapContainer: {
    height: 380,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  mapView: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E53935',
  },
  vertexDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  vertexText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  mapOverlayControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  mapControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  radiusFloatBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
  },
  radiusFloatText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  methodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  methodCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    ...theme.shadows.soft,
  },
  methodCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginTop: 10,
  },
  methodDesc: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 4,
    lineHeight: 14,
  },
  configCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  configHeader: {
    fontSize: 14,
    fontWeight: '850',
    color: theme.colors.textDark,
  },
  configDesc: {
    fontSize: 12,
    color: theme.colors.textLight,
    fontWeight: '700',
    marginTop: 2,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    position: 'relative',
  },
  sliderTrackFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  chipTextActive: {
    color: '#FFF',
  },
  coverageBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 12,
  },
  coverageLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  coverageValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  editorActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  editorActionBtn: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  editorActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  checkerRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  checkerInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  checkBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '850',
  },
  resultBox: {
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  resultSuccess: {
    backgroundColor: '#DCFCE7',
  },
  resultSuccessText: {
    color: '#15803D',
  },
  resultFailed: {
    backgroundColor: '#FEE2E2',
  },
  resultFailedText: {
    color: theme.colors.error,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pricingCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  pricingGroupTitle: {
    fontSize: 13,
    fontWeight: '850',
    color: theme.colors.textDark,
    marginBottom: 10,
  },
  pricingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pricingCol: {
    width: '30%',
  },
  pricingInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  pricingInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  pricingDivider: {
    height: 1.5,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },
  togglesCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.roundness,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
    ...theme.shadows.soft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  toggleSub: {
    fontSize: 11,
    color: theme.colors.textLight,
    marginTop: 2,
    fontWeight: '700',
  },
  timeScheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '850',
    color: theme.colors.textLight,
    textTransform: 'uppercase',
  },
  timeInput: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 4,
    textAlign: 'center',
    paddingVertical: 0,
  },
  stickySaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1.5,
    borderTopColor: theme.colors.border,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  saveAllBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  saveAllText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '850',
  },
});
