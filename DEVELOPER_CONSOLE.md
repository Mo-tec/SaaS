# 🖥️ MFUMO POS - Developer Console Guide

## Overview

The Developer Console is a complete system monitoring and management dashboard built into your MFUMO POS system. Only administrators can access it.

---

## 📍 How to Access

1. **Login** as "Boss Admin" with password: `Digital11#`
2. Click **Developer** button in the sidebar (bottom of navigation)
3. You'll see the Developer Console dashboard

---

## 🎯 Features & Tools

### 1. **📊 System Statistics**
- **Total Products**: Number of products in inventory
- **Total Stock Value**: Total inventory value (price × qty)
- **Total Sales**: Number of completed sales
- **Total Revenue**: Sum of all sales amounts
- **Storage Used**: Database size in KB

**Action**: Click **🔄 Refresh** to update all stats in real-time

---

### 2. **📋 License Management**
Monitor and control your subscription:
- Company ID
- Current Plan (Basic/Pro/Enterprise)
- License Status (Active/Expired)
- Expiry Date
- Days Left

**Available Actions**:
- **Renew 1 Month** - Extend license by 30 days
- **Generate Key** - Create temporary unlock key (valid 24hrs)
- **Upgrade** - Upgrade to next plan tier

---

### 3. **👥 Employee Management**
View all registered employees and add new ones:
- Lists all employees with their roles
- Add new employees (name + role)
- Employee tracking

**To Add Employee**:
1. Enter employee name (e.g., "John Doe")
2. Enter role (e.g., "staff" or "admin")
3. Click **Add Employee**

---

### 4. **💾 Database Info**
Information about your system storage:
- **Storage Backend**: Browser localStorage (local data)
- **Data Format**: JSON format
- **Backup Status**: Current backup readiness
- **Last Backup**: Last backup timestamp

**Available Actions**:
- **💾 Backup Now** - Create system backup
- **📥 Export** - Download database as JSON file
- **🗑️ Clear** - ⚠️ WARNING: Deletes all data (irreversible)

---

### 5. **🔌 API Testing Tool**
Test your backend API endpoints directly:
- Enter API URL (e.g., `http://localhost:3001/api/license/validate`)
- Choose HTTP method (GET, POST, PUT, DELETE)
- Write JSON request body
- See response in real-time

**Example Request**:
```json
{
  "company_id": "COMP-1234567890",
  "action": "validate"
}
```

**Common Endpoints**:
- `POST /api/license/validate` - Validate license
- `POST /api/license/create` - Create new license
- `POST /api/license/{id}/renew` - Renew license
- `GET /api/license/{id}` - Get license details

---

### 6. **📝 System Audit Logs**
Complete activity log of all system operations:
- All user actions
- License events
- Database operations
- API calls
- Timestamps for each action

**Log Types**:
- ℹ️ **Info** (blue) - General information
- ✅ **Success** (green) - Successful operations
- ⚠️ **Warning** (orange) - Important notices
- ❌ **Error** (red) - Error events

**Actions**:
- View logs in chronological order (newest first)
- Click **Clear Logs** to reset audit trail

---

## 🛠️ Common Tasks

### Generate Unlock Key for Expired License
1. Go to **License Management** section
2. Click **Generate Key**
3. Key is valid for 24 hours
4. Share key with user to unlock system

### Backup System Data
1. Click **💾 Backup Now** under Database Info
2. System creates snapshot of all data
3. Last backup timestamp updates

### Export All Data
1. Click **📥 Export** under Database Info
2. Browser downloads `mfumo_backup_[timestamp].json`
3. File contains all products, sales, employees, settings

### Test Backend API
1. Ensure backend is running (`npm start` in /backend)
2. Enter endpoint URL in API Testing Tool
3. Choose HTTP method
4. Enter request body (if needed)
5. Click **Send Request**
6. View response below

### Monitor Inventory Health
1. Check **System Statistics** section
2. Review **Total Stock Value**
3. See count of **Total Products**
4. Export data for deeper analysis

---

## 📊 System Metrics Explained

| Metric | Meaning |
|--------|---------|
| Total Products | Count of unique products in inventory |
| Stock Value | Sum of (price × quantity) for all products |
| Total Sales | Number of completed transactions |
| Total Revenue | Sum of all transaction amounts |
| Storage Used | Size of all stored data in kilobytes |
| Days Left | Remaining days until license expiry |

---

## ⚠️ Important Notes

### License Management
- **Only the license creator can renew it** (even admin cannot)
- **Renewal limit**: Maximum 1 renewal per month per license
- **Temporary keys**: Valid for 24 hours only
- **Plan upgrades**: Basic → Pro → Enterprise (one direction only)

### Backup & Export
- **Backup** = Automatic snapshot
- **Export** = Download as JSON file (manual backup)
- **Clear** = ⚠️ **IRREVERSIBLE** - All data deleted
- Backups are stored locally in browser

### API Testing
- Backend must be running on specified URL
- JSON must be valid format
- Response shows server's actual response
- Useful for debugging production issues

---

## 🔐 Security Notes

1. **Developer Console requires admin login**
2. **All actions are logged in audit trail**
3. **Unlock keys expire after 24 hours**
4. **Database can be cleared** (confirmation required)
5. **API testing shows real backend responses**

---

## 🚀 Quick Actions

| Need to... | Go to... | Action |
|-----------|----------|--------|
| Check system health | System Statistics | Click Refresh |
| Extend license | License Management | Click Renew |
| Create unlock key | License Management | Click Generate Key |
| Add new staff | Employee Management | Enter name & role |
| Backup data | Database Info | Click Backup Now |
| Download backup | Database Info | Click Export |
| Test API | API Testing Tool | Enter URL & body |
| View activities | System Audit Logs | Review list |

---

## 📞 Troubleshooting

**Q: Can't see Developer button?**
- A: You must be logged in as admin (Boss Admin)

**Q: Audit logs are empty?**
- A: Logs track events after console loads; refresh to populate

**Q: API test shows "Error"?**
- A: Check if backend is running and URL is correct

**Q: Can't renew license?**
- A: Only the original license creator can renew it

**Q: Data disappeared after clicking Clear?**
- A: That was intentional (you confirmed twice). It's gone.

---

## 📚 Related Documentation

- **[README.md](README.md)** - System overview
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Features summary
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Backend integration
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick commands

---

**Developer Console** • Built for system administrators and developers
**Version 1.0** • May 2026
