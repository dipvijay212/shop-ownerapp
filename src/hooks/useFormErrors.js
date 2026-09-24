import { useCallback, useRef, useState } from 'react';

// Forms used to report a problem with an alert — "Please fill all required
// fields" — and then leave the person to hunt for which one. This keeps an
// error per field, and on a failed submit scrolls the FIRST offending field
// into view so the message they just read is attached to something they can
// see.
//
//   const form = useFormErrors();
//   <ScrollView ref={form.scrollRef}>
//     <View onLayout={form.onFieldLayout('name')}>
//       <TextInput onChangeText={(v) => { setName(v); form.clearError('name'); }} />
//       {form.errors.name ? <Text style={s.err}>{form.errors.name}</Text> : null}
//
//   if (!form.validate([[!name.trim(), 'name', t('nameRequired')]])) return;
//
// Rules are checked in the order given, so list them the way the fields are
// laid out and the first failure is also the topmost one.
export const useFormErrors = () => {
  const [errors, setErrors] = useState({});
  const scrollRef = useRef(null);
  const positions = useRef({});

  const onFieldLayout = useCallback(
    (field) => (event) => {
      positions.current[field] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToField = useCallback((field) => {
    const y = positions.current[field];
    const scroller = scrollRef.current;
    if (y === undefined || !scroller) return;
    // Leave room above the field so it does not land under a sticky header.
    const target = Math.max(0, y - 24);
    // KeyboardAwareScrollView exposes scrollToPosition; a plain ScrollView
    // exposes scrollTo. Support whichever this form is built on.
    if (typeof scroller.scrollToPosition === 'function') {
      scroller.scrollToPosition(0, target, true);
    } else if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ y: target, animated: true });
    }
  }, []);

  // rules: [condition, field, message][] — condition true means INVALID.
  const validate = useCallback(
    (rules) => {
      const next = {};
      let firstBad = null;
      for (const [failed, field, message] of rules) {
        if (failed && !next[field]) {
          next[field] = message;
          if (!firstBad) firstBad = field;
        }
      }
      setErrors(next);
      if (firstBad) {
        scrollToField(firstBad);
        return false;
      }
      return true;
    },
    [scrollToField],
  );

  const clearError = useCallback((field) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }, []);

  const setError = useCallback(
    (field, message) => {
      setErrors((prev) => ({ ...prev, [field]: message }));
      scrollToField(field);
    },
    [scrollToField],
  );

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, scrollRef, onFieldLayout, validate, clearError, setError, clearAll };
};

export default useFormErrors;
