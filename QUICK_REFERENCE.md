# Quick Reference - License System

## 🎯 For Users

### View License Status
1. Go to **Settings** (⚙️)
2. Scroll to **Subscription License** section
3. See: Company ID, Plan, Expiry Date, Days Left

### Renew License
1. Click **"📋 Manage License"** button
2. See your current license details
3. Click **"Renew for 1 Month"**
4. License extends by 30 days

**Important:** Only the employee who created the license can renew it. Even the owner/admin cannot renew it. If you need to renew, ask the creator to do so.

### Unlock with Temporary Key
- If the system is locked due to expiry, enter the temporary unlock key on the login page.
- The developer can generate this key from the license modal when they are logged in as admin or creator.

### Login with Expired License
- You'll see: "Your system has been locked due to expired subscription. Contact provider."
- Only the creator can renew the license to restore access

---

## 👨‍💻 For Developers

### Quick API Test

**Validate License:**
```bash
curl -X POST http://localhost:3001/api/license/validate \
  -H "Content-Type: application/json" \
  -d '{"company_id":"COMP-A1B2C3D4E5F6G7H8"}'
```

**Create License:**
```bash
curl -X POST http://localhost:3001/api/license/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "email": "test@example.com",
    "phone": "+255692854445",
    "plan": "basic"
  }'
```

**Renew License:**
```bash
curl -X POST http://localhost:3001/api/license/COMP-ID/renew \
  -H "Content-Type: application/json" \
  -H "x-company-id: COMP-ID" \
  -d '{"months": 1}'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| License shows expired | Check system date/time |
| Can't renew | Max 1 renewal per month |
| Backend not connecting | Check `DB_TYPE`, credentials in .env |
| Port 3001 in use | Change PORT in .env or kill process |
| Database error | Run `npm run migrate` |

### Key Files

| File | Purpose |
|------|---------|
| `app.js` | Frontend license logic |
| `backend/server.js` | Backend API server |
| `backend/models/License.js` | Database operations |
| `backend/middleware/licenseMiddleware.js` | Route protection |

### Environment Variables

```env
# Database
DB_TYPE=mysql              # mysql or postgres
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=mfumo_pos_license

# Server
PORT=3001
NODE_ENV=development

# License
LICENSE_TRIAL_DAYS=30
MAX_EXTENSIONS_PER_MONTH=1
```

---

## 📊 License Plans

| Plan | Users | Products | Price/Month |
|------|-------|----------|------------|
| **Basic** | 5 | 100 | $29 |
| **Pro** | 20 | 1,000 | $99 |
| **Enterprise** | ∞ | ∞ | Custom |

---

## 🔑 Key Functions (Frontend)

```javascript
// Check status
isLicenseActive()           // true/false
isLicenseExpired()          // true/false
getDaysRemaining()          // number
getLicenseExpiryDate()      // Date object

// Manage
renewLicense(months)        // extend license
upgradePlan(plan)           // basic/pro/enterprise
validateLicenseForLogin()   // {valid: bool, message: string}

// UI
displayLicenseStatus()      // update badge
updateLicenseModalContent() // refresh modal
```

---

## 🚀 Deployment Checklist

### Frontend
- [ ] Verify index.html opens in browser
- [ ] Check license status in Settings
- [ ] Test login with active license
- [ ] Test renewal process

### Backend (Optional)
- [ ] `npm install` complete
- [ ] `.env` file configured
- [ ] Database created
- [ ] `npm run migrate` successful
- [ ] `npm run dev` starts without errors
- [ ] GET http://localhost:3001/health returns OK

### Production
- [ ] Use HTTPS/SSL
- [ ] Update JWT_SECRET
- [ ] Configure CORS_ORIGIN
- [ ] Set NODE_ENV=production
- [ ] Enable database backups
- [ ] Monitor error logs

---

## 📞 Support

- **Frontend Issues:** Check `INTEGRATION_GUIDE.md`
- **Backend Issues:** See `backend/README.md`
- **API Documentation:** `backend/README.md` - API Endpoints
- **Database Schema:** `backend/README.md` - Database Schema

---

**Last Updated:** May 26, 2026
