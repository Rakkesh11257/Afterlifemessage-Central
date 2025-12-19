# Email Verification Fixes - Summary

## Issues Fixed

### 1. Email Change Flow Issues

**Problem**: 
- When email was changed but verification cancelled, Cognito showed email as "confirmed" even though it wasn't verified
- User couldn't login with old email (correct)
- User could login with new email but was asked to verify (correct)
- No verification code was sent initially when email changed
- After resending code, it didn't verify because email was already "confirmed" in Cognito

**Root Cause**: 
- Cognito's `updateUserAttributes` doesn't always send verification code automatically
- When auto-verification is enabled, Cognito may set `email_verified` to true even for changed emails
- Need to explicitly request verification code using `verifyUserAttribute`

**Solution**:
1. After `updateUserAttributes`, explicitly call `Auth.verifyUserAttribute(currentUser, 'email')` to ensure code is sent
2. Added resend verification code button in Profile page
3. Updated cancel handler to sign out user if they cancel verification
4. Added rate limit information (15 minutes, 3 codes max)

### 2. Login After Email Change

**Problem**: User gets "incorrect username and password" when trying to login with old email after changing email.

**Solution**: This is correct behavior - the username in Cognito is now the new email. User must login with new email and verify it.

**Implementation**:
- Updated `signIn` function to detect email verification required
- Shows appropriate error message directing user to verify email
- Routes to confirmation page with new email pre-filled

### 3. Verification Code Not Received

**Problem**: After changing email, verification code wasn't always sent.

**Solution**: 
- Explicitly call `Auth.verifyUserAttribute()` after `updateUserAttributes()`
- This ensures code is always sent to new email address

### 4. Verification Fails When Email Shows as "Confirmed"

**Problem**: Cognito shows email_verified as true even after email change, causing verification to fail.

**Solution**:
- `verifyUserAttributeSubmit` works for attribute verification even if `email_verified` is true
- Added comment explaining this behavior
- The verification process is separate from account confirmation status

## Rate Limits

**AWS Cognito Rate Limit for Verification Codes**:
- Maximum 3 verification codes per 15 minutes per user
- Error code: `LimitExceededException`
- User must wait 15 minutes before requesting another code

## Current Flow

1. **User changes email**:
   - Confirmation dialog warns about verification requirement
   - Email updated in Cognito via `updateUserAttributes`
   - Verification code explicitly requested via `verifyUserAttribute`
   - Warning box shown with OTP input

2. **User verifies immediately**:
   - Enters OTP code
   - `verifyUserAttributeSubmit` verifies the email
   - DynamoDB profile updated
   - User remains logged in

3. **User cancels verification**:
   - Warning dialog shown
   - User signed out automatically
   - Must verify email before next login

4. **User logs in with new email** (without verifying):
   - Login detects `email_verified === false`
   - Shows error message with new email
   - Routes to confirmation page
   - User can resend code and verify

5. **User needs to resend code**:
   - Click "Resend verification code" button
   - Calls `Auth.verifyUserAttribute()` again
   - Rate limit: 3 codes per 15 minutes

## Testing Checklist

- [x] Email change sends verification code immediately
- [x] Cancel verification signs user out
- [x] Login with old email fails (correct behavior)
- [x] Login with new unverified email shows verification prompt
- [x] Resend verification code works
- [x] Rate limit message shown after 3 attempts
- [x] Verification works even if Cognito shows email as "confirmed"
- [x] DynamoDB email updated only after verification

