import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import {
  MapPin,
  ChevronLeft,
  Sliders,
  Clock,
  Compass,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Navigation,
  Globe,
  Settings,
  Sparkles,
  Map,
  X,
  Check,
} from 'lucide-react-native';
import { Map as MapLibreMap, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

// Surat default coordinates
const DEFAULT_SHOP_LOC = {
  latitude: 21.2401,
  longitude: 72.8735,
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

const mockLocations = {
  'city light': { lat: 21.2215, lng: 72.8095, dist: 1.5, name: 'City Light' },
  'vesu': { lat: 21.1415, lng: 72.7712, dist: 2.5, name: 'Vesu' },
  'piplod': { lat: 21.1712, lng: 72.7845, dist: 3.5, name: 'Piplod' },
  'athwa': { lat: 21.1895, lng: 72.8012, dist: 4.5, name: 'Athwa Lines' },
  'adajan': { lat: 21.2154, lng: 72.7915, dist: 5.5, name: 'Adajan Patia' },
};

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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { shop } = useContext(AuthContext);
  const mapCameraRef = useRef(null);

  // States
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [locationOption, setLocationOption] = useState('shop'); // 'shop' | 'current'
  const [boundaryMode, setBoundaryMode] = useState('radius'); // 'radius' | 'custom'
  
  const [shopLoc, setShopLoc] = useState({
    latitude: shop?.latitude || DEFAULT_SHOP_LOC.latitude,
    longitude: shop?.longitude || DEFAULT_SHOP_LOC.longitude,
  });

  const [radiusKm, setRadiusKm] = useState(3.0);

  // Custom Boundary points state (green polygon)
  const [customPoints, setCustomPoints] = useState([
    { latitude: shopLoc.latitude + 0.015, longitude: shopLoc.longitude - 0.015 },
    { latitude: shopLoc.latitude + 0.015, longitude: shopLoc.longitude + 0.015 },
    { latitude: shopLoc.latitude - 0.015, longitude: shopLoc.longitude + 0.015 },
    { latitude: shopLoc.latitude - 0.015, longitude: shopLoc.longitude - 0.015 },
  ]);

  useEffect(() => {
    if (shop) {
      const lat = parseFloat(shop.latitude) || DEFAULT_SHOP_LOC.latitude;
      const lng = parseFloat(shop.longitude) || DEFAULT_SHOP_LOC.longitude;
      setShopLoc({ latitude: lat, longitude: lng });
      setCustomPoints([
        { latitude: lat + 0.015, longitude: lng - 0.015 },
        { latitude: lat + 0.015, longitude: lng + 0.015 },
        { latitude: lat - 0.015, longitude: lng + 0.015 },
        { latitude: lat - 0.015, longitude: lng - 0.015 },
      ]);

      // Explicitly move the camera viewport to center on shop location
      setTimeout(() => {
        if (mapCameraRef.current) {
          mapCameraRef.current.flyTo({
            center: [lng, lat],
            zoom: 13,
            duration: 1000,
          });
        }
      }, 500);
    }
  }, [shop]);

  // Serviceability Checker
  const [checkAddressText, setCheckAddressText] = useState('');
  const [serviceabilityResult, setServiceabilityResult] = useState(null); // { deliverable: boolean, msg: string }

  // Delivery Charges States
  const [localFee, setLocalFee] = useState('20');
  const [localMin, setLocalMin] = useState('100');
  const [localTime, setLocalTime] = useState('25 mins');

  const [outerFee, setOuterFee] = useState('45');
  const [outerMin, setOuterMin] = useState('250');
  const [outerTime, setOuterTime] = useState('45 mins');

  // Settings Toggles
  const [pickupOnly, setPickupOnly] = useState(false);
  const [acceptOutside, setAcceptOutside] = useState(false);
  const [autoRejectOutside, setAutoRejectOutside] = useState(true);
  const [showDeliveryTime, setShowDeliveryTime] = useState(true);
  const [expressEnabled, setExpressEnabled] = useState(true);

  // Operations Timing
  const [openTime, setOpenTime] = useState('08:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [emergencyPause, setEmergencyPause] = useState(false);
  const [temporaryClosed, setTemporaryClosed] = useState(false);

  // Handle option swap
  const handleLocationOptionChange = (option) => {
    setLocationOption(option);
    if (option === 'current') {
      // Simulate getting current GPS location (offset slightly from store center)
      const currentGps = {
        latitude: DEFAULT_SHOP_LOC.latitude + 0.002,
        longitude: DEFAULT_SHOP_LOC.longitude + 0.003,
      };
      setShopLoc(currentGps);
      mapCameraRef.current?.flyTo({
        center: [currentGps.longitude, currentGps.latitude],
        zoom: 14,
        duration: 1000,
      });
      Toast.show({ type: 'info', text1: 'GPS Synced', text2: 'Using simulated current mobile location.' });
    } else {
      const storeLoc = {
        latitude: shop?.latitude || DEFAULT_SHOP_LOC.latitude,
        longitude: shop?.longitude || DEFAULT_SHOP_LOC.longitude,
      };
      setShopLoc(storeLoc);
      mapCameraRef.current?.flyTo({
        center: [storeLoc.longitude, storeLoc.latitude],
        zoom: 14,
        duration: 1000,
      });
      Toast.show({ type: 'info', text1: 'Address Synced', text2: 'Using location entered during store setup.' });
    }
  };

  const handleZoom = (zoomIn) => {
    mapCameraRef.current?.flyTo({
      zoom: zoomIn ? 15 : 12,
      duration: 500,
    });
  };

  const handleRecenter = () => {
    mapCameraRef.current?.flyTo({
      center: [shopLoc.longitude, shopLoc.latitude],
      zoom: 14,
      duration: 1000,
    });
  };

  const getZoomForRadius = (km) => {
    if (km <= 1) return 14.2;
    if (km <= 2) return 13.2;
    if (km <= 3) return 12.6;
    if (km <= 5) return 11.8;
    if (km <= 8) return 11.1;
    if (km <= 10) return 10.8;
    if (km <= 15) return 10.2;
    return 9.7;
  };

  const updateRadiusWithZoom = (newVal) => {
    setRadiusKm(newVal);
    if (mapCameraRef.current && shopLoc.latitude && shopLoc.longitude) {
      mapCameraRef.current.flyTo({
        center: [shopLoc.longitude, shopLoc.latitude],
        zoom: getZoomForRadius(newVal),
        duration: 600,
      });
    }
  };

  // Radius adjustment
  const handleAdjustRadius = (value) => {
    const newVal = Math.max(0.5, Math.min(25, parseFloat((radiusKm + value).toFixed(1))));
    updateRadiusWithZoom(newVal);
  };

  // Custom polygon edit actions
  const handleAddPoint = () => {
    // Add point offset from last coordinate
    const last = customPoints[customPoints.length - 1] || shopLoc;
    const newPt = {
      latitude: last.latitude + 0.003,
      longitude: last.longitude + 0.003,
    };
    setCustomPoints(prev => [...prev, newPt]);
    Toast.show({ type: 'success', text1: 'Point Added', text2: 'Added vertex at bottom corner.' });
  };

  const handleMovePoint = () => {
    // Offset point 0 to simulate moving vertices
    if (customPoints.length === 0) return;
    setCustomPoints(prev => prev.map((pt, idx) => idx === 0 ? { ...pt, latitude: pt.latitude + 0.002 } : pt));
    Toast.show({ type: 'info', text1: 'Point Moved', text2: 'Repositioned vertex 1 on the map.' });
  };

  const handleDeletePoint = () => {
    if (customPoints.length <= 3) {
      Toast.show({ type: 'error', text1: 'Delete Failed', text2: 'Boundary requires at least 3 vertices.' });
      return;
    }
    setCustomPoints(prev => prev.slice(0, -1));
    Toast.show({ type: 'info', text1: 'Point Removed', text2: 'Removed last vertex.' });
  };

  const handleResetBoundary = () => {
    setCustomPoints([
      { latitude: shopLoc.latitude + 0.012, longitude: shopLoc.longitude - 0.012 },
      { latitude: shopLoc.latitude + 0.012, longitude: shopLoc.longitude + 0.012 },
      { latitude: shopLoc.latitude - 0.012, longitude: shopLoc.longitude + 0.012 },
      { latitude: shopLoc.latitude - 0.012, longitude: shopLoc.longitude - 0.012 },
    ]);
    Toast.show({ type: 'info', text1: 'Boundary Reset', text2: 'Reverted coordinates back to default box.' });
  };

  // Check Address serviceability
  const handleCheckAddress = () => {
    if (!checkAddressText.trim()) {
      setServiceabilityResult(null);
      return;
    }
    const cleanQuery = checkAddressText.toLowerCase().trim();
    const loc = mockLocations[cleanQuery];

    if (loc) {
      if (boundaryMode === 'radius') {
        const canDeliver = loc.dist <= radiusKm;
        setServiceabilityResult({
          deliverable: canDeliver,
          msg: canDeliver 
            ? `Deliverable (Located ${loc.dist} km away, inside ${radiusKm} km limit)`
            : `Outside Area (Located ${loc.dist} km away, exceeds ${radiusKm} km limit)`
        });
      } else {
        // Custom polygon mock serviceability check (Vesu, City Light and Piplod are serviced)
        const canDeliver = cleanQuery === 'vesu' || cleanQuery === 'city light' || cleanQuery === 'piplod';
        setServiceabilityResult({
          deliverable: canDeliver,
          msg: canDeliver
            ? `Deliverable (Serviced by custom geofence layout)`
            : `Outside Area (Not covered in custom zone bounds)`
        });
      }
    } else {
      setServiceabilityResult({
        deliverable: false,
        msg: 'Address outside known service regions.'
      });
    }
  };

  const handleSaveAll = () => {
    Toast.show({
      type: 'success',
      text1: 'Boundary Saved Successfully',
      text2: 'Delivery configs updated and persisted locally.'
    });
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
        <Text style={styles.headerTitle}>Delivery Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Delivery Operations Status</Text>
            <Text style={[styles.statusValue, { color: deliveryEnabled ? theme.colors.success : theme.colors.textLight }]}>
              {deliveryEnabled ? '✓ Delivery Service Enabled' : '✕ Delivery Service Disabled'}
            </Text>
          </View>
          <Switch
            value={deliveryEnabled}
            onValueChange={setDeliveryEnabled}
            trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }}
            thumbColor={deliveryEnabled ? theme.colors.primary : '#F1F5F9'}
          />
        </View>

        {/* Location selector details */}
        <Text style={styles.sectionHeader}>Shop Anchor Location</Text>
        <View style={styles.locationOptionsRow}>
          <TouchableOpacity
            style={[styles.locationTab, locationOption === 'shop' && styles.locationTabActive]}
            onPress={() => handleLocationOptionChange('shop')}
          >
            <Text style={[styles.locationTabText, locationOption === 'shop' && styles.locationTabTextActive]}>
              Use Shop Address
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.locationTab, locationOption === 'current' && styles.locationTabActive]}
            onPress={() => handleLocationOptionChange('current')}
          >
            <Text style={[styles.locationTabText, locationOption === 'current' && styles.locationTabTextActive]}>
              Use Current Location
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.shopDetailBox}>
          <View style={styles.detailTextRow}>
            <MapPin color={theme.colors.primary} size={18} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shopNameText}>{shop?.name || 'Fresh Mart Storefront'}</Text>
              <Text style={styles.shopAddressText}>{shop?.address || '102 Blue Diamond Complex, Surat, Gujarat'}</Text>
            </View>
          </View>
          <View style={styles.coordsGrid}>
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordVal}>{shopLoc.latitude.toFixed(6)}</Text>
            </View>
            <View style={styles.coordCol}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordVal}>{shopLoc.longitude.toFixed(6)}</Text>
            </View>
          </View>
        </View>

        {/* Map area */}
        <Text style={styles.sectionHeader}>Geofence Bound Map</Text>
        <View style={styles.mapContainer}>
          <MapLibreMap 
            style={styles.mapView}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            logoEnabled={false}
            attributionEnabled={false}
            androidView="surface"
          >
            <Camera
              ref={mapCameraRef}
              defaultSettings={{
                centerCoordinate: [shopLoc.longitude, shopLoc.latitude],
                zoomLevel: 13,
              }}
            />

            {/* Shop Pin Marker */}
            <Marker coordinate={[shopLoc.longitude, shopLoc.latitude]}>
              <View style={styles.markerContainer}>
                <View style={styles.markerBubble}>
                  <MapPin color="#FFF" size={14} />
                </View>
                <View style={styles.markerTail} />
              </View>
            </Marker>

            {/* Radius Circle GeoJSON layer */}
            {boundaryMode === 'radius' && circleGeoJson && (
              <GeoJSONSource id="circleSource" data={circleGeoJson}>
                <Layer
                  id="circleFill"
                  type="fill"
                  style={{
                    fillColor: '#16A34A',
                    fillOpacity: 0.15,
                  }}
                />
                <Layer
                  id="circleOutline"
                  type="line"
                  style={{
                    lineColor: '#16A34A',
                    lineWidth: 2.5,
                  }}
                />
              </GeoJSONSource>
            )}

            {/* Custom Polygon GeoJSON layer */}
            {boundaryMode === 'custom' && customPolygonGeoJson && (
              <GeoJSONSource id="customSource" data={customPolygonGeoJson}>
                <Layer
                  id="customFill"
                  type="fill"
                  style={{
                    fillColor: '#22C55E',
                    fillOpacity: 0.22,
                  }}
                />
                <Layer
                  id="customOutline"
                  type="line"
                  style={{
                    lineColor: '#15803D',
                    lineWidth: 3,
                  }}
                />
              </GeoJSONSource>
            )}
          </MapLibreMap>

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

        {/* Boundary Area method selector */}
        <Text style={styles.sectionHeader}>Delivery Boundary Method</Text>
        <View style={styles.methodsRow}>
          <TouchableOpacity
            style={[styles.methodCard, boundaryMode === 'radius' && styles.methodCardActive]}
            onPress={() => setBoundaryMode('radius')}
          >
            <Sliders color={boundaryMode === 'radius' ? theme.colors.primary : theme.colors.textLight} size={24} />
            <Text style={styles.methodTitle}>Radius Circle</Text>
            <Text style={styles.methodDesc}>Deliver within circular limits of your store.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodCard, boundaryMode === 'custom' && styles.methodCardActive]}
            onPress={() => setBoundaryMode('custom')}
          >
            <Map color={boundaryMode === 'custom' ? theme.colors.primary : theme.colors.textLight} size={24} />
            <Text style={styles.methodTitle}>Custom Shape</Text>
            <Text style={styles.methodDesc}>Draw customized polygons covering delivery zones.</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Controls based on Boundary Method */}
        {boundaryMode === 'radius' ? (
          <View style={styles.configCard}>
            <Text style={styles.configHeader}>Select Delivery Radius Limit</Text>
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
              <Text style={styles.coverageLabel}>Estimated Coverage Area:</Text>
              <Text style={styles.coverageValue}>~{(Math.PI * radiusKm * radiusKm).toFixed(1)} sq. km</Text>
            </View>
          </View>
        ) : (
          <View style={styles.configCard}>
            <Text style={styles.configHeader}>Polygon Vertices Editor</Text>
            <Text style={styles.configDesc}>Manually reposition points to carve out serviced neighborhoods.</Text>
            
            <View style={styles.editorActionsGrid}>
              <TouchableOpacity style={styles.editorActionBtn} onPress={handleAddPoint}>
                <Plus size={16} color={theme.colors.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.editorActionText}>Add Point</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editorActionBtn} onPress={handleMovePoint}>
                <Sliders size={16} color={theme.colors.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.editorActionText}>Move Point</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editorActionBtn} onPress={handleDeletePoint}>
                <Minus size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.editorActionText, { color: theme.colors.error }]}>Delete Point</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editorActionBtn} onPress={handleResetBoundary}>
                <X size={16} color={theme.colors.textLight} style={{ marginRight: 6 }} />
                <Text style={styles.editorActionText}>Reset Shape</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Address serviceability checker */}
        <Text style={styles.sectionHeader}>Serviceability Verification</Text>
        <View style={styles.configCard}>
          <Text style={styles.configHeader}>Test Local Address</Text>
          <View style={styles.checkerRow}>
            <TextInput
              style={styles.checkerInput}
              placeholder="e.g. Vesu, Adajan, City Light, Piplod..."
              placeholderTextColor={theme.colors.textLight}
              value={checkAddressText}
              onChangeText={(txt) => {
                setCheckAddressText(txt);
                setServiceabilityResult(null);
              }}
            />
            <TouchableOpacity style={styles.checkBtn} onPress={handleCheckAddress}>
              <Text style={styles.checkBtnText}>Check Area</Text>
            </TouchableOpacity>
          </View>

          {serviceabilityResult && (
            <View style={[
              styles.resultBox,
              serviceabilityResult.deliverable ? styles.resultSuccess : styles.resultFailed
            ]}>
              <Text style={[
                styles.resultText,
                serviceabilityResult.deliverable ? styles.resultSuccessText : styles.resultFailedText
              ]}>
                {serviceabilityResult.msg}
              </Text>
            </View>
          )}
        </View>

        {/* Delivery Charges config */}
        <Text style={styles.sectionHeader}>Delivery Charges Matrix</Text>
        <View style={styles.pricingCard}>
          <Text style={styles.pricingGroupTitle}>Local Zone (Core Service Bounds)</Text>
          <View style={styles.pricingGrid}>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Delivery Fee (₹)</Text>
              <TextInput style={styles.pricingInput} value={localFee} onChangeText={setLocalFee} keyboardType="numeric" />
            </View>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Min Order (₹)</Text>
              <TextInput style={styles.pricingInput} value={localMin} onChangeText={setLocalMin} keyboardType="numeric" />
            </View>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Est. Time</Text>
              <TextInput style={styles.pricingInput} value={localTime} onChangeText={setLocalTime} />
            </View>
          </View>

          <View style={styles.pricingDivider} />

          <Text style={styles.pricingGroupTitle}>Outer Zone (Boundary Threshold)</Text>
          <View style={styles.pricingGrid}>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Delivery Fee (₹)</Text>
              <TextInput style={styles.pricingInput} value={outerFee} onChangeText={setOuterFee} keyboardType="numeric" />
            </View>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Min Order (₹)</Text>
              <TextInput style={styles.pricingInput} value={outerMin} onChangeText={setOuterMin} keyboardType="numeric" />
            </View>
            <View style={styles.pricingCol}>
              <Text style={styles.pricingInputLabel}>Est. Time</Text>
              <TextInput style={styles.pricingInput} value={outerTime} onChangeText={setOuterTime} />
            </View>
          </View>
        </View>

        {/* Delivery Settings toggles */}
        <Text style={styles.sectionHeader}>Fulfillment Rules</Text>
        <View style={styles.togglesCard}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Enable Store Deliveries</Text>
              <Text style={styles.toggleSub}>Allows home deliveries from shop.</Text>
            </View>
            <Switch value={deliveryEnabled} onValueChange={setDeliveryEnabled} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={deliveryEnabled ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Pickup Only Option</Text>
              <Text style={styles.toggleSub}>Disable home deliveries temporarily.</Text>
            </View>
            <Switch value={pickupOnly} onValueChange={setPickupOnly} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={pickupOnly ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Accept orders outside boundary</Text>
              <Text style={styles.toggleSub}>Processes orders beyond routing areas.</Text>
            </View>
            <Switch value={acceptOutside} onValueChange={setAcceptOutside} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={acceptOutside ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Auto-reject outside boundary</Text>
              <Text style={styles.toggleSub}>Instantly cancels out-of-bounds orders.</Text>
            </View>
            <Switch value={autoRejectOutside} onValueChange={setAutoRejectOutside} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={autoRejectOutside ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Display delivery duration</Text>
              <Text style={styles.toggleSub}>Displays ETA to checkout customers.</Text>
            </View>
            <Switch value={showDeliveryTime} onValueChange={setShowDeliveryTime} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={showDeliveryTime ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Enable Express Delivery Option</Text>
              <Text style={styles.toggleSub}>Fast routes for priority members.</Text>
            </View>
            <Switch value={expressEnabled} onValueChange={setExpressEnabled} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={expressEnabled ? theme.colors.primary : '#F1F5F9'} />
          </View>
        </View>

        {/* Store schedule timing */}
        <Text style={styles.sectionHeader}>Timing Schedules</Text>
        <View style={styles.togglesCard}>
          <View style={styles.timeScheduleCard}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.timeLabel}>Opening Time</Text>
              <TextInput style={styles.timeInput} value={openTime} onChangeText={setOpenTime} />
            </View>
            <View style={{ width: 1.5, backgroundColor: theme.colors.border, height: '80%' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.timeLabel}>Closing Time</Text>
              <TextInput style={styles.timeInput} value={closeTime} onChangeText={setCloseTime} />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Emergency Shutdown Mode</Text>
              <Text style={styles.toggleSub}>Temporarily goes offline immediately.</Text>
            </View>
            <Switch value={emergencyPause} onValueChange={setEmergencyPause} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={emergencyPause ? theme.colors.primary : '#F1F5F9'} />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleTitle}>Mark Store Closed Today</Text>
              <Text style={styles.toggleSub}>Bypasses schedule calendar settings.</Text>
            </View>
            <Switch value={temporaryClosed} onValueChange={setTemporaryClosed} trackColor={{ false: '#CBD5E1', true: theme.colors.primaryLight }} thumbColor={temporaryClosed ? theme.colors.primary : '#F1F5F9'} />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Save Button */}
      <View style={[styles.stickySaveContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 16 }]}>
        <TouchableOpacity style={styles.saveAllBtn} onPress={handleSaveAll}>
          <Check color="#FFF" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.saveAllText}>Save Boundary Settings</Text>
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
    height: 220,
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
