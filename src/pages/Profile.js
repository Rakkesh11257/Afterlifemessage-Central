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
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isUpdatingDisplayName, setIsUpdatingDisplayName] = useState(false);
  const [newMobile, setNewMobile] = useState('');
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
  }, []);

  useEffect(() => {
    if (userProfile) {
      console.log('userProfile:', userProfile);
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

  const handleEditEmail = () => {
    setNewEmail(getUserEmail());
    setIsEditing(true);
  };

  const handleSaveEmail = async () => {
    if (!newEmail || newEmail === getUserEmail()) {
      setIsEditing(false);
      setNewEmail('');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsUpdatingEmail(true);
      
      // Update email using AWS Amplify Auth
      const { Auth } = await import('aws-amplify');
      const currentUser = await Auth.currentAuthenticatedUser();
      
      await Auth.updateUserAttributes(currentUser, {
        email: newEmail
      });

      toast.success('Email updated! Please check your new email for verification code.');
      setShowOtpInput(true);
      setIsUpdatingEmail(false);
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error('Failed to update email. Please try again.');
      setIsUpdatingEmail(false);
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
      
      // Verify the OTP
      await Auth.verifyUserAttributeSubmit(currentUser, 'email', otp);
      
      toast.success('Email verified successfully!');
      setShowOtpInput(false);
      setOtp('');
      setIsEditing(false);
      setNewEmail('');
      
      // Migrate user data to new email
      try {
        const oldEmail = getUserEmail();
        const userProfile = await messageAPI.getUserProfile();
        
        if (userProfile && userProfile.userId) {
          console.log('Starting migration with:', { oldEmail, newEmail, userId: userProfile.userId });
          
          const migrationResult = await messageAPI.migrateUser(oldEmail, newEmail, userProfile.userId);
          console.log('Migration result:', migrationResult);
          
          if (migrationResult.success) {
            toast.success(`Migration completed! ${migrationResult.migratedMessages} messages updated.`);
            
            // Refresh the user session to get updated attributes
            const refreshResult = await refreshUser();
            if (refreshResult.success) {
              // Also refresh the user profile data
              await fetchUserProfile();
              await fetchUserStats();
              
              toast.success('Email verification and migration completed! Your profile has been updated.');
              // Force a page reload to ensure all data is updated
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            } else {
              console.error('Failed to refresh user data:', refreshResult.error);
              toast.error('Migration completed but failed to refresh user data. Please refresh the page manually.');
            }
          } else {
            toast.error(`Migration failed: ${migrationResult.error || 'Unknown error'}`);
            console.error('Migration failed:', migrationResult);
          }
        } else {
          toast.error('User profile not found. Please contact support.');
          console.error('User profile not found:', userProfile);
        }
      } catch (migrationError) {
        console.error('Error during user migration:', migrationError);
        toast.error(`Migration failed: ${migrationError.message || 'Unknown error'}`);
      }
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

  const handleCancelOtp = () => {
    setShowOtpInput(false);
    setOtp('');
    setIsEditing(false);
    setNewEmail('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewEmail('');
    setShowOtpInput(false);
    setOtp('');
  };

  const handleEditDisplayName = () => {
    setNewDisplayName(getUserDisplayName());
    setNewMobile(userProfile?.phoneNumber || '');
    setIsEditingDisplayName(true);
  };

  const handleSaveDisplayName = async () => {
    if (!newDisplayName || newDisplayName.trim() === '') {
      toast.error('Please enter a valid display name');
      return;
    }
    if (!newMobile || newMobile.trim() === '') {
      toast.error('Please enter a valid mobile number');
      return;
    }
    try {
      setIsUpdatingDisplayName(true);
      const { Auth } = await import('aws-amplify');
      const currentUser = await Auth.currentAuthenticatedUser();
      // Always update Cognito with 'name' and 'phone_number'
      let phoneNumber = newMobile;
      if (phoneNumber && !phoneNumber.startsWith('+')) {
        phoneNumber = '+91' + phoneNumber.replace(/^0+/, ''); // Default to India country code, adjust as needed
      }
      await Auth.updateUserAttributes(currentUser, { name: newDisplayName, phone_number: phoneNumber });
      if (userProfile && userProfile.userId) {
        const payload = {
          displayName: newDisplayName,
          phoneNumber: phoneNumber
        };
        console.log('Sending profile update payload:', payload);
        await messageAPI.updateUserProfile(payload);
      } else {
        toast.error('User profile not found. Please refresh the page and try again.');
        setIsUpdatingDisplayName(false);
        return;
      }
      toast.success('Profile updated successfully!');
      setIsEditingDisplayName(false);
      setNewDisplayName('');
      setNewMobile('');
      const refreshResult = await refreshUser();
      await fetchUserProfile();
    } catch (error) {
      toast.error(`Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingDisplayName(false);
    }
  };

  const handleCancelDisplayName = () => {
    setIsEditingDisplayName(false);
    setNewDisplayName('');
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
  const isEmailVerified = () => {
    return user?.attributes?.email_verified === true || false;
  };

  // Debug function to log user attributes
  const logUserAttributes = () => {
    console.log('User object:', user);
    console.log('User attributes:', user?.attributes);
    console.log('Available attributes:', Object.keys(user?.attributes || {}));
    console.log('User email:', getUserEmail());
    console.log('Email verified:', isEmailVerified());
    console.log('getUserEmail() result:', getUserEmail());
    console.log('user?.attributes?.email:', user?.attributes?.email);
    console.log('user?.username:', user?.username);
  };

  // Log user attributes on component mount for debugging
  useEffect(() => {
    if (user) {
      logUserAttributes();
    }
  }, [user]);

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
                <button
                  onClick={isEditing ? handleCancelEdit : handleEditEmail}
                  className="flex items-center text-primary-600 hover:text-primary-700"
                  disabled={isUpdatingEmail}
                >
                  {isEditing ? (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </>
                  )}
                </button>
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
                    {isEditingDisplayName ? (
                      <>
                        <input
                          type="text"
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent mb-2"
                          placeholder="Enter your display name"
                        />
                        <input
                          type="text"
                          value={newMobile}
                          onChange={(e) => setNewMobile(e.target.value)}
                          className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent mb-2"
                          placeholder="Enter your mobile number"
                        />
                      </>
                    ) : (
                      <div className="flex flex-col space-y-1">
                        <div>
                          <span className="text-gray-600 text-sm font-medium">Display Name: </span>
                          <span className="text-gray-900 font-medium">{getUserDisplayName()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 text-sm font-medium">Mobile: </span>
                          <span className="text-gray-900 font-medium">{userProfile?.phoneNumber || 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {!isEditingDisplayName && (
                    <button
                      onClick={handleEditDisplayName}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center"
                      disabled={isUpdatingDisplayName}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  )}
                </div>
                
                {isEditingDisplayName && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      onClick={handleCancelDisplayName}
                      className="btn-outline"
                      disabled={isUpdatingDisplayName}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveDisplayName}
                      className="btn-primary flex items-center"
                      disabled={isUpdatingDisplayName}
                    >
                      {isUpdatingDisplayName ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save Display Name
                        </>
                      )}
                    </button>
                  </div>
                )}
                
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
                      disabled={isUpdatingEmail}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEmail}
                      className="btn-primary flex items-center"
                      disabled={isUpdatingEmail}
                    >
                      {isUpdatingEmail ? (
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
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center mb-3">
                      <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                      <h4 className="font-medium text-blue-900">Verify New Email</h4>
                    </div>
                    <p className="text-sm text-blue-700 mb-4">
                      We've sent a verification code to <strong>{newEmail}</strong>. Please enter it below to complete the email update.
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
            {/* Debug Section - Remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-primary-600" />
                  Debug Information (Development Only)
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Raw Values:</strong>
                    <div className="bg-gray-100 p-2 rounded mt-1 text-xs">
                      <div>user?.attributes?.email: "{user?.attributes?.email}"</div>
                      <div>user?.username: "{user?.username}"</div>
                      <div>getUserEmail(): "{getUserEmail()}"</div>
                      <div>getUserDisplayName(): "{getUserDisplayName()}"</div>
                    </div>
                  </div>
                  <div>
                    <strong>User Object:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-auto">
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>User Attributes:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-auto">
                      {JSON.stringify(user?.attributes, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>Available Attributes:</strong>
                    <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-auto">
                      {JSON.stringify(Object.keys(user?.attributes || {}), null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 