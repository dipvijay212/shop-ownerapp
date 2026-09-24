import { useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { captureQRCode, shareQRCode, downloadQRCode, getShopSlug } from '../utils/qrCodeUtils';
import { useTranslation } from '../constants/translations';

/**
 * Custom hook to handle capturing, sharing, and downloading the QR Card.
 * @param {React.RefObject} viewShotRef
 * @param {object} shop
 */
export const useQRCodeActions = (viewShotRef, shop) => {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleShare = useCallback(async () => {
    if (isSharing || isDownloading) return;
    setIsSharing(true);

    try {
      const imageUri = await captureQRCode(viewShotRef);
      const shared = await shareQRCode(imageUri, shop);

      if (shared) {
        Toast.show({
          type: 'success',
          text1: t('qrReadyToShare'),
          text2: t('qrSharedSuccess'),
        });
      }
    } catch (error) {
      console.log('useQRCodeActions handleShare error:', error);
      Toast.show({
        type: 'error',
        text1: t('shareFailed'),
        text2: error?.message || 'Could not capture or share QR Card image.',
      });
    } finally {
      setIsSharing(false);
    }
  }, [viewShotRef, shop, isSharing, isDownloading, t]);

  const handleDownload = useCallback(async () => {
    if (isSharing || isDownloading) return;
    setIsDownloading(true);

    try {
      const imageUri = await captureQRCode(viewShotRef);
      await downloadQRCode(imageUri, shop, t);

      const shopSlug = getShopSlug(shop);
      Toast.show({
        type: 'success',
        text1: t('qrSavedToGallery'),
        text2: `Saved as ${shopSlug}_QR.png`,
      });
    } catch (error) {
      console.log('useQRCodeActions handleDownload error:', error);
      Toast.show({
        type: 'error',
        text1: t('downloadFailed'),
        text2: error?.message || 'Could not save QR Card image to gallery.',
      });
    } finally {
      setIsDownloading(false);
    }
  }, [viewShotRef, shop, isSharing, isDownloading, t]);

  return {
    isSharing,
    isDownloading,
    handleShare,
    handleDownload,
  };
};
