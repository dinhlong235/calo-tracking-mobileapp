import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// Mock AI prediction lists to choose randomly or default to
const MOCK_PREDICTIONS = [
  {
    food_name: 'Phở Bò Việt Nam',
    estimated_calories: 550,
    protein_g: 24,
    carb_g: 68,
    fat_g: 16,
    portion_size: '1 bát lớn',
  },
  {
    food_name: 'Cơm Tấm Sườn Trứng',
    estimated_calories: 720,
    protein_g: 32,
    carb_g: 85,
    fat_g: 25,
    portion_size: '1 đĩa',
  },
  {
    food_name: 'Salad Ức Gà',
    estimated_calories: 320,
    protein_g: 35,
    carb_g: 12,
    fat_g: 10,
    portion_size: '1 phần',
  },
  {
    food_name: 'Bánh Mì Kẹp Thịt',
    estimated_calories: 450,
    protein_g: 18,
    carb_g: 52,
    fat_g: 14,
    portion_size: '1 ổ',
  },
];

export default function CameraScreen() {
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [libraryPermissionResponse, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();

  const [cameraActive, setCameraActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for prediction results
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [portionSize, setPortionSize] = useState('');

  const cameraRef = useRef<any>(null);

  // Request permissions
  const verifyPermissions = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        return permission.granted;
      }
      return true;
    } else {
      if (!libraryPermissionResponse?.granted) {
        const permission = await requestLibraryPermission();
        return permission.granted;
      }
      return true;
    }
  };

  // Trigger Mock AI detection
  const runMockAI = (imageUri: string) => {
    setSelectedImage(imageUri);
    setCameraActive(false);
    setAnalyzing(true);

    // Simulate AI model processing time (1.5s)
    setTimeout(() => {
      // Pick a random mock food prediction
      const randomIndex = Math.floor(Math.random() * MOCK_PREDICTIONS.length);
      const prediction = MOCK_PREDICTIONS[randomIndex];

      setFoodName(prediction.food_name);
      setCalories(prediction.estimated_calories.toString());
      setProtein(prediction.protein_g.toString());
      setCarbs(prediction.carb_g.toString());
      setFat(prediction.fat_g.toString());
      setPortionSize(prediction.portion_size);

      setAnalyzing(false);
    }, 1500);
  };

  // Open device camera
  const handleTakePhoto = async () => {
    const hasPermission = await verifyPermissions('camera');
    if (!hasPermission) {
      Alert.alert('Quyền truy cập camera bị từ chối', 'Bạn cần cho phép quyền camera để chụp ảnh món ăn.');
      return;
    }
    setCameraActive(true);
    setSelectedImage(null);
  };

  // Capture image using expo-camera
  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo?.uri) {
          runMockAI(photo.uri);
        }
      } catch (error) {
        console.error('Failed to capture image:', error);
        Alert.alert('Lỗi', 'Không thể chụp ảnh. Vui lòng thử lại.');
      }
    }
  };

  // Select photo from library
  const handlePickPhoto = async () => {
    const hasPermission = await verifyPermissions('library');
    if (!hasPermission) {
      Alert.alert('Quyền truy cập thư viện bị từ chối', 'Bạn cần cho phép quyền thư viện ảnh để chọn ảnh.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        runMockAI(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick photo:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  // Save food log to Supabase
  const handleSaveMeal = async () => {
    if (!foodName || !calories) {
      Alert.alert('Lỗi', 'Vui lòng điền tên món ăn và số lượng calo.');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Lỗi', 'Bạn chưa đăng nhập.');
        return;
      }

      let finalPhotoUrl = null;

      if (selectedImage) {
        try {
          // Resize chiều rộng tối đa 1024px, nén quality 0.7 để tối ưu dung lượng & token AI
          const manipulated = await ImageManipulator.manipulateAsync(
            selectedImage,
            [{ resize: { width: 1024 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );

          const response = await fetch(manipulated.uri);
          const blob = await response.blob();
          const arrayBuffer = await new Response(blob).arrayBuffer();
          const fileName = `${user.id}/${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('meal-photos')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            throw uploadError;
          }

          const { data: publicUrlData } = supabase.storage
            .from('meal-photos')
            .getPublicUrl(fileName);

          finalPhotoUrl = publicUrlData.publicUrl;
        } catch (uploadErr: any) {
          console.warn('Upload error:', uploadErr);
          Alert.alert('Cảnh báo', 'Không thể tải ảnh lên máy chủ. Bữa ăn sẽ được lưu không có ảnh.');
        }
      }

      const { error } = await supabase.from('meal_logs').insert([
        {
          user_id: user.id,
          photo_url: finalPhotoUrl,
          food_name: foodName,
          estimated_calories: parseInt(calories, 10),
          protein_g: parseFloat(protein) || 0,
          carb_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
          portion_size: portionSize || '1 portion',
          is_ai_estimated: true,
        },
      ]);

      if (error) {
        Alert.alert('Lỗi lưu dữ liệu', error.message);
      } else {
        Alert.alert('Thành công', 'Đã lưu bữa ăn thành công!', [
          {
            text: 'OK',
            onPress: () => {
              // Clear form and go back to dashboard
              setSelectedImage(null);
              setFoodName('');
              setCalories('');
              setProtein('');
              setCarbs('');
              setFat('');
              setPortionSize('');
              router.push('/(tabs)');
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Lỗi hệ thống', error.message || 'Không thể lưu bữa ăn.');
    } finally {
      setSaving(false);
    }
  };

  // Render camera view screen
  if (cameraActive) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} facing="back">
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeCameraButton} onPress={() => setCameraActive(false)}>
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.captureActionContainer}>
              <TouchableOpacity style={styles.captureButton} onPress={capturePhoto}>
                <View style={styles.captureInnerCircle} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Pickers when no image selected */}
          {!selectedImage && !analyzing && (
            <View style={styles.pickerContainer}>
              <Ionicons name="image-outline" size={80} color="#CBD5E1" />
              <Text style={styles.pickerInstruction}>Chụp ảnh món ăn để phân tích calo bằng AI hoặc chọn từ thư viện của bạn.</Text>

              <TouchableOpacity style={styles.primaryPickerButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={24} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.pickerButtonText}>Chụp ảnh món ăn</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryPickerButton} onPress={handlePickPhoto}>
                <Ionicons name="images" size={24} color="#2563EB" style={styles.buttonIcon} />
                <Text style={styles.pickerButtonTextSecondary}>Chọn từ thư viện</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Analyzing loading state */}
          {analyzing && (
            <View style={styles.analyzingContainer}>
              {selectedImage && <Image source={{ uri: selectedImage }} style={styles.analyzingImagePreview} />}
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.analyzingText}>AI đang phân tích món ăn...</Text>
              </View>
            </View>
          )}

          {/* Form Result screen */}
          {selectedImage && !analyzing && (
            <View style={styles.resultContainer}>
              <View style={styles.imagePreviewHeader}>
                <Image source={{ uri: selectedImage }} style={styles.resultImagePreview} />
                <TouchableOpacity style={styles.changeImageButton} onPress={() => setSelectedImage(null)}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={styles.changeImageText}>Xóa & Chọn lại</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Kết quả dự đoán của AI</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Tên món ăn</Text>
                  <TextInput
                    style={styles.input}
                    value={foodName}
                    onChangeText={setFoodName}
                    placeholder="Tên món ăn"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Số lượng Calo (kcal)</Text>
                  <TextInput
                    style={styles.input}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="numeric"
                    placeholder="Calo"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Khẩu phần</Text>
                  <TextInput
                    style={styles.input}
                    value={portionSize}
                    onChangeText={setPortionSize}
                    placeholder="Ví dụ: 1 bát, 1 đĩa, 200g"
                  />
                </View>

                <Text style={styles.macroFormTitle}>Thành phần dinh dưỡng</Text>
                <View style={styles.macroInputsRow}>
                  <View style={styles.macroInputCol}>
                    <Text style={styles.macroLabel}>Carbs (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={protein}
                      onChangeText={setProtein}
                      keyboardType="numeric"
                      placeholder="g"
                    />
                  </View>
                  <View style={styles.macroInputCol}>
                    <Text style={styles.macroLabel}>Protein (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={carbs}
                      onChangeText={setCarbs}
                      keyboardType="numeric"
                      placeholder="g"
                    />
                  </View>
                  <View style={styles.macroInputCol}>
                    <Text style={styles.macroLabel}>Fat (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={fat}
                      onChangeText={setFat}
                      keyboardType="numeric"
                      placeholder="g"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveMeal}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" style={styles.buttonIcon} />
                      <Text style={styles.saveButtonText}>Lưu vào nhật ký ăn uống</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  pickerContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  pickerInstruction: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  buttonIcon: {
    marginRight: 8,
  },
  pickerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerButtonTextSecondary: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  closeCameraButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
    marginTop: Platform.OS === 'ios' ? 44 : 20,
  },
  captureActionContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureInnerCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },
  analyzingContainer: {
    flex: 1,
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  analyzingImagePreview: {
    width: '100%',
    height: '100%',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  resultContainer: {},
  imagePreviewHeader: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  resultImagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  changeImageText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  macroFormTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  macroInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  macroInputCol: {
    flex: 1,
    marginHorizontal: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  macroInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
