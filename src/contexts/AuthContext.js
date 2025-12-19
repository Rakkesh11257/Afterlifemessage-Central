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
      // Use bypassCache to get fresh user data, not cached
      const currentUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
      
      // Verify user actually exists by checking if we can get their profile
      // This ensures we don't use cached tokens for deleted users
      try {
        await messageAPI.getUserProfile();
        // User profile exists, set user
        setUser(currentUser);
      } catch (profileError) {
        // If getUserProfile fails with 401, user doesn't exist (deleted from Cognito)
        // Clear cache and sign out
        if (profileError.response?.status === 401 || profileError.message?.includes('not found')) {
          console.log('User not found in backend, clearing cache and signing out');
          try {
            await Auth.signOut();
          } catch (signOutError) {
            // Ignore sign out errors
          }
          // Clear local storage cache
          localStorage.clear();
          setUser(null);
        } else {
          // Other errors - still set user but log the error
          console.error('Error fetching user profile:', profileError);
          setUser(currentUser);
        }
      }
    } catch (error) {
      // No authenticated user or error getting user
      console.log('No authenticated user:', error);
      setUser(null);
      // Clear any cached tokens
      try {
        localStorage.clear();
      } catch (clearError) {
        // Ignore clear errors
      }
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
      
      // Get fresh user data with bypassCache to ensure we have the latest email_verified status
      // This is important after email verification to avoid stale cached data
      const freshUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
      
      // Check if email is verified - this handles both initial signup and email changes
      // email_verified can be boolean true/false or string "true"/"false"
      const emailVerified = freshUser.attributes?.email_verified;
      const isEmailVerified = emailVerified === true || emailVerified === 'true';
      
      if (!isEmailVerified) {
        const currentEmail = freshUser.attributes?.email || user.attributes?.email;
        return { 
          success: false, 
          error: `Your email address (${currentEmail}) needs to be verified. Please check your email for the verification code and verify your email address.`, 
          notConfirmed: true,
          requiresEmailVerification: true,
          email: currentEmail
        };
      }
      
      setUser(freshUser);
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
      // Handle case where user changed email but hasn't verified - Cognito might reject login
      if (error.message && error.message.includes('email')) {
        return { 
          success: false, 
          error: 'Email verification required. If you recently changed your email, please verify your new email address. Check your email for the verification code.', 
          notConfirmed: true,
          requiresEmailVerification: true
        };
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
      // Clear localStorage cache to prevent stale tokens
      try {
        localStorage.clear();
      } catch (clearError) {
        // Ignore clear errors
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if signOut fails, clear local state and cache
      setUser(null);
      try {
        localStorage.clear();
      } catch (clearError) {
        // Ignore clear errors
      }
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