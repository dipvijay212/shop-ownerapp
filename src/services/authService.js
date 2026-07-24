import AsyncStorage from '@react-native-async-storage/async-storage';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const authService = {
  /**
   * Mock endpoint for POST /api/auth/customer/send-otp
   */
  sendOtp: async (phone) => {
    await delay(1000); // Simulate network delay
    // Always succeed
    return { success: true };
  },

  /**
   * Mock endpoint for POST /api/auth/customer/verify-otp
   */
  verifyOtp: async (phone, otp) => {
    await delay(1000); // Simulate network delay
    
    if (otp !== '123456') {
      const error = new Error('Invalid OTP');
      error.response = { status: 400 };
      throw error;
    }

    // Check if customer exists in AsyncStorage
    const customersJson = await AsyncStorage.getItem('mock_customers');
    const customers = customersJson ? JSON.parse(customersJson) : [];
    
    const existingCustomer = customers.find(c => c.phone === phone);

    if (existingCustomer) {
      // Returning user
      const token = `mock-jwt-token-for-${existingCustomer.id}`;
      return {
        isNewUser: false,
        token,
        customer: existingCustomer
      };
    } else {
      // New user
      return {
        isNewUser: true,
        phone
      };
    }
  },

  /**
   * Mock endpoint for POST /api/auth/customer/profile
   */
  createProfile: async ({ phone, name, email, language }) => {
    await delay(1000); // Simulate network delay
    
    const customersJson = await AsyncStorage.getItem('mock_customers');
    const customers = customersJson ? JSON.parse(customersJson) : [];
    
    const newCustomer = {
      id: `cust_${Date.now()}`,
      phone,
      name,
      email: email || '',
      language: language || 'en',
      createdAt: new Date().toISOString()
    };
    
    customers.push(newCustomer);
    await AsyncStorage.setItem('mock_customers', JSON.stringify(customers));
    
    const token = `mock-jwt-token-for-${newCustomer.id}`;
    
    return {
      token,
      customer: newCustomer
    };
  },

  /**
   * Mock endpoint for GET /api/auth/me (Startup validation)
   */
  validateToken: async (token) => {
    await delay(500); // Simulate network delay
    
    if (!token || !token.startsWith('mock-jwt-token-for-')) {
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      throw error;
    }
    
    const customerId = token.replace('mock-jwt-token-for-', '');
    
    const customersJson = await AsyncStorage.getItem('mock_customers');
    const customers = customersJson ? JSON.parse(customersJson) : [];
    
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) {
      const error = new Error('Customer not found');
      error.response = { status: 401 };
      throw error;
    }
    
    return { user: customer };
  }
};
