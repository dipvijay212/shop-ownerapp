import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar, Image } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, GripVertical, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import axiosClient from '../api/axiosClient';
import { theme } from '../theme';

export const ManageShopsScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [data, setData] = useState([]);

  const { data: shops, isLoading } = useQuery({
    queryKey: ['myShops'],
    queryFn: async () => {
      const res = await axiosClient.get('/my-shops');
      return res.data.savedShops;
    }
  });

  useEffect(() => {
    if (shops) {
      setData(shops);
    }
  }, [shops]);

  const reorderMutation = useMutation({
    mutationFn: async (orderedData) => {
      const payload = orderedData.map((s, index) => ({
        shop_id: s.id,
        sort_order: index
      }));
      await axiosClient.put('/my-shops/reorder', { orders: payload });
    },
    onSuccess: () => queryClient.invalidateQueries(['myShops'])
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await axiosClient.delete(`/my-shops/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries(['myShops'])
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const handleDelete = (id, name) => {
    Alert.alert('Remove Shop', `Are you sure you want to remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(id) }
    ]);
  };

  const renderItem = ({ item, drag, isActive }) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Shop', { shopId: item.id })}
          onLongPress={drag}
          disabled={isActive}
          style={[styles.rowItem, isActive && styles.rowItemActive]}
        >
          <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
            <GripVertical color={theme.colors.textLight} size={24} />
          </TouchableOpacity>
          <Image source={{ uri: item.banner_url }} style={styles.shopImage} />
          <View style={styles.info}>
            <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.category}>{item.category}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
            <View style={styles.deleteBtnInner}>
              <Trash2 color={theme.colors.error} size={18} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const handleDragEnd = ({ data: newData }) => {
    setData(newData);
    reorderMutation.mutate(newData);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={theme.colors.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Shops</Text>
          <View style={{width: 28}} />
        </View>
        <Text style={styles.instruction}>Drag the grip icon to reorder your saved shops.</Text>
        
        <DraggableFlatList
          data={data}
          onDragEnd={handleDragEnd}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  backBtn: {
    padding: theme.spacing.xs,
    marginLeft: -theme.spacing.xs,
  },
  headerTitle: {
    ...theme.typography.title,
    fontSize: 20,
  },
  instruction: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.l,
    textAlign: 'center',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.s,
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowItemActive: {
    backgroundColor: '#F9FAFB',
    transform: [{ scale: 1.02 }],
    ...theme.shadows.strong,
  },
  dragHandle: {
    padding: theme.spacing.s,
  },
  shopImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: theme.spacing.m,
    backgroundColor: '#EEEEEE',
  },
  info: {
    flex: 1,
  },
  shopName: {
    ...theme.typography.body,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  category: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  deleteBtn: {
    padding: theme.spacing.s,
  },
  deleteBtnInner: {
    backgroundColor: '#FEE2E2',
    padding: 8,
    borderRadius: 8,
  }
});

export default ManageShopsScreen;
