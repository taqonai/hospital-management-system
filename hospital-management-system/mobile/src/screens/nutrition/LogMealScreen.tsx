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
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, nutritionAiApi, MealType, LogMealData, DetectedFood, MealAnalysis } from '../../services/api';
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

  // Form state
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

  // AI Photo Analysis state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<MealAnalysis | null>(null);
  const [selectedFoods, setSelectedFoods] = useState<DetectedFood[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);

  const handleQuickAdd = (food: typeof QUICK_FOODS[0]) => {
    setName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setShowQuickAdd(false);
    setAnalysisResult(null);
    setSelectedImage(null);
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to take photos of your meals.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo library access to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImage(result.assets[0].uri);
      analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setShowQuickAdd(false);

    try {
      const mealTypeForAi = mealType?.toUpperCase() as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | undefined;
      const response = await nutritionAiApi.analyzeMealImage({
        imageBase64,
        mealType: mealTypeForAi,
      });

      if (response.data) {
        setAnalysisResult(response.data);
        setSelectedFoods(response.data.foods);
        setShowAiResults(true);

        // If only one food detected, auto-fill the form
        if (response.data.foods.length === 1) {
          autoFillFromFood(response.data.foods[0]);
        }
      }
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      Alert.alert(
        'Analysis Failed',
        'Unable to analyze the image. You can still enter the meal details manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoFillFromFood = (food: DetectedFood) => {
    setName(food.name_ar ? `${food.name} (${food.name_ar})` : food.name);
    setCalories(Math.round(food.calories).toString());
    setProtein(food.protein.toFixed(1));
    setCarbs(food.carbs.toFixed(1));
    setFat(food.fat.toFixed(1));
    setServingSize(food.portion_grams.toString());
    setServingUnit('g');
  };

  const handleSelectAllFoods = () => {
    if (analysisResult) {
      const totalCals = analysisResult.foods.reduce((sum, f) => sum + f.calories, 0);
      const totalProtein = analysisResult.foods.reduce((sum, f) => sum + f.protein, 0);
      const totalCarbs = analysisResult.foods.reduce((sum, f) => sum + f.carbs, 0);
      const totalFat = analysisResult.foods.reduce((sum, f) => sum + f.fat, 0);
      const totalGrams = analysisResult.foods.reduce((sum, f) => sum + f.portion_grams, 0);

      const foodNames = analysisResult.foods.map(f =>
        f.name_ar ? `${f.name} (${f.name_ar})` : f.name
      ).join(', ');

      setName(foodNames);
      setCalories(Math.round(totalCals).toString());
      setProtein(totalProtein.toFixed(1));
      setCarbs(totalCarbs.toFixed(1));
      setFat(totalFat.toFixed(1));
      setServingSize(totalGrams.toString());
      setShowAiResults(false);
    }
  };

  const handleToggleFood = (food: DetectedFood) => {
    setSelectedFoods(prev => {
      const exists = prev.find(f => f.name === food.name);
      if (exists) {
        return prev.filter(f => f.name !== food.name);
      } else {
        return [...prev, food];
      }
    });
  };

  const handleConfirmSelection = () => {
    if (selectedFoods.length === 0) {
      Alert.alert('No Foods Selected', 'Please select at least one food item.');
      return;
    }

    const totalCals = selectedFoods.reduce((sum, f) => sum + f.calories, 0);
    const totalProtein = selectedFoods.reduce((sum, f) => sum + f.protein, 0);
    const totalCarbs = selectedFoods.reduce((sum, f) => sum + f.carbs, 0);
    const totalFat = selectedFoods.reduce((sum, f) => sum + f.fat, 0);
    const totalGrams = selectedFoods.reduce((sum, f) => sum + f.portion_grams, 0);

    const foodNames = selectedFoods.map(f =>
      f.name_ar ? `${f.name} (${f.name_ar})` : f.name
    ).join(', ');

    setName(foodNames);
    setCalories(Math.round(totalCals).toString());
    setProtein(totalProtein.toFixed(1));
    setCarbs(totalCarbs.toFixed(1));
    setFat(totalFat.toFixed(1));
    setServingSize(totalGrams.toString());
    setShowAiResults(false);
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

  const renderFoodItem = (food: DetectedFood) => {
    const isSelected = selectedFoods.find(f => f.name === food.name);
    const confidencePercent = Math.round(food.confidence * 100);

    return (
      <TouchableOpacity
        key={food.name}
        style={[styles.foodItem, isSelected && styles.foodItemSelected]}
        onPress={() => handleToggleFood(food)}
      >
        <View style={styles.foodItemContent}>
          <View style={styles.foodItemHeader}>
            <View style={styles.foodNameRow}>
              <Text style={styles.foodName}>{food.name}</Text>
              {food.is_regional && (
                <View style={styles.regionalBadge}>
                  <Text style={styles.regionalBadgeText}>Regional</Text>
                </View>
              )}
            </View>
            {food.name_ar && (
              <Text style={styles.foodNameAr}>{food.name_ar}</Text>
            )}
          </View>
          <View style={styles.foodStats}>
            <Text style={styles.foodCalories}>{Math.round(food.calories)} cal</Text>
            <Text style={styles.foodMacros}>
              P: {food.protein.toFixed(0)}g | C: {food.carbs.toFixed(0)}g | F: {food.fat.toFixed(0)}g
            </Text>
          </View>
          <View style={styles.confidenceRow}>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${confidencePercent}%` },
                ]}
              />
            </View>
            <Text style={styles.confidenceText}>{confidencePercent}% confident</Text>
          </View>
        </View>
        <View style={styles.checkbox}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? colors.primary[600] : colors.gray[400]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* AI Photo Capture Section */}
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Snap Your Meal</Text>
            <Text style={styles.photoSubtitle}>
              Take a photo and our AI will identify the foods and estimate nutrition
            </Text>
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handleTakePhoto}
                disabled={isAnalyzing}
              >
                <Ionicons name="camera" size={24} color={colors.primary[600]} />
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickImage}
                disabled={isAnalyzing}
              >
                <Ionicons name="images" size={24} color={colors.primary[600]} />
                <Text style={styles.photoButtonText}>Choose Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Selected Image Preview */}
            {selectedImage && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                {isAnalyzing && (
                  <View style={styles.analyzingOverlay}>
                    <ActivityIndicator size="large" color={colors.white} />
                    <Text style={styles.analyzingText}>Analyzing your meal...</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* AI Analysis Results Modal */}
          <Modal
            visible={showAiResults && analysisResult !== null}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowAiResults(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Detected Foods</Text>
                  <TouchableOpacity
                    onPress={() => setShowAiResults(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={colors.gray[600]} />
                  </TouchableOpacity>
                </View>

                {analysisResult && (
                  <>
                    <Text style={styles.modalSubtitle}>
                      Found {analysisResult.foods.length} item(s) - Overall {Math.round(analysisResult.confidence * 100)}% confident
                    </Text>

                    <ScrollView style={styles.foodsList}>
                      {analysisResult.foods.map(renderFoodItem)}
                    </ScrollView>

                    {/* Suggestions/Warnings */}
                    {(analysisResult.suggestions.length > 0 || analysisResult.warnings.length > 0) && (
                      <View style={styles.feedbackSection}>
                        {analysisResult.warnings.map((warning, idx) => (
                          <View key={`w-${idx}`} style={styles.warningItem}>
                            <Ionicons name="warning" size={16} color={colors.warning[600]} />
                            <Text style={styles.warningText}>{warning}</Text>
                          </View>
                        ))}
                        {analysisResult.suggestions.slice(0, 2).map((suggestion, idx) => (
                          <View key={`s-${idx}`} style={styles.suggestionItem}>
                            <Ionicons name="bulb" size={16} color={colors.info[600]} />
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.selectAllButton}
                        onPress={handleSelectAllFoods}
                      >
                        <Text style={styles.selectAllText}>Log All Items</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleConfirmSelection}
                      >
                        <Text style={styles.confirmButtonText}>
                          Log Selected ({selectedFoods.length})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or enter manually</Text>
            <View style={styles.dividerLine} />
          </View>

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
              {showQuickAdd && !selectedImage && (
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
  // Photo Section
  photoSection: {
    marginBottom: spacing.lg,
  },
  photoSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  photoButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  imagePreview: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.white,
    fontWeight: typography.fontWeight.medium,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  foodsList: {
    maxHeight: 300,
  },
  foodItem: {
    flexDirection: 'row',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  foodItemSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  foodItemContent: {
    flex: 1,
  },
  foodItemHeader: {
    marginBottom: spacing.xs,
  },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  foodName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  foodNameAr: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  regionalBadge: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  regionalBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  foodStats: {
    marginBottom: spacing.xs,
  },
  foodCalories: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  foodMacros: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: colors.success[500],
  },
  confidenceText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    width: 80,
  },
  checkbox: {
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  feedbackSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning[50],
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.info[50],
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.info[700],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  selectAllButton: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Original styles
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
