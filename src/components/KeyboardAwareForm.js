// One scroll container for every screen that has a text field.
//
// The app had five different keyboard strategies and only one of them worked.
// The common one — <KeyboardAvoidingView behavior={Platform.OS === 'ios' ?
// 'padding' : undefined}> — renders a plain View on Android, so the field a
// customer had just tapped stayed under the keyboard. The manifest's
// android:windowSoftInputMode="adjustResize" used to paper over that for simple
// screens, but under the edge-to-edge display that Android 15 enforces on a
// targetSdk 36 build the window no longer resizes, so nothing moved at all.
//
// react-native-keyboard-aware-scroll-view was already a dependency and already
// configured correctly in one place; this is that configuration, in a component,
// so every form gets the same behaviour and the next screen does not have to
// rediscover it.

import React, { useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const KeyboardAwareForm = React.forwardRef(
  ({ children, contentContainerStyle, extraBottomPadding = 0, ...rest }, ref) => {
    const inner = useRef(null);

    // KeyboardAwareScrollView has scrollToPosition(x, y, animated) and NO
    // scrollTo. This component reads as a drop-in scroll container, so callers
    // were written against the ScrollView API — and `ref.current.scrollTo` was
    // simply undefined. Optional chaining did not save them: `current` is set,
    // it is the method that is missing, so `current?.scrollTo(...)` threw
    // "undefined is not a function".
    //
    // Rather than rewrite every call site and leave the next one to rediscover
    // this, the component honours the API it appears to have.
    useImperativeHandle(
      ref,
      () => ({
        scrollTo: ({ x = 0, y = 0, animated = true } = {}) =>
          inner.current?.scrollToPosition(x, y, animated),
        scrollToPosition: (x, y, animated = true) => inner.current?.scrollToPosition(x, y, animated),
        scrollToEnd: (animated = true) => inner.current?.scrollToEnd(animated),
        scrollToFocusedInput: (...args) => inner.current?.scrollToFocusedInput(...args),
        getScrollResponder: () => inner.current?.getScrollResponder(),
      }),
      [],
    );

    return (
      <KeyboardAwareScrollView
        ref={inner}
        // Android needs to be asked; on iOS it is the default.
        enableOnAndroid
        enableAutomaticScroll
        // Taps on a button while the keyboard is open must reach the button
        // rather than being eaten by the dismiss.
        keyboardShouldPersistTaps="handled"
        // How far ABOVE the keyboard the focused field settles. Without this the
        // field lands flush against the keyboard, which is technically visible
        // and still feels wrong.
        extraScrollHeight={Platform.OS === 'android' ? 120 : 80}
        extraHeight={140}
        showsVerticalScrollIndicator={false}
        // Flattened, not an array: on Android the library computes
        // `contentContainerStyle.paddingBottom + keyboardSpace` and appends it
        // LAST. Read off an array, that paddingBottom is undefined, so it
        // overrode ours with the bare keyboard space — 0 with the keyboard
        // closed — and the bottom of every form ended flush against the tab bar.
        contentContainerStyle={StyleSheet.flatten([
          // Room to scroll the LAST field clear of the keyboard; without it the
          // content simply ends and the bottom field cannot come up.
          { paddingBottom: 120 + extraBottomPadding },
          contentContainerStyle,
        ])}
        {...rest}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  },
);

KeyboardAwareForm.displayName = 'KeyboardAwareForm';

export default KeyboardAwareForm;
