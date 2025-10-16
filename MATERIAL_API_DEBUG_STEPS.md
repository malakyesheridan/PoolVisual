# Material API 500 Error - Debug Steps

## 🚨 **ISSUE**
The `/api/v2/materials` endpoint is returning a 500 error when the canvas editor tries to load materials.

## 🔧 **DEBUGGING CHANGES MADE**

### 1. **Enhanced Error Logging**
- Added detailed console logging to the `/api/v2/materials` endpoint
- Added error stack traces for better debugging
- Added sample material logging when materials are found

### 2. **Fixed API Call**
- Changed from `storage.getMaterials('default')` to `storage.getMaterials()` 
- This gets ALL materials regardless of orgId (no filtering)

### 3. **Added Debug Endpoints**
- `/api/v2/_probe` - Basic health check
- `/api/v2/_test-db` - Test database connection
- `/api/v2/_check-materials` - Check materials table and data

## 🔍 **DEBUGGING STEPS**

### **Step 1: Check Basic Health**
Visit: `http://localhost:3000/api/v2/_probe`
Expected: `{"ok": true, "ts": ..., "env": "development"}`

### **Step 2: Test Database Connection**
Visit: `http://localhost:3000/api/v2/_test-db`
Expected: `{"ok": true, "count": X, "message": "Database connection working. Found X materials."}`

### **Step 3: Check Materials Table**
Visit: `http://localhost:3000/api/v2/_check-materials`
Expected: `{"ok": true, "count": X, "materials": [...], "message": "Found X total materials in database."}`

### **Step 4: Check Server Logs**
Look at the server console for:
- `[v2/materials] Starting materials fetch...`
- `[v2/materials] Successfully fetched X materials`
- Any error messages or stack traces

## 🎯 **POSSIBLE CAUSES**

### **1. No Materials in Database**
- **Symptom**: API returns empty array `{ items: [] }`
- **Solution**: Add materials via the Materials page

### **2. Database Connection Issue**
- **Symptom**: 500 error with database connection error
- **Solution**: Check `DATABASE_URL` environment variable

### **3. Materials Table Missing**
- **Symptom**: Table doesn't exist error
- **Solution**: Run database migrations

### **4. Schema Mismatch**
- **Symptom**: Column doesn't exist error
- **Solution**: Check database schema matches code

## 🚀 **NEXT STEPS**

1. **Test the debug endpoints** to identify the specific issue
2. **Check server logs** for detailed error information
3. **Verify database has materials** - if empty, add some via Materials page
4. **Check environment variables** - ensure `DATABASE_URL` is set

## 📝 **EXPECTED BEHAVIOR AFTER FIX**

- `/api/v2/materials` returns `{ items: [...] }` with materials array
- Canvas editor shows materials in sidebar
- No more "Material Library Error" message
- Source shows "API (/api/v2/materials)" in green

## 🔧 **QUICK FIXES TO TRY**

### **If No Materials in Database:**
1. Go to Materials page
2. Add a few materials
3. Refresh canvas editor

### **If Database Connection Issue:**
1. Check `.env` file has `DATABASE_URL`
2. Restart server
3. Test debug endpoints

### **If Still Getting 500 Error:**
1. Check server console logs
2. Test `/api/v2/_test-db` endpoint
3. Look for specific error message in logs

The enhanced logging will now show exactly what's happening when the API is called!
