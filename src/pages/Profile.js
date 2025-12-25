import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI } from '../services/api';
import { User, Mail, Calendar, Shield, Settings, ArrowLeft, Edit, X, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [userStats, setUserStats] = useState({
    totalMessages: 0,
    pendingMessages: 0,
    deliveredMessages: 0,
    accountAge: 0
  });
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats();
    fetchUserProfile();
    // Refresh user data periodically to get updated email_verified status
    // This is especially important after email changes
    const refreshInterval = setInterval(async () => {
      if (user) {
        try {
          await refreshUser();
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      setNewMobile(userProfile.phoneNumber || '');
    }
  }, [userProfile]);

  const fetchUserStats = async () => {
    try {
      const { messages } = await messageAPI.getMessages();
      const totalMessages = messages.length;
      const deliveredMessages = messages.filter(m => m.status === 'delivered').length;
      const pendingMessages = messages.filter(m => m.status === 'pending').length;
      setUserStats(prev => ({
        ...prev,
        totalMessages,
        pendingMessages,
        deliveredMessages
      }));
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setUserStats(prev => ({ ...prev, totalMessages: 0, pendingMessages: 0, deliveredMessages: 0 }));
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const profile = await messageAPI.getUserProfile();
      setUserProfile(profile);
      
      // Calculate account age from creation date
      if (profile.createdAt) {
        const createdDate = new Date(profile.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - createdDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setUserStats(prev => ({
          ...prev,
          accountAge: diffDays
        }));
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleChangePassword = () => {
    navigate('/reset-password');
  };

  const handleEdit = () => {
    setNewEmail(getUserEmail());
    setNewDisplayName(getUserDisplayName());
    setNewMobile(userProfile?.phoneNumber || '');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    // Validate all fields
    if (!newDisplayName || newDisplayName.trim() === '') {
      toast.error('Please enter a valid display name');
      return;
    }
    if (!newMobile || newMobile.trim() === '') {
      toast.error('Please enter a valid mobile number');
      return;
    }

    // Validate email if it changed
    const emailChanged = newEmail !== getUserEmail();
    if (emailChanged) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    try {
      setIsUpdatingProfile(true);
      
      const { Auth } = await import('aws-amplify');
      const currentUser = await Auth.currentAuthenticatedUser();
      
      // Update display name and phone number in Cognito
      let phoneNumber = newMobile;
      if (phoneNumber && !phoneNumber.startsWith('+')) {
        phoneNumber = '+91' + phoneNumber.replace(/^0+/, ''); // Default to India country code
      }
      
      await Auth.updateUserAttributes(currentUser, {
        name: newDisplayName,
        phone_number: phoneNumber
      });

      // Update display name and phone in DynamoDB
      if (userProfile && userProfile.userId) {
        const payload = {
          displayName: newDisplayName.trim(),
          phoneNumber: phoneNumber
        };
        try {
          await messageAPI.updateUserProfile(payload);
        } catch (updateError) {
          console.error('Error updating profile in DynamoDB:', updateError);
          // Don't fail the whole flow if DynamoDB update fails - Cognito is already updated
          toast.error(`Profile updated in Cognito, but failed to update in database: ${updateError.response?.data?.error || updateError.message}`);
        }
      } else {
        console.error('Cannot update DynamoDB: userProfile or userId missing', { userProfile });
        toast.error('Cannot update profile: User profile not found. Please refresh the page.');
        setIsUpdatingProfile(false);
        return;
      }

      // If email changed, update it separately with verification flow
      if (emailChanged) {
        // Warn user about email verification requirement
        const confirmed = window.confirm(
          '⚠️ IMPORTANT: Your email address will be changed.\n\n' +
          'After changing your email, you MUST verify the new email address with the confirmation code that will be sent to your new email.\n\n' +
          'If you do not verify your new email address:\n' +
          '• You will not be able to log in\n' +
          '• Your messages will NOT be delivered\n' +
          '• You may lose access to your account\n\n' +
          'Do you want to continue?'
        );

        if (!confirmed) {
          setIsUpdatingProfile(false);
          return;
        }

        // Update email attribute - this will send verification code to new email
        await Auth.updateUserAttributes(currentUser, {
          email: newEmail
        });

        // Explicitly request verification code for the new email attribute
        try {
          await Auth.verifyUserAttribute(currentUser, 'email');
        } catch (verifyError) {
          // Verification code request failed, but continue with the flow
        }

        // Refresh user object to get updated email_verified status
        await refreshUser();
        
        // Get fresh user data with bypassCache to see actual verification status
        const updatedUser = await Auth.currentAuthenticatedUser({ bypassCache: true });

        // Check if email is actually verified
        const isVerified = updatedUser.attributes.email_verified === true || updatedUser.attributes.email_verified === 'true';
        
        if (!isVerified) {
          toast.success('Profile updated! Please check your NEW email address for the verification code. You must verify your email before logging in again.', {
            duration: 8000,
            icon: '⚠️'
          });
          // Show OTP input for immediate verification
          setShowOtpInput(true);
          setIsUpdatingProfile(false);
          return; // Don't exit edit mode yet - wait for email verification
        }
      }

      // If no email change or email already verified, complete the update
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      setNewEmail('');
      setNewDisplayName('');
      setNewMobile('');
      setShowOtpInput(false);
      
      // Refresh user data
      await refreshUser();
      await fetchUserProfile();
      await fetchUserStats();
      
      setIsUpdatingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(`Failed to update profile: ${error.message || 'Please try again.'}`);
      setIsUpdatingProfile(false);
    }
  };

  const handleResendEmailVerificationCode = async () => {
    try {
      const { Auth } = await import('aws-amplify');
      const currentUser = await Auth.currentAuthenticatedUser();
      
      // Resend verification code for email attribute (not signup confirmation)
      await Auth.verifyUserAttribute(currentUser, 'email');
      toast.success('Verification code resent! Please check your email.');
    } catch (error) {
      console.error('Error resending verification code:', error);
      if (error.code === 'LimitExceededException') {
        toast.error('Too many attempts. Please wait 15 minutes before requesting another code. AWS Cognito rate limit: Maximum 3 verification codes per 15 minutes per user.');
      } else {
        toast.error(error.message || 'Failed to resend verification code.');
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('Please enter the verification code');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      
      const { Auth } = await import('aws-amplify');
      const currentUser = await Auth.currentAuthenticatedUser();
      
      // Verify the OTP for email attribute
      // Note: This will work even if Cognito shows email_verified as true
      // because we're verifying the attribute change, not the account confirmation
      await Auth.verifyUserAttributeSubmit(currentUser, 'email', otp);
      
      toast.success('Email verified successfully!');
      
      // Update user profile in DynamoDB with new email
      try {
        // Get the updated user to fetch new email
        const updatedUser = await Auth.currentAuthenticatedUser({ bypassCache: true });
        const verifiedEmail = updatedUser.attributes.email;
        
        // Update user profile in DynamoDB (email is stored in Cognito, but we can update DynamoDB for consistency)
        // Note: Messages are tied to userId, not email, so no migration needed
        const refreshResult = await refreshUser();
        if (refreshResult.success) {
          // Refresh the user profile data
          await fetchUserProfile();
          await fetchUserStats();
          
          toast.success('Email updated successfully! Your profile has been refreshed.');
        } else {
          console.error('Failed to refresh user data:', refreshResult.error);
          toast.success('Email verified! Please refresh the page to see the update.');
        }
      } catch (updateError) {
        console.error('Error updating user profile:', updateError);
        // Don't fail the whole flow if profile update fails - email is already verified in Cognito
        toast.success('Email verified! Your email has been updated in Cognito.');
      }
      
      setShowOtpInput(false);
      setOtp('');
      setIsEditing(false);
      setNewEmail('');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      if (error.code === 'CodeMismatchException') {
        toast.error('Invalid verification code. Please check your email and try again.');
      } else if (error.code === 'ExpiredCodeException') {
        toast.error('Verification code has expired. Please request a new one.');
      } else {
        toast.error(`Verification failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleCancelOtp = async () => {
    // Warn user about consequences of not verifying
    const confirmed = window.confirm(
      '⚠️ WARNING: Email verification cancelled.\n\n' +
      'Your email has been changed to ' + newEmail + ' but is NOT verified.\n\n' +
      'Consequences:\n' +
      '• You will NOT be able to log in after signing out\n' +
      '• Your messages will NOT be delivered\n' +
      '• You may lose access to your account\n\n' +
      'You can verify your email later, but you must do it before logging in again.\n\n' +
      'Do you want to cancel verification?'
    );
    
    if (!confirmed) {
      return; // User wants to continue with verification
    }
    
    // Don't sign out automatically - let user stay logged in but show warning
    // They can verify later, but will need to verify before next login
    setShowOtpInput(false);
    setOtp('');
    setIsEditing(false);
    toast('Email verification cancelled. Your email is changed but NOT verified. You must verify it before your next login.', {
      duration: 8000,
      icon: '⚠️',
      style: {
        background: '#ffa500',
        color: '#fff',
      },
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewEmail('');
    setNewDisplayName('');
    setNewMobile('');
    setShowOtpInput(false);
    setOtp('');
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAccountAgeText = (days) => {
    if (days < 30) return `${days} days`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      if (remainingDays === 0) {
        return `${months} months`;
      } else {
        return `${months} months, ${remainingDays} days`;
      }
    }
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    if (remainingDays === 0) {
      return `${years} years`;
    } else {
      const months = Math.floor(remainingDays / 30);
      return `${years} years, ${months} months`;
    }
  };

  // Get user email - try different possible locations
  const getUserEmail = () => {
    // Based on the actual user object structure
    return user?.attributes?.email || 
           user?.username || 
           'Email not available';
  };

  // Get user display name
  const getUserDisplayName = () => {
    return user?.attributes?.name || 
           user?.attributes?.email || 
           user?.username || 
           'User';
  };

  // Get account creation date
  const getAccountCreatedDate = () => {
    if (userProfile?.createdAt) {
      return formatDate(userProfile.createdAt);
    }
    // Fallback to Cognito attributes if available
    if (user?.attributes?.email_verified === true) {
      return 'Recently';
    }
    return 'N/A';
  };

  // Check if email is verified
  // Note: After email change, email_verified might be false even if account is CONFIRMED
  const isEmailVerified = () => {
    if (!user?.attributes) return false;
    // email_verified can be boolean true/false or string "true"/"false"
    const emailVerified = user.attributes.email_verified;
    return emailVerified === true || emailVerified === 'true';
  };


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="card">
              <div className="text-center">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-12 w-12 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-center mb-1 break-words max-w-xs mx-auto">
                  {getUserDisplayName()}
                </h2>
                <p className="text-gray-600 mb-4 truncate max-w-xs mx-auto overflow-hidden text-ellipsis">
                  {getUserEmail()}
                </p>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Member since:</span>
                    <span className="font-medium">
                      {getAccountCreatedDate()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Account age:</span>
                    <span className="font-medium">
                      {getAccountAgeText(userStats.accountAge)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Account Statistics */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-primary-600" />
                Account Statistics
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{userStats.totalMessages}</div>
                  <div className="text-sm text-gray-600">Total Messages</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{userStats.pendingMessages}</div>
                  <div className="text-sm text-gray-600">Pending</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{userStats.deliveredMessages}</div>
                  <div className="text-sm text-gray-600">Delivered</div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary-600" />
                  Account Information
                </h3>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    className="flex items-center text-primary-600 hover:text-primary-700"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    {isEditing ? (
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                        placeholder="Enter new email address"
                      />
                    ) : (
                      <span className="text-gray-900 break-all">{getUserEmail()}</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                        placeholder="Enter your display name"
                      />
                    ) : (
                      <span className="text-gray-900 font-medium">{getUserDisplayName()}</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    {isEditing ? (
                      <input
                        type="text"
                        value={newMobile}
                        onChange={(e) => setNewMobile(e.target.value)}
                        className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                        placeholder="Enter your mobile number"
                      />
                    ) : (
                      <span className="text-gray-900 font-medium">{userProfile?.phoneNumber || 'N/A'}</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Created
                  </label>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-gray-900">
                      {getAccountCreatedDate()}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Verified
                  </label>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                      isEmailVerified() 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                    }`}></div>
                    <span className="text-gray-900">
                      {isEmailVerified() ? 'Verified' : 'Not Verified'}
                    </span>
                  </div>
                </div>

                {isEditing && !showOtpInput && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      onClick={handleCancelEdit}
                      className="btn-outline"
                      disabled={isUpdatingProfile}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="btn-primary flex items-center"
                      disabled={isUpdatingProfile}
                    >
                      {isUpdatingProfile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}

                {showOtpInput && (
                  <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-2">⚠️</span>
                      <h4 className="font-bold text-yellow-900">VERIFY YOUR NEW EMAIL ADDRESS</h4>
                    </div>
                    <div className="bg-yellow-100 p-3 rounded mb-4">
                      <p className="text-sm font-semibold text-yellow-900 mb-2">
                        ⚠️ IMPORTANT: You must verify your new email address!
                      </p>
                      <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                        <li>Your messages will <strong>NOT be delivered</strong> if email is not verified</li>
                        <li>You will <strong>NOT be able to log in</strong> until email is verified</li>
                        <li>You may <strong>lose access to your account</strong> if email is not verified</li>
                      </ul>
                    </div>
                    <p className="text-sm text-yellow-800 mb-4">
                      We've sent a verification code to <strong className="text-yellow-900">{newEmail}</strong>. Please enter it below to complete the email update.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Verification Code
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
                          placeholder="Enter 6-digit verification code"
                          maxLength="6"
                        />
                        <button
                          type="button"
                          onClick={handleResendEmailVerificationCode}
                          className="mt-2 text-sm text-primary-600 hover:text-primary-700 underline"
                        >
                          Didn't receive code? Resend verification code
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                          Rate limit: Maximum 3 codes per 15 minutes
                        </p>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleCancelOtp}
                          className="btn-outline"
                          disabled={isVerifyingOtp}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleVerifyOtp}
                          className="btn-primary flex items-center"
                          disabled={isVerifyingOtp}
                        >
                          {isVerifyingOtp ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Verify Email
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security Settings */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-primary-600" />
                Security Settings
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Change Password</h4>
                    <p className="text-sm text-gray-600">Reset your account password</p>
                  </div>
                  <button
                    onClick={handleChangePassword}
                    className="btn-outline"
                  >
                    Reset Password
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Sign Out</h4>
                    <p className="text-sm text-gray-600">Sign out of your account</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="btn-secondary"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-primary-600" />
                Preferences
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Email Notifications</h4>
                    <p className="text-sm text-gray-600">Receive notifications about your messages</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Message Reminders</h4>
                    <p className="text-sm text-gray-600">Get reminders about upcoming deliveries</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 