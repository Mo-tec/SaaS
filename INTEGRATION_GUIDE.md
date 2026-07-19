# MFUMO POS - Subscription License System Implementation Guide

## Overview

This document explains how the subscription license system works and how to use it in your MFUMO POS system.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   MFUMO POS Frontend                         │
│  (React/Vanilla JS - Browser-based License Validation)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Optional: Backend Validation
                       │ (for production & multi-device setup)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│           MFUMO POS Backend (Node.js + Express)             │
│         Secure License Management & Validation              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │
┌──────────────────────▼──────────────────────────────────────┐
│          Database (MySQL or PostgreSQL)                      │
│   - Companies    - Licenses    - Audit Logs    - Renewals   │
└─────────────────────────────────────────────────────────────┘
```

## Frontend License System (Browser-based)

The frontend already has a complete license system built-in using localStorage:

### Key Functions

**Check if license is active:**
```javascript
isLicenseActive()  // Returns: true/false
```

**Check if license is expired:**
```javascript
isLicenseExpired()  // Returns: true/false
```

**Get days remaining:**
```javascript
getDaysRemaining()  // Returns: number of days
```

**Get expiry date:**
```javascript
getLicenseExpiryDate()  // Returns: Date object
```

**Renew license:**
```javascript
renewLicense(months)  // months parameter (default: 1)
```

**Upgrade plan:**
```javascript
upgradePlan(newPlan)  // 'basic', 'pro', or 'enterprise'
```

**Validate on login:**
The system automatically checks if the license is valid when an employee tries to login.

### License Data Structure (localStorage)

```javascript
licenseData = {
  company_id: "COMP-A1B2C3D4E5F6G7H8",
  plan: "basic",              // basic, pro, enterprise
  status: "ACTIVE",           // ACTIVE, EXPIRED
  expiry_date: "2024-06-25",
  created_date: "2024-05-26",
  last_renewal: "2024-05-26"
}
```

### UI Components

1. **License Status Badge** (Sidebar Footer)
   - Shows current license status
   - Displays days remaining
   - Color-coded (green=active, red=expired)

2. **License Settings Panel** (Settings → Subscription License)
   - View company ID
   - View current plan
   - View expiry date
   - Open license management modal

3. **License Renewal Modal**
   - View detailed license info
   - Renew for 1 month
   - Check renewal status

### Login Protection

When a user tries to login:
1. Password is validated
2. **License is validated** (NEW)
3. If expired → login denied with message:
   > "Your system has been locked due to expired subscription. Contact provider."

## Backend License System (Optional but Recommended for Production)

For production deployments, use the Node.js backend for:
- Centralized license management
- Multi-device support
- Better security
- Audit trails
- Payment integration

### Setup Backend

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Configure database:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Run migrations:**
```bash
npm run migrate
```

4. **Start server:**
```bash
npm run dev          # Development
npm start            # Production
```

### Connect Frontend to Backend

Add this code to your app.js to sync with backend:

```javascript
// Backend API Configuration
const BACKEND_URL = 'http://localhost:3001';
const COMPANY_ID = licenseData.company_id;

/**
 * Sync license data with backend
 */
async function syncLicenseWithBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: COMPANY_ID })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('License validation failed:', result.message);
      return false;
    }
    
    // Update local license with backend data
    licenseData.status = result.data.status;
    licenseData.expiry_date = result.data.expiry_date;
    saveLicenseData();
    
    return true;
  } catch (error) {
    console.error('Backend sync error:', error);
    // Fallback to local validation
    return isLicenseActive();
  }
}

/**
 * Renew license via backend
 * Note: Only the creator can renew the license
 */
async function renewLicenseViaBackend(months = 1, creatorId = null) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/license/${COMPANY_ID}/renew`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': COMPANY_ID,
          ...(creatorId ? { 'x-creator-id': creatorId } : {})
        },
        body: JSON.stringify({ months, creator_id: creatorId })
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      if (result.reason === 'NOT_CREATOR') {
        console.error('Renewal failed: Only the creator can renew the license');
      } else {
        console.error('Renewal failed:', result.message);
      }
      return false;
    }
    
    // Update local license
    licenseData.expiry_date = result.data.new_expiry;
    licenseData.last_renewal = new Date().toISOString().split('T')[0];
    saveLicenseData();
    
    return true;
  } catch (error) {
    console.error('Renewal error:', error);
    return false;
  }
}
```

## API Request Examples

### From Frontend to Backend

**Frontend to Backend Validation:**
```javascript
fetch('http://localhost:3001/api/license/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_id: 'COMP-A1B2C3D4E5F6G7H8'
  })
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    console.log('License is valid until:', data.data.expiry_date);
  } else {
    console.error('License expired or invalid');
  }
});
```

**Create New License:**
```javascript
fetch('http://localhost:3001/api/license/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Business',
    email: 'admin@example.com',
    phone: '+255692854445',
    plan: 'basic'
  })
})
.then(r => r.json())
.then(data => {
  if (data.success) {
    const companyId = data.data.company_id;
    console.log('License created:', companyId);
  }
});
```

## Plan Features

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|-----------|
| Max Users | 5 | 20 | Unlimited |
| Products | 100 | 1,000 | Unlimited |
| Sales History | 30 days | 90 days | Unlimited |
| Reports | Basic | Advanced | Advanced + API |
| Support | Email | Priority | 24/7 Phone |
| Cost/Month | $29 | $99 | Custom |

## Troubleshooting

### License Shows as Expired but Should be Active

1. Check system date/time on the device
2. If using backend, verify database date
3. Clear localStorage and reload

### Can't Renew License

1. **Creator-only restriction**: Only the employee who created the license can renew it. If you're not the creator, contact the creator to renew.
2. Frontend: Check if renewal limit is hit (1 per month)
3. Backend: Verify database is accessible
4. Check browser console for errors
5. If using backend, verify creator_id is passed in the request

### License Modal Won't Open

1. Verify `licenseRenewalModal` element exists in HTML
2. Check browser console for JavaScript errors
3. Reload the page

### Backend Connection Issues

1. Verify backend is running: `curl http://localhost:3001/health`
2. Check CORS is enabled in backend
3. Check firewall allows connection

## Security Notes

⚠️ **Frontend-only deployment:**
- Good for: Single-device deployments, development
- Risk: User can manipulate localStorage
- Mitigation: For single user only

✅ **With backend validation:**
- Good for: Multi-device, production, team-based
- Secure: Server-side validation
- Recommended: For all production systems

## Monitoring License Usage

### Backend Admin Dashboard (Future)

Monitor in your backend:
```sql
-- Check license expirations
SELECT company_id, expiry_date, DATEDIFF(expiry_date, NOW()) as days_left
FROM licenses
WHERE status = 'ACTIVE'
ORDER BY expiry_date ASC;

-- View renewal history
SELECT company_id, renewal_date, months, payment_status
FROM license_renewals
ORDER BY renewal_date DESC;

-- Check validation attempts
SELECT company_id, COUNT(*) as validations
FROM license_validations
WHERE validation_timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY company_id;
```

## Integration Checklist

- [x] Frontend license system integrated
- [ ] Backend server deployed
- [ ] Database configured (MySQL/PostgreSQL)
- [ ] Environment variables set
- [ ] Frontend connected to backend API
- [ ] License renewal process tested
- [ ] Login with expired license tested
- [ ] Renewal limits verified
- [ ] Audit logs checked
- [ ] Production deployment completed

## Support & Documentation

- **Backend README:** `backend/README.md`
- **API Documentation:** `backend/README.md` - API Endpoints section
- **Database Schema:** `backend/README.md` - Database Schema section

## Next Steps

1. Deploy frontend (already done - open index.html)
2. Deploy backend (optional but recommended)
3. Set up database (MySQL or PostgreSQL)
4. Create initial licenses for companies
5. Train users on license renewal process
6. Monitor usage and renewals

---

**Last Updated:** May 26, 2026
**Version:** 1.0.0
