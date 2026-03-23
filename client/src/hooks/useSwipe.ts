import { useState, useCallback, useRef } from 'react';
import { CareerROI, SwipeDirection } from '../types';

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

export const useSwipe = (initialCards: CareerROI[] = []): UseSwipeResult => {
  const [swipeHistory, setSwipeHistory] = useState<SwipeRecord[]>([]);
  const historyRef = useRef<SwipeRecord[]>(swipeHistory);

  historyRef.current = swipeHistory;
  const currentIndex = swipeHistory.length;
  const cards = initialCards;

  const swipeLeft = useCallback((): CareerROI | null => {
    if (currentIndex >= cards.length || cards.length === 0) return null;
    
    const card = cards[currentIndex];
    const record: SwipeRecord = { career: card, direction: 'left', timestamp: Date.now() };
    const newHistory = [...historyRef.current, record];
    
    historyRef.current = newHistory;
    setSwipeHistory(newHistory);
    return card;
  }, [cards, currentIndex]);

  const swipeRight = useCallback((): CareerROI | null => {
    if (currentIndex >= cards.length || cards.length === 0) return null;
    
    const card = cards[currentIndex];
    const record: SwipeRecord = { career: card, direction: 'right', timestamp: Date.now() };
    const newHistory = [...historyRef.current, record];
    
    historyRef.current = newHistory;
    setSwipeHistory(newHistory);
    return card;
  }, [cards, currentIndex]);

  const undo = useCallback((): SwipeRecord | null => {
    if (historyRef.current.length === 0) return null;
    
    const lastRecord = historyRef.current[historyRef.current.length - 1];
    const newHistory = historyRef.current.slice(0, -1);
    
    historyRef.current = newHistory;
    setSwipeHistory(newHistory);
    return lastRecord;
  }, []);

  const getUnswipedCards = useCallback((): CareerROI[] => {
    return cards.slice(currentIndex);
  }, [cards, currentIndex]);

  const resetSwipes = useCallback(() => {
    historyRef.current = [];
    setSwipeHistory([]);
  }, []);

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