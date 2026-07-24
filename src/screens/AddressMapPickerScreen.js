import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MapPin, Home, AlignLeft, Map as MapIcon, ArrowLeft } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';

export const AddressMapPickerScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [pincode, setPincode] = useState('');

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      await axiosClient.post('/addresses', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['addresses']);
      navigation.goBack();
    },
    onError: (err) => {
      Alert.alert('Error', err.response?.data?.message || err.message);
    }
  });



  const handleSave = () => {
    if (!line1 || !pincode) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
      return;
    }

    saveMutation.mutate({
      label,
      line1,
      line2,
      pincode,
      is_default: false
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color="#1A1A1A" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Address Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAwareScrollView 
          contentContainerStyle={styles.formContainer} 
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={20}
        >
          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 12, marginBottom: 0 }]}>
              <Home color="#666" size={18} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Label (e.g. Home)" value={label} onChangeText={setLabel} placeholderTextColor="#999" />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginBottom: 0 }]}>
              <MapPin color="#666" size={18} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" placeholderTextColor="#999" />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <AlignLeft color="#666" size={18} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Flat, House no., Building" value={line1} onChangeText={setLine1} placeholderTextColor="#999" />
          </View>
          
          <View style={styles.inputContainer}>
            <MapIcon color="#666" size={18} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Area, Street, Sector, Village" value={line2} onChangeText={setLine2} placeholderTextColor="#999" />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Address</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>


      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  formContainer: {
    padding: 24,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  footer: {
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    backgroundColor: '#006B54',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  }
});

export default AddressMapPickerScreen;
