// Bottom spacing that follows the DEVICE, not a hardcoded number.
//
// `insets.bottom` is what the OS reports for the strip a screen must not draw
// under: the gesture bar on a modern Android phone, the home indicator on an
// iPhone, 0 on a device with physical buttons. Screens that ignored it left
// their last row and their footer buttons sitting behind the navigation bar.
//
// A small floor is still applied, because a 0 inset means "no system bar" —
// not "content should touch the bottom edge of the glass".

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FLOOR = 16;

export const useScreenPadding = (extra = 0) => {
  const insets = useSafeAreaInsets();
  return {
    insets,
    /** For a scroll view's contentContainerStyle. */
    bottom: Math.max(insets.bottom, FLOOR) + extra,
    /** For a fixed footer that sits above the system bar. */
    footer: Math.max(insets.bottom, FLOOR),
  };
};

export default useScreenPadding;
