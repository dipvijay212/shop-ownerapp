import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import QRCode from 'qrcode';

/**
 * 100% Spec-Compliant Native SVG QR Code Component (Level H Error Correction).
 * Uses node 'qrcode' generator core to render crisp, fully scannable SVG QR codes locally on device.
 */
export const QRCodeView = ({ value, size = 155, color = '#000000', backgroundColor = '#FFFFFF' }) => {
  const { numCells, pathData } = useMemo(() => {
    if (!value) return { numCells: 0, pathData: '' };
    try {
      const qr = QRCode.create(String(value), { errorCorrectionLevel: 'H' });
      const cells = qr.modules.size;
      const cellSize = size / cells;
      let d = '';

      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          if (qr.modules.get(r, c)) {
            const x = c * cellSize;
            const y = r * cellSize;
            d += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
          }
        }
      }
      return { numCells: cells, pathData: d };
    } catch (e) {
      console.warn('QR code rendering error:', e);
      return { numCells: 0, pathData: '' };
    }
  }, [value, size]);

  if (!numCells || !pathData) {
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect width={size} height={size} fill={backgroundColor} />
      <Path d={pathData} fill={color} />
    </Svg>
  );
};

export default QRCodeView;
