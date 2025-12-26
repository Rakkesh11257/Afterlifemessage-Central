# Media Streaming Cost Analysis

## Current Implementation Costs

### For Small Files (< 5MB):
1. **Lambda Execution**: Decrypts file in Lambda (~$0.0000166667 per GB-second)
2. **API Gateway Data Transfer**: ~$0.09 per GB transferred (data out)
3. **S3 GET Request**: $0.0004 per 1,000 requests
4. **S3 Data Transfer IN (to Lambda)**: Free (within same region)

**Example**: 1MB audio file streamed 100 times
- Lambda: ~$0.001 (assuming 1 second execution)
- API Gateway: ~$0.009 (1MB × 100 × $0.09/GB)
- S3 GET: ~$0.00004
- **Total: ~$0.01 for 100 streams**

### For Large Files (> 5MB):
1. **Lambda Execution**: Decrypts + uploads to temp S3 (~$0.001-0.002 per execution)
2. **S3 PUT Request**: $0.005 per 1,000 requests (temp file upload)
3. **S3 Data Transfer OUT**: ~$0.09 per GB (from S3 to user)
4. **S3 Storage**: ~$0.023 per GB/month (temp files, cleaned up after 10 min)

**Example**: 10MB audio file streamed 100 times
- Lambda: ~$0.10-0.20 (decrypt + upload)
- S3 PUT: ~$0.0005
- S3 Transfer OUT: ~$0.09 (10MB × 100 × $0.09/GB)
- **Total: ~$0.20-0.30 for 100 streams**

## Cost Optimization Recommendation

### Option 1: Always Use Presigned URLs (Recommended for Cost Savings)

**Change**: Always redirect to S3 presigned URLs, even for small files.

**Benefits**:
- **No API Gateway data transfer cost** (S3 handles transfer directly)
- **Reduced Lambda execution time** (no need to stream through Lambda)
- **Better performance** (direct S3 streaming is faster)
- **Cost Savings**: ~90% reduction in data transfer costs

**Trade-offs**:
- Need to decrypt and upload to temp S3 location (even for small files)
- Temp storage cost (minimal, files expire quickly)
- Slightly more complex code

**Estimated Cost** (1MB file, 100 streams):
- Lambda: ~$0.001 (decrypt + upload)
- S3 PUT: ~$0.0005
- S3 Transfer OUT: ~$0.009
- **Total: ~$0.01** (same as current, but scales better for larger files)

### Option 2: Increase Threshold (Quick Fix)

**Change**: Increase `LARGE_FILE_THRESHOLD` from 5MB to 1MB or 2MB.

**Benefits**:
- More files use presigned URLs (cost-efficient path)
- Minimal code changes

### Option 3: Keep Current Implementation

**If**: Your audio files are typically small (< 5MB) and not accessed frequently
**Then**: Current costs are minimal and acceptable

## Recommendation

For a production app with potentially many users streaming media:
- **Use Option 1** (always presigned URLs) for best cost efficiency
- This also provides better scalability and performance

For a small-scale app with low traffic:
- Current implementation is fine
- Consider Option 2 if you want a quick optimization

