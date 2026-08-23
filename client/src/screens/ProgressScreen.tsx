import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useGamification } from '../hooks/useGamification';
import {
  ACHIEVEMENTS,
  currentStreak,
  GamificationState,
  progressToNext,
  shiftDateKey,
  utcDateKey,
} from '../utils/gamification';

const RING_SIZE = 148;
const RING_STROKE = 12;
const RING_SEGMENTS = 60;
const STREAK_DAYS = 14;

/** Circular progress ring built from rotating tick segments (no SVG dependency). */
const ProgressRing: React.FC<{ fraction: number; color: string; trackColor: string; label: string; sublabel: string; labelColor: string }> = ({
  fraction,
  color,
  trackColor,
  label,
  sublabel,
  labelColor,
}) => {
  const clamped = Math.min(1, Math.max(0, fraction));
  const lit = Math.round(clamped * RING_SEGMENTS);
  const segAngle = 360 / RING_SEGMENTS;
  const segWidth = 4.5;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      {Array.from({ length: RING_SEGMENTS }, (_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: RING_SIZE,
            height: RING_SIZE,
            transform: [{ rotate: `${i * segAngle}deg` }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: (RING_SIZE - segWidth) / 2,
              width: segWidth,
              height: RING_STROKE,
              borderRadius: segWidth / 2,
              backgroundColor: i < lit ? color : trackColor,
            }}
          />
        </View>
      ))}
      <View style={styles.ringCenter}>
        <Text style={[styles.ringLevel, { color: labelColor }]}>{label}</Text>
        <Text style={[styles.ringSublabel, { color: labelColor }]}>{sublabel}</Text>
      </View>
    </View>
  );
};

const collectLastDays = (today: string): string[] =>
  Array.from({ length: STREAK_DAYS }, (_, i) => shiftDateKey(today, i - (STREAK_DAYS - 1)));

export const ProgressScreen: React.FC = () => {
  const theme = useTheme();
  const { state, isLoaded } = useGamification();
  const s: GamificationState = state;

  const progress = progressToNext(s.xp);
  const today = utcDateKey(new Date());
  const streak = currentStreak(s.activeDates, today);
  const lastDays = collectLastDays(today);
  const streakSet = new Set(s.activeDates);
  const unlockedCount = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

  if (!isLoaded) {
    return <View style={[styles.container, { backgroundColor: theme.colors.background }]} />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }, theme.shadows.card]}>
        <ProgressRing
          fraction={progress.fraction}
          color={theme.colors.primary}
          trackColor={theme.colors.border}
          label={`Lv ${progress.level}`}
          sublabel={`${progress.totalXp} XP`}
          labelColor={theme.colors.text.primary}
        />
        <Text style={[styles.xpRemaining, { color: theme.colors.text.secondary }]}>
          {progress.level === 1 && progress.totalXp === 0
            ? 'Review careers to earn XP'
            : `${progress.xpRemaining} XP to Level ${progress.level + 1}`}
        </Text>
        <View style={[styles.xpBarTrack, { backgroundColor: theme.colors.border }]}>
          <View
            style={[
              styles.xpBarFill,
              { backgroundColor: theme.colors.success, width: `${Math.round(progress.fraction * 100)}%` as `${number}%` },
            ]}
          />
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>🔥 Streak</Text>
          <Text style={[styles.streakCount, { color: theme.colors.warning }]}>
            {streak} {streak === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <View style={styles.streakStrip}>
          {lastDays.map((day) => {
            const active = streakSet.has(day);
            return (
              <View key={day} style={styles.streakDay}>
                {active ? (
                  <Text style={styles.streakFlame}>🔥</Text>
                ) : (
                  <View style={[styles.streakDotIdle, { backgroundColor: theme.colors.border }]} />
                )}
                <Text style={[styles.streakDayLabel, { color: theme.colors.text.muted }]}>
                  {day.slice(8)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>🏅 Achievements</Text>
          <Text style={[styles.achievementCount, { color: theme.colors.text.secondary }]}>
            {unlockedCount}/{ACHIEVEMENTS.length}
          </Text>
        </View>
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((def) => {
            const unlockedAt = s.achievements[def.id];
            return (
              <View
                key={def.id}
                style={[
                  styles.tile,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  !unlockedAt && styles.tileLocked,
                ]}
              >
                <Text style={[styles.tileIcon, !unlockedAt && styles.tileIconLocked]}>{def.icon}</Text>
                <Text
                  style={[styles.tileTitle, { color: unlockedAt ? theme.colors.text.primary : theme.colors.text.muted }]}
                  numberOfLines={2}
                >
                  {def.title}
                </Text>
                <Text
                  style={[styles.tileMeta, { color: unlockedAt ? theme.colors.success : theme.colors.text.muted }]}
                  numberOfLines={1}
                >
                  {unlockedAt ? new Date(unlockedAt).toLocaleDateString() : `🔒 ${def.description}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.footerCard, { backgroundColor: theme.colors.surface }, theme.shadows.subtle]}>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>{s.totalReviews}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Reviews</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>{s.likes}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Likes</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>{s.feedbacks}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>Feedbacks</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  content: {
    padding: 20,
    paddingBottom: 40,
  } as ViewStyle,
  heroCard: {
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
  } as ViewStyle,
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  ringLevel: {
    fontSize: 30,
    fontWeight: 'bold',
  } as TextStyle,
  ringSublabel: {
    fontSize: 13,
    marginTop: 2,
  } as TextStyle,
  xpRemaining: {
    marginTop: 16,
    fontSize: 14,
  } as TextStyle,
  xpBarTrack: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 9999,
    marginTop: 12,
    overflow: 'hidden',
  } as ViewStyle,
  xpBarFill: {
    height: '100%' as `${number}%`,
    borderRadius: 9999,
  } as ViewStyle,
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  } as ViewStyle,
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  streakCount: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
  streakStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  } as ViewStyle,
  streakDay: {
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,
  streakFlame: {
    fontSize: 15,
  } as TextStyle,
  streakDotIdle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
    marginBottom: 3,
  } as ViewStyle,
  streakDayLabel: {
    fontSize: 9,
    marginTop: 4,
  } as TextStyle,
  achievementCount: {
    fontSize: 13,
  } as TextStyle,
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  } as ViewStyle,
  tile: {
    width: '33.33%' as `${number}%`,
    aspectRatio: 0.92,
    marginVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  tileLocked: {
    opacity: 0.55,
  },
  tileIcon: {
    fontSize: 26,
    marginBottom: 6,
  } as TextStyle,
  tileIconLocked: {
    opacity: 0.45,
  },
  tileTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  } as TextStyle,
  tileMeta: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 3,
  } as TextStyle,
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 18,
  } as ViewStyle,
  statBlock: {
    flex: 1,
    alignItems: 'center',
  } as ViewStyle,
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  } as TextStyle,
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  } as TextStyle,
  statDivider: {
    width: 1,
    height: 32,
  } as ViewStyle,
});
