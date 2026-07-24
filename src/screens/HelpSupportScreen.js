import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, MessageSquare, Mail, Phone, ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';

export const HelpSupportScreen = () => {
  const navigation = useNavigation();

  const faqs = [
    { question: 'Where is my order?', answer: 'You can track your order status in the Orders tab.' },
    { question: 'How do I cancel my order?', answer: 'Orders can only be cancelled before they are accepted by the shop.' },
    { question: 'What is the refund policy?', answer: 'Refunds are processed within 3-5 business days if applicable.' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#1A1A1A" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          
          <TouchableOpacity style={styles.contactCard} onPress={() => {}}>
            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
              <MessageSquare color="#1976D2" size={20} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Live Chat</Text>
              <Text style={styles.contactSub}>Typically replies in 5 mins</Text>
            </View>
            <ChevronRight color={theme.colors.textLight} size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('mailto:support@localneighborhood.com')}>
            <View style={[styles.iconBox, { backgroundColor: '#F3E5F5' }]}>
              <Mail color="#7B1FA2" size={20} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactSub}>support@localneighborhood.com</Text>
            </View>
            <ChevronRight color={theme.colors.textLight} size={20} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('tel:+18001234567')}>
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <Phone color="#388E3C" size={20} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Call Us</Text>
              <Text style={styles.contactSub}>Available 9AM - 8PM</Text>
            </View>
            <ChevronRight color={theme.colors.textLight} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqCard}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFF',
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
  },
  contactSection: {
    padding: theme.spacing.m,
  },
  sectionTitle: {
    ...theme.typography.subtitle,
    fontWeight: '700',
    marginBottom: theme.spacing.m,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    ...theme.shadows.soft,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.m,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    ...theme.typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactSub: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
  },
  faqSection: {
    padding: theme.spacing.m,
    paddingTop: 0,
  },
  faqCard: {
    backgroundColor: '#FFF',
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.s,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  faqQuestion: {
    ...theme.typography.body,
    fontWeight: '700',
    marginBottom: 6,
  },
  faqAnswer: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    lineHeight: 20,
  }
});

export default HelpSupportScreen;
