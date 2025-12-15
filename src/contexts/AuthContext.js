import React, { createContext, useContext, useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';
import { messageAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);
      // Ensure user profile exists in our backend
      try {
        await messageAPI.getUserProfile();
      } catch (error) {
        // Optionally log error for monitoring
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      const user = await Auth.signIn(email, password);
      // Cognito returns a user object even if not confirmed, so check status
      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
        return { success: false, error: 'New password required. Please reset your password.' };
      }
      if (user.challengeName === 'SMS_MFA' || user.challengeName === 'SOFTWARE_TOKEN_MFA') {
        return { success: false, error: 'MFA required. Please complete multi-factor authentication.' };
      }
      if (user.attributes && user.attributes.email_verified === false) {
        return { success: false, error: 'Please verify your email before signing in.', notConfirmed: true };
      }
      setUser(user);
      // Ensure user profile exists in our backend
      try {
        await messageAPI.getUserProfile();
      } catch (error) {
        // Optionally log error for monitoring
      }
      return { success: true };
    } catch (error) {
      if (error.code === 'UserNotConfirmedException') {
        // User is not confirmed
        return { success: false, error: 'Your account is not confirmed. Please check your email for the confirmation code.', notConfirmed: true };
      }
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email, password, fullName) => {
    try {
      await Auth.signUp({
        username: email,
        password,
        attributes: {
          email,
          name: fullName, // Store full name in Cognito
        },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const confirmSignUp = async (email, code) => {
    try {
      await Auth.confirmSignUp(email, code);
      return { success: true };
    } catch (error) {
      if (
        error.code === 'NotAuthorizedException' &&
        error.message && error.message.toLowerCase().includes('already confirmed')
      ) {
        // User is already confirmed, treat as success
        return { success: true, alreadyConfirmed: true };
      }
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await Auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const forgotPassword = async (email) => {
    try {
      await Auth.forgotPassword(email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const confirmForgotPassword = async (email, code, newPassword) => {
    try {
      await Auth.forgotPasswordSubmit(email, code, newPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
      setUser(currentUser);
      return { success: true };
    } catch (error) {
      console.error('Error refreshing user:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    forgotPassword,
    confirmForgotPassword,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 