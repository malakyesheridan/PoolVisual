# Simple Solution: Use Composite Image (Image + Masks Combined)

## ✅ What Changed

The server now generates a **composite image** (image with masks already applied) and includes it in the webhook payload as `compositeImageUrl`.

**You only need to download ONE image now!**

---

## 🎯 Quick Fix (1 Step)

### Update Your HTTP Request Node

1. **Find your "Download Image" HTTP Request node**
2. **Change the URL** from:
   ```
   {{ $json.body.imageUrl }}
   ```
   to:
   ```
   {{ $json.body.compositeImageUrl }}
   ```

**That's it!** Now you're downloading a single image that has masks already applied.

---

## 📦 What's in the Payload Now

The webhook now receives:
```json
{
  "jobId": "...",
  "imageUrl": "https://...",           // Original image (for reference)
  "compositeImageUrl": "https://...", // ✅ USE THIS - Image with masks applied
  "maskImageUrl": "https://...",      // Mask image (for AI inpainting if needed)
  "masks": [...],                     // Mask coordinates (for reference)
  "mode": "add_decoration",
  ...
}
```

---

## 🔄 Workflow Structure

**Before (messy):**
```
Webhook → Download Original Image
        → Download Mask Image
        → Upload both to Dropbox
        → Analyse Image (needs both)
```

**After (clean):**
```
Webhook → Download Composite Image (ONE file!)
        → Upload to Dropbox
        → Analyse Image
```

---

## 💡 Benefits

1. **One file instead of two** - Much simpler!
2. **Masks already applied** - The composite image shows exactly what the user sees
3. **No coordinate processing** - Everything is baked into the image
4. **Works with any analysis tool** - Just needs a single image file

---

## 🛠️ Fallback Behavior

- **If masks exist**: `compositeImageUrl` = image with masks applied
- **If no masks**: `compositeImageUrl` = original image (same as `imageUrl`)
- **If generation fails**: `compositeImageUrl` = original image (safe fallback)

So you can always use `compositeImageUrl` - it will always have a valid image URL.

---

## 📝 Optional: Keep Both URLs

If you want to keep both the original and composite for comparison:

1. **Keep your current node** downloading `{{ $json.body.imageUrl }}` (original)
2. **Add a second node** downloading `{{ $json.body.compositeImageUrl }}` (with masks)
3. Upload both to Dropbox with different names

But for most use cases, just the composite image is enough!

---

## ✅ Testing

1. **Check webhook execution** in n8n
2. **Verify** `compositeImageUrl` is present in the payload
3. **Download** the composite image
4. **Verify** it shows the image with masks already applied (materials/textures visible)

---

## 🎉 Result

You now have a **single, clean image** that contains everything:
- Original photo ✅
- Masks applied ✅
- Materials/textures rendered ✅

No more messy coordinate arrays or separate mask files!

