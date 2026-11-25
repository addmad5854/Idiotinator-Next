/**
 * @format
 */

// Hermes/React Native ship no URL; it must exist before the app graph loads.
import 'react-native-url-polyfill/auto';

import React from 'react';
import {AppRegistry, LogBox, ScrollView, Text} from 'react-native';

// Silence LogBox in E2E builds so the in-app warning toast doesn't cover
// chat-bottom controls Appium needs. Left active otherwise so warnings
// surface during development.
if (__E2E__) {
  LogBox.ignoreAllLogs(true);
}


import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => {
  try {
    return require('./App').default;
  } catch (error) {
    const detail = String(error?.stack || error);
    return function StartupDiagnostic() {
      return React.createElement(ScrollView, {style: {flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#ffffff'}},
        React.createElement(Text, {style: {color: '#111111', fontSize: 18}, selectable: true}, 'Idiotinator startup error\n\n' + detail));
    };
  }
});
