# Square Image Limitation

## Issue
The kie.ai seedream model does not support square (1:1 aspect ratio) images. Square images will cause the API to return:
```
"code": 500,
"msg": "image_size is not within the range of allowed options"
```

## Solution Implemented
We've added validation on both client and server side to prevent square images from being sent to the API.

### Client-Side Validation
- Location: `client/src/components/enhancement/JobsDrawer.tsx`
- Checks if `imgW === imgH` (within 1px tolerance)
- Shows user-friendly error toast: "Square images not supported - AI enhancement requires landscape or portrait images"

### Server-Side Validation
- Location: `server/routes/aiEnhancement.ts`
- Validates dimensions before creating enhancement job
- Returns 400 error with clear message if image is square

## n8n Workflow Note
The n8n workflow should not receive square images due to validation, but if it does:
- The current code defaults square images to `"portrait_4_3"` which may still fail
- Consider adding explicit handling for square images in the "Configure AI Model" node

## User Experience
Users with square images will see a clear error message explaining that they need to use a different aspect ratio. This is acceptable since:
- Square images are very rare in pool/backyard photography
- Most photos are landscape (4:3 or 16:9) or portrait (3:4 or 9:16)
- Users can easily use a different photo or crop their image

