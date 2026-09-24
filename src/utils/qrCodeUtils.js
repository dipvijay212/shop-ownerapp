import { Platform, PermissionsAndroid } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import RNShare from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

/**
 * Safely generates a clean slug string for filenames.
 * @param {object} shop
 * @returns {string}
 */
export const getShopSlug = (shop) => {
  const val = shop?.id ?? shop?.name ?? 'freshmart';
  return String(val).toLowerCase().replace(/[^a-z0-9_]/g, '_');
};

/**
 * Captures the QR Card ViewShot component as a high-quality PNG image.
 * @param {React.RefObject} viewShotRef
 * @returns {Promise<string>} File URI of the captured image
 */
export const captureQRCode = async (viewShotRef) => {
  if (!viewShotRef || !viewShotRef.current) {
    throw new Error('QR Card view element not ready for capture.');
  }

  let uri;
  try {
    if (typeof viewShotRef.current.capture === 'function') {
      uri = await viewShotRef.current.capture();
    } else {
      uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
    }
  } catch (err) {
    console.log('captureQRCode error, retrying captureRef:', err);
    uri = await captureRef(viewShotRef, {
      format: 'png',
      quality: 1.0,
      result: 'tmpfile',
    });
  }

  if (!uri) {
    throw new Error('Failed to capture QR Card image.');
  }

  return uri;
};

/**
 * Shares the captured QR Card PNG image via the native Share Sheet.
 * @param {string} imageUri
 * @param {object} shop
 * @returns {Promise<boolean>} True if shared or user dismissed without error
 */
export const shareQRCode = async (imageUri, shop) => {
  const shopSlug = getShopSlug(shop);
  const fileName = `${shopSlug}_QR.png`;
  const cleanPath = imageUri.replace('file://', '');
  const fileUri = Platform.OS === 'android' ? `file://${cleanPath}` : imageUri;

  try {
    // Try Method 1: Share via local file URI
    await RNShare.open({
      title: `${shop?.name || 'Store'} QR Code`,
      url: fileUri,
      type: 'image/png',
      filename: fileName,
      failOnCancel: false,
    });
    return true;
  } catch (fileErr) {
    const fileErrStr = String(fileErr?.message || fileErr?.error || fileErr || '').toLowerCase();
    const isCancel =
      fileErrStr.includes('cancel') ||
      fileErrStr.includes('dismiss') ||
      fileErrStr.includes('did not share') ||
      fileErrStr.includes('user_canceled') ||
      fileErrStr.includes('user canceled');

    if (isCancel) {
      return false;
    }

    console.log('File URI share warning, trying base64 fallback:', fileErr);

    // Try Method 2: Share via Base64 Data URI
    try {
      const base64Data = await ReactNativeBlobUtil.fs.readFile(cleanPath, 'base64');
      const base64Image = `data:image/png;base64,${base64Data}`;

      await RNShare.open({
        title: `${shop?.name || 'Store'} QR Code`,
        url: base64Image,
        type: 'image/png',
        filename: fileName,
        failOnCancel: false,
      });
      return true;
    } catch (base64Err) {
      const b64ErrStr = String(base64Err?.message || base64Err?.error || base64Err || '').toLowerCase();
      if (
        b64ErrStr.includes('cancel') ||
        b64ErrStr.includes('dismiss') ||
        b64ErrStr.includes('did not share') ||
        b64ErrStr.includes('user_canceled') ||
        b64ErrStr.includes('user canceled')
      ) {
        return false;
      }
      throw base64Err;
    }
  }
};

/**
 * Saves the captured QR Card PNG image to the device Gallery/Photos.
 * @param {string} imageUri
 * @param {object} shop
 * @returns {Promise<boolean>} True if saved successfully
 */
// `t` comes from the calling hook — this module has none of its own, and the
// Android permission dialog is read by the shop owner like any other copy.
export const downloadQRCode = async (imageUri, shop, t = (k, fallback) => fallback ?? k) => {
  const shopSlug = getShopSlug(shop);
  const fileName = `${shopSlug}_QR.png`;
  const cleanPath = imageUri.replace('file://', '');
  const fileUri = Platform.OS === 'android' ? `file://${cleanPath}` : imageUri;

  // Request Android storage permissions if Android < 33
  if (Platform.OS === 'android' && Platform.Version < 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: t('storagePermissionTitle', 'Storage Permission Required'),
        message: t('storagePermissionBody', 'App needs storage access to save the QR Code image to your gallery.'),
        buttonNeutral: t('askLater', 'Ask Later'),
        buttonNegative: t('cancel', 'Cancel'),
        buttonPositive: t('okBtn', 'OK'),
      }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Storage permission denied.');
    }
  }

  // Method 1: Use CameraRoll saveAsset
  try {
    await CameraRoll.saveAsset(fileUri, { type: 'photo', album: 'Paasora Partner' });
    return true;
  } catch (cameraRollErr) {
    console.log('CameraRoll save warning, attempting DownloadManager fallback:', cameraRollErr);

    // Method 2: Android DownloadManager / MediaStore Scan Fallback
    if (Platform.OS === 'android') {
      const downloadsDir = ReactNativeBlobUtil.fs.dirs.DownloadDir;
      const targetPath = `${downloadsDir}/${fileName}`;

      await ReactNativeBlobUtil.fs.cp(cleanPath, targetPath);
      await ReactNativeBlobUtil.fs.scanFile([{ path: targetPath, mime: 'image/png' }]);
      return true;
    }
    throw cameraRollErr;
  }
};
