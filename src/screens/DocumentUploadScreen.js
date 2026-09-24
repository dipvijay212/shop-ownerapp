import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { ArrowLeft, FileText, Upload, CheckCircle2, ShieldAlert, FileCheck, X, File } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';

const isPickerCancel = (err) => {
  if (!err) return false;
  if (isErrorWithCode && isErrorWithCode(err) && err.code === errorCodes?.OPERATION_CANCELED) return true;
  return err.code === 'OPERATION_CANCELED' || err.code === 'DOCUMENT_PICKER_CANCELED';
};

export const DocumentUploadScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { shop, refreshShop, registerShop } = useContext(AuthContext);
  const registerFormData = route.params?.registerFormData;

  const [submitting, setSubmitting] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [aadhaarUri, setAadhaarUri] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panUri, setPanUri] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [tradeLicenseUri, setTradeLicenseUri] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');

  const [errors, setErrors] = useState({});

  // Modal Picker State
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [activePickerTarget, setActivePickerTarget] = useState(null); // { setter, errorKey }
  const pendingPickerAction = useRef(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await api.shop.getDocuments();
        if (docs) {
          if (docs.aadhaar_url) setAadhaarUri(docs.aadhaar_url);
          if (docs.aadhaar_number) setAadhaarNumber(docs.aadhaar_number);
          if (docs.pan_url) setPanUri(docs.pan_url);
          if (docs.pan_number) setPanNumber(docs.pan_number);
          if (docs.trade_license_url) setTradeLicenseUri(docs.trade_license_url);
          if (docs.trade_license_number) setTradeLicenseNumber(docs.trade_license_number);
        }
      } catch (e) {
        console.log('[DocumentUpload] Failed to fetch documents', e);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocs();
  }, []);

  const openPickerModal = (setter, errorKey) => {
    setActivePickerTarget({ setter, errorKey });
    setPickerModalVisible(true);
  };

  // iOS presents the native picker on top of whatever view controller is
  // frontmost. Launching it while this Modal is still animating out hands it
  // the dismissing controller, so the picker silently never appears -- which is
  // why the second upload on a screen would do nothing. Wait for the modal to
  // actually be gone first (onDismiss is iOS-only; Android tears it down
  // synchronously). The timer is a fallback in case onDismiss never fires; the
  // ref makes sure whichever path runs first is the only one that fires.
  const runAfterModalDismissed = (action) => {
    setPickerModalVisible(false);
    if (Platform.OS !== 'ios') {
      action();
      return;
    }
    pendingPickerAction.current = action;
    setTimeout(consumePendingPickerAction, 450);
  };

  const consumePendingPickerAction = () => {
    const action = pendingPickerAction.current;
    pendingPickerAction.current = null;
    if (action) action();
  };

  const pickImageFromGallery = () => {
    if (!activePickerTarget) return;
    const { setter, errorKey } = activePickerTarget;
    const options = { mediaType: 'photo', quality: 0.8 };
    try {
      launchImageLibrary(options, (response) => {
        if (response?.didCancel) return;
        if (response?.errorMessage) {
          Toast.show({
            type: 'error',
            text1: t('galleryError'),
            text2: response.errorMessage,
          });
          return;
        }
        if (response?.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          setter({
            uri: asset.uri,
            name: asset.fileName || 'photo.jpg',
            type: asset.type || 'image/jpeg',
          });
          setErrors((prev) => ({ ...prev, [errorKey]: null }));
        }
      });
    } catch (err) {
      console.error('[ImagePicker] error', err);
      Toast.show({
        type: 'error',
        text1: t('imagePickerError'),
        text2: err?.message || 'Could not open photo gallery.',
      });
    }
  };

  const pickFileFromStorage = async () => {
    if (!activePickerTarget) return;
    const { setter, errorKey } = activePickerTarget;
    try {
      if (typeof pick !== 'function') {
        throw new Error('RNDocumentPicker module is not available');
      }
      const [res] = await pick({
        type: [types.pdf, types.images, types.allFiles],
      });
      if (res) {
        setter({
          uri: res.uri,
          name: res.name || 'document.pdf',
          type: res.type || (res.name?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        });
        setErrors((prev) => ({ ...prev, [errorKey]: null }));
      }
    } catch (err) {
      if (isPickerCancel(err)) {
        return;
      }
      console.error('[DocumentPicker] pick error', err);
      const errMsg = err?.message || String(err);
      const isMissingNativeModule =
        errMsg.includes('RNDocumentPicker') ||
        errMsg.includes('TurboModuleRegistry') ||
        errMsg.includes('null') ||
        errMsg.includes('undefined') ||
        errMsg.includes('not available');

      if (isMissingNativeModule) {
        Alert.alert(
          t('rebuildAppTitle'),
          t('rebuildAppBody'),
          [{ text: 'OK' }]
        );
      } else {
        Toast.show({
          type: 'error',
          text1: t('documentSelectorError'),
          text2: errMsg || 'Could not select document file.',
        });
      }
    }
  };

  const getDocUri = (doc) => {
    if (!doc) return '';
    if (typeof doc === 'object') return doc.uri || '';
    return doc;
  };

  const getDocName = (doc) => {
    if (typeof doc === 'object' && doc?.name) return doc.name;
    const uri = getDocUri(doc);
    if (!uri) return '';
    const cleanUri = uri.split('?')[0];
    return cleanUri.split('/').pop() || 'Uploaded Document';
  };

  const isPdfDoc = (doc) => {
    if (typeof doc === 'object' && doc?.type === 'application/pdf') return true;
    const name = getDocName(doc).toLowerCase();
    return name.endsWith('.pdf');
  };

  const uploadDocIfLocal = async (doc) => {
    const uri = getDocUri(doc);
    if (!uri) return '';
    if (/^https?:/i.test(uri)) return uri;
    try {
      const filePayload = typeof doc === 'object' && doc ? doc : { uri };
      const res = await api.platform.uploadImage(filePayload);
      return res?.url || uri;
    } catch (e) {
      console.error('[DocumentUpload] upload error', e);
      // The server aborts an over-sized upload inside multer, so all it can say
      // is a bare "File too large". Name the limit here, where the hint above
      // the picker already states it.
      if (e?.code === 'UPLOAD_TOO_LARGE') {
        throw new Error('That file is over 25MB. Try a lower-quality scan or split it into fewer pages.');
      }
      throw new Error(e?.message || 'Failed to upload document file. Please try again.');
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!aadhaarUri) newErrors.aadhaar = 'Please upload your Aadhaar Card';
    if (!panUri) newErrors.pan = 'Please upload your PAN Card';
    if (!tradeLicenseUri) newErrors.tradeLicense = 'Please upload your Trade License / Gumasta Certificate';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Toast.show({
        type: 'error',
        text1: t('requiredDocsMissing'),
        text2: t('requiredDocsMissingSub'),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (registerFormData) {
        // Initial onboarding flow: upload docs, finish shop registration and submit documents
        const [aadhaarUrl, panUrl, tradeLicenseUrl] = await Promise.all([
          uploadDocIfLocal(aadhaarUri),
          uploadDocIfLocal(panUri),
          uploadDocIfLocal(tradeLicenseUri),
        ]);

        await registerShop({
          ...registerFormData,
          aadhaarUrl,
          aadhaarNumber: aadhaarNumber.trim(),
          panUrl,
          panNumber: panNumber.trim(),
          tradeLicenseUrl,
          tradeLicenseNumber: tradeLicenseNumber.trim(),
        });

        Toast.show({
          type: 'success',
          text1: t('shopRegistrationSubmitted'),
          text2: t('pendingAdminVerification'),
        });
      } else {
        // Re-upload or update flow
        const [aadhaar_url, pan_url, trade_license_url] = await Promise.all([
          uploadDocIfLocal(aadhaarUri),
          uploadDocIfLocal(panUri),
          uploadDocIfLocal(tradeLicenseUri),
        ]);

        await api.shop.submitDocuments({
          aadhaar_url,
          aadhaar_number: aadhaarNumber.trim() || undefined,
          pan_url,
          pan_number: panNumber.trim() || undefined,
          trade_license_url,
          trade_license_number: tradeLicenseNumber.trim() || undefined,
        });

        await refreshShop();

        Toast.show({
          type: 'success',
          text1: t('documentsSubmitted'),
          text2: t('pendingAdminVerification'),
        });

        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: t('submissionFailed'),
        text2: e.message || 'Could not submit verification documents.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderDocCard = (title, icon, doc, setDoc, errorKey, numberVal, setNumberVal, numberPlaceholder) => {
    const hasDoc = !!doc;
    const isPdf = isPdfDoc(doc);
    const docName = getDocName(doc);
    const docUri = getDocUri(doc);

    return (
      <View style={styles.docCard}>
        <View style={styles.docHeader}>
          {icon}
          <Text style={styles.docTitle}>{title}</Text>
          {hasDoc ? <CheckCircle2 color="#16A34A" size={18} /> : null}
        </View>

        <TouchableOpacity
          style={[styles.uploadBox, errors[errorKey] && styles.uploadBoxError]}
          onPress={() => openPickerModal(setDoc, errorKey)}
        >
          {hasDoc ? (
            isPdf ? (
              <View style={styles.pdfPreviewBox}>
                <FileText color="#DC2626" size={32} />
                <View style={styles.pdfInfo}>
                  <Text style={styles.pdfName} numberOfLines={1} ellipsisMode="middle">{docName}</Text>
                  <Text style={styles.pdfSubtext}>{t('pdfDocument')}</Text>
                </View>
                <TouchableOpacity style={styles.changeBadgeInline} onPress={() => openPickerModal(setDoc, errorKey)}>
                  <Text style={styles.changeBadgeText}>{t('changeBtnDoc')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.previewContainer}>
                <Image source={{ uri: docUri }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.changeBadge} onPress={() => openPickerModal(setDoc, errorKey)}>
                  <Text style={styles.changeBadgeText}>{t('changeBtnDoc')}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Upload color={theme.colors.primary} size={28} />
              <Text style={styles.uploadText}>{t('tapToUploadDoc')}</Text>
              <Text style={styles.uploadSubtext}>{t('docFileTypes')}</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors[errorKey] && <Text style={styles.errorText}>{errors[errorKey]}</Text>}

        <Text style={styles.inputLabel}>{title.replace(/\s*\*$/, '')} Number (Optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder={numberPlaceholder}
          placeholderTextColor="#94A3B8"
          value={numberVal}
          onChangeText={setNumberVal}
        />
      </View>
    );
  };

  if (loadingDocs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top + 8 : insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('shopVerificationDocuments')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {shop?.rejection_reason ? (
          <View style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <ShieldAlert color="#DC2626" size={20} />
              <Text style={styles.rejectionTitle}>{t('previousRejection')}</Text>
            </View>
            <Text style={styles.rejectionReason}>{shop.rejection_reason}</Text>
            <Text style={styles.rejectionHint}>{t('previousRejectionSub')}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionSubtitle}>
          {t('uploadMandatoryDocs')}
        </Text>

        {/* 1. Aadhaar Card */}
        {renderDocCard(
          '1. Aadhaar Card *',
          <FileText color={theme.colors.primary} size={20} />,
          aadhaarUri,
          setAadhaarUri,
          'aadhaar',
          aadhaarNumber,
          setAadhaarNumber,
          '12-digit Aadhaar Number',
        )}

        {/* 2. PAN Card */}
        {renderDocCard(
          '2. PAN Card *',
          <FileCheck color={theme.colors.primary} size={20} />,
          panUri,
          setPanUri,
          'pan',
          panNumber,
          setPanNumber,
          '10-character PAN (e.g. ABCDE1234F)',
        )}

        {/* 3. Trade License / Gumasta */}
        {renderDocCard(
          '3. Trade License / Gumasta Certificate *',
          <FileText color={theme.colors.primary} size={20} />,
          tradeLicenseUri,
          setTradeLicenseUri,
          'tradeLicense',
          tradeLicenseNumber,
          setTradeLicenseNumber,
          'License / Certificate Number',
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Platform.OS === 'android'
              ? Math.max(insets.bottom + 16, 24)
              : Math.max(insets.bottom + 12, 16),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{t('submitDocsForVerification')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Source Picker Modal */}
      <Modal
        visible={pickerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerModalVisible(false)}
        onDismiss={consumePendingPickerAction}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('chooseDocumentSource')}</Text>
            <Text style={styles.modalSubtext}>{t('chooseDocumentSourceSub')}</Text>

            <TouchableOpacity style={styles.modalOption} onPress={() => runAfterModalDismissed(pickImageFromGallery)}>
              <Upload color={theme.colors.primary} size={22} />
              <View style={styles.modalOptionTextContainer}>
                <Text style={styles.modalOptionTitle}>{t('photoGallery')}</Text>
                <Text style={styles.modalOptionSubtext}>{t('photoGallerySub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={() => runAfterModalDismissed(pickFileFromStorage)}>
              <FileText color="#DC2626" size={22} />
              <View style={styles.modalOptionTextContainer}>
                <Text style={styles.modalOptionTitle}>{t('documentFile')}</Text>
                <Text style={styles.modalOptionSubtext}>{t('documentFileSub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPickerModalVisible(false)}>
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scrollContent: { padding: 18, paddingBottom: 24 },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  rejectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rejectionTitle: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  rejectionReason: { fontSize: 14, color: '#991B1B', fontWeight: '600', marginBottom: 4 },
  rejectionHint: { fontSize: 12, color: '#B91C1C' },
  sectionSubtitle: { fontSize: 14, color: '#475569', marginBottom: 18, lineHeight: 20 },
  docCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  docTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  uploadBoxError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  uploadPlaceholder: { alignItems: 'center', padding: 16 },
  uploadText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginTop: 8 },
  uploadSubtext: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  previewContainer: { width: '100%', height: 140, position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  changeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  changeBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginBottom: 8, marginTop: -4 },
  pdfPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    width: '100%',
    height: 140,
    backgroundColor: '#FEF2F2',
  },
  pdfInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  pdfName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  pdfSubtext: { fontSize: 12, color: '#DC2626', marginTop: 2, fontWeight: '600' },
  changeBadgeInline: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  modalSubtext: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  modalOptionTextContainer: { marginLeft: 12 },
  modalOptionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  modalOptionSubtext: { fontSize: 12, color: '#64748B', marginTop: 1 },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  bottomBar: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
});

export default DocumentUploadScreen;
