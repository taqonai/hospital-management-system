import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, MealType, LogMealData } from '../../services/api';
import { NutritionStackParamList } from '../../types';

type RouteProps = RouteProp<NutritionStackParamList, 'LogMeal'>;

const MEAL_TYPES = [
  { type: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', time: '6:00 AM - 10:00 AM' },
  { type: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline', time: '11:00 AM - 2:00 PM' },
  { type: 'dinner', label: 'Dinner', icon: 'moon-outline', time: '5:00 PM - 9:00 PM' },
  { type: 'snack', label: 'Snack', icon: 'cafe-outline', time: 'Any time' },
] as const;

const QUICK_FOODS = [
  { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Rice (1 cup)', calories: 206, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: 'Egg', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  { name: 'Greek Yogurt (1 cup)', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { name: 'Oatmeal (1 cup)', calories: 150, protein: 5, carbs: 27, fat: 3 },
  { name: 'Salad (mixed greens)', calories: 20, protein: 2, carbs: 3, fat: 0 },
];

const LogMealScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const initialMealType = route.params?.mealType as MealType;

  const [mealType, setMealType] = useState<MealType | null>(
    initialMealType ? initialMealType as MealType : null
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [servingUnit, setServingUnit] = useState('g');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(true);

  const handleQuickAdd = (food: typeof QUICK_FOODS[0]) => {
    setName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setShowQuickAdd(false);
  };

  const handleSubmit = async () => {
    if (!mealType) {
      Alert.alert('Error', 'Please select a meal type');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return;
    }

    if (!calories || parseInt(calories) <= 0) {
      Alert.alert('Error', 'Please enter calories');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: LogMealData = {
        mealType,
        name: name.trim(),
        calories: parseInt(calories),
      };

      if (description.trim()) data.description = description.trim();
      if (protein) data.protein = parseFloat(protein);
      if (carbs) data.carbs = parseFloat(carbs);
      if (fat) data.fat = parseFloat(fat);
      if (servingSize) {
        data.servingSize = parseFloat(servingSize);
        data.servingUnit = servingUnit;
      }

      await wellnessApi.logMeal(data);

      Alert.alert(
        'Meal Logged',
        `${name} has been added to your ${mealType}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to log meal. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Meal Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meal Type</Text>
            <View style={styles.mealTypeGrid}>
              {MEAL_TYPES.map((meal) => (
                <TouchableOpacity
                  key={meal.type}
                  style={[
                    styles.mealTypeOption,
                    mealType === meal.type && styles.mealTypeSelected,
                  ]}
                  onPress={() => setMealType(meal.type)}
                >
                  <Ionicons
                    name={meal.icon as any}
                    size={24}
                    color={mealType === meal.type ? colors.primary[600] : colors.gray[500]}
                  />
                  <Text
                    style={[
                      styles.mealTypeLabel,
                      mealType === meal.type && styles.mealTypeLabelSelected,
                    ]}
                  >
                    {meal.label}
                  </Text>
                  <Text style={styles.mealTypeTime}>{meal.time}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {mealType && (
            <>
              {/* Quick Add */}
              {showQuickAdd && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quick Add</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.quickAddList}>
                      {QUICK_FOODS.map((food, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.quickAddItem}
                          onPress={() => handleQuickAdd(food)}
                        >
                          <Text style={styles.quickAddName}>{food.name}</Text>
                          <Text style={styles.quickAddCalories}>{food.calories} cal</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Food Details */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Food Details</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Food Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Grilled Chicken Salad"
                    placeholderTextColor={colors.gray[400]}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Add notes about the meal..."
                    placeholderTextColor={colors.gray[400]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>

              {/* Nutrition Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nutrition Information</Text>
                <View style={styles.nutritionGrid}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionLabel}>Calories *</Text>
                    <View style={styles.nutritionInput}>
                      <TextInput
                        style={styles.nutritionValue}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="number-pad"
                        value={calories}
                        onChangeText={setCalories}
                      />
                      <Text style={styles.nutritionUnit}>cal</Text>
                    </View>
                  </View>

                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                    <View style={styles.nutritionInput}>
                      <TextInput
                        style={styles.nutritionValue}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="decimal-pad"
                        value={protein}
                        onChangeText={setProtein}
                      />
                      <Text style={styles.nutritionUnit}>g</Text>
                    </View>
                  </View>

                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                    <View style={styles.nutritionInput}>
                      <TextInput
                        style={styles.nutritionValue}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="decimal-pad"
                        value={carbs}
                        onChangeText={setCarbs}
                      />
                      <Text style={styles.nutritionUnit}>g</Text>
                    </View>
                  </View>

                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                    <View style={styles.nutritionInput}>
                      <TextInput
                        style={styles.nutritionValue}
                        placeholder="0"
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="decimal-pad"
                        value={fat}
                        onChangeText={setFat}
                      />
                      <Text style={styles.nutritionUnit}>g</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Serving Size */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Serving Size (Optional)</Text>
                <View style={styles.servingRow}>
                  <TextInput
                    style={[styles.input, styles.servingInput]}
                    placeholder="100"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                    value={servingSize}
                    onChangeText={setServingSize}
                  />
                  <View style={styles.unitSelector}>
                    {['g', 'oz', 'cup', 'ml'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitOption,
                          servingUnit === unit && styles.unitOptionSelected,
                        ]}
                        onPress={() => setServingUnit(unit)}
                      >
                        <Text
                          style={[
                            styles.unitText,
                            servingUnit === unit && styles.unitTextSelected,
                          ]}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || !name || !calories}
              >
                {isSubmitting ? (
                  <Text style={styles.submitButtonText}>Logging...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>Log Meal</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mealTypeOption: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  mealTypeSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  mealTypeLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  mealTypeLabelSelected: {
    color: colors.primary[600],
  },
  mealTypeTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  quickAddList: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickAddItem: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 100,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickAddName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  quickAddCalories: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    ...shadows.sm,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  nutritionItem: {
    width: '48%',
  },
  nutritionLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  nutritionInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  nutritionValue: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  nutritionUnit: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  servingRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  servingInput: {
    width: 100,
    textAlign: 'center',
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    padding: 2,
  },
  unitOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  unitOptionSelected: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  unitText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  unitTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default LogMealScreen;
