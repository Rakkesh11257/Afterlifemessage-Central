import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Auth } from 'aws-amplify';

// Helper to create/update user profile in backend
async function createOrUpdateUserProfile(displayName, mobile) {
  const session = await Auth.currentSession();
  const token = session.getIdToken().getJwtToken();
  await axios.put(
    'https://d15u5v4bkj.execute-api.ap-south-1.amazonaws.com/dev/profile',
    { displayName, phoneNumber: mobile },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [emailForConfirmation, setEmailForConfirmation] = useState('');
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  
  const { signIn, signUp, confirmSignUp } = useAuth();
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors }, watch, setError, clearErrors } = useForm();
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  const onSubmit = async (data) => {
    setIsLoading(true);
    clearErrors('confirmPassword');
    try {
      if (isSignUp) {
        if (data.password !== data.confirmPassword) {
          setError('confirmPassword', { type: 'manual', message: 'Passwords do not match' });
          setIsLoading(false);
          return;
        }
        setSignupFullName(data.fullName);
        setSignupMobile(data.mobile);
        // Format phone number to E.164 if not already (basic check)
        let phone = data.mobile;
        if (phone && !phone.startsWith('+')) {
          phone = '+91' + phone.replace(/^0+/, ''); // Default to India country code, adjust as needed
        }
        try {
          const result = await Auth.signUp({
            username: data.email,
            password: data.password,
            attributes: {
              name: data.fullName,
              phone_number: phone
            }
          });
          if (result.user) {
            setEmailForConfirmation(data.email);
            setShowConfirmation(true);
          } else {
            toast.error(result.error || 'Sign up failed');
          }
        } catch (err) {
          if (err.code === 'UsernameExistsException') {
            // Try to resend code if user is unconfirmed
            setEmailForConfirmation(data.email);
            setShowConfirmation(true);
            toast.error('User already exists but is not confirmed. Please confirm your account.');
          } else {
            toast.error(err.message || 'Sign up failed');
          }
        }
      } else {
        const result = await signIn(data.email, data.password);
        if (result.success) {
          navigate('/dashboard');
        } else if (result.notConfirmed) {
          setNotConfirmed(true);
          setPendingEmail(data.email);
          setPendingPassword(data.password);
          setShowConfirmation(true);
          toast.error(result.error || 'Your account is not confirmed. Please check your email for the confirmation code.');
        } else {
          toast.error(result.error || 'Sign in failed');
        }
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = await confirmSignUp(pendingEmail || emailForConfirmation, confirmationCode);
      if (result.success) {
        // After confirmation, update user profile in backend
        try {
          // Use the persisted signup values
          const displayName = signupFullName;
          const mobile = signupMobile;
          if (displayName && mobile) {
            await axios.put(
              'https://d15u5v4bkj.execute-api.ap-south-1.amazonaws.com/dev/profile',
              { displayName, phoneNumber: mobile },
              {
                headers: {
                  'Content-Type': 'application/json',
                }
              }
            );
          }
        } catch (profileError) {
          // Log but do not block confirmation flow
          console.error('Error updating user profile after confirmation:', profileError);
        }
        setConfirmationSuccess(true);
        setShowConfirmation(false);
        setNotConfirmed(false);
        setIsSignUp(false); // Ensure we are in sign-in mode after confirmation
        toast.success('Your account has been confirmed! Please log in.');
        // Force sign out to clear any stale session/token
        try {
          await Auth.signOut();
        } catch (e) {}
        // Redirect to login page
        navigate('/login');
      } else {
        toast.error(result.error || 'Invalid confirmation code.');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      await Auth.resendSignUp(emailForConfirmation || pendingEmail);
      toast.success('Confirmation code resent! Please check your email.');
    } catch (err) {
      toast.error(err.message || 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    if (confirmationSuccess) {
      const timer = setTimeout(() => {
        setIsSignUp(false); // Ensure sign-in mode
        navigate('/login');
      }, 1500); // 1.5 seconds delay
      return () => clearTimeout(timer);
    }
  }, [confirmationSuccess, navigate]);

  if (showConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Confirm Your Account</h2>
            <p className="mt-2 text-gray-600">
              We've sent a confirmation code to {emailForConfirmation || pendingEmail}
            </p>
          </div>
          
          <div className="card">
            <div className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Confirmation Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  className="input-field mt-1"
                  placeholder="Enter 6-digit code"
                />
              </div>
              
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Confirming...' : 'Confirm Account'}
              </button>
              <button
                onClick={handleResendCode}
                disabled={resendLoading}
                className="btn-secondary w-full"
              >
                {resendLoading ? 'Resending...' : 'Resend Confirmation Code'}
              </button>
              
              <button
                onClick={() => setShowConfirmation(false)}
                className="btn-secondary w-full"
              >
                <ArrowLeft className="h-4 w-4 inline mr-2" />
                Back to Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h2>
          <p className="mt-2 text-gray-600">
            {isSignUp 
              ? 'Start creating your digital legacy today' 
              : 'Sign in to access your messages'
            }
          </p>
        </div>
        
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {isSignUp && (
              <>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="fullName"
                      type="text"
                      {...register('fullName', { 
                        required: isSignUp ? 'Full name is required' : false,
                        minLength: {
                          value: 2,
                          message: 'Name must be at least 2 characters'
                        }
                      })}
                      className="input-field pl-10"
                      placeholder="Enter your full name"
                    />
                    <User className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
                    Mobile Number
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="mobile"
                      type="text"
                      {...register('mobile', { 
                        required: isSignUp ? 'Mobile number is required' : false,
                        pattern: {
                          value: /^[0-9]{10,15}$/,
                          message: 'Enter a valid mobile number'
                        }
                      })}
                      className="input-field pl-10"
                      placeholder="Enter your mobile number"
                    />
                    <User className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  </div>
                  {errors.mobile && (
                    <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>
                  )}
                </div>
              </>
            )}
            {/* Email and password fields always visible */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1 relative">
                <input
                  id="email"
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field pl-10"
                  placeholder="Enter your email"
                />
                <Mail className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { 
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  className="input-field pl-10"
                  placeholder="Enter your password"
                />
                <Lock className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            {isSignUp && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    {...register('confirmPassword', { 
                      required: isSignUp ? 'Please confirm your password' : false,
                      validate: value => value === password || 'Passwords do not match'
                    })}
                    className="input-field pl-10"
                    placeholder="Confirm your password"
                  />
                  <Lock className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary-600 hover:text-primary-500 text-sm"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login; 