import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';

interface CareerROI {
  id: number;
  occupation_code: string;
  occupation_name: string;
  area_code: string;
  area_name: string;
  annual_median_salary: string;
  education_cost: string;
  years_to_breakeven: number;
  roi_percentage: string;
  job_zone: number;
  education_level: string;
  skills: string[];
  cost_of_living_index: string;
  adjusted_salary: string;
  industry_code: string;
  industry_name: string;
}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
const API_URL = `${API_BASE}/api/roi`;

interface DataSource {
  name: string;
  source: string;
  lag: string;
  description: string;
  lastUpdated: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    name: 'Bureau of Labor Statistics (BLS)',
    source: 'Occupational Employment and Wage Statistics (OEWS)',
    lag: '2-3 years',
    description: 'Salary data, employment statistics, and job outlook information for occupations',
    lastUpdated: 'May 2024',
  },
  {
    name: 'Bureau of Labor Statistics (BLS)',
    source: 'Consumer Expenditure Survey (CE)',
    lag: '1-2 years',
    description: 'Cost of living and expenditure data used to calculate regional purchasing power',
    lastUpdated: '2023',
  },
  {
    name: 'National Center for Education Statistics (NCES)',
    source: 'IPEDS',
    lag: '1-2 years',
    description: 'Education costs, tuition, and program duration for various degree paths',
    lastUpdated: '2023-24',
  },
  {
    name: "O*NET",
    source: 'Skills, Abilities, Work Activities Database',
    lag: 'Ongoing updates',
    description: 'Occupational skills requirements, job zones, and ability profiles',
    lastUpdated: 'Continuously updated',
  },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Career ROI</Text>
        <Text style={styles.drawerSubtitle}>Career Investment Calculator</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

const Drawer = createDrawerNavigator();

function HomeScreen() {
  const [career, setCareer] = useState<CareerROI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopCareer = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data: CareerROI[] = await response.json();
      if (data.length > 0) {
        const sortedByROI = [...data].sort((a, b) => 
          parseFloat(b.roi_percentage) - parseFloat(a.roi_percentage)
        );
        const top10 = sortedByROI.slice(0, 10);
        const randomIndex = Math.floor(Math.random() * top10.length);
        setCareer(top10[randomIndex]);
      } else {
        setError('No careers found');
      }
    } catch (err) {
      setError('Failed to load career data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopCareer();
  }, []);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading careers...</Text>
      </View>
    );
  }

  if (error || !career) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'No career data available'}</Text>
        <TouchableOpacity style={styles.button} onPress={fetchTopCareer}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Career ROI</Text>
        <Text style={styles.subtitle}>Discover career investment returns</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.occupationName}>{career.occupation_name}</Text>
        <Text style={styles.occupationCode}>{career.occupation_code}</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Median Salary</Text>
            <Text style={styles.value}>{formatCurrency(career.annual_median_salary)}</Text>
          </View>
          {career.adjusted_salary !== career.annual_median_salary && (
            <View style={styles.row}>
              <Text style={styles.label}>Adjusted Salary</Text>
              <Text style={styles.valueGreen}>{formatCurrency(career.adjusted_salary)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Investment & ROI</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Education Cost</Text>
            <Text style={styles.value}>{formatCurrency(career.education_cost)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Years to Breakeven</Text>
            <Text style={styles.value}>{career.years_to_breakeven} years</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>ROI</Text>
            <Text style={styles.valueHighlight}>{formatPercent(career.roi_percentage)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Area</Text>
            <Text style={styles.value}>{career.area_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cost of Living Index</Text>
            <Text style={styles.value}>{career.cost_of_living_index}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education & Skills</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Education Level</Text>
            <Text style={styles.value}>{career.education_level}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Job Zone</Text>
            <Text style={styles.value}>{career.job_zone}</Text>
          </View>
          {career.skills && career.skills.length > 0 && (
            <View style={styles.skillsContainer}>
              <Text style={styles.label}>Skills</Text>
              <View style={styles.skillsList}>
                {career.skills.map((skill, index) => (
                  <View key={index} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={fetchTopCareer}>
        <Text style={styles.buttonText}>Find Another Career</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Data sourced from Bureau of Labor Statistics</Text>
    </ScrollView>
  );
}

function DataSourcesScreen() {
  return (
    <ScrollView style={styles.dsContainer}>
      <View style={styles.dsHeader}>
        <Text style={styles.dsTitle}>Data Sources</Text>
        <Text style={styles.dsSubtitle}>Information about our data providers</Text>
      </View>

      <View style={styles.dsLagWarning}>
        <Text style={styles.dsLagWarningTitle}>Data Currency Notice</Text>
        <Text style={styles.dsLagWarningText}>
          The data below represents the most recent available from each source. Due to the nature of government data collection and reporting, there is inherent lag in the information. Salary figures and employment statistics may not reflect current market conditions.
        </Text>
      </View>

      <Text style={styles.dsSectionTitle}>Primary Data Sources</Text>

      {DATA_SOURCES.map((source, index) => (
        <View key={index} style={styles.dsCard}>
          <Text style={styles.dsSourceName}>{source.name}</Text>
          <Text style={styles.dsSourceType}>{source.source}</Text>
          <Text style={styles.dsDescription}>{source.description}</Text>
          <View style={styles.dsLagRow}>
            <View style={styles.dsLagBadge}>
              <Text style={styles.dsLagBadgeText}>Data Lag: {source.lag}</Text>
            </View>
            <Text style={styles.dsLastUpdated}>Latest data: {source.lastUpdated}</Text>
          </View>
        </View>
      ))}

      <View style={styles.dsDisclaimer}>
        <Text style={styles.dsDisclaimerTitle}>Important Disclaimer</Text>
        <Text style={styles.dsDisclaimerText}>
          This application is for informational purposes only. Salary figures and career projections are based on historical data and may not guarantee future earnings. Employment outcomes vary based on individual factors, location, economic conditions, and other variables. Always conduct your own research and consult with financial and career advisors before making investment decisions about education.
        </Text>
      </View>
    </ScrollView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#4F46E5' },
          headerTintColor: '#FFFFFF',
          drawerActiveBackgroundColor: '#EEF2FF',
          drawerActiveTintColor: '#4F46E5',
          drawerInactiveTintColor: '#6B7280',
          drawerLabelStyle: { marginLeft: -20, fontSize: 16 },
        }}
      >
        <Drawer.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            title: 'Career ROI',
            drawerIcon: () => (
              <Text style={{ fontSize: 20 }}>📊</Text>
            ),
          }}
        />
        <Drawer.Screen 
          name="DataSources" 
          component={DataSourcesScreen}
          options={{
            title: 'Data Sources',
            drawerIcon: () => (
              <Text style={{ fontSize: 20 }}>📁</Text>
            ),
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#C7D2FE',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  occupationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  occupationCode: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    color: '#6B7280',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  valueGreen: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  valueHighlight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  skillsContainer: {
    marginTop: 8,
  },
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  skillBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#4F46E5',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 40,
  },
  drawerContent: {
    flex: 1,
  },
  drawerHeader: {
    backgroundColor: '#4F46E5',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  drawerSubtitle: {
    fontSize: 14,
    color: '#C7D2FE',
    marginTop: 4,
  },
  dsContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  dsHeader: {
    backgroundColor: '#4F46E5',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  dsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dsSubtitle: {
    fontSize: 14,
    color: '#C7D2FE',
    marginTop: 4,
  },
  dsLagWarning: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  dsLagWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8,
  },
  dsLagWarningText: {
    fontSize: 14,
    color: '#92400E',
  },
  dsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  dsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dsSourceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  dsSourceType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 4,
  },
  dsDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  dsLagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  dsLagBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dsLagBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  dsLastUpdated: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  dsDisclaimer: {
    backgroundColor: '#F3F4F6',
    margin: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dsDisclaimerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 8,
  },
  dsDisclaimerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
