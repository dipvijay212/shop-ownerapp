import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// iOS presents a Modal, a native picker or a pushed stack screen from whatever
// view controller is frontmost. Doing any of that while a Modal is still
// animating out hands it the dismissing controller: the new thing silently
// never appears, or UIKit leaves an invisible transition view over the window
// and every tap dies -- the app looks frozen. So close the Modal first and run
// the follow-up once it is really gone.
//
// Usage: `const [runAfter, onDismiss] = useAfterModalDismiss();`, pass
// `onDismiss` to the Modal, and call `runAfter(close, action)`.
//
// onDismiss is iOS-only; Android tears the Modal down synchronously, so there
// the action runs straight away. The timer is a fallback in case onDismiss
// never fires; the ref makes sure whichever path comes first is the only one.
export const useAfterModalDismiss = () => {
  const pending = useRef(null);

  const onDismiss = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    if (action) action();
  }, []);

  const runAfter = useCallback(
    (close, action) => {
      close();
      if (Platform.OS !== 'ios') {
        action();
        return;
      }
      pending.current = action;
      setTimeout(onDismiss, 450);
    },
    [onDismiss],
  );

  return [runAfter, onDismiss];
};

export default useAfterModalDismiss;
