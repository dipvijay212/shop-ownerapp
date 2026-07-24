import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';
import { CheckCircle2 } from 'lucide-react-native';

export const AddressListScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const res = await axiosClient.get('/addresses');
      return res.data.addresses;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await axiosClient.delete(`/addresses/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries(['addresses'])
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (address) => {
      await axiosClient.put(`/addresses/${address.id}`, {
        label: address.label,
        line1: address.line1,
        line2: address.line2,
        pincode: address.pincode,
        lat: address.latitude,
        lng: address.longitude,
        is_default: true,
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['addresses'])
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const handleDelete = (id) => {
    Alert.alert('Delete Address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) }
    ]);
  };

  const renderItem = ({ item }) => {
    const isSelected = Boolean(item.is_default);
    return (
      <TouchableOpacity 
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => !isSelected && setDefaultMutation.mutate(item)}
      >
        <View style={styles.headerRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {isSelected && <CheckCircle2 color={theme.colors.primary} size={20} style={{marginRight: 6}} />}
            <Text style={[styles.label, isSelected && {color: theme.colors.primary}]}>
              {item.label} {isSelected && '(Default)'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.body}>{item.line1}</Text>
        {item.line2 ? <Text style={styles.body}>{item.line2}</Text> : null}
        <Text style={styles.body}>{item.pincode}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Saved Addresses</Text>
      
      <FlatList
        data={addresses}
        keyExtractor={a => a.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No addresses found.</Text>}
      />

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddressMapPicker')}
      >
        <Text style={styles.fabText}>+ Add Address</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...theme.typography.title,
    margin: theme.spacing.m,
  },
  list: {
    paddingHorizontal: theme.spacing.m,
    paddingBottom: 100,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: 8,
    marginBottom: theme.spacing.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4', // Very light green tint
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  label: {
    ...theme.typography.subtitle,
    fontWeight: 'bold',
  },
  deleteText: {
    color: theme.colors.error,
    fontWeight: 'bold',
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.m,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default AddressListScreen;
