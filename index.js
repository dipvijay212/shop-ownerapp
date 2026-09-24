/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered here, outside any component, so it exists when FCM wakes
// the app headless. The backend only sends notification messages, which the
// OS draws by itself, so there is no work to do; without a handler the
// library logs a warning on every message received in the background.
setBackgroundMessageHandler(getMessaging(), async () => {});

AppRegistry.registerComponent(appName, () => App);
