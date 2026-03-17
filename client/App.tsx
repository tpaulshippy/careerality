import React from 'react';
import { Text, StyleSheet, TextStyle, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { HomeScreen, DataSourcesScreen } from './src/screens';
import { CustomDrawerContent } from './src/components';
import { useTheme } from './src/hooks/useTheme';
import { lightColors, darkColors } from './src/constants/theme';

const Drawer = createDrawerNavigator();

const LightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.text.primary,
    border: lightColors.border,
  },
};

const DarkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.text.primary,
    border: darkColors.border,
  },
};

export default function App() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const navigationTheme = colorScheme === 'dark' ? DarkNavigationTheme : LightNavigationTheme;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#FFFFFF',
          drawerActiveBackgroundColor: theme.colors.primaryLight,
          drawerActiveTintColor: theme.colors.primary,
          drawerInactiveTintColor: theme.colors.text.secondary,
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
