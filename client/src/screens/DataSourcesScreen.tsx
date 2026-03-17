import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Header } from '../components';
import { DATA_SOURCES } from '../constants/dataSources';
import { useTheme } from '../hooks/useTheme';

export const DataSourcesScreen: React.FC = () => {
  const theme = useTheme();
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title="Data Sources" subtitle="Information about our data providers" />

      <View style={[styles.lagWarning, { backgroundColor: theme.colors.warningLight, borderLeftColor: theme.colors.warning }]}>
        <Text style={[styles.lagWarningTitle, { color: '#92400E' }]}>Data Currency Notice</Text>
        <Text style={[styles.lagWarningText, { color: '#92400E' }]}>
          The data below represents the most recent available from each source. Due to the nature of government data collection and reporting, there is inherent lag in the information. Salary figures and employment statistics may not reflect current market conditions.
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Primary Data Sources</Text>

      {DATA_SOURCES.map((source, index) => (
        <View key={index} style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
          <Text style={[styles.sourceName, { color: theme.colors.text.primary }]}>{source.name}</Text>
          <Text style={[styles.sourceType, { color: theme.colors.primary }]}>{source.source}</Text>
          <Text style={[styles.description, { color: theme.colors.text.secondary }]}>{source.description}</Text>
          <View style={styles.lagRow}>
            <View style={[styles.lagBadge, { backgroundColor: theme.colors.warningLight }]}>
              <Text style={[styles.lagBadgeText, { color: '#92400E' }]}>Data Lag: {source.lag}</Text>
            </View>
            <Text style={[styles.lastUpdated, { color: theme.colors.text.muted }]}>Latest data: {source.lastUpdated}</Text>
          </View>
        </View>
      ))}

      <View style={[styles.disclaimer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <Text style={[styles.disclaimerTitle, { color: theme.colors.text.secondary }]}>Important Disclaimer</Text>
        <Text style={[styles.disclaimerText, { color: theme.colors.text.muted }]}>
          This application is for informational purposes only. Salary figures and career projections are based on historical data and may not guarantee future earnings. Employment outcomes vary based on individual factors, location, economic conditions, and other variables. Always conduct your own research and consult with financial and career advisors before making investment decisions about education.
        </Text>
      </View>

      <Text style={[styles.modeIndicator, { color: theme.colors.text.muted }]}>
        Mode: {theme.isDark ? 'Dark' : 'Light'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  lagWarning: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  } as ViewStyle,
  lagWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  } as TextStyle,
  lagWarningText: {
    fontSize: 14,
  } as TextStyle,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  } as TextStyle,
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  } as ViewStyle,
  sourceName: {
    fontSize: 16,
    fontWeight: 'bold',
  } as TextStyle,
  sourceType: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  } as TextStyle,
  description: {
    fontSize: 14,
    marginTop: 16,
  } as TextStyle,
  lagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'space-between',
  } as ViewStyle,
  lagBadge: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 9999,
  } as ViewStyle,
  lagBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  lastUpdated: {
    fontSize: 13,
  } as TextStyle,
  disclaimer: {
    margin: 16,
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  } as ViewStyle,
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  } as TextStyle,
  disclaimerText: {
    fontSize: 12,
  } as TextStyle,
  modeIndicator: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 30,
  } as TextStyle,
});
