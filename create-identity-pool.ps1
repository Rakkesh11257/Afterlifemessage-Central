# Create Identity Pool for AfterLifeMessage
# This script creates an Identity Pool that allows authenticated users to access AWS services

Write-Host "Creating Identity Pool for AfterLifeMessage..." -ForegroundColor Green

# Cognito User Pool and App Client details
$userPoolId = "ap-south-1_STYxHAQAP"
$clientId = "141mio422kgemdtpunrvfib9io"
$region = "ap-south-1"

# Create Identity Pool
$identityPoolResponse = aws cognito-identity create-identity-pool `
  --identity-pool-name "AfterLifeMessageIdentityPool" `
  --allow-unauthenticated-identities false `
  --cognito-identity-providers ProviderName="cognito-idp.$region.amazonaws.com/$userPoolId",ClientId="$clientId",ServerSideTokenCheck=false `
  --region $region `
  --no-cli-pager

if ($LASTEXITCODE -eq 0) {
    $identityPoolId = ($identityPoolResponse | ConvertFrom-Json).IdentityPoolId
    Write-Host "Identity Pool created successfully!" -ForegroundColor Green
    Write-Host "Identity Pool ID: $identityPoolId" -ForegroundColor Cyan
    
    # Get the Identity Pool details
    $poolDetails = aws cognito-identity describe-identity-pool `
      --identity-pool-id $identityPoolId `
      --region $region `
      --no-cli-pager
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Identity Pool Details:" -ForegroundColor Yellow
        Write-Host ($poolDetails | ConvertFrom-Json | ConvertTo-Json -Depth 10)
    }
    
    # Create IAM roles for the Identity Pool
    Write-Host "Creating IAM roles for Identity Pool..." -ForegroundColor Green
    
    # Create authenticated role
    $authenticatedRoleName = "Cognito_AfterLifeMessageAuth_Role"
    $authenticatedRolePolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Federated = "cognito-identity.amazonaws.com"
                }
                Action = "sts:AssumeRoleWithWebIdentity"
                Condition = @{
                    StringEquals = @{
                        "cognito-identity.amazonaws.com:aud" = $identityPoolId
                    }
                    "ForAnyValue:StringLike" = @{
                        "cognito-identity.amazonaws.com:amr" = "authenticated"
                    }
                }
            }
        )
    }
    
    # Create unauthenticated role
    $unauthenticatedRoleName = "Cognito_AfterLifeMessageUnauth_Role"
    $unauthenticatedRolePolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Federated = "cognito-identity.amazonaws.com"
                }
                Action = "sts:AssumeRoleWithWebIdentity"
                Condition = @{
                    StringEquals = @{
                        "cognito-identity.amazonaws.com:aud" = $identityPoolId
                    }
                    "ForAnyValue:StringLike" = @{
                        "cognito-identity.amazonaws.com:amr" = "unauthenticated"
                    }
                }
            }
        )
    }
    
    # Create authenticated role
    $authenticatedRoleResponse = aws iam create-role `
      --role-name $authenticatedRoleName `
      --assume-role-policy-document ($authenticatedRolePolicy | ConvertTo-Json -Depth 10) `
      --no-cli-pager
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Authenticated role created successfully!" -ForegroundColor Green
        
        # Attach policies for authenticated users
        aws iam attach-role-policy `
          --role-name $authenticatedRoleName `
          --policy-arn "arn:aws:iam::aws:policy/AmazonS3FullAccess" `
          --no-cli-pager
        
        aws iam attach-role-policy `
          --role-name $authenticatedRoleName `
          --policy-arn "arn:aws:iam::aws:policy/AmazonAPIGatewayInvokeFullAccess" `
          --no-cli-pager
    }
    
    # Create unauthenticated role
    $unauthenticatedRoleResponse = aws iam create-role `
      --role-name $unauthenticatedRoleName `
      --assume-role-policy-document ($unauthenticatedRolePolicy | ConvertTo-Json -Depth 10) `
      --no-cli-pager
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Unauthenticated role created successfully!" -ForegroundColor Green
    }
    
    # Update Identity Pool with role ARNs
    $authenticatedRoleArn = "arn:aws:iam::$((aws sts get-caller-identity --query Account --output text --no-cli-pager)):role/$authenticatedRoleName"
    $unauthenticatedRoleArn = "arn:aws:iam::$((aws sts get-caller-identity --query Account --output text --no-cli-pager)):role/$unauthenticatedRoleName"
    
    $updateResponse = aws cognito-identity set-identity-pool-roles `
      --identity-pool-id $identityPoolId `
      --roles authenticated=$authenticatedRoleArn,unauthenticated=$unauthenticatedRoleArn `
      --region $region `
      --no-cli-pager
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Identity Pool roles updated successfully!" -ForegroundColor Green
    }
    
    # Save configuration to file
    $config = @{
        IdentityPoolId = $identityPoolId
        UserPoolId = $userPoolId
        ClientId = $clientId
        Region = $region
        AuthenticatedRoleArn = $authenticatedRoleArn
        UnauthenticatedRoleArn = $unauthenticatedRoleArn
    }
    
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath "identity-pool-config.json" -Encoding UTF8
    Write-Host "Configuration saved to identity-pool-config.json" -ForegroundColor Green
    
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Update src/aws-config.js with the Identity Pool ID" -ForegroundColor White
    Write-Host "2. Deploy the backend with: cd backend && serverless deploy" -ForegroundColor White
    Write-Host "3. Start the React app with: npm start" -ForegroundColor White
    
} else {
    Write-Host "Failed to create Identity Pool" -ForegroundColor Red
    Write-Host $identityPoolResponse -ForegroundColor Red
} 