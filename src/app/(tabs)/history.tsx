import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { MealLog } from '../../types/database.types';

interface MealSection {
  title: string;
  data: MealLog[];
  totalCalories: number;
}

export default function HistoryScreen() {
  const [sections, setSections] = useState<MealSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (error) {
        console.error('Error fetching meal logs:', error.message);
        return;
      }

      if (data) {
        groupMealsByDate(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatDateLabel = (dateStr: string) => {
    const mealDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (mealDate.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (mealDate.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      // Format as DD/MM/YYYY
      const day = String(mealDate.getDate()).padStart(2, '0');
      const month = String(mealDate.getMonth() + 1).padStart(2, '0');
      const year = mealDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const groupMealsByDate = (meals: MealLog[]) => {
    const groups: { [key: string]: MealLog[] } = {};

    meals.forEach((meal) => {
      const dateKey = new Date(meal.logged_at).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(meal);
    });

    const formattedSections: MealSection[] = Object.keys(groups).map((dateKey) => {
      const mealsInGroup = groups[dateKey];
      const totalCalories = mealsInGroup.reduce((sum, meal) => sum + meal.estimated_calories, 0);
      const title = formatDateLabel(mealsInGroup[0].logged_at);

      return {
        title,
        data: mealsInGroup,
        totalCalories,
      };
    });

    setSections(formattedSections);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {sections.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
        >
          <Ionicons name="calendar-outline" size={60} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Lịch sử trống</Text>
          <Text style={styles.emptyText}>Bắt đầu quét và lưu bữa ăn của bạn để xem lịch sử ở đây.</Text>
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.mealItem}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.mealImage} />
              ) : (
                <View style={styles.mealIconPlaceholder}>
                  <Ionicons name="fast-food" size={24} color="#94A3B8" />
                </View>
              )}
              <View style={styles.mealDetailsContainer}>
                <Text style={styles.mealName}>{item.food_name}</Text>
                <Text style={styles.mealMacros}>
                  Pro: {item.protein_g}g • Carb: {item.carb_g}g • Fat: {item.fat_g}g
                </Text>
                <Text style={styles.mealTime}>
                  {new Date(item.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.calorieBadge}>
                <Text style={styles.calorieText}>{item.estimated_calories}</Text>
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
            </View>
          )}
          renderSectionHeader={({ section: { title, totalCalories } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionTotal}>Tổng: {totalCalories} kcal</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
          }
          contentContainerStyle={styles.listPadding}
        />
      )}
    </SafeAreaView>
  );
}

// Wrapping ScrollView since SectionList needs ScrollView for refresh when empty
import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  mealImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  mealIconPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealDetailsContainer: {
    flex: 1,
  },
  mealName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  mealMacros: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  mealTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  calorieBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  calorieText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  calorieUnit: {
    fontSize: 9,
    color: '#64748B',
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
