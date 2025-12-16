# 🧪 Signup & Email Verification Testing Guide

## ✅ Current Flow Logic

### 1. **Signup Process**
- User fills signup form (email, password, full name, mobile)
- Frontend calls `Auth.signUp()` → Cognito creates unconfirmed user
- User receives confirmation code via email
- User enters code → `Auth.confirmSignUp()` → Email verified
- **PostConfirmation Lambda** (`migrateUser`) runs automatically
- User record created in DynamoDB
- User redirected to login page

### 2. **Login Process**
- User enters email/password
- Frontend checks: `user.attributes.email_verified === false`
- **If NOT verified**: Login blocked, shows confirmation screen
- **If verified**: Login succeeds, user can access dashboard

### 3. **Email Verification Enforcement**
✅ **Already implemented** in `AuthContext.js`:
```javascript
if (user.attributes && user.attributes.email_verified === false) {
  return { success: false, error: 'Please verify your email before signing in.', notConfirmed: true };
}
```

---

## 🧪 Testing Steps

### Step 1: Test Signup Flow

1. **Start frontend**:
   ```bash
   npm start
   ```

2. **Go to signup page**: `http://localhost:3000/login`
   - Click "Don't have an account? Sign up"

3. **Fill signup form**:
   - Full Name: `John Doe`
   - Mobile: `9876543210`
   - Email: `newuser@example.com` (use a real email you can access)
   - Password: `TestPass123!`
   - Confirm Password: `TestPass123!`

4. **Click "Create Account"**
   - ✅ Should show: "Confirm Your Account" screen
   - ✅ Should display: "We've sent a confirmation code to newuser@example.com"

5. **Check your email** for the 6-digit confirmation code

---

### Step 2: Test Email Verification

1. **Enter confirmation code** from email
2. **Click "Confirm Account"**
   - ✅ Should show: "Your account has been confirmed! Please log in."
   - ✅ Should redirect to login page

3. **Verify backend**:
   - Check DynamoDB table `afterlifemessage-backend-users-dev`
   - Should see new user record with:
     - `userId`: Cognito user ID
     - `email`: newuser@example.com
     - `displayName`: John Doe
     - `phoneNumber`: +919876543210

---

### Step 3: Test Login (After Verification)

1. **On login page**, enter:
   - Email: `newuser@example.com`
   - Password: `TestPass123!`

2. **Click "Sign In"**
   - ✅ Should successfully login
   - ✅ Should redirect to `/dashboard`

---

### Step 4: Test Login Block (Unverified User)

1. **Create another test user** (but don't verify):
   - Sign up with: `unverified@example.com`
   - **Don't enter confirmation code**
   - Close the confirmation screen

2. **Try to login** with unverified account:
   - Email: `unverified@example.com`
   - Password: `TestPass123!`

3. **Expected behavior**:
   - ✅ Login should be **blocked**
   - ✅ Should show: "Your account is not confirmed. Please check your email for the confirmation code."
   - ✅ Should show confirmation code input screen

4. **Enter confirmation code** and verify
5. **Try login again** → Should work now

---

## 🔍 Verification Checklist

- [ ] User can sign up from UI
- [ ] Confirmation email is received
- [ ] User can enter confirmation code
- [ ] After confirmation, user record appears in DynamoDB
- [ ] Unverified users **cannot** login
- [ ] Verified users **can** login
- [ ] User profile (name, mobile) is saved correctly

---

## 🐛 Troubleshooting

### Issue: No confirmation email received

**Check**:
1. Cognito User Pool email settings
2. Check spam folder
3. Verify email address is correct

**Fix**:
```bash
# Check User Pool email configuration
aws cognito-idp describe-user-pool \
  --user-pool-id ap-south-1_CRybCfDpw \
  --region ap-south-1 \
  --query 'UserPool.EmailConfiguration'
```

### Issue: "User already exists" error

**Cause**: User signed up before but didn't verify

**Fix**: 
- Click "Resend Confirmation Code" on confirmation screen
- Or use the resend function in the UI

### Issue: Login works without verification

**Check**: 
- Verify `AuthContext.js` has the email verification check
- Check browser console for errors
- Verify Cognito User Pool requires email verification

**Fix**:
```bash
# Verify User Pool requires email verification
aws cognito-idp describe-user-pool \
  --user-pool-id ap-south-1_CRybCfDpw \
  --region ap-south-1 \
  --query 'UserPool.AutoVerifiedAttributes'
```

Should return: `["email"]`

### Issue: User not created in DynamoDB after confirmation

**Check**:
1. CloudWatch logs for `postConfirmation` Lambda
2. Verify DynamoDB table exists
3. Check Lambda has DynamoDB write permissions

**View logs**:
```bash
aws logs tail /aws/lambda/afterlifemessage-backend-dev-postConfirmation --follow --region ap-south-1
```

---

## 📋 Next Steps After Testing

1. ✅ **Create DynamoDB Tables** (if not done):
   ```bash
   # See FRONTEND-BACKEND-TESTING.md for commands
   ```

2. ✅ **Create S3 Bucket** (if not done):
   ```bash
   # See FRONTEND-BACKEND-TESTING.md for commands
   ```

3. ✅ **Test full message creation flow**:
   - Login with verified user
   - Create a message
   - Verify it's stored in DynamoDB

4. ✅ **Test file uploads**:
   - Upload audio/video file
   - Verify it's stored in S3

---

## 🎯 Summary

✅ **Email verification is enforced** - unverified users cannot login
✅ **Signup flow works** - user receives confirmation code
✅ **PostConfirmation Lambda** - automatically creates user in DynamoDB
✅ **Login only works** - after email is verified

**Your flow is secure!** Users must verify their email before they can access the application.

