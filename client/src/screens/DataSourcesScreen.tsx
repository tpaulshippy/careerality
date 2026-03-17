import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Header } from '../components';
import { DATA_SOURCES } from '../constants/dataSources';
import { colors, spacing, borderRadius, shadows, typography } from '../constants/theme';

export const DataSourcesScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <Header title="Data Sources" subtitle="Information about our data providers" />

      <View style={styles.lagWarning}>
        <Text style={styles.lagWarningTitle}>Data Currency Notice</Text>
        <Text style={styles.lagWarningText}>
          The data below represents the most recent available from each source. Due to the nature of government data collection and reporting, there is inherent lag in the information. Salary figures and employment statistics may not reflect current market conditions.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Primary Data Sources</Text>

      {DATA_SOURCES.map((source, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.sourceName}>{source.name}</Text>
          <Text style={styles.sourceType}>{source.source}</Text>
          <Text style={styles.description}>{source.description}</Text>
          <View style={styles.lagRow}>
            <View style={styles.lagBadge}>
              <Text style={styles.lagBadgeText}>Data Lag: {source.lag}</Text>
            </View>
            <Text style={styles.lastUpdated}>Latest data: {source.lastUpdated}</Text>
          </View>
        </View>
      ))}

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>Important Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          This application is for informational purposes only. Salary figures and career projections are based on historical data and may not guarantee future earnings. Employment outcomes vary based on individual factors, location, economic conditions, and other variables. Always conduct your own research and consult with financial and career advisors before making investment decisions about education.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  lagWarning: {
    backgroundColor: colors.warningLight,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  } as ViewStyle,
  lagWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: spacing.sm,
  } as TextStyle,
  lagWarningText: {
    fontSize: 14,
    color: '#92400E',
  } as TextStyle,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  } as TextStyle,
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.subtle,
  } as ViewStyle,
  sourceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
  } as TextStyle,
  sourceType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs,
  } as TextStyle,
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.md,
  } as TextStyle,
  lagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    justifyContent: 'space-between',
  } as ViewStyle,
  lagBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm / 2,
    borderRadius: borderRadius.full,
  } as ViewStyle,
  lagBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  } as TextStyle,
  lastUpdated: {
    fontSize: 13,
    color: colors.text.muted,
  } as TextStyle,
  disclaimer: {
    backgroundColor: colors.background,
    margin: spacing.md,
    marginBottom: spacing.xxl,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  } as ViewStyle,
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  } as TextStyle,
  disclaimerText: {
    fontSize: 12,
    color: colors.text.muted,
  } as TextStyle,
});
