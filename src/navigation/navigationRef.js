// Navigation handle for code that runs outside the tree — a tapped push
// notification is delivered by the OS, not by a screen, so whatever acts on it
// has no `useNavigation()` to reach for.

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
