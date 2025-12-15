# AfterLifeMessage.in - Cognito User Pool Creation Script (Fixed)
# Run this script after configuring AWS credentials

Write-Host "Creating Cognito User Pool for AfterLifeMessage.in..." -ForegroundColor Green

# Step 1: Create User Pool
Write-Host "Step 1: Creating User Pool..." -ForegroundColor Yellow

$userPoolResponse = aws cognito-idp create-user-pool --pool-name "AfterLifeMessage-Users" --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' --auto-verified-attributes email --username-attributes email --mfa-configuration OFF --account-recovery-setting '{"RecoveryMechanisms":[{"Name":"verified_email","Priority":1}]}' --verification-message-template '{"DefaultEmailOption":"CONFIRM_WITH_CODE"}' --email-configuration '{"EmailSendingAccount":"COGNITO_DEFAULT"}' --admin-create-user-config '{"AllowAdminCreateUserOnly":false}' --schema '[{"Name":"email","AttributeDataType":"String","Required":true,"Mutable":true}]'

if ($LASTEXITCODE -eq 0) {
    $userPoolId = ($userPoolResponse | ConvertFrom-Json).UserPool.Id
    Write-Host "✅ User Pool created successfully!" -ForegroundColor Green
    Write-Host "User Pool ID: $userPoolId" -ForegroundColor Cyan
    
    # Step 2: Create App Client
    Write-Host "Step 2: Creating App Client..." -ForegroundColor Yellow
    $appClientResponse = aws cognito-idp create-user-pool-client --user-pool-id $userPoolId --client-name "AfterLifeMessage-WebClient" --no-generate-secret --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH --prevent-user-existence-errors ENABLED --read-attributes email --write-attributes email
    
    if ($LASTEXITCODE -eq 0) {
        $appClientId = ($appClientResponse | ConvertFrom-Json).UserPoolClient.ClientId
        Write-Host "✅ App Client created successfully!" -ForegroundColor Green
        Write-Host "App Client ID: $appClientId" -ForegroundColor Cyan
        
        # Step 3: Create Identity Pool (Optional)
        Write-Host "Step 3: Creating Identity Pool..." -ForegroundColor Yellow
        $identityPoolResponse = aws cognito-identity create-identity-pool --identity-pool-name "AfterLifeMessage-IdentityPool" --allow-unauthenticated-identities false --cognito-identity-providers "ProviderName=cognito-idp.us-east-1.amazonaws.com/$userPoolId,ClientId=$appClientId,ServerSideTokenCheck=false"
        
        if ($LASTEXITCODE -eq 0) {
            $identityPoolId = ($identityPoolResponse | ConvertFrom-Json).IdentityPoolId
            Write-Host "✅ Identity Pool created successfully!" -ForegroundColor Green
            Write-Host "Identity Pool ID: $identityPoolId" -ForegroundColor Cyan
        }
        
        # Display Summary
        Write-Host "`n🎉 Cognito Setup Complete!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor White
        Write-Host "User Pool ID: $userPoolId" -ForegroundColor Cyan
        Write-Host "App Client ID: $appClientId" -ForegroundColor Cyan
        Write-Host "Identity Pool ID: $identityPoolId" -ForegroundColor Cyan
        Write-Host "Region: us-east-1" -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor White
        
        # Save to file
        $config = @{
            UserPoolId = $userPoolId
            AppClientId = $appClientId
            IdentityPoolId = $identityPoolId
            Region = "us-east-1"
        }
        $config | ConvertTo-Json | Out-File -FilePath "cognito-config.json" -Encoding UTF8
        Write-Host "`n📄 Configuration saved to: cognito-config.json" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Failed to create App Client" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Failed to create User Pool" -ForegroundColor Red
}

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Configure AWS credentials if not done: aws configure" -ForegroundColor White
Write-Host "2. Update src/aws-exports.js with the IDs above" -ForegroundColor White
Write-Host "3. Test the authentication flow" -ForegroundColor White 