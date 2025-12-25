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
      console.log('SignIn successful, user object:', user);
      console.log('User attributes:', user.attributes);
      
      // Cognito returns a user object even if not confirmed, so check status
      if (user.challengeName === 'NEW_PASSWORD_REQUIRED') {
        return { success: false, error: 'New password required. Please reset your password.' };
      }
      if (user.challengeName === 'SMS_MFA' || user.challengeName === 'SOFTWARE_TOKEN_MFA') {
        return { success: false, error: 'MFA required. Please complete multi-factor authentication.' };
      }
      
      // Use attributes directly from the user object returned by signIn
      // The user object should have attributes if sign-in was successful
      const userAttributes = user.attributes || {};
      
      // Check if email is verified
      // email_verified can be boolean true/false or string "true"/"false"
      // If email_verified is undefined, assume the user is verified (confirmed users might not have this attribute)
      const emailVerified = userAttributes.email_verified;
      const isEmailUnverified = emailVerified === false || emailVerified === 'false';
      
      console.log('Email verified check:', { 
        emailVerified, 
        isEmailUnverified,
        userAttributes,
        userUsername: user.username
      });
      
      // Only block sign-in if email_verified is explicitly false
      // If it's undefined or true, allow sign-in to proceed
      if (isEmailUnverified) {
        const currentEmail = userAttributes.email || user.username;
        return { 
          success: false, 
          error: `Your email address (${currentEmail}) needs to be verified. Please check your email for the verification code and verify your email address.`, 
          notConfirmed: true,
          requiresEmailVerification: true,
          email: currentEmail
        };
      }
      
      setUser(user);
      // Ensure user profile exists in our backend
      try {
        await messageAPI.getUserProfile();
      } catch (error) {
        console.error('Error getting user profile after sign in:', error);
        // Don't fail sign in if profile fetch fails
      }
      return { success: true };
    } catch (error) {
      console.error('SignIn error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Handle specific Cognito error codes
      if (error.code === 'UserNotConfirmedException') {
        return { success: false, error: 'Your account is not confirmed. Please check your email for the confirmation code.', notConfirmed: true };
      }
      
      if (error.code === 'NotAuthorizedException') {
        return { success: false, error: 'Incorrect email or password. Please check your credentials and try again.' };
      }
      
      if (error.code === 'UserNotFoundException') {
        return { success: false, error: 'No account found with this email address. Please sign up first.' };
      }
      
      if (error.code === 'InvalidParameterException') {
        return { success: false, error: 'Invalid email or password format. Please check your credentials.' };
      }
      
      if (error.code === 'PasswordResetRequiredException') {
        return { success: false, error: 'Password reset required. Please reset your password.' };
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
      
      // Log the full error for debugging
      console.error('SignIn error details:', {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
        fullError: error,
        toString: error.toString()
      });
      
      // Extract error message - try multiple sources
      let errorMessage = 'Sign in failed. Please check your credentials and try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Sign in failed: ${error.code}`;
      } else if (error.toString && error.toString() !== '[object Object]') {
        errorMessage = error.toString();
      }
      
      return { success: false, error: errorMessage };
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