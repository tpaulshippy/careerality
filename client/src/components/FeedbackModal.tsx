import React, { useState } from 'react';
import { View, Text, Modal, TextInput, StyleSheet, ViewStyle, TextStyle, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Button } from './Button';

export type InterestLevel = 'very_interested' | 'somewhat_interested' | 'not_for_me';

interface FeedbackModalProps {
  visible: boolean;
  careerName: string;
  onSubmit: (interest: InterestLevel, notes: string) => void;
  onClose: () => void;
}

const interestOptions: { key: InterestLevel; label: string }[] = [
  { key: 'very_interested', label: 'Very Interested' },
  { key: 'somewhat_interested', label: 'Somewhat Interested' },
  { key: 'not_for_me', label: 'Not for Me' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  visible, 
  careerName, 
  onSubmit, 
  onClose 
}) => {
  const theme = useTheme();
  const [selectedInterest, setSelectedInterest] = useState<InterestLevel | null>(null);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (selectedInterest) {
      onSubmit(selectedInterest, notes);
      setSelectedInterest(null);
      setNotes('');
    }
  };

  const handleClose = () => {
    setSelectedInterest(null);
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                How interested are you?
              </Text>
              <Text style={[styles.careerName, { color: theme.colors.text.secondary }]}>
                {careerName}
              </Text>

              <View style={styles.optionsContainer}>
                {interestOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.option,
                      { borderColor: theme.colors.border },
                      selectedInterest === option.key && { 
                        backgroundColor: theme.colors.primaryLight,
                        borderColor: theme.colors.primary 
                      },
                    ]}
                    onPress={() => setSelectedInterest(option.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: theme.colors.text.primary },
                        selectedInterest === option.key && { color: theme.colors.primary },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.notesInput,
                  { 
                    borderColor: theme.colors.border, 
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background,
                  },
                ]}
                placeholder="Add notes (optional)"
                placeholderTextColor={theme.colors.text.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              <View style={styles.buttonContainer}>
                <Button
                  title="Skip"
                  onPress={handleClose}
                  style={[styles.button, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                />
                <Button
                  title="Submit"
                  onPress={handleSubmit}
                  disabled={!selectedInterest}
                  style={[styles.button, { opacity: selectedInterest ? 1 : 0.5 }]}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as ViewStyle,
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  } as TextStyle,
  careerName: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  } as TextStyle,
  optionsContainer: {
    marginBottom: 16,
  } as ViewStyle,
  option: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  } as ViewStyle,
  optionText: {
    fontSize: 16,
    textAlign: 'center',
  } as TextStyle,
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  } as TextStyle,
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,
  button: {
    flex: 1,
  } as ViewStyle,
});