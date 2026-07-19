# MFUMO POS - Modern Employee Sales & Business Management System

## 🎯 Overview

MFUMO POS is a modern, professional Point-of-Sale and Business Management System designed for retail businesses. It features an **orange-themed premium UI**, complete inventory management, real-time analytics, and integrated reporting capabilities.

**Live Demo:** Open `index.html` in a modern web browser.

---

## ✨ Key Features Included

### ✅ 1. Subscription License System (NEW!)
- Secure subscription management for multiple companies
- Support for Basic, Pro, and Enterprise plans
- Automatic license expiry detection
- One-month renewal with limit controls
- Developer-generated temporary unlock keys for expired systems
- License validation on login
- Real-time license status display
- Backend API for production deployments
- Comprehensive audit logging
- Database support: MySQL & PostgreSQL

### ✅ 2. Employee Dashboard
- Modern responsive layout with orange premium UI/UX
- Real-time KPI cards (Revenue, Items Sold, Transactions, Low Stock)
- Mobile-friendly responsive design with smooth animations
- Professional sidebar navigation

### ✅ 2. Product Inventory System
- Display all products with complete information
- Real-time stock tracking with status indicators
- Low stock alerts and out of stock warnings
- Add/edit products with SKU, price, category
- Update stock quantities quickly
- Stock value calculations

### ✅ 3. Fast Cashier Sales System
- Click product buttons to add to cart
- Automatic stock reduction after sale
- Real-time cart updates with quantity controls
- Employee notes/comments for transactions
- One-click checkout workflow

### ✅ 4. Daily Work Flow Management
- Today's sales summary dashboard
- Current employee and working status display
- Clock in/out tracking
- Sales-by-employee tracking
- Daily transaction history

### ✅ 5. Time Reminder System (Closing at 10 PM)
- Automatic scheduling for configured closing time
- 15-minute countdown before store closing
- Visual countdown banner with animations
- Automatically disables sales buttons
- Keeps comment section active only

### ✅ 6. Boss Report System
- Daily, Weekly, Monthly sales reports
- WhatsApp integration (one-click sending)
- Employee comment section for boss messages
- Formatted report messages
- Boss/Admin dashboard for daily, weekly, and monthly sales
- Profit, cost/loss-risk, stock remaining, and stock sold tracking
- Employee performance report and printable PDF workflow

### ✅ 7. Analytics Dashboard
- 7-day sales trend chart
- Product performance analytics
- Revenue metrics and statistics
- Best-selling products ranking
- Interactive charts using Chart.js

### ✅ 8. Modern Orange-Themed UI/UX
- Pure Green admin palette (#008000 + hover #006400)
- Professional POS interface design
- Smooth hover effects and transitions
- Modern animated cards and responsive tables
- Premium gradient buttons

### ✅ 9. Professional Code Structure
- Clean HTML/CSS/JavaScript separation
- Modular, reusable components
- Scalable architecture
- Local Storage persistence
- Well-commented code

---

## 🚀 Quick Start

1. **Open:** Double-click `index.html` to launch in browser
2. **Login:** Choose Boss Admin or a staff member and enter the password
3. **Add Products:** Go to Inventory → Add new products
4. **Make Sales:** Click POS → Add products to cart → Complete Sale
5. **View Reports:** Check Dashboard or Reports section

### Login Accounts
- **Boss Admin:** password `Digital11#`
- **Staff:** password `Digital11@`

**License System:** The system comes with a 30-day trial license. 
- View license status in Settings → Subscription License
- Renew license when it expires

---

## 💻 Backend Setup (Optional but Recommended for Production)

For multi-device deployments and production environments, set up the secure backend server:

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with database credentials
npm run migrate
npm run dev
```

**Requirements:**
- Node.js 14+
- MySQL 5.7+ or PostgreSQL 12+

**Features:**
- Centralized license management
- Multi-company support
- Payment integration ready
- Audit logging
- API documentation

See `backend/README.md` for detailed setup instructions.

---

## 📱 License Management

### How Licensing Works

1. **Trial Period:** Every company gets a 30-day free trial
2. **Subscription Plans:**
   - **Basic:** 5 users, 100 products, email support
   - **Pro:** 20 users, 1000 products, priority support
   - **Enterprise:** Unlimited users/products, 24/7 support

3. **License Validation:**
   - Checked on every login
   - Blocks access if expired
   - Shows clear expiry warnings

4. **Renewal Process:**
   - Go to Settings → Subscription License
   - Click "Manage License"
   - Click "Renew for 1 Month"
   - License extends automatically

### License Features

✅ **Frontend-Only (Ready to Use):**
- Works immediately without backend
- 30-day trial included
- Renew anytime
- View status in sidebar

✅ **With Backend (Production):**
- Multiple companies supported
- Payment gateway ready
- Audit trail of all changes
- Professional management dashboard
- API for custom integrations

---

## 👥 Staff & Security

**Employee Accounts:**
- **Staff:** password `Digital11@`
- Boss Admin can create additional staff accounts
- Passwords expire every 113 days
- Passwords require: uppercase, lowercase, number, symbol, 8+ chars

**Access Control:**
- Staff limited to POS sales panel only
- Boss Admin has full access
- Staff access locked 10 PM - 8 AM
- License validation on every login

---

## 📊 System Features

### Dashboard
- KPI Cards with real-time updates
- Best-selling products ranking
- Low stock alerts
- Recent transactions
- Quick action buttons

### Point of Sale (POS)
- Responsive product grid
- Quick search functionality
- Shopping cart with controls
- Auto-calculation
- One-click checkout

### Inventory
- Complete product database
- Status indicators (In/Low/Out of Stock)
- Add/edit products
- Statistics and valuations

### Analytics
- 7-day trend chart
- Product performance
- Revenue metrics
- Real-time visualization

### Reporting
- Daily/Weekly/Monthly reports
- WhatsApp integration
- CSV/JSON export
- Printable reports

---

## 🎨 Design Highlights

**Color Scheme:**
- Primary Green: `#008000`
- Accent Teal: `#1ABC9C`
- Dark Backgrounds: `#0F1419` to `#232A36`

**Features:**
- Gradient effects and premium shadows
- Smooth animations and transitions
- Color-coded status indicators
- Responsive mobile/tablet design
- Touch-friendly interface

---

## 💾 Data Storage

- **Local Storage** - Browser-based persistence
- **No server needed** - Everything stored locally
- **Daily sales** - Stored per date
- **Auto-save** - All changes saved automatically
- **Export options** - CSV, JSON, Print, WhatsApp

---

## ⚙️ Settings

Configure in Settings panel:
- **Business Name** - Your store name
- **Boss Phone** - WhatsApp number for reports
- **Closing Time** - Automatic closing reminder time (default: 10:00 PM)
- **Low Stock Threshold** - Alert level for inventory

---

## 📱 Browser Support

- ✅ Chrome/Chromium (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

---

## 🎓 Pro Tips

1. **Faster Sales:** Use search to find products quickly
2. **Better Reports:** Always set employee before sales
3. **Stock Management:** Add stock before running out
4. **Export Data:** Use CSV for analysis in Excel

---

## 🔒 Security & Privacy

- **Local Storage Only** - No external servers
- **No Cloud Upload** - Your data stays on your device
- **Private System** - No tracking or analytics
- **Complete Control** - You own all your data

---

## 📄 File Structure

```
pos/
├── index.html      (HTML structure & layout)
├── style.css       (CSS styling & orange theme)
├── app.js          (Complete application logic)
└── README.md       (Documentation)
```

---

## 🚀 Future Enhancements

Possible additions:
- Backend database integration
- Multi-location support
- Advanced forecasting
- Barcode scanning
- Payment gateway
- Mobile app version
- Customer loyalty programs

---

## 📧 Support & Customization

This system is ready to use and customize. Adapt the code for your specific business needs.

---

## 🎉 MFUMO POS

**Making retail management simple and professional.**

**Version:** 1.0  
**Status:** Production Ready  
**Theme:** Modern Orange Premium UI/UX
