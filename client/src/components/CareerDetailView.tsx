import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ImageStyle, Image, Linking } from 'react-native';
import { Card } from './Card';
import { Section } from './Section';
import { InfoRow } from './InfoRow';
import { SkillBadge } from './SkillBadge';
import { OccupationIconBadge } from './OccupationIconBadge';
import { CareerROI, CareerImage } from '../types';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { useTheme } from '../hooks/useTheme';
import { getOccupationGroup } from '../utils/occupationGroup';
import { getImageUrls, IMAGE_SLOTS } from '../utils/careerImage';

const JOB_ZONE_LABELS: Record<number, string> = {
  1: 'Little to no preparation',
  2: 'Some preparation',
  3: 'Medium preparation',
  4: 'Considerable preparation',
  5: 'Extensive preparation',
};

const SLIDE_INTERVAL_MS = 4000;

interface CareerDetailViewProps {
  career: CareerROI;
  images?: CareerImage[];
  onClose?: () => void;
  onInterest?: () => void;
}

export const CareerDetailView: React.FC<CareerDetailViewProps> = ({ career, images, onClose, onInterest }) => {
  const theme = useTheme();

  // Slideshow state. `urls` holds one candidate per generated slot plus the
  // pre-slideshow single image as a final fallback, so careers that have not been
  // regenerated yet still render something.
  const urls = getImageUrls(career.occupation_code);
  const [cursor, setCursor] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Candidate indices that have not 404'd. Only real slideshow slots get a dot;
  // the trailing legacy image is a fallback, not a frame.
  const available = useMemo(
    () => urls.map((_, i) => i).filter((i) => !failed.has(i)),
    [urls, failed]
  );
  const frames = available.filter((i) => i < IMAGE_SLOTS);
  const showImage = !hidden && available.length > 0;
  // cursor is always a valid index: it is only ever set from `available`, from
  // `remaining`, or reset to 0.
  const currentIndex = failed.has(cursor) ? available[0] : cursor;
  const currentUrl = urls[currentIndex];

  const advance = useCallback(() => {
    if (available.length <= 1) return;
    const position = available.indexOf(currentIndex);
    setCursor(available[(position + 1) % available.length]);
  }, [available, currentIndex]);

  // Reset whenever the career changes.
  useEffect(() => {
    setCursor(0);
    setFailed(new Set());
    setHidden(false);
  }, [career.occupation_code]);

  // Auto-advance only while more than one image is actually available.
  useEffect(() => {
    if (!showImage || available.length <= 1) return undefined;
    timer.current = setInterval(advance, SLIDE_INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [showImage, available.length, advance]);

  const handleImageError = () => {
    const next = new Set(failed);
    next.add(currentIndex);
    setFailed(next);

    const remaining = urls.map((_, i) => i).filter((i) => !next.has(i));
    if (remaining.length === 0) {
      setHidden(true);
      return;
    }
    if (next.has(cursor)) setCursor(remaining[0]);
  };

  const handleDotPress = (target: number) => setCursor(target);

  const isNational = career.area_code === '99' || career.area_name === 'U.S.';
  const showColIndex = !isNational && career.adjusted_salary !== career.annual_median_salary;
  const jobZoneLabel = JOB_ZONE_LABELS[career.job_zone]
    ? `${JOB_ZONE_LABELS[career.job_zone]} (Zone ${career.job_zone})`
    : `Zone ${career.job_zone}`;

  const handleVideoPress = () => {
    if (career.video_url) {
      Linking.openURL(career.video_url);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      )}

      <Card>
        <View style={styles.headerRow}>
          <OccupationIconBadge groupName={getOccupationGroup(career.occupation_code)} size={48} />
          <View style={styles.headerText}>
            <Text style={[styles.occupationName, { color: theme.colors.text.primary }]}>{career.occupation_name}</Text>
          </View>
          {onInterest && (
            <TouchableOpacity
              testID="career-detail-interest"
              accessibilityLabel={`Express interest in ${career.occupation_name}`}
              onPress={onInterest}
              style={[styles.interestButton, { backgroundColor: theme.colors.primaryLight }]}
              activeOpacity={0.75}
            >
              <Text style={[styles.interestIcon, { color: theme.colors.success }]}>✓</Text>
            </TouchableOpacity>
          )}
        </View>

        {showImage && (
          <View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel={`Show next photo of ${career.occupation_name}`}
            >
              <Image
                source={{ uri: currentUrl }}
                style={styles.careerImage}
                resizeMode="cover"
                testID="career-detail-image"
                onError={handleImageError}
              />
            </TouchableOpacity>

            {available.length > 1 && (
              <View style={styles.dots} testID="career-detail-dots">
                {frames.map((i) => (
                  <TouchableOpacity
                    key={urls[i]}
                    onPress={() => handleDotPress(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Photo ${i + 1}`}
                    testID={`career-detail-dot-${i}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          i === currentIndex ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {career.day_in_life_full && (
          <View style={styles.dayInLifeSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Day in the Life</Text>
            <Text style={[styles.dayInLifeText, { color: theme.colors.text.secondary }]}>
              {career.day_in_life_full}
            </Text>
          </View>
        )}

        {images && images.length > 0 && (
          <View style={styles.imageGallery}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {images.map((img) => (
                <Image key={img.id} source={{ uri: img.image_url.replace(/\.png$/, '.webp') }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </View>
        )}

        {career.video_url && (
          <TouchableOpacity style={[styles.videoButton, { backgroundColor: theme.colors.surface }]} onPress={handleVideoPress}>
            <Text style={[styles.videoButtonText, { color: theme.colors.primary }]}>🎥 Watch Career Video</Text>
          </TouchableOpacity>
        )}

        <Section title="Salary Information">
          <InfoRow label="Median Salary" value={formatCurrency(career.annual_median_salary)} />
          {career.adjusted_salary !== career.annual_median_salary && (
            <InfoRow label="Adjusted Salary" value={formatCurrency(career.adjusted_salary)} valueColor={theme.colors.success} />
          )}
        </Section>

        <Section title="Investment">
          <InfoRow label="ROI" value={formatPercent(career.roi_percentage)} highlight />
          <InfoRow label="Education Cost" value={formatCurrency(career.education_cost)} />
          <InfoRow label="Years to Breakeven" value={`${career.years_to_breakeven} years`} />
        </Section>

        <Section title="Location">
          <InfoRow label="Area" value={career.area_name} />
          {showColIndex && (
            <InfoRow label="Cost of Living Index" value={career.cost_of_living_index} />
          )}
        </Section>

        <Section title="Education & Skills">
          <InfoRow label="Education Level" value={career.education_level} />
          <InfoRow label="Preparation" value={jobZoneLabel} />
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
  careerImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  } as ImageStyle,
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 20,
  } as ViewStyle,
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  } as ViewStyle,
  headerText: {
    flex: 1,
  } as ViewStyle,
  interestButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  interestIcon: {
    fontSize: 24,
    fontWeight: '700',
  } as TextStyle,
  dayInLifeSection: {
    marginBottom: 20,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  } as TextStyle,
  dayInLifeText: {
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,
  imageGallery: {
    marginBottom: 20,
  } as ViewStyle,
  imageScroll: {
    marginTop: 8,
  } as ViewStyle,
  galleryImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 12,
  } as ImageStyle,
  videoButton: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
  } as ViewStyle,
  videoButtonText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
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
