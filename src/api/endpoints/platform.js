// Public / cross-cutting endpoints: app gate, geocoding, support, uploads.

import { http } from '../httpClient';

// Call before rendering at app start — drives force-update and maintenance
// screens. Owner app reads `min_owner_app_version`.
export const getAppConfig = () => http.get('/app-config');

// Used by the shop-address picker during onboarding (Step 2).
export const reverseGeocode = (lat, lng) => http.get('/geo/reverse', { params: { lat, lng } });

export const getSupportContact = () => http.get('/support/contact');

export const getFaqs = (audience = 'owner') => http.get('/faqs', { params: { audience } });

// POST /uploads — multipart, used for the shop banner and product photos.
// 413/400 → inline "≤25 MB, JPEG/PNG/WebP"; keep the form state.
// → { url, thumb_url, path }
export const uploadImage = async (file) => {
  const form = new FormData();
  const uri = typeof file === 'object' && file ? file.uri : file;
  let filename = (file && typeof file === 'object' ? file.fileName || file.name : null) || (typeof uri === 'string' ? uri.split('/').pop() : 'upload.jpg') || 'upload.jpg';
  
  let type = (file && typeof file === 'object' && file.type ? file.type : '').toLowerCase();
  if (type === 'image/jpg' || type === 'image/pjpeg') type = 'image/jpeg';

  if (!type) {
    if (/\.pdf$/i.test(filename)) {
      type = 'application/pdf';
    } else if (/\.png$/i.test(filename)) {
      type = 'image/png';
    } else if (/\.webp$/i.test(filename)) {
      type = 'image/webp';
    } else {
      type = 'image/jpeg';
    }
  }

  if (type === 'application/pdf') {
    if (!/\.pdf$/i.test(filename)) {
      filename = `${filename}.pdf`;
    }
  } else if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    type = 'image/jpeg';
    if (!/\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      filename = `${filename}.jpg`;
    }
  }

  form.append('file', {
    uri,
    name: filename,
    type,
  });

  return http.post('/uploads', form, {
    transformRequest: (data, headers) => {
      if (headers) {
        delete headers['Content-Type'];
        delete headers['content-type'];
      }
      return data;
    },
    timeout: 60000,
  });
};
