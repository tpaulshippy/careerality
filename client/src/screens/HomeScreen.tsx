import React from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Card, Header, Section, InfoRow, Button, Loading, ErrorView, SkillBadge } from '../components';
import { useCareerData } from '../hooks/useCareerData';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { useTheme } from '../hooks/useTheme';

export const HomeScreen: React.FC = () => {
  const theme = useTheme();
  const { career, loading, error, refetch } = useCareerData();

  if (loading) {
    return <Loading />;
  }

  if (error || !career) {
    return <ErrorView message={error || 'No career data available'} onRetry={refetch} />;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title="Career ROI" subtitle="Discover career investment returns" />

      <Card>
        <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>{career.occupation_name}</Text>
        <Text style={[styles.occupationCode, { color: theme.colors.text.secondary }]}>{career.occupation_code}</Text>
        
        <Section title="Salary Information">
          <InfoRow label="Median Salary" value={formatCurrency(career.annual_median_salary)} />
          {career.adjusted_salary !== career.annual_median_salary && (
            <InfoRow label="Adjusted Salary" value={formatCurrency(career.adjusted_salary)} valueColor={theme.colors.success} />
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
              <Text style={[styles.skillsLabel, { color: theme.colors.text.secondary }]}>Skills</Text>
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

      <Text style={[styles.footer, { color: theme.colors.text.muted }]}>Data sourced from Bureau of Labor Statistics</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  occupationName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  } as TextStyle,
  occupationCode: {
    fontSize: 14,
    marginBottom: 20,
  } as TextStyle,
  skillsContainer: {
    marginTop: 8,
  } as ViewStyle,
  skillsLabel: {
    fontSize: 15,
  } as TextStyle,
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  } as ViewStyle,
  button: {
    marginHorizontal: 20,
    marginBottom: 20,
  } as ViewStyle,
  footer: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 30,
  } as TextStyle,
});
