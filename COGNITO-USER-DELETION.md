# Cognito User Deletion and Account Recreation

## Issue: User Deleted but Still Exists

When you delete a user from Cognito User Pool, sometimes the user record may still exist in an **UNCONFIRMED** state. This can happen if:

1. The user was deleted but a new signup attempt created a new unconfirmed user
2. The deletion didn't fully complete
3. There are multiple user records with the same email

## Solution: Complete User Cleanup

### Step 1: Find All Users with the Email

```bash
aws cognito-idp list-users \
  --user-pool-id ap-south-1_CRybCfDpw \
  --region ap-south-1 \
  --filter "email = \"your-email@example.com\""
```

### Step 2: Delete All User Records

For each user found, delete them:

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id ap-south-1_CRybCfDpw \
  --username <USERNAME> \
  --region ap-south-1
```

**Note**: The `username` might be:
- The email address (if username is email)
- A UUID (sub) if username is auto-generated

### Step 3: Clean Up DynamoDB (Optional)

If you also want to remove the user from DynamoDB:

```bash
aws dynamodb delete-item \
  --table-name afterlifemessage-backend-users-dev \
  --key '{"userId": {"S": "<USER_ID>"}}' \
  --region ap-south-1
```

---

## Issue: Resend Confirmation Code Fails

### Error: "Autoverification is not turned on"

This error occurs when:
1. The Cognito User Pool doesn't have `AutoVerifiedAttributes` configured
2. The `resendSignUp` method requires auto-verification to be enabled

### Solution: Enable Auto-Verification

The User Pool has been configured with email auto-verification:

```bash
aws cognito-idp update-user-pool \
  --user-pool-id ap-south-1_CRybCfDpw \
  --region ap-south-1 \
  --auto-verified-attributes email
```

**Status**: ✅ Auto-verification is now enabled for email

---

## Best Practices

1. **Always delete from Cognito first**, then DynamoDB if needed
2. **Check for multiple user records** with the same email before deleting
3. **Wait a few seconds** after deletion before attempting new signup
4. **Use admin-delete-user** for complete deletion (not just disabling)

---

## Frontend Handling

The frontend now:
- ✅ Shows better error messages when user already exists
- ✅ Handles resend code errors gracefully
- ✅ Provides clear instructions to users

---

## Testing Account Recreation

After cleanup, you should be able to:
1. Sign up with the same email
2. Receive confirmation code
3. Confirm account successfully
4. Have complete profile in DynamoDB

