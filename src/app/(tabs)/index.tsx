import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { MealLog, Profile } from '../../types/database.types';

export default function DashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTodayData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Profile for calorie goal
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // 2. Fetch Meal Logs logged today (local time)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data: mealsData, error: mealsError } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', startOfDay.toISOString())
        .lte('logged_at', endOfDay.toISOString())
        .order('logged_at', { ascending: false });

      if (!mealsError && mealsData) {
        setTodayMeals(mealsData);
      }
    } catch (error) {
      console.error('Error fetching today\'s data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchTodayData();
    }, [fetchTodayData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTodayData();
  };

  // Calculate totals
  const totalCalories = todayMeals.reduce((sum, meal) => sum + meal.estimated_calories, 0);
  const totalProtein = todayMeals.reduce((sum, meal) => sum + (meal.protein_g || 0), 0);
  const totalCarbs = todayMeals.reduce((sum, meal) => sum + (meal.carb_g || 0), 0);
  const totalFat = todayMeals.reduce((sum, meal) => sum + (meal.fat_g || 0), 0);

  const dailyGoal = profile?.daily_calorie_goal || 2000;
  const percentComplete = Math.min((totalCalories / dailyGoal) * 100, 100);
  const remainingCalories = Math.max(dailyGoal - totalCalories, 0);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />}
      >
        {/* Welcome Banner */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Xin chào,</Text>
          <Text style={styles.userName}>{profile?.display_name || 'Người dùng'}</Text>
        </View>

        {/* Calorie Card */}
        <View style={styles.calorieCard}>
          <View style={styles.calorieHeader}>
            <Text style={styles.calorieCardTitle}>Calo Hôm Nay</Text>
            <Text style={styles.goalText}>Mục tiêu: {dailyGoal} kcal</Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${percentComplete}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressValue}>{totalCalories} kcal đã nạp</Text>
              <Text style={styles.remainingValue}>
                {remainingCalories > 0 ? `Còn lại ${remainingCalories} kcal` : 'Đã đạt mục tiêu!'}
              </Text>
            </View>
          </View>
        </View>

        {/* Macronutrients Row */}
        <View style={styles.macroRow}>
          <View style={[styles.macroCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroValueText}>{totalCarbs.toFixed(1)}g</Text>
          </View>
          <View style={[styles.macroCard, { borderLeftColor: '#EF4444' }]}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValueText}>{totalProtein.toFixed(1)}g</Text>
          </View>
          <View style={[styles.macroCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.macroLabel}>Chất béo</Text>
            <Text style={styles.macroValueText}>{totalFat.toFixed(1)}g</Text>
          </View>
        </View>

        {/* Today's Meals */}
        <View style={styles.mealsHeader}>
          <Text style={styles.sectionTitle}>Bữa ăn hôm nay</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/camera')}>
            <Text style={styles.addMealLink}>+ Thêm bữa ăn</Text>
          </TouchableOpacity>
        </View>

        {todayMeals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>Chưa có bữa ăn nào được ghi nhận hôm nay.</Text>
            <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/(tabs)/camera')}>
              <Text style={styles.scanButtonText}>Quét món ăn ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          todayMeals.map((meal) => (
            <View key={meal.id} style={styles.mealItem}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{meal.food_name}</Text>
                <Text style={styles.mealDetails}>
                  Kích thước: {meal.portion_size} • Carbs: {meal.carb_g}g • Pro: {meal.protein_g}g • Fat: {meal.fat_g}g
                </Text>
              </View>
              <View style={styles.mealCalories}>
                <Text style={styles.mealCalValue}>{meal.estimated_calories}</Text>
                <Text style={styles.mealCalUnit}>kcal</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  calorieCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calorieCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  goalText: {
    fontSize: 14,
    color: '#64748B',
  },
  progressContainer: {},
  progressBarBackground: {
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  remainingValue: {
    fontSize: 14,
    color: '#64748B',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  macroLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  macroValueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  addMealLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  mealInfo: {
    flex: 1,
    marginRight: 8,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  mealDetails: {
    fontSize: 12,
    color: '#64748B',
  },
  mealCalories: {
    alignItems: 'flex-end',
  },
  mealCalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  mealCalUnit: {
    fontSize: 10,
    color: '#64748B',
  },
});
