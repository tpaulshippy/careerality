import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { CareerROI } from '../types';

interface SwipeCardProps {
  career: CareerROI;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({ career, onSwipeLeft, onSwipeRight }) => {
  const theme = useTheme();

  const formatCurrency = (value: string) => {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return value;
    return `$${num.toLocaleString()}`;
  };

  const roiValue = parseFloat(career.roi_percentage.replace(/[^0-9.-]/g, ''));
  const roiColor = roiValue >= 100 ? theme.colors.success : roiValue >= 50 ? theme.colors.warning : theme.colors.error;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.card]}>
      <View style={styles.header}>
        <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>
          {career.occupation_name}
        </Text>
        <Text style={[styles.areaName, { color: theme.colors.text.secondary }]}>
          {career.area_name}
        </Text>
      </View>

      <View style={styles.roiContainer}>
        <Text style={[styles.roiValue, { color: roiColor }]}>{career.roi_percentage}</Text>
        <Text style={[styles.roiLabel, { color: theme.colors.text.secondary }]}>ROI</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Annual Salary</Text>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
            {formatCurrency(career.annual_median_salary)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Education Cost</Text>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
            {formatCurrency(career.education_cost)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Break-even</Text>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
            {career.years_to_breakeven} years
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Job Zone</Text>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
            {career.job_zone}
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
          onPress={onSwipeLeft}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
          onPress={onSwipeRight}
          activeOpacity={0.8}
        >
          <Text style={styles.actionButtonText}>Like</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  } as ViewStyle,
  header: {
    marginBottom: 16,
  } as ViewStyle,
  occupationName: {
    fontSize: 22,
    fontWeight: 'bold',
  } as TextStyle,
  areaName: {
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  roiContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  } as ViewStyle,
  roiValue: {
    fontSize: 36,
    fontWeight: 'bold',
  } as TextStyle,
  roiLabel: {
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  } as ViewStyle,
  statItem: {
    width: '50%',
    paddingVertical: 8,
  } as ViewStyle,
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  } as TextStyle,
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  } as ViewStyle,
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  } as ViewStyle,
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
});