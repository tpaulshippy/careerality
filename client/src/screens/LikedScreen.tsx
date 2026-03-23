import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { Header, CareerDetailView, OccupationIconBadge } from '../components';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { getOccupationGroup } from '../utils/occupationGroup';

interface LikedRecord extends CareerROI {
  swipe_id: number;
  swiped_at: string;
}

export const LikedScreen: React.FC = () => {
  const theme = useTheme();
  const [records, setRecords] = useState<LikedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const fetchKeyRef = useRef(0);

  const fetchLikedCareers = useCallback(async () => {
    const thisFetch = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);

    try {
      const json = await apiClient.getLikedCareers() as { records: LikedRecord[] };
      if (thisFetch !== fetchKeyRef.current) return;
      const data = json.records || [];
      setRecords(data);
    } catch {
      if (thisFetch === fetchKeyRef.current) {
        setError('Failed to load liked careers');
      }
    } finally {
      if (thisFetch === fetchKeyRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLikedCareers();
    }, [fetchLikedCareers])
  );

  const handleRemove = useCallback(async (swipeId: number) => {
    try {
      await apiClient.removeSwipe(swipeId);
      setRecords(prev => prev.filter(r => r.swipe_id !== swipeId));
    } catch {
      Alert.alert('Error', 'Failed to remove career. Please try again.');
    }
  }, []);

  const handleCardPress = useCallback((career: CareerROI) => {
    setDetailCareer(career);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailCareer(null);
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading liked careers...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Text style={[styles.retryText, { color: theme.colors.primary }]} onPress={fetchLikedCareers}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (detailCareer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={detailCareer} onClose={handleCloseDetails} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Header title="Liked Careers" subtitle="Occupations you're interested in" />
      
      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            No liked careers yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
            Swipe right on careers in Discover to add them here
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {records.map(record => (
            <TouchableOpacity
              key={record.swipe_id}
              style={[styles.card, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}
              onPress={() => handleCardPress(record)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(record.swipe_id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.removeButtonText, { color: theme.colors.text.muted }]}>✕</Text>
              </TouchableOpacity>
              
              <View style={styles.cardContent}>
                <OccupationIconBadge
                  groupName={getOccupationGroup(record.occupation_code)}
                  size={40}
                />
                <View style={styles.textContainer}>
                  <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>
                    {record.occupation_name}
                  </Text>
                  <Text style={[styles.areaName, { color: theme.colors.text.secondary }]}>
                    {record.area_name}
                  </Text>
                  
                  <View style={styles.statsRow}>
                    <Text style={[styles.stat, { color: theme.colors.text.primary }]}>
                      {formatCurrency(record.annual_median_salary)}
                    </Text>
                    <Text style={[styles.stat, { color: theme.colors.primary }]}>
                      {formatPercent(record.roi_percentage)}
                    </Text>
                    <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
                      {record.years_to_breakeven}yr
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  } as TextStyle,
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  } as ViewStyle,
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  } as TextStyle,
  list: {
    paddingVertical: 16,
  } as ViewStyle,
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  } as ViewStyle,
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  } as ViewStyle,
  removeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  } as TextStyle,
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  textContainer: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,
  occupationName: {
    fontSize: 16,
    fontWeight: 'bold',
  } as TextStyle,
  areaName: {
    fontSize: 14,
    marginTop: 2,
  } as TextStyle,
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  } as ViewStyle,
  stat: {
    fontSize: 13,
    marginRight: 12,
  } as TextStyle,
});