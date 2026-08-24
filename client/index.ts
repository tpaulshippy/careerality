import * as Sentry from '@sentry/react-native';
import { registerRootComponent } from 'expo';

import App from './App';

Sentry.init({
  dsn:
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    'https://1c2823ee3699a1f8e008abe48f42bf37@o419449.ingest.us.sentry.io/4511963423178752',
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Sentry.wrap(App));
