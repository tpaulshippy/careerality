import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Card } from './Card';
import { Section } from './Section';
import { InfoRow } from './InfoRow';
import { SkillBadge } from './SkillBadge';
import { CareerROI } from '../types';
import { formatCurrency } from '../hooks/useFormatters';
import { useTheme } from '../hooks/useTheme';

interface CareerDetailViewProps {
  career: CareerROI;
  onClose?: () => void;
}

export const CareerDetailView: React.FC<CareerDetailViewProps> = ({ career, onClose }) => {
  const theme = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      )}

      <Card>
        <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>{career.occupation_name}</Text>
        <Text style={[styles.occupationCode, { color: theme.colors.text.secondary }]}>{career.occupation_code}</Text>

        <Section title="Salary Information">
          <InfoRow label="Median Salary" value={formatCurrency(career.annual_median_salary)} />
          {career.adjusted_salary !== career.annual_median_salary && (
            <InfoRow label="Adjusted Salary" value={formatCurrency(career.adjusted_salary)} valueColor={theme.colors.success} />
          )}
        </Section>

        <Section title="Investment">
          <InfoRow label="Education Cost" value={formatCurrency(career.education_cost)} />
          <InfoRow label="Years to Breakeven" value={`${career.years_to_breakeven} years`} />
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

        {(career.demand_rank || career.avg_annual_openings || career.projected_growth_percent) && (
          <Section title="Market Demand">
            {career.demand_rank && (
              <InfoRow label="Demand Rank" value={`#${career.demand_rank}`} />
            )}
            {career.avg_annual_openings && (
              <InfoRow label="Annual Openings" value={career.avg_annual_openings.toString()} />
            )}
            {career.projected_growth_percent && (
              <InfoRow label="Projected Growth" value={`${career.projected_growth_percent}%`} highlight />
            )}
          </Section>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  backButton: {
    padding: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  } as TextStyle,
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
});
