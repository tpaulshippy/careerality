import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Card, Header, Section, InfoRow, Button, Loading, ErrorView, SkillBadge } from '../components';
import { useCareerData } from '../hooks/useCareerData';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { colors, spacing, typography } from '../constants/theme';

export const HomeScreen: React.FC = () => {
  const { career, loading, error, refetch } = useCareerData();

  if (loading) {
    return <Loading />;
  }

  if (error || !career) {
    return <ErrorView message={error || 'No career data available'} onRetry={refetch} />;
  }

  return (
    <ScrollView style={styles.container}>
      <Header title="Career ROI" subtitle="Discover career investment returns" />

      <Card>
        <Text style={styles.occupationName}>{career.occupation_name}</Text>
        <Text style={styles.occupationCode}>{career.occupation_code}</Text>
        
        <Section title="Salary Information">
          <InfoRow label="Median Salary" value={formatCurrency(career.annual_median_salary)} />
          {career.adjusted_salary !== career.annual_median_salary && (
            <InfoRow label="Adjusted Salary" value={formatCurrency(career.adjusted_salary)} valueColor={colors.success} />
          )}
        </Section>

        <Section title="Investment & ROI">
          <InfoRow label="Education Cost" value={formatCurrency(career.education_cost)} />
          <InfoRow label="Years to Breakeven" value={`${career.years_to_breakeven} years`} />
          <InfoRow label="ROI" value={formatPercent(career.roi_percentage)} highlight />
        </Section>

        <Section title="Location">
          <InfoRow label="Area" value={career.area_name} />
          <InfoRow label="Cost of Living Index" value={career.cost_of_living_index} />
        </Section>

        <Section title="Education & Skills">
          <InfoRow label="Education Level" value={career.education_level} />
          <InfoRow label="Job Zone" value={career.job_zone.toString()} />
          {career.skills && career.skills.length > 0 && (
            <View style={styles.skillsContainer}>
              <Text style={styles.skillsLabel}>Skills</Text>
              <View style={styles.skillsList}>
                {career.skills.map((skill, index) => (
                  <SkillBadge key={index} skill={skill} />
                ))}
              </View>
            </View>
          )}
        </Section>
      </Card>

      <Button title="Find Another Career" onPress={refetch} style={styles.button} />

      <Text style={styles.footer}>Data sourced from Bureau of Labor Statistics</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  occupationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  } as TextStyle,
  occupationCode: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  } as TextStyle,
  skillsContainer: {
    marginTop: spacing.sm,
  } as ViewStyle,
  skillsLabel: {
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  } as TextStyle,
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  } as ViewStyle,
  button: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  } as ViewStyle,
  footer: {
    textAlign: 'center',
    fontSize: typography.small.fontSize,
    color: colors.text.muted,
    marginBottom: spacing.xxl,
  } as TextStyle,
});
