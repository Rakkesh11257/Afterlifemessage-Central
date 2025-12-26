# Video Streaming Cost Analysis

## Current Implementation for Video

Videos are typically **much larger** than audio files:
- **Audio**: Usually 1-5 MB
- **Video**: Often 10-100 MB or more

### Current Behavior (5MB Threshold):

For videos > 5MB (which is most videos):
1. Lambda decrypts the video file
2. Lambda uploads decrypted video to temp S3 location
3. User streams directly from S3 (presigned URL)
4. Temp file expires after 10 minutes

### Cost Breakdown for Video Streaming:

**Example: 50MB video file streamed 100 times**

1. **Lambda Execution** (decrypt + upload):
   - Decryption: ~0.5-1 second execution
   - Upload to S3: ~0.5-1 second execution
   - Cost: ~$0.001-0.002 per execution
   - **100 executions: ~$0.10-0.20**

2. **S3 PUT Requests** (upload temp decrypted file):
   - $0.005 per 1,000 requests
   - **100 uploads: ~$0.0005**

3. **S3 Data Transfer OUT** (user downloads):
   - $0.09 per GB (first 10 TB/month)
   - 50MB × 100 = 5GB
   - **Cost: ~$0.45**

4. **S3 Storage** (temp files, very short-lived):
   - ~$0.023 per GB/month
   - Files exist ~10 minutes max
   - **Cost: Negligible (< $0.001)**

**Total Cost: ~$0.55-0.65 per 100 video streams**

### Cost per Video Stream:
- **50MB video**: ~$0.0055-0.0065 per stream
- **100MB video**: ~$0.011-0.012 per stream

## Cost Optimization for Video

### Option 1: Always Use Presigned URLs for Video (Recommended)

**Current**: Videos > 5MB use presigned URLs
**Optimization**: ALL videos use presigned URLs (even < 5MB)

**Benefits**:
- Avoids API Gateway 6MB limit issues
- Consistent behavior for all videos
- Better performance (direct S3 streaming)
- No API Gateway data transfer costs

**Implementation**: Lower threshold to 0 for video type specifically

### Option 2: CloudFront CDN (For High Traffic)

If you expect many video views, consider:
- CloudFront CDN in front of S3
- Reduces S3 data transfer costs
- Better global performance
- Adds complexity but saves money at scale

### Option 3: Video Compression

- Compress videos before upload
- Smaller files = lower costs
- Can reduce file sizes by 50-80%

## Recommendation

**For Most Cases**:
- Current implementation is fine (videos > 5MB already use presigned URLs)
- Cost is reasonable: ~$0.005-0.01 per video stream
- Consider Option 1 if you have videos < 5MB

**For High Traffic** (> 10,000 views/month):
- Consider CloudFront CDN
- Monitor costs and optimize as needed

**For Very Large Videos** (> 100MB):
- Consider video compression during upload
- Or implement progressive streaming/transcoding

