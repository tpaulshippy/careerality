import { useState, useCallback } from 'react';
import { CareerROI } from '../types';
import { useLocalStorage } from './useLocalStorage';

export type SwipeDirection = 'left' | 'right';

export interface SwipeRecord {
  career: CareerROI;
  direction: SwipeDirection;
  timestamp: number;
}

interface UseSwipeResult {
  cards: CareerROI[];
  currentIndex: number;
  swipeHistory: SwipeRecord[];
  swipeLeft: () => CareerROI | null;
  swipeRight: () => CareerROI | null;
  undo: () => SwipeRecord | null;
  getUnswipedCards: () => CareerROI[];
  resetSwipes: () => void;
}

const STORAGE_KEY = 'careerality_swipes';

export const useSwipe = (initialCards: CareerROI[] = []): UseSwipeResult => {
  const [cards, setCards] = useState<CareerROI[]>(initialCards);
  const [swipeHistory, setSwipeHistory] = useLocalStorage<SwipeRecord[]>(STORAGE_KEY, []);

  const currentIndex = swipeHistory.length;

  const swipeLeft = useCallback((): CareerROI | null => {
    if (currentIndex >= cards.length) return null;
    const card = cards[currentIndex];
    const record: SwipeRecord = {
      career: card,
      direction: 'left',
      timestamp: Date.now(),
    };
    setSwipeHistory([...swipeHistory, record]);
    return card;
  }, [cards, currentIndex, setSwipeHistory, swipeHistory]);

  const swipeRight = useCallback((): CareerROI | null => {
    if (currentIndex >= cards.length) return null;
    const card = cards[currentIndex];
    const record: SwipeRecord = {
      career: card,
      direction: 'right',
      timestamp: Date.now(),
    };
    setSwipeHistory([...swipeHistory, record]);
    return card;
  }, [cards, currentIndex, setSwipeHistory, swipeHistory]);

  const undo = useCallback((): SwipeRecord | null => {
    if (swipeHistory.length === 0) return null;
    const lastRecord = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory(swipeHistory.slice(0, -1));
    return lastRecord;
  }, [swipeHistory, setSwipeHistory]);

  const getUnswipedCards = useCallback((): CareerROI[] => {
    return cards.slice(currentIndex);
  }, [cards, currentIndex]);

  const resetSwipes = useCallback(() => {
    setSwipeHistory([]);
  }, [setSwipeHistory]);

  return {
    cards,
    currentIndex,
    swipeHistory,
    swipeLeft,
    swipeRight,
    undo,
    getUnswipedCards,
    resetSwipes,
  };
};
