import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, TextStyle, View, ViewStyle, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DiscoverScreen, DataSourcesScreen, LikedScreen, CompareScreen, MapScreen, ProgressScreen, SearchScreen, RealityCheckScreen, InsightsScreen } from './src/screens';
import { CustomDrawerContent, OnboardingQuiz } from './src/components';
import { useTheme } from './src/hooks/useTheme';
import { useLocalStorage } from './src/hooks/useLocalStorage';
import { useFilters } from './src/hooks/useFilters';
import { lightColors, darkColors } from './src/constants/theme';
import { ONBOARDING_STORAGE_KEYS, OnboardingPayload } from './src/utils/onboarding';
import { EXPERIMENTAL_SCREENS_STORAGE_KEY } from './src/constants/features';

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
  const [onboardedFlag, setOnboardedFlag, clearOnboarded, onboardedLoaded] = useLocalStorage(
    ONBOARDING_STORAGE_KEYS.onboarded,
    false,
  );
  const [, setEduPrefStored] = useLocalStorage(ONBOARDING_STORAGE_KEYS.eduPref, 'any');
  const [experimentalScreens, setExperimentalScreens] = useLocalStorage(
    EXPERIMENTAL_SCREENS_STORAGE_KEY,
    false,
  );
  // App owns all persistence so queued writes always process even though the
  // quiz unmounts on finish (writes from an unmounting component are dropped).
  const { setStateCode, setSalaryMin, setSortBy } = useFilters();
  // Local override wins over the persisted flag because separate
  // useLocalStorage instances of the same key do not re-sync at runtime.
  const [quizActiveOverride, setQuizActiveOverride] = useState<boolean | null>(null);
  const [showMatchBanner, setShowMatchBanner] = useState(false);
  // Bumping this remounts the navigator so screens re-read persisted filters
  // right after the quiz applies them.
  const [navEpoch, setNavEpoch] = useState(0);

  useEffect(() => {
    if (!showMatchBanner) return;
    const timer = setTimeout(() => setShowMatchBanner(false), 4000);
    return () => clearTimeout(timer);
  }, [showMatchBanner]);

  if (!onboardedLoaded) {
    return <View style={[styles.root, { backgroundColor: theme.colors.background }]} />;
  }

  const showQuiz = quizActiveOverride ?? !onboardedFlag;

  const handleRetakeOnboarding = () => {
    clearOnboarded();
    setShowMatchBanner(false);
    setQuizActiveOverride(true);
  };

  const handleQuizFinish = (payload: OnboardingPayload | null) => {
    setQuizActiveOverride(false);
    setOnboardedFlag(true);
    if (payload) {
      setStateCode(payload.filterPatch.stateCode);
      setSalaryMin(payload.filterPatch.minSalary);
      setSortBy(payload.sortBy);
      setEduPrefStored(payload.eduPref);
      // Remount the navigator so Discover reads the freshly written filters.
      setNavEpoch(prev => prev + 1);
      setShowMatchBanner(true);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <NavigationContainer theme={navigationTheme}>
        <Drawer.Navigator
          key={navEpoch}
          initialRouteName="Discover"
          drawerContent={(props) => (
            <CustomDrawerContent {...props} onRetakeOnboarding={handleRetakeOnboarding} />
          )}
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
          name="Discover"
          options={{
            title: 'Discover',
            drawerIcon: () => (
              <Text style={styles.icon}>🔍</Text>
            ),
          }}
        >
          {() => <DiscoverScreen searchEnabled={experimentalScreens} />}
        </Drawer.Screen>
        <Drawer.Screen
          name="Map"
          component={MapScreen}
          options={{
            title: 'Map',
            drawerIcon: () => (
              <Text style={styles.icon}>🗺️</Text>
            ),
          }}
        />
        <Drawer.Screen
          name="Liked"
          component={LikedScreen}
          options={{
            title: 'Liked Careers',
            drawerIcon: () => (
              <Text style={styles.icon}>❤️</Text>
            ),
          }}
        />
        <Drawer.Screen
          name="Progress"
          component={ProgressScreen}
          options={{
            title: 'Your Progress',
            drawerIcon: () => (
              <Text style={styles.icon}>🏆</Text>
            ),
          }}
        />
        <Drawer.Screen
          name="Insights"
          component={InsightsScreen}
          options={{
            title: 'My Insights',
            drawerIcon: () => (
              <Text style={styles.icon}>📊</Text>
            ),
          }}
        />
        <Drawer.Screen
          name="DataSources"
          options={{
            title: 'Data Sources',
            drawerIcon: () => (
              <Text style={styles.icon}>📁</Text>
            ),
          }}
        >
          {() => (
            <DataSourcesScreen
              experimentalEnabled={experimentalScreens}
              onToggleExperimental={(enabled) => setExperimentalScreens(enabled)}
            />
          )}
        </Drawer.Screen>
        {experimentalScreens && (
          <Drawer.Screen
            name="Search"
            component={SearchScreen}
            options={{
              title: 'Search',
              drawerIcon: () => (
                <Text style={styles.icon}>🔎</Text>
              ),
            }}
          />
        )}
        {experimentalScreens && (
          <Drawer.Screen
            name="RealityCheck"
            component={RealityCheckScreen}
            options={{
              title: 'Reality Check',
              drawerIcon: () => (
                <Text style={styles.icon}>💵</Text>
              ),
            }}
          />
        )}
        <Drawer.Screen
          name="Compare"
          component={CompareScreen}
          options={{
            title: 'Compare',
            drawerItemStyle: { display: 'none' },
          }}
        />
      </Drawer.Navigator>
      </NavigationContainer>
      {showQuiz && <OnboardingQuiz onFinish={handleQuizFinish} />}
      {showMatchBanner && !showQuiz && (
        <View
          style={[
            styles.matchBanner,
            { backgroundColor: theme.colors.surface, shadowColor: '#000' },
          ]}
        >
          <Text style={[styles.matchBannerText, { color: theme.colors.text.primary }]}>
            ✓ Showing careers matched to your setup
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  } as ViewStyle,
  icon: {
    fontSize: 20,
  } as TextStyle,
  matchBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  } as ViewStyle,
  matchBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,
});
