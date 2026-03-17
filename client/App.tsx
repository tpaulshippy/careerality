import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { HomeScreen, DataSourcesScreen } from './src/screens';
import { CustomDrawerContent } from './src/components';
import { colors } from './src/constants/theme';

const Drawer = createDrawerNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          drawerActiveBackgroundColor: colors.primaryLight,
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.text.secondary,
          drawerLabelStyle: { marginLeft: 8, fontSize: 16 },
        }}
      >
        <Drawer.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            title: 'Career ROI',
            drawerIcon: () => (
              <Text style={styles.icon}>📊</Text>
            ),
          }}
        />
        <Drawer.Screen 
          name="DataSources" 
          component={DataSourcesScreen}
          options={{
            title: 'Data Sources',
            drawerIcon: () => (
              <Text style={styles.icon}>📁</Text>
            ),
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
  } as TextStyle,
});
