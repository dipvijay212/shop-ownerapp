import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, SafeAreaView, Platform, Dimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';
import { AuthContext } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';
import { Store, User, MapPin, Mail, ArrowLeft, Image as ImageIcon, Map, Trash2, Undo, Save, CheckCircle, Phone } from 'lucide-react-native';
import { Map as MapLibreMap, Camera, Marker, UserLocation, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getCurrentLocation } from '../../utils/location';
import { updateMockShopGeofence } from '../../mockOwnerData';

const { width, height } = Dimensions.get('window');
const CATEGORIES = ['Groceries', 'Electronics', 'Clothing', 'Pharmacy', 'Bakery', 'Stationery'];
const DEFAULT_CENTER = {
  latitude: 21.2401,
  longitude: 72.8735,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

const makeCircleGeoJson = (latitude, longitude, radiusKm) => {
  if (!latitude || !longitude || !radiusKm) return null;
  const points = 64;
  const coords = [];
  const distance = radiusKm / 6371; // Earth's radius in km
  
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
  coords.push(coords[0]);
  
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
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

export const RegisterShopScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { phone } = route.params || { phone: '9876543210' }; // pre-filled/read-only from OTP
  
  const { registerShop } = useContext(AuthContext);

  const [currentStep, setCurrentStep] = useState(1);

  // --- STEP 1: Personal Details ---
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // --- STEP 2: Shop Details ---
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('Groceries');
  const [shopAddress, setShopAddress] = useState('');
  const [bannerUri, setBannerUri] = useState(null);

  // --- STEP 3: Delivery Boundary ---
  const cameraRef = useRef(null);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [mapRegion, setMapRegion] = useState(DEFAULT_CENTER);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [boundaryMode, setBoundaryMode] = useState('polygon'); // 'polygon' or 'radius'
  const [radiusKm, setRadiusKm] = useState(5); // default 5km radius
  const [shopLocation, setShopLocation] = useState({ latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude });
  const [mapTapAction, setMapTapAction] = useState('storefront'); // 'storefront' or 'boundary'

  // --- Global States ---
  const [submitting, setSubmitting] = useState(false);

  // GeoJSON computations for MapLibre shapes
  const lineGeoJson = useMemo(() => {
    if (polygonPoints.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: polygonPoints.map(p => [p.longitude, p.latitude]),
      },
    };
  }, [polygonPoints]);

  const polygonGeoJson = useMemo(() => {
    if (polygonPoints.length < 3) return null;
    const coords = polygonPoints.map(p => [p.longitude, p.latitude]);
    // Close the polygon shape by making the last coordinate match the first
    coords.push([polygonPoints[0].longitude, polygonPoints[0].latitude]);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
  }, [polygonPoints]);

  const radiusCircleGeoJson = useMemo(() => {
    if (boundaryMode !== 'radius' || !shopLocation.latitude || !shopLocation.longitude) return null;
    return makeCircleGeoJson(shopLocation.latitude, shopLocation.longitude, radiusKm);
  }, [boundaryMode, shopLocation, radiusKm]);

  // Fetch current location on entering step 3
  useEffect(() => {
    if (currentStep === 3) {
      const fetchLocation = async () => {
        setLoadingLocation(true);
        try {
          // Check if address matches any specific location key in Surat
          const cleanAddr = shopAddress ? shopAddress.toLowerCase() : '';
          let targetCoords = null;

          if (cleanAddr.includes('dindoli')) {
            targetCoords = { latitude: 21.1610, longitude: 72.8633 };
          } else if (cleanAddr.includes('vesu')) {
            targetCoords = { latitude: 21.1415, longitude: 72.7712 };
          } else if (cleanAddr.includes('adajan')) {
            targetCoords = { latitude: 21.2154, longitude: 72.7915 };
          } else if (cleanAddr.includes('city light')) {
            targetCoords = { latitude: 21.2215, longitude: 72.8095 };
          } else if (cleanAddr.includes('piplod')) {
            targetCoords = { latitude: 21.1712, longitude: 72.7845 };
          } else if (cleanAddr.includes('athwa')) {
            targetCoords = { latitude: 21.1895, longitude: 72.8012 };
          }

          if (targetCoords) {
            // Address matched, center on target area coordinates
            const region = {
              latitude: targetCoords.latitude,
              longitude: targetCoords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            };
            setMapRegion(region);
            setShopLocation(targetCoords);
            
            if (cameraRef.current) {
              cameraRef.current.flyTo({
                center: [targetCoords.longitude, targetCoords.latitude],
                zoom: 15,
                duration: 1000
              });
            }
            Toast.show({
              type: 'success',
              text1: 'Address Located',
              text2: `Centered map on matching neighborhood: ${shopAddress}`
            });
          } else {
            // Fallback to GPS location
            const coords = await getCurrentLocation();
            const region = {
              latitude: coords.latitude,
              longitude: coords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            };
            setMapRegion(region);
            setShopLocation({ latitude: coords.latitude, longitude: coords.longitude });
            
            if (cameraRef.current) {
              cameraRef.current.flyTo({
                center: [coords.longitude, coords.latitude],
                zoom: 15,
                duration: 1000
              });
            }
          }
        } catch (e) {
          console.warn('[RegisterShop] Geolocation error, using fallback:', e);
          Toast.show({
            type: 'info',
            text1: 'Location Service',
            text2: 'Could not fetch current location. Centered on fallback Surat area.'
          });
        } finally {
          setLoadingLocation(false);
        }
      };
      fetchLocation();
    }
  }, [currentStep, shopAddress]);

  const selectBannerImage = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
    };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Toast.show({
          type: 'error',
          text1: 'Image Selector Error',
          text2: response.errorMessage || 'Failed to select image.'
        });
      } else if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        setBannerUri(uri);
      }
    });
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!ownerName.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Input Validation',
          text2: 'Please enter your full name.'
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!shopName.trim() || !shopAddress.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Input Validation',
          text2: 'Please enter both shop name and address.'
        });
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleMapPress = (event) => {
    let coord = null;
    if (event.coordinates) {
      coord = event.coordinates;
    } else if (event.nativeEvent) {
      if (event.nativeEvent.coordinate) {
        coord = [event.nativeEvent.coordinate.longitude, event.nativeEvent.coordinate.latitude];
      } else if (event.nativeEvent.coordinates) {
        coord = event.nativeEvent.coordinates;
      } else if (event.nativeEvent.lngLat) {
        const lngLat = event.nativeEvent.lngLat;
        if (Array.isArray(lngLat)) {
          coord = lngLat;
        } else if (lngLat && typeof lngLat === 'object') {
          coord = [lngLat.lng ?? lngLat.longitude, lngLat.lat ?? lngLat.latitude];
        }
      }
    }
    
    if (coord && coord.length >= 2) {
      const [longitude, latitude] = coord;
      if (mapTapAction === 'storefront') {
        setShopLocation({ latitude, longitude });
      } else {
        setPolygonPoints([...polygonPoints, { latitude, longitude }]);
      }
    } else {
      console.warn('Could not extract coordinates from event', event);
    }
  };

  const undoLastPoint = () => {
    if (polygonPoints.length > 0) {
      setPolygonPoints(polygonPoints.slice(0, -1));
    }
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
  };

  const handleSaveBoundary = async () => {
    const finalPoints = boundaryMode === 'radius' 
      ? getCirclePoints(shopLocation.latitude, shopLocation.longitude, radiusKm) 
      : polygonPoints;

    if (boundaryMode === 'polygon' && finalPoints.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Save Boundary',
        text2: 'Please tap at least 3 points on the map to define your boundary.'
      });
      return;
    }
    try {
      await updateMockShopGeofence(finalPoints);
      Toast.show({
        type: 'success',
        text1: 'Boundary Saved',
        text2: boundaryMode === 'radius'
          ? `Delivery boundary saved with a ${radiusKm}km radius.`
          : `${finalPoints.length} vertices successfully recorded.`
      });
      setCurrentStep(4);
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Save Boundary Failed',
        text2: 'Could not save the delivery boundary.'
      });
    }
  };

  const handleFinishSetup = async () => {
    setSubmitting(true);
    const finalPoints = boundaryMode === 'radius' 
      ? getCirclePoints(shopLocation.latitude, shopLocation.longitude, radiusKm) 
      : polygonPoints;

    const shopLat = shopLocation.latitude;
    const shopLng = shopLocation.longitude;

    try {
      await registerShop({
        name: ownerName.trim(),
        phone,
        email: ownerEmail.trim(),
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopCategory,
        shopLatitude: shopLat,
        shopLongitude: shopLng,
        shopBannerUrl: bannerUri,
        deliveryPolygon: finalPoints,
      });

      Toast.show({
        type: 'success',
        text1: 'Merchant Setup Completed',
        text2: 'Welcome! Your store is now active.'
      });
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: 'Could not write owner profile.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDERS ---

  const renderStepIndicator = () => {
    return (
      <View style={[styles.indicatorContainer, { paddingTop: insets.top + 6 }]}>
        <View style={styles.indicatorHeader}>
          {currentStep > 1 ? (
            <TouchableOpacity onPress={handlePrevStep} style={styles.backBtn}>
              <ArrowLeft color={theme.colors.primary} size={24} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <Text style={styles.indicatorText}>Step {currentStep} of 4</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${(currentStep / 4) * 100}%` }]} />
        </View>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <KeyboardAwareScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionHeading}>Tell us about yourself</Text>
            <Text style={styles.sectionSubtitle}>These details are used to set up your partner account.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.textInputContainer}>
                <User color={theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Aman Sharma"
                  placeholderTextColor={theme.colors.textLight}
                  value={ownerName}
                  onChangeText={setOwnerName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number (Verified)</Text>
              <View style={[styles.textInputContainer, styles.disabledInput]}>
                <Phone color={theme.colors.textLight} size={22} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.textLight }]}
                  value={`+91 ${phone}`}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address (Optional)</Text>
              <View style={styles.textInputContainer}>
                <Mail color={theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. name@email.com"
                  placeholderTextColor={theme.colors.textLight}
                  keyboardType="email-address"
                  value={ownerEmail}
                  onChangeText={setOwnerEmail}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep}>
              <Text style={styles.primaryBtnText}>Continue to Shop Details</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        );

      case 2:
        return (
          <KeyboardAwareScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionHeading}>Your Shop Details</Text>
            <Text style={styles.sectionSubtitle}>Enter details of your local store storefront.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shop Name *</Text>
              <View style={styles.textInputContainer}>
                <Store color={theme.colors.primary} size={22} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Fresh Mart"
                  placeholderTextColor={theme.colors.textLight}
                  value={shopName}
                  onChangeText={setShopName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shop Category *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = shopCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryGridItem,
                        isSelected && styles.categoryGridItemSelected
                      ]}
                      onPress={() => setShopCategory(cat)}
                    >
                      <Text style={[
                        styles.categoryGridText,
                        isSelected && styles.categoryGridTextSelected
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shop Address *</Text>
              <View style={[styles.textInputContainer, styles.textAreaContainer]}>
                <MapPin color={theme.colors.primary} size={22} style={[styles.inputIcon, { marginTop: 14 }]} />
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Street details, neighborhood pincode"
                  placeholderTextColor={theme.colors.textLight}
                  value={shopAddress}
                  onChangeText={setShopAddress}
                  multiline={true}
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Storefront Banner Photo</Text>
              {bannerUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: bannerUri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.replaceImageBtn} onPress={selectBannerImage}>
                    <Text style={styles.replaceImageText}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePlaceholder} onPress={selectBannerImage}>
                  <ImageIcon color={theme.colors.primary} size={36} />
                  <Text style={styles.imagePlaceholderText}>Select Banner Photo from Gallery</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep}>
              <Text style={styles.primaryBtnText}>Continue to Geofencing</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        );

      case 3:
        const hasPoints = polygonPoints.length > 0;
        const validShape = polygonPoints.length >= 3;
        const canSave = boundaryMode === 'radius' ? true : validShape;
        return (
          <View style={styles.mapContainer}>
            {/* Top Address & Mode Selection Panel */}
            <View style={styles.mapTopPanel}>
              <View style={styles.addressCard}>
                <MapPin color={theme.colors.primary} size={18} style={{ marginRight: 6 }} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {shopAddress || 'No shop address entered.'}
                </Text>
              </View>

              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, boundaryMode === 'polygon' && styles.modeToggleBtnActive]}
                  onPress={() => {
                    setBoundaryMode('polygon');
                    setMapTapAction('boundary'); // default to drawing
                  }}
                >
                  <Text style={[styles.modeToggleBtnText, boundaryMode === 'polygon' && styles.modeToggleBtnTextActive]}>
                    Custom Shape
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeToggleBtn, boundaryMode === 'radius' && styles.modeToggleBtnActive]}
                  onPress={() => {
                    setBoundaryMode('radius');
                    setMapTapAction('storefront'); // can only place storefront pin
                  }}
                >
                  <Text style={[styles.modeToggleBtnText, boundaryMode === 'radius' && styles.modeToggleBtnTextActive]}>
                    Radius Circle
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner Instructions */}
            <View style={styles.mapInstructionBanner}>
              <Map color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.mapInstructionText}>
                {boundaryMode === 'radius'
                  ? 'Tap map to set storefront pin. Adjust circle radius below.'
                  : mapTapAction === 'storefront'
                    ? 'Tap map to set storefront pin. Toggle to "Draw Boundary" to trace.'
                    : 'Tap map to draw delivery boundary (at least 3 points).'}
              </Text>
            </View>

            {loadingLocation ? (
              <View style={styles.mapLoader}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.mapLoaderText}>Locating storefront...</Text>
              </View>
            ) : (
              <MapLibreMap
                style={styles.mapView}
                mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                logoEnabled={false}
                attributionEnabled={false}
                androidView="surface"
                onPress={handleMapPress}
              >
                <Camera
                  ref={cameraRef}
                  initialViewState={{
                    center: [mapRegion.longitude, mapRegion.latitude],
                    zoom: 15,
                  }}
                />
                <UserLocation visible={true} />

                {/* Storefront Location Marker */}
                {shopLocation.latitude && shopLocation.longitude && (
                  <Marker
                    id="storefront-pin"
                    lngLat={[shopLocation.longitude, shopLocation.latitude]}
                  >
                    <View style={styles.storefrontMarkerContainer}>
                      <View style={styles.storefrontMarkerBubble}>
                        <Store color="#FFF" size={14} />
                      </View>
                      <View style={styles.storefrontMarkerTail} />
                    </View>
                  </Marker>
                )}

                {/* Drawn Points Markers */}
                {boundaryMode === 'polygon' && polygonPoints.map((point, index) => (
                  <Marker
                    key={index.toString()}
                    id={`vertex-${index}`}
                    lngLat={[point.longitude, point.latitude]}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.markerDot}>
                        <Text style={styles.markerText}>{index + 1}</Text>
                      </View>
                    </View>
                  </Marker>
                ))}

                {/* Live Connected Line */}
                {boundaryMode === 'polygon' && lineGeoJson && (
                  <GeoJSONSource id="lineSource" data={lineGeoJson}>
                    <Layer
                      id="lineLayer"
                      type="line"
                      style={{
                        lineColor: theme.colors.primary,
                        lineWidth: 4,
                      }}
                    />
                  </GeoJSONSource>
                )}

                {/* Final Polygon Zone */}
                {boundaryMode === 'polygon' && polygonGeoJson && (
                  <GeoJSONSource id="polygonSource" data={polygonGeoJson}>
                    <Layer
                      id="polygonFillLayer"
                      type="fill"
                      style={{
                        fillColor: 'rgba(46, 125, 50, 0.25)',
                      }}
                    />
                    <Layer
                      id="polygonOutlineLayer"
                      type="line"
                      style={{
                        lineColor: theme.colors.primary,
                        lineWidth: 4,
                      }}
                    />
                  </GeoJSONSource>
                )}

                {/* Radius Circle Zone */}
                {boundaryMode === 'radius' && radiusCircleGeoJson && (
                  <GeoJSONSource id="radiusCircleSource" data={radiusCircleGeoJson}>
                    <Layer
                      id="radiusCircleFillLayer"
                      type="fill"
                      style={{
                        fillColor: 'rgba(33, 150, 243, 0.2)',
                      }}
                    />
                    <Layer
                      id="radiusCircleOutlineLayer"
                      type="line"
                      style={{
                        lineColor: '#2196F3',
                        lineWidth: 3,
                      }}
                    />
                  </GeoJSONSource>
                )}
              </MapLibreMap>
            )}

            {/* Map Action Buttons Overlay */}
            <View style={[styles.mapButtonOverlay, { bottom: insets.bottom > 0 ? insets.bottom + 10 : 20 }]}>
              {/* Tap Action Toggle (only for Custom Shape mode) */}
              {boundaryMode === 'polygon' && (
                <View style={styles.tapActionToggleRow}>
                  <TouchableOpacity
                    style={[styles.tapActionBtn, mapTapAction === 'storefront' && styles.tapActionBtnActive]}
                    onPress={() => setMapTapAction('storefront')}
                  >
                    <Store color={mapTapAction === 'storefront' ? '#FFF' : theme.colors.primary} size={15} style={{ marginRight: 6 }} />
                    <Text style={[styles.tapActionBtnText, mapTapAction === 'storefront' && styles.tapActionBtnTextActive]}>
                      Set Shop Pin
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tapActionBtn, mapTapAction === 'boundary' && styles.tapActionBtnActive]}
                    onPress={() => setMapTapAction('boundary')}
                  >
                    <Map color={mapTapAction === 'boundary' ? '#FFF' : theme.colors.primary} size={15} style={{ marginRight: 6 }} />
                    <Text style={[styles.tapActionBtnText, mapTapAction === 'boundary' && styles.tapActionBtnTextActive]}>
                      Draw Boundary
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Radius size control */}
              {boundaryMode === 'radius' && (
                <View style={styles.radiusControlCard}>
                  <Text style={styles.radiusControlLabel}>
                    Delivery Radius: <Text style={styles.radiusHighlight}>{radiusKm} km</Text>
                  </Text>
                  <View style={styles.radiusChipsRow}>
                    {[1, 2, 3, 5, 8, 10, 15, 20].map((km) => (
                      <TouchableOpacity
                        key={km}
                        style={[styles.radiusChip, radiusKm === km && styles.radiusChipActive]}
                        onPress={() => setRadiusKm(km)}
                      >
                        <Text style={[styles.radiusChipText, radiusKm === km && styles.radiusChipTextActive]}>
                          {km}km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {boundaryMode === 'polygon' && (
                <View style={styles.row}>
                  <TouchableOpacity 
                    style={[styles.mapOverlayBtn, !hasPoints && styles.disabledBtn]} 
                    onPress={undoLastPoint}
                    disabled={!hasPoints}
                  >
                    <Undo color={hasPoints ? theme.colors.primary : '#AAA'} size={20} />
                    <Text style={[styles.mapOverlayBtnText, { color: hasPoints ? theme.colors.textDark : '#AAA' }]}>Undo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.mapOverlayBtn, !hasPoints && styles.disabledBtn]} 
                    onPress={clearPolygon}
                    disabled={!hasPoints}
                  >
                    <Trash2 color={hasPoints ? theme.colors.error : '#AAA'} size={20} />
                    <Text style={[styles.mapOverlayBtnText, { color: hasPoints ? theme.colors.error : '#AAA' }]}>Reset</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.mapSaveBtn, !canSave && styles.disabledBtn]} 
                onPress={handleSaveBoundary}
                disabled={!canSave}
              >
                <Save color="#FFF" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.mapSaveBtnText}>
                  {boundaryMode === 'radius'
                    ? `Save boundary (${radiusKm}km radius)`
                    : `Save boundary (${polygonPoints.length} points)`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 4:
        return (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionHeading}>Review Setup Details</Text>
            <Text style={styles.sectionSubtitle}>Please confirm the business profile is correct.</Text>

            {/* Overview Card */}
            <View style={styles.confirmCard}>
              <Text style={styles.confirmSectionTitle}>PERSONAL INFORMATION</Text>
              <View style={styles.confirmRow}>
                <User color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{ownerName}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Phone color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>+91 {phone}</Text>
              </View>
              {ownerEmail.trim() !== '' && (
                <View style={styles.confirmRow}>
                  <Mail color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                  <Text style={styles.confirmValue}>{ownerEmail}</Text>
                </View>
              )}

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmSectionTitle}>STOREFRONT INFORMATION</Text>
              {bannerUri && (
                <Image source={{ uri: bannerUri }} style={styles.confirmBannerThumbnail} />
              )}
              <View style={styles.confirmRow}>
                <Store color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{shopName} ({shopCategory})</Text>
              </View>
              <View style={styles.confirmRow}>
                <MapPin color={theme.colors.primary} size={18} style={styles.confirmIcon} />
                <Text style={styles.confirmValue}>{shopAddress}</Text>
              </View>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmSectionTitle}>DELIVERY SETTINGS</Text>
              <View style={styles.confirmRow}>
                <CheckCircle color={theme.colors.primary} size={20} style={styles.confirmIcon} />
                <Text style={[styles.confirmValue, { fontWeight: '800', color: theme.colors.primary }]}>
                  {boundaryMode === 'radius'
                    ? `Circular boundary active (${radiusKm} km radius)`
                    : `${polygonPoints.length} vertices custom geofence boundary active`}
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryBtn, submitting && styles.disabledBtn]} 
              onPress={handleFinishSetup}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Finish Setup & Open Shop</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderStepIndicator()}
      <View style={styles.body}>{renderStepContent()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
  },
  indicatorContainer: {
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    marginBottom: 10,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
  },
  indicatorText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#ECEFF1',
    marginHorizontal: theme.spacing.xl,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    padding: theme.spacing.m,
    paddingBottom: theme.spacing.xxl,
  },
  sectionHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: theme.spacing.s,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: theme.spacing.l,
  },
  inputGroup: {
    marginBottom: theme.spacing.l,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    height: theme.controls.touchTargetHeight,
  },
  disabledInput: {
    backgroundColor: '#ECEFF1',
    borderColor: '#CFD8DC',
  },
  inputIcon: {
    marginLeft: 16,
  },
  textInput: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  textAreaContainer: {
    height: 100,
    alignItems: 'flex-start',
  },
  textArea: {
    height: 90,
    paddingTop: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryGridItem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    width: '48%', // Grid layout
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryGridItemSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryGridText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textLight,
  },
  categoryGridTextSelected: {
    color: theme.colors.white,
  },
  imagePlaceholder: {
    height: 120,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 8,
    textAlign: 'center',
  },
  imagePreviewContainer: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  replaceImageBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  replaceImageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    height: theme.controls.touchTargetHeight,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.l,
    ...theme.shadows.soft,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.white,
  },
  // Map drawing coordinates
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapInstructionBanner: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)', // transparent primary green
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapInstructionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  mapLoaderText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  mapView: {
    flex: 1,
  },
  markerContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  mapButtonOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  mapOverlayBtn: {
    flex: 1,
    height: 52,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  mapOverlayBtnText: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },
  mapSaveBtn: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    ...theme.shadows.medium,
  },
  mapSaveBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
  },
  // Confirm Card
  confirmCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    ...theme.shadows.soft,
  },
  confirmSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: theme.spacing.s,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmIcon: {
    marginRight: 10,
  },
  confirmValue: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textDark,
  },
  confirmBannerThumbnail: {
    height: 100,
    borderRadius: 10,
    marginBottom: theme.spacing.m,
    backgroundColor: '#ECEFF1',
  },
  confirmDivider: {
    height: 1.5,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.m,
  },
  // New Map setup styles
  mapTopPanel: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1.5,
    borderBottomColor: theme.colors.border,
    padding: 12,
  },
  addressCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addressText: {
    color: theme.colors.textDark,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  modeToggleBtnText: {
    color: theme.colors.textLight,
    fontSize: 14,
    fontWeight: '800',
  },
  modeToggleBtnTextActive: {
    color: 'white',
  },
  storefrontMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  storefrontMarkerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  storefrontMarkerTail: {
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
  tapActionToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  tapActionBtn: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tapActionBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tapActionBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  tapActionBtnTextActive: {
    color: 'white',
  },
  radiusControlCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  radiusControlLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textDark,
    marginBottom: 6,
  },
  radiusHighlight: {
    color: theme.colors.primary,
  },
  radiusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: 6,
    marginBottom: 6,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textDark,
  },
  radiusChipTextActive: {
    color: 'white',
  },
});
