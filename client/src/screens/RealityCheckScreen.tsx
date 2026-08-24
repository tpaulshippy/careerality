import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { CareerROI } from '../types';
import { apiClient } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import { useFilters } from '../hooks/useFilters';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import {
  MAX_EXPERIENCE_YEARS,
  TAX_YEAR,
  LIFESTYLE_ORDER,
  LIFESTYLE_LABELS,
  LifestylePreset,
  salaryAtExperience,
  takeHome,
  budgetFor,
  verdict,
  breakEvenProgress,
  VerdictStatus,
} from '../utils/simulator';
import { CareerPickerModal } from '../components/CareerPickerModal';

const NATIONAL_AREA_CODE = '99';

const BUDGET_COLORS = {
  housing: '#136399',
  food: '#F59E0B',
  transport: '#EC4899',
  healthcare: '#0EA5E9',
  misc: '#9CA3AF',
  savings: '#059669',
} as const;

const BUDGET_SEGMENTS: { key: keyof typeof BUDGET_COLORS; label: string }[] = [
  { key: 'housing', label: 'Housing' },
  { key: 'food', label: 'Food' },
  { key: 'transport', label: 'Transport' },
  { key: 'healthcare', label: 'Health' },
  { key: 'misc', label: 'Misc' },
  { key: 'savings', label: 'Savings' },
];

interface StateOption {
  area_code: string;
  area_name: string;
}

export const RealityCheckScreen: React.FC = () => {
  const theme = useTheme();
  const { filters, setStateCode } = useFilters();
  const [career, setCareer] = useState<CareerROI | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [years, setYears] = useState(0);
  const [lifestyle, setLifestyle] = useState<LifestylePreset>('moderate');
  const [states, setStates] = useState<StateOption[]>([]);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [areaCareer, setAreaCareer] = useState<CareerROI | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);
  const areaFetchKeyRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getStates()
      .then((data) => {
        if (!cancelled) setStates(data.states || []);
      })
      .catch(() => {
        if (!cancelled) setStatesError('Could not load states');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAreaCareer = useCallback(
    async (target: CareerROI, code: string) => {
      const thisFetch = ++areaFetchKeyRef.current;
      setAreaLoading(true);
      setAreaError(null);
      const finish = (record: CareerROI | null) => {
        if (thisFetch !== areaFetchKeyRef.current) return;
        setAreaLoading(false);
        if (record) setAreaCareer(record);
        else setAreaError('Could not load this state. Tap to retry.');
      };
      try {
        // State records may use a more detailed occupation code than the
        // national one, so fall back to a name search within the state.
        let record: CareerROI | null = null;
        try {
          record = await apiClient.getCareerInArea(target.occupation_code, code);
        } catch {
          const res = await apiClient.searchCareers(target.occupation_name.trim(), code);
          const name = target.occupation_name.trim().toLowerCase();
          record =
            (res.records || []).find((r) => r.occupation_code === target.occupation_code) ??
            (res.records || []).find((r) => r.occupation_name.trim().toLowerCase() === name) ??
            null;
        }
        finish(record);
      } catch {
        finish(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!career || filters.stateCode === NATIONAL_AREA_CODE) {
      areaFetchKeyRef.current++;
      setAreaCareer(null);
      setAreaError(null);
      setAreaLoading(false);
      return;
    }
    fetchAreaCareer(career, filters.stateCode);
  }, [career, filters.stateCode, fetchAreaCareer]);

  const effectiveCareer =
    filters.stateCode !== NATIONAL_AREA_CODE && areaCareer ? areaCareer : career;

  // State records carry a cost-of-living-adjusted salary; simulate against
  // that so the national lifestyle budgets stay comparable across states.
  const stateAdjusted = effectiveCareer
    ? parseFloat(effectiveCareer.adjusted_salary)
    : NaN;
  const medianAnnual = effectiveCareer
    ? (filters.stateCode !== NATIONAL_AREA_CODE &&
      Number.isFinite(stateAdjusted) &&
      stateAdjusted > 0
        ? stateAdjusted
        : parseFloat(effectiveCareer.annual_median_salary)) || 0
    : 0;
  const educationCost = effectiveCareer ? parseFloat(effectiveCareer.education_cost) || 0 : 0;
  const salary = salaryAtExperience(medianAnnual, years);
  const th = takeHome(salary);
  const budget = budgetFor(lifestyle, th.monthlyNet);
  const v = verdict(th.monthlyNet, budget);
  const be = breakEvenProgress({
    medianAnnual,
    educationCost,
    yearsExperience: years,
  });

  const national = states.find((s) => s.area_code === NATIONAL_AREA_CODE);
  const orderedStates: StateOption[] = national
    ? [
        { ...national, area_name: 'National' },
        ...states.filter((s) => s.area_code !== NATIONAL_AREA_CODE),
      ]
    : [{ area_code: NATIONAL_AREA_CODE, area_name: 'National' }, ...states];

  const verdictColor =
    v.status === 'comfortable'
      ? theme.colors.success
      : v.status === 'tight'
        ? theme.colors.warning
        : theme.colors.error;

  const verdictEmoji: Record<VerdictStatus, string> = {
    comfortable: '✅',
    tight: '⚠️',
    shortfall: '🚨',
  };

  const widthOf = (value: number) =>
    th.gross > 0 ? Math.max(0, Math.min(100, (value / th.gross) * 100)) : 0;

  const axisEnd = Math.max(1, (effectiveCareer?.years_to_breakeven ?? 1) * 2, be.breakEvenYear ?? 0);
  const markerLeftPct = be.breakEvenYear !== null ? (be.breakEvenYear / axisEnd) * 100 : null;
  const nowLeftPct = (Math.min(years, axisEnd) / axisEnd) * 100;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Career</Text>
          {!effectiveCareer ? (
            <TouchableOpacity
              style={[
                styles.pickCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                theme.shadows.subtle,
              ]}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickTitle, { color: theme.colors.text.primary }]}>
                Pick a career to simulate 💵
              </Text>
              <Text style={[styles.pickSubtitle, { color: theme.colors.text.secondary }]}>
                See what your paycheck actually looks like month to month.
              </Text>
              <Text style={[styles.pickLink, { color: theme.colors.primary }]}>Browse careers →</Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                theme.shadows.subtle,
              ]}
            >
              <View style={styles.summaryHeader}>
                <Text
                  style={[styles.careerName, { color: theme.colors.text.primary }]}
                  numberOfLines={2}
                >
                  {effectiveCareer.occupation_name}
                </Text>
                <TouchableOpacity onPress={() => setPickerVisible(true)}>
                  <Text style={[styles.changeLink, { color: theme.colors.primary }]}>Change</Text>
                </TouchableOpacity>
              </View>
              <SummaryRow
                label="Median salary"
                value={formatCurrency(effectiveCareer.annual_median_salary)}
                color={theme.colors.text.primary}
                labelColor={theme.colors.text.secondary}
              />
              <SummaryRow
                label="Education cost"
                value={formatCurrency(effectiveCareer.education_cost)}
                color={theme.colors.text.primary}
                labelColor={theme.colors.text.secondary}
              />
              <SummaryRow
                label="Years to break-even"
                value={`${effectiveCareer.years_to_breakeven} yrs`}
                color={theme.colors.text.primary}
                labelColor={theme.colors.text.secondary}
              />
              <SummaryRow
                label="ROI"
                value={formatPercent(effectiveCareer.roi_percentage)}
                color={theme.colors.primary}
                labelColor={theme.colors.text.secondary}
              />
              {areaCareer && filters.stateCode !== NATIONAL_AREA_CODE && (
                <SummaryRow
                  label={`Adjusted for ${effectiveCareer.area_name}`}
                  value={`${formatCurrency(effectiveCareer.adjusted_salary)} · COL ${formatPercent(parseFloat(effectiveCareer.cost_of_living_index))}`}
                  color={theme.colors.text.secondary}
                  labelColor={theme.colors.text.secondary}
                />
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Your situation</Text>

          <View style={styles.inputBlock}>
            <View style={styles.inputLabelRow}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                Years of experience
              </Text>
              <Text style={[styles.inputValue, { color: theme.colors.primary }]}>{years} yrs</Text>
            </View>
            <MultiSlider
              values={[years]}
              min={0}
              max={MAX_EXPERIENCE_YEARS}
              step={1}
              onValuesChange={(values) => setYears(values[0])}
              selectedStyle={{ backgroundColor: theme.colors.primary }}
              containerStyle={{ height: 50, padding: 10 }}
              trackStyle={{ backgroundColor: theme.colors.border }}
              markerStyle={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
                borderWidth: 2,
              }}
            />
            <Text style={[styles.hint, { color: theme.colors.text.muted }]}>
              Salary grows ~2.2%/yr, capped at 1.6× the median.
            </Text>
          </View>

          <View style={styles.inputBlock}>
            <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Lifestyle</Text>
            <View style={[styles.segmented, { borderColor: theme.colors.border }]}>
              {LIFESTYLE_ORDER.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.segment,
                    lifestyle === preset && { backgroundColor: theme.colors.primaryLight },
                  ]}
                  onPress={() => setLifestyle(preset)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: theme.colors.text.secondary },
                      lifestyle === preset && { color: theme.colors.text.primary, fontWeight: '600' },
                    ]}
                  >
                    {LIFESTYLE_LABELS[preset]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputBlock}>
            <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>State</Text>
            <View
              style={[
                styles.pickerWrap,
                { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
            >
              <Picker
                selectedValue={filters.stateCode}
                onValueChange={(value) => setStateCode(value as string)}
                style={{
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background,
                }}
                enabled={!statesError}
              >
                {orderedStates.map((state) => (
                  <Picker.Item
                    key={state.area_code}
                    label={state.area_name}
                    value={state.area_code}
                    color={theme.colors.text.primary}
                  />
                ))}
              </Picker>
            </View>
            {statesError ? (
              <Text style={[styles.hint, { color: theme.colors.error }]}>
                {statesError} — showing national estimates.
              </Text>
            ) : (
              <Text style={[styles.hint, { color: theme.colors.text.muted }]}>
                Optional. Adjusts salary and cost of living for that state.
              </Text>
            )}
          </View>
        </View>

        {career && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Monthly reality
              </Text>
              {areaLoading ? (
                <Text style={[styles.areaNote, { color: theme.colors.text.muted }]}>
                  Updating for state…
                </Text>
              ) : areaError && filters.stateCode !== NATIONAL_AREA_CODE ? (
                <TouchableOpacity onPress={() => fetchAreaCareer(career, filters.stateCode)}>
                  <Text style={[styles.areaNote, { color: theme.colors.error }]}>{areaError}</Text>
                </TouchableOpacity>
              ) : null}

              <View
                style={[
                  styles.verdictCard,
                  { backgroundColor: theme.colors.surface, borderLeftColor: verdictColor },
                  theme.shadows.subtle,
                ]}
              >
                <Text style={[styles.verdictHeadline, { color: verdictColor }]}>
                  {verdictEmoji[v.status]} {v.headline}
                </Text>
                <Text style={[styles.verdictDetail, { color: theme.colors.text.secondary }]}>
                  {v.detail}
                </Text>
                <Text style={[styles.verdictNet, { color: theme.colors.text.primary }]}>
                  {formatCurrency(salary)}/yr gross → {formatCurrency(th.monthlyNet)}/mo take-home
                </Text>
              </View>

              <View style={styles.waterfall}>
                <WaterfallRow
                  label="Gross"
                  amount={`${formatCurrency(th.gross)}/yr`}
                  widthPct={widthOf(th.gross)}
                  color={theme.colors.primary}
                  textColor={theme.colors.text.primary}
                />
                <WaterfallRow
                  label="Federal tax"
                  amount={`−${formatCurrency(th.federal)}/yr`}
                  widthPct={widthOf(th.federal)}
                  color={theme.colors.error}
                  textColor={theme.colors.text.primary}
                />
                <WaterfallRow
                  label="FICA"
                  amount={`−${formatCurrency(th.fica)}/yr`}
                  widthPct={widthOf(th.fica)}
                  color={theme.colors.warning}
                  textColor={theme.colors.text.primary}
                />
                <WaterfallRow
                  label="Take-home"
                  amount={`${formatCurrency(th.net)}/yr (${formatCurrency(th.monthlyNet)}/mo)`}
                  widthPct={widthOf(th.net)}
                  color={theme.colors.success}
                  textColor={theme.colors.text.primary}
                />
              </View>

              <View style={styles.budgetBlock}>
                <Text style={[styles.blockTitle, { color: theme.colors.text.secondary }]}>
                  Where the monthly paycheck goes
                </Text>
                <View style={[styles.budgetBar, { backgroundColor: theme.colors.border }]}>
                  {BUDGET_SEGMENTS.map(({ key }) =>
                    budget.categories[key] > 0 ? (
                      <View
                        key={key}
                        style={{
                          flex: budget.categories[key],
                          backgroundColor: BUDGET_COLORS[key],
                        }}
                      />
                    ) : null
                  )}
                </View>
                <View style={styles.legend}>
                  {BUDGET_SEGMENTS.map(({ key, label }) => (
                    <View key={key} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: BUDGET_COLORS[key] }]} />
                      <Text style={[styles.legendText, { color: theme.colors.text.secondary }]}>
                        {label}{' '}
                        <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
                          {formatCurrency(budget.categories[key])}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.sectionLast}>
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Break-even timeline
              </Text>
              <View
                style={[
                  styles.timelineCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.timelineText, { color: theme.colors.text.secondary }]}>
                  {be.breakEvenYear !== null ? (
                    <>
                      Education cost of{' '}
                      <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
                        {formatCurrency(be.educationCost)}
                      </Text>{' '}
                      is earned back after about{' '}
                      <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                        {be.breakEvenYear} {be.breakEvenYear === 1 ? 'year' : 'years'}
                      </Text>{' '}
                      of work.
                    </>
                  ) : (
                    <>
                      At this salary you have not yet earned back the{' '}
                      <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>
                        {formatCurrency(be.educationCost)}
                      </Text>{' '}
                      education cost.
                    </>
                  )}
                </Text>
                <View style={styles.axisWrap}>
                  <View style={[styles.axisLine, { backgroundColor: theme.colors.border }]}>
                    {markerLeftPct !== null && (
                      <View style={[styles.marker, { left: `${markerLeftPct}%` }]}>
                        <View
                          style={[styles.markerDot, { backgroundColor: theme.colors.success }]}
                        />
                        <Text style={[styles.markerLabel, { color: theme.colors.success }]}>
                          yr {be.breakEvenYear}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.nowMarker, { left: `${nowLeftPct}%` }]}>
                      <View style={[styles.markerDot, { backgroundColor: theme.colors.primary }]} />
                    </View>
                  </View>
                  <View style={styles.axisLabels}>
                    <Text style={[styles.axisLabel, { color: theme.colors.text.muted }]}>yr 0</Text>
                    <Text style={[styles.axisLabel, { color: theme.colors.text.muted }]}>
                      yr {axisEnd}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.disclaimer, { color: theme.colors.text.muted }]}>
                Estimates only: simplified {TAX_YEAR} tax brackets, standard deduction and FICA;
                budgets approximate a single adult.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <CareerPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(selected) => {
          setCareer(selected);
          setAreaCareer(null);
          setPickerVisible(false);
        }}
      />
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string; color: string; labelColor: string }> = ({
  label,
  value,
  color,
  labelColor,
}) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, { color: labelColor }]}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
  </View>
);

const WaterfallRow: React.FC<{
  label: string;
  amount: string;
  widthPct: number;
  color: string;
  textColor: string;
}> = ({ label, amount, widthPct, color, textColor }) => (
  <View style={styles.waterfallRow}>
    <Text style={[styles.waterfallLabel, { color: textColor }]}>{label}</Text>
    <View style={styles.waterfallTrack}>
      <View
        style={[styles.waterfallBar, { width: `${widthPct}%`, backgroundColor: color }]}
      />
    </View>
    <Text style={[styles.waterfallAmount, { color: textColor }]} numberOfLines={1}>
      {amount}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  scroll: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  } as ViewStyle,
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  } as ViewStyle,
  sectionLast: {
    marginBottom: 32,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  } as TextStyle,
  pickCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  } as ViewStyle,
  pickTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  } as TextStyle,
  pickSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  } as TextStyle,
  pickLink: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  summaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  } as ViewStyle,
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  } as ViewStyle,
  careerName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  } as TextStyle,
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    paddingTop: 2,
  } as TextStyle,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  } as ViewStyle,
  summaryLabel: {
    fontSize: 14,
  } as TextStyle,
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  } as TextStyle,
  inputBlock: {
    marginBottom: 18,
  } as ViewStyle,
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  } as TextStyle,
  inputValue: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  hint: {
    fontSize: 12,
    marginTop: 2,
  } as TextStyle,
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  } as ViewStyle,
  segmentText: {
    fontSize: 14,
  } as TextStyle,
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,
  areaNote: {
    fontSize: 13,
    marginBottom: 10,
  } as TextStyle,
  verdictCard: {
    borderLeftWidth: 5,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  } as ViewStyle,
  verdictHeadline: {
    fontSize: 19,
    fontWeight: 'bold',
    lineHeight: 26,
    marginBottom: 6,
  } as TextStyle,
  verdictDetail: {
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  } as TextStyle,
  verdictNet: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  waterfall: {
    marginBottom: 18,
  } as ViewStyle,
  waterfallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  } as ViewStyle,
  waterfallLabel: {
    width: 84,
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  waterfallTrack: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    marginRight: 10,
  } as ViewStyle,
  waterfallBar: {
    height: '100%',
    borderRadius: 9,
  } as ViewStyle,
  waterfallAmount: {
    width: 118,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  } as TextStyle,
  budgetBlock: {
    marginBottom: 4,
  } as ViewStyle,
  blockTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  } as TextStyle,
  budgetBar: {
    flexDirection: 'row',
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    marginBottom: 12,
  } as ViewStyle,
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  } as ViewStyle,
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  } as ViewStyle,
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  } as ViewStyle,
  legendText: {
    fontSize: 12,
  } as TextStyle,
  timelineCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  } as ViewStyle,
  timelineText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  } as TextStyle,
  axisWrap: {
    marginBottom: 6,
  } as ViewStyle,
  axisLine: {
    height: 4,
    borderRadius: 2,
    justifyContent: 'center',
  } as ViewStyle,
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  } as ViewStyle,
  axisLabel: {
    fontSize: 11,
  } as TextStyle,
  marker: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -7,
  } as ViewStyle,
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  } as ViewStyle,
  markerLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  } as TextStyle,
  nowMarker: {
    position: 'absolute',
    marginLeft: -5,
  } as ViewStyle,
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  } as TextStyle,
});
