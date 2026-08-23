import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { apiClient } from '../api/client';
import { Button } from './Button';
import { FilterChip } from './FilterChip';
import {
  assemblePayload,
  buildStateOptions,
  canAdvance,
  EDU_PREF_OPTIONS,
  EMPTY_ANSWERS,
  filterStateOptions,
  ONBOARDING_STEPS,
  PRIORITY_OPTIONS,
  SALARY_PRESETS,
  StateOption,
  TOTAL_STEPS,
} from '../utils/onboarding';

interface OnboardingQuizProps {
  // Called with the assembled payload on finish, or null when skipped.
  onFinish: (payload: ReturnType<typeof assemblePayload> | null) => void;
}

const WELCOME_BULLETS = [
  { icon: '💸', title: 'Real salaries', body: 'Median pay from official labor data' },
  { icon: '🎓', title: 'Cost vs. payoff', body: 'How fast education pays for itself' },
  { icon: '📈', title: 'Demand outlook', body: 'Where hiring is heading' },
];

export const OnboardingQuiz: React.FC<OnboardingQuizProps> = ({ onFinish }) => {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);

  const [states, setStates] = useState<StateOption[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [stateQuery, setStateQuery] = useState('');

  const fetchStates = useCallback(async () => {
    setStatesLoading(true);
    setStatesError(null);
    try {
      const data = await apiClient.get<{ states: StateOption[] }>('/api/areas/states');
      setStates(buildStateOptions(data.states || []));
    } catch (err) {
      setStatesError(err instanceof Error ? err.message : 'Could not load locations');
    } finally {
      setStatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  // Default to National as soon as options arrive, so Next is always available.
  useEffect(() => {
    if (answers.stateCode === null && states.length > 0) {
      setAnswers(prev => ({ ...prev, stateCode: states[0].area_code }));
    }
  }, [states, answers.stateCode]);

  const isLast = step === TOTAL_STEPS - 1;

  const handleSelectState = (area_code: string) => {
    setAnswers(prev => ({ ...prev, stateCode: area_code }));
  };

  const handleNext = () => {
    if (isLast) {
      onFinish(assemblePayload(answers));
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    onFinish(null);
  };

  const selectedStateName =
    states.find(s => s.area_code === answers.stateCode)?.area_name ?? '';
  const visibleStates = filterStateOptions(states, stateQuery);

  return (
    <View style={[styles.overlay, { backgroundColor: theme.colors.background }]}>
      <View style={styles.topBar}>
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step ? styles.dotActive : null,
                { backgroundColor: i === step ? theme.colors.primary : theme.colors.border },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.skipText, { color: theme.colors.text.muted }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {step === ONBOARDING_STEPS.welcome && (
        <ScrollView contentContainerStyle={styles.welcomeContent} bounces={false}>
          <View style={styles.heroArt}>
            <View style={[styles.heroCircleLarge, { backgroundColor: theme.colors.primaryLight }]} />
            <View style={[styles.heroCard, styles.heroCardLeft, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.heroEmoji}>💼</Text>
            </View>
            <View style={[styles.heroCard, styles.heroCardCenter, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.heroEmoji}>💸</Text>
            </View>
            <View style={[styles.heroCard, styles.heroCardRight, { backgroundColor: theme.colors.warning }]}>
              <Text style={styles.heroEmoji}>📈</Text>
            </View>
          </View>
          <Text style={[styles.welcomeTitle, { color: theme.colors.text.primary }]}>
            Find the career{'\n'}that pays you back.
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.colors.text.secondary }]}>
            Swipe through careers ranked by real salaries, education cost, and demand —
            matched to your goals.
          </Text>
          <View style={styles.bullets}>
            {WELCOME_BULLETS.map(bullet => (
              <View key={bullet.title} style={styles.bulletRow}>
                <Text style={styles.bulletIcon}>{bullet.icon}</Text>
                <View style={styles.bulletTextWrap}>
                  <Text style={[styles.bulletTitle, { color: theme.colors.text.primary }]}>
                    {bullet.title}
                  </Text>
                  <Text style={[styles.bulletBody, { color: theme.colors.text.secondary }]}>
                    {bullet.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {step === ONBOARDING_STEPS.location && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
            Where do you want to work?
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.text.primary,
              },
            ]}
            placeholder="Search states..."
            placeholderTextColor={theme.colors.text.muted}
            value={stateQuery}
            onChangeText={setStateQuery}
          />
          {statesLoading ? (
            <ActivityIndicator style={styles.statesStatus} size="large" color={theme.colors.primary} />
          ) : statesError ? (
            <View style={styles.statesStatus}>
              <Text style={[styles.statesErrorText, { color: theme.colors.error }]}>{statesError}</Text>
              <TouchableOpacity onPress={fetchStates}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.stateList} contentContainerStyle={styles.stateListInner}>
              {visibleStates.map(state => {
                const selected = state.area_code === answers.stateCode;
                return (
                  <TouchableOpacity
                    key={state.area_code}
                    style={[
                      styles.stateRow,
                      { borderColor: theme.colors.border },
                      selected && {
                        backgroundColor: theme.colors.primaryLight,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => handleSelectState(state.area_code)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.stateRowText,
                        { color: theme.colors.text.primary },
                        selected && { color: theme.colors.primary, fontWeight: '600' },
                      ]}
                    >
                      {state.area_name}
                    </Text>
                    {selected && (
                      <Text style={[styles.checkMark, { color: theme.colors.primary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              {visibleStates.length === 0 && (
                <Text style={[styles.noResultsText, { color: theme.colors.text.muted }]}>
                  No locations match "{stateQuery}"
                </Text>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {step === ONBOARDING_STEPS.salary && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
            What salary are you aiming for?
          </Text>
          <View style={styles.chipWrap}>
            {SALARY_PRESETS.map(preset => (
              <FilterChip
                key={preset.key}
                label={preset.label}
                selected={answers.salaryPreset === preset.key}
                onPress={() =>
                  setAnswers(prev => ({ ...prev, salaryPreset: preset.key }))
                }
              />
            ))}
          </View>
          <Text style={[styles.stepHint, { color: theme.colors.text.secondary }]}>
            We'll surface careers above this median pay.
          </Text>
        </View>
      )}

      {step === ONBOARDING_STEPS.education && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
            How much education do you prefer?
          </Text>
          <View style={styles.chipWrap}>
            {EDU_PREF_OPTIONS.map(option => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={answers.eduPref === option.value}
                onPress={() => setAnswers(prev => ({ ...prev, eduPref: option.value }))}
              />
            ))}
          </View>
          <Text style={[styles.stepHint, { color: theme.colors.text.secondary }]}>
            Saved for smarter recommendations later.
          </Text>
        </View>
      )}

      {step === ONBOARDING_STEPS.priority && (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
            What matters most to you?
          </Text>
          <View style={styles.chipWrap}>
            {PRIORITY_OPTIONS.map(option => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={answers.priority === option.value}
                onPress={() => setAnswers(prev => ({ ...prev, priority: option.value }))}
              />
            ))}
          </View>
          <Text style={[styles.stepHint, { color: theme.colors.text.secondary }]}>
            {selectedStateName
              ? `Careers in ${selectedStateName}, sorted your way.`
              : "We'll sort careers your way."}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.backButton, { borderColor: theme.colors.border }]}
          onPress={handleBack}
          disabled={step === 0}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.backButtonText,
              { color: step === 0 ? theme.colors.text.muted : theme.colors.text.secondary },
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>
        <Button
          title={isLast ? 'See your matches' : step === 0 ? 'Get started' : 'Next'}
          onPress={handleNext}
          disabled={!canAdvance(step, answers)}
          style={styles.nextButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
  } as ViewStyle,
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  } as ViewStyle,
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  } as ViewStyle,
  dotActive: {
    width: 20,
  } as ViewStyle,
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  skipButton: {
    position: 'absolute',
    right: 0,
  } as ViewStyle,
  welcomeContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  heroArt: {
    width: 220,
    height: 150,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  heroCircleLarge: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  } as ViewStyle,
  heroCard: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  heroCardLeft: {
    transform: [{ rotate: '-8deg' }],
    left: 6,
    top: 44,
  } as ViewStyle,
  heroCardCenter: {
    transform: [{ rotate: '3deg' }],
    top: 12,
  } as ViewStyle,
  heroCardRight: {
    transform: [{ rotate: '10deg' }],
    right: 6,
    top: 52,
  } as ViewStyle,
  heroEmoji: {
    fontSize: 30,
  } as TextStyle,
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40,
  } as TextStyle,
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
    paddingHorizontal: 8,
  } as TextStyle,
  bullets: {
    alignSelf: 'stretch',
    marginTop: 24,
  } as ViewStyle,
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  } as ViewStyle,
  bulletIcon: {
    fontSize: 24,
    marginRight: 14,
  } as TextStyle,
  bulletTextWrap: {
    flex: 1,
  } as ViewStyle,
  bulletTitle: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  bulletBody: {
    fontSize: 14,
    marginTop: 2,
  } as TextStyle,
  stepContent: {
    flex: 1,
  } as ViewStyle,
  stepTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    lineHeight: 34,
    marginTop: 16,
    marginBottom: 20,
  } as TextStyle,
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  } as ViewStyle,
  stepHint: {
    fontSize: 14,
    marginTop: 16,
  } as TextStyle,
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  } as ViewStyle,
  stateList: {
    flex: 1,
  } as ViewStyle,
  stateListInner: {
    paddingBottom: 12,
  } as ViewStyle,
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  } as ViewStyle,
  stateRowText: {
    fontSize: 15,
  } as TextStyle,
  checkMark: {
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,
  statesStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  statesErrorText: {
    fontSize: 15,
    marginBottom: 12,
    textAlign: 'center',
  } as TextStyle,
  retryText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  } as TextStyle,
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  } as ViewStyle,
  backButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  nextButton: {
    flex: 1,
  } as ViewStyle,
});
