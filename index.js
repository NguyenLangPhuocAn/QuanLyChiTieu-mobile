/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import WidgetQuickEntry from './src/screens/widget/WidgetQuickEntry';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('NovaWidgetEntry', () => WidgetQuickEntry);
