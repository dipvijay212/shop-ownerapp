import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check } from 'lucide-react-native';
import { theme } from '../theme';

export const LanguageSettingsScreen = () => {
  const navigation = useNavigation();
  const [selectedLang, setSelectedLang] = useState('en');

  const languages = [
    { id: 'en', name: 'English', nativeName: 'English' },
    { id: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { id: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  ];

  const handleSave = () => {
    // In a real app, save to async storage, update context/i18n instance
    navigation.goBack();
  };

  const renderItem = ({ item }) => {
    const isSelected = item.id === selectedLang;
    
    return (
      <TouchableOpacity 
        style={[styles.langRow, isSelected && styles.langRowSelected]}
        onPress={() => setSelectedLang(item.id)}
      >
        <View style={styles.langInfo}>
          <Text style={styles.langName}>{item.nativeName}</Text>
          <Text style={styles.langSub}>{item.name}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkIcon}>
            <Check color={theme.colors.primary} size={20} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1A1A1A" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Language Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>Select your preferred language</Text>
        
        <FlatList
          data={languages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save Language</Text>
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    backgroundColor: '#F7F9F8',
  },
  instruction: {
    ...theme.typography.subtitle,
    margin: theme.spacing.m,
    color: theme.colors.textLight,
  },
  listContent: {
    paddingHorizontal: theme.spacing.m,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  langRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FFF4',
  },
  langInfo: {
    flex: 1,
  },
  langName: {
    ...theme.typography.body,
    fontWeight: '700',
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  langSub: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  checkIcon: {
    padding: 4,
  },
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
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

export default LanguageSettingsScreen;
