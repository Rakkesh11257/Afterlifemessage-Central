# User Profile Data Flow

This document explains how user profile data (email, displayName, phoneNumber) flows between Cognito User Pool and DynamoDB.

## 🔄 Data Flow Overview

### 1. **New User Creation (Sign Up + Email Confirmation)**

When a new user signs up and confirms their email:

1. **Frontend** (`src/pages/Login.js`):
   - User fills signup form (email, password, fullName, mobile)
   - Frontend calls `Auth.signUp()` with attributes:
     - `email`: User's email
     - `name`: User's full name (displayName)
     - `phone_number`: User's phone number (formatted with country code, e.g., `+91...`)

2. **Cognito User Pool**:
   - Creates user account
   - Stores attributes: `email`, `name`, `phone_number`, `sub` (userId)

3. **Post-Confirmation Lambda Trigger** (`backend/functions/migrateUser.js`):
   - **Automatically triggered** when user confirms email
   - Fetches user attributes from Cognito event
   - Creates record in DynamoDB (`afterlifemessage-backend-users-dev`) with:
     - `userId`: Cognito `sub`
     - `email`: From Cognito
     - `displayName`: From Cognito `name` attribute
     - `phoneNumber`: From Cognito `phone_number` attribute
     - `createdAt`: Current timestamp
     - `updatedAt`: Current timestamp
     - `lastActive`: Current timestamp

**Result**: Complete user profile is stored in both Cognito and DynamoDB.

---

### 2. **User Profile Updates (Editing Profile)**

When user edits their profile from the Profile page:

1. **Frontend** (`src/pages/Profile.js`):
   - User clicks "Edit" and changes displayName or phoneNumber
   - Frontend calls `Auth.updateUserAttributes()` to update Cognito:
     - Updates `name` attribute
     - Updates `phone_number` attribute
   - Frontend calls `messageAPI.updateUserProfile()` to update DynamoDB:
     - Sends `displayName` and `phoneNumber` to backend API

2. **Backend** (`backend/functions/updateUserProfile.js`):
   - Receives update request with `displayName` and/or `phoneNumber`
   - Updates DynamoDB record:
     - Updates `displayName` if provided
     - Updates `phoneNumber` if provided
     - Updates `updatedAt` timestamp
   - Returns success response

**Result**: Both Cognito and DynamoDB are updated synchronously.

---

### 3. **Reading User Profile**

When user views their profile:

1. **Frontend** (`src/pages/Profile.js`):
   - Calls `messageAPI.getUserProfile()` to fetch profile

2. **Backend** (`backend/functions/getUserProfile.js`):
   - Fetches user record from DynamoDB
   - **Fallback mechanism**: If any fields are missing (email, displayName, phoneNumber), it:
     - Fetches from Cognito User Pool using `adminGetUser`
     - Updates DynamoDB with missing fields
     - Returns complete profile
   - Returns user profile data

**Result**: Profile is always complete, with automatic backfill from Cognito if needed.

---

## 📊 Data Storage Locations

### Cognito User Pool
- Stores: `email`, `name` (displayName), `phone_number`, `sub` (userId)
- Used for: Authentication, authorization
- Updated by: Frontend (`Auth.updateUserAttributes`)

### DynamoDB Table (`afterlifemessage-backend-users-dev`)
- Stores: `userId`, `email`, `displayName`, `phoneNumber`, `createdAt`, `updatedAt`, `lastActive`
- Used for: Application data, user profiles, analytics
- Updated by: 
  - Post-Confirmation Lambda (on signup)
  - `updateUserProfile` API (on profile edit)
  - `getUserProfile` API (fallback/backfill)

---

## 🔧 Configuration

### Post-Confirmation Lambda Trigger

The `postConfirmation` Lambda function is configured as a Cognito trigger:

- **Lambda Function**: `afterlifemessage-backend-dev-postConfirmation`
- **Trigger Type**: Post Confirmation (runs after email confirmation)
- **Configured**: ✅ Yes (via AWS CLI/Console)

To verify:
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id ap-south-1_CRybCfDpw \
  --region ap-south-1 \
  --query 'UserPool.LambdaConfig.PostConfirmation'
```

---

## ✅ Best Practices

1. **Always update both Cognito and DynamoDB** when editing profile
2. **Use DynamoDB as source of truth** for application data
3. **Use Cognito as source of truth** for authentication attributes
4. **Fallback mechanism** ensures data consistency even if one update fails

---

## 🐛 Troubleshooting

### Issue: User profile shows "N/A" for phone number

**Cause**: Phone number wasn't captured during signup or DynamoDB record is incomplete.

**Solution**: The `getUserProfile` function automatically fetches missing data from Cognito and updates DynamoDB. Simply refresh the profile page.

### Issue: Profile data out of sync between Cognito and DynamoDB

**Cause**: One update succeeded but the other failed.

**Solution**: 
- Edit profile again to trigger both updates
- Or refresh profile page - fallback mechanism will sync from Cognito

### Issue: New users don't appear in DynamoDB

**Cause**: Post-Confirmation Lambda trigger not configured or failing.

**Solution**: 
1. Check CloudWatch logs for `afterlifemessage-backend-dev-postConfirmation`
2. Verify trigger is configured:
   ```bash
   aws cognito-idp describe-user-pool \
     --user-pool-id ap-south-1_CRybCfDpw \
     --region ap-south-1 \
     --query 'UserPool.LambdaConfig.PostConfirmation'
   ```
3. Check Lambda permissions allow Cognito to invoke it

