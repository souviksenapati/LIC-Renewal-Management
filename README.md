# 📱 LIC Renewal Management App

> **Production-ready** React Native application for managing LIC policy renewals with intelligent AI-powered PDF parsing, automated receipt verification, and robust offline support.

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/souviksenapati/LIC-Renewal-Management)
[![Expo](https://img.shields.io/badge/Expo-54.0-000020.svg?logo=expo)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6-FFCA28.svg?logo=firebase)](https://firebase.google.com)

---

## ✨ Key Features

### 🎯 **Core Capabilities**
- 🤖 **AI-Powered PDF Parsing** - Gemini 2.5 Flash extracts policies with ~100% accuracy
- 📸 **Smart Receipt Verification** - Automatic OCR verification using Gemini Vision
- 📡 **Offline-First Architecture** - Full offline persistence with Firestore caching
- 🔄 **Real-time Sync** - Live updates across all devices
- 🔐 **Role-Based Access** - Secure admin/staff separation with Firebase Auth
- 🎨 **Premium UI/UX** - Modern gradient designs with smooth animations

---

## 👥 User Roles & Features

### 🔵 **Admin Dashboard**
| Feature | Description |
|---------|-------------|
| 📄 **Bulk PDF Import** | Upload Premium Due List PDFs → AI extracts all policies |
| 💰 **Commission Tracking** | Track estimated commissions (hidden from staff) |
| 📊 **Live Analytics** | Real-time stats: total policies, amounts, commissions |
| ✅ **Receipt Verification** | Review staff-uploaded receipts with OCR results |
| 📝 **Manual Entry** | Add individual policies manually |
| 🗑️ **Batch Operations** | Clear verified/all policies for new billing cycle |
| 👁️ **Policy Management** | View, filter, verify, and manage all policies |

### 🟢 **Staff Interface**
| Feature | Description |
|---------|-------------|
| 📋 **Policy List** | View assigned policies with filters (pending/verified) |
| 📸 **Receipt Upload** | Camera integration for instant receipt capture |
| 🔍 **Auto-Verification** | Real-time verification progress with status updates |
| ⚡ **Offline Mode** | Upload receipts offline → auto-sync when online |
| 🔔 **Status Updates** | Live verification results with processing modal |

---

## 🏗️ Architecture

### **Tech Stack**

#### Frontend
```
React Native (0.81.5)
├── Expo (54.0) - Development platform
├── TypeScript (5.9) - Type safety
├── Expo Router (6.0) - File-based navigation
└── React 19.1 - Latest React features
```

#### Backend
```
Firebase Platform
├── Cloud Functions (Node.js 20) - Serverless processing
├── Firestore - NoSQL database with offline support
├── Cloud Storage - File storage with GCS versioning
├── Authentication - Secure user management
└── Gemini 2.5 Flash API - AI PDF/OCR processing
```

#### Key Libraries
- `@react-native-async-storage/async-storage` - Persistent storage
- `@react-native-community/netinfo` - Network status detection
- `expo-image-picker` - Camera integration
- `expo-document-picker` - PDF file selection
- `expo-linear-gradient` - Premium gradient UI

---

## 🚀 Advanced Features

### 1. **Offline Support** 🌐
- ✅ Firestore offline persistence enabled by default
- ✅ AsyncStorage role caching for offline login
- ✅ Network status detection with real-time banner
- ✅ Queued writes sync automatically when online
- ✅ Cached policy data available offline

### 2. **Error Handling** 🛡️
- ✅ Centralized error parser (`utils/errorParser.ts`)
- ✅ Context-aware user-friendly messages
- ✅ Error boundary for graceful failure handling
- ✅ Network error detection and retry suggestions

### 3. **Receipt Auto-Delete** 🔄
- ✅ GCS Object Versioning enabled
- ✅ Old receipts archived (7-day retention)
- ✅ Fixed filename per policy (`receipts/{policyId}.jpg`)
- ✅ Automatic cleanup on policy deletion

### 4. **Processing Modals** ⚙️
- ✅ Real-time Firestore listener for progress
- ✅ Minimizable modal with floating badge
- ✅ Processing stages: Upload → Process → Verify
- ✅ Persistent state across app reopens

### 5. **Security** 🔒
- ✅ Firestore rules: Role-based field restrictions
- ✅ Storage rules: File type/size validation
- ✅ Input sanitization for search queries
- ✅ Commission data visible only to admins
- ✅ No credentials stored locally

---

## 📊 Data Models

### Policy Schema
```typescript
interface Policy {
  id: string;                    // Firestore document ID
  policyNumber: string;          // 9-digit policy number
  customerName: string;          // Customer full name
  amount: number;                // Premium amount
  commission?: number;           // Admin-only field
  dueDate: string;              // DD/MM/YYYY format
  dateOfCommencement?: string;  // Policy start date
  fup?: string;                 // First Unpaid Premium
  mod?: string;                 // Mode (Qly/Hly/Yly)
  status: 'pending' | 'verified';
  receiptUrl?: string;          // Cloud Storage URL
  uploadedBy?: string;          // Staff UID
  uploadedAt?: number;          // Unix timestamp
  verifiedAt?: number;          // Unix timestamp
}
```

### Processing Log Schema
```typescript
interface ProcessingLog {
  type: 'pdf' | 'receipt';
  stage: 'uploading' | 'processing' | 'parsing' | 'completed' | 'failed';
  message: string;
  progress?: number;
  policiesFound?: number;
  verificationPassed?: boolean;
  error?: string;
  status: 'in_progress' | 'error';
  startedAt: number;
  completedAt?: number;
}
```

---

## 🤖 AI Integration Details

### Gemini 2.5 Flash - PDF Parsing
**Model:** `gemini-2.5-flash`  
**Input:** Base64-encoded PDF  
**Output:** JSON with extracted policies

**Extraction Capabilities:**
- Policy Number (9 digits)
- Customer Name (full name)
- Premium Amount (₹)
- Mode (Qly, Hly, Yly)
- Estimated Commission (%)
- Date of Commencement
- First Unpaid Premium

**Performance:**
- ⚡ ~54 seconds for 75 policies
- 🎯 ~100% accuracy on standard LIC PDFs
- 📄 Multi-page support (1-10+ pages)

### Gemini Vision - Receipt OCR
**Model:** `gemini-2.5-flash` (with vision)  
**Input:** Receipt image (JPEG/PNG)  
**Verification:**
- Extracts policy number from receipt
- Extracts customer name
- Compares with Firestore policy data
- Fuzzy matching for name variations

**Features:**
- ✅ Handles handwritten receipts
- ✅ Case-insensitive matching
- ✅ Name similarity scoring

---

## 📦 Project Structure

```
LIC-Renewal-Management/
├── app/                        # Expo Router screens
│   ├── _layout.tsx            # Root layout with providers
│   ├── index.tsx              # Login screen
│   ├── admin/
│   │   ├── dashboard.tsx      # Admin home with analytics
│   │   ├── policies.tsx       # Policy list with filters
│   │   ├── add-policy.tsx     # Manual policy entry
│   │   └── upload-pdf.tsx     # PDF bulk upload
│   └── staff/
│       └── dashboard.tsx      # Staff policy list + upload
├── components/
│   ├── NetworkBanner.tsx      # Offline indicator (bottom)
│   ├── EnvironmentBadge.tsx   # Testing environment badge
│   ├── ErrorBoundary.tsx      # Global error handler
│   ├── ProcessingStatusModal.tsx  # PDF processing UI
│   └── ReceiptVerificationProgress.tsx  # Receipt verification UI
├── context/
│   └── AuthContext.tsx        # Auth state + role management
├── hooks/
│   └── useNetworkStatus.ts    # Network detection hook
├── utils/
│   └── errorParser.ts         # User-friendly error messages
├── types/
│   └── index.ts               # TypeScript interfaces
├── functions/                  # Cloud Functions
│   ├── index.js               # Main functions file
│   │   ├── processPdfUpload   # Gemini PDF parsing
│   │   ├── verifyReceipt      # Gemini OCR verification
│   │   └── onPolicyDelete     # Cascade delete receipts
│   ├── package.json
│   └── .env                   # API keys (not committed)
├── firebaseConfig.ts          # Multi-environment config
├── firestore.rules            # Security rules
├── storage.rules              # Storage access rules
├── eas.json                   # EAS build configuration
└── package.json
```

---

## 🛠️ Setup Instructions

### Prerequisites
- ✅ Node.js 20+
- ✅ Firebase project (Blaze plan for Cloud Functions)
- ✅ Gemini API key ([Get from AI Studio](https://aistudio.google.com/app/apikey))
- ✅ Expo account
- ✅ Android Studio (for local builds) or EAS CLI

### 1. Clone & Install

```bash
git clone https://github.com/souviksenapati/LIC-Renewal-Management.git
cd LIC-Renewal-Management

# Install app dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..
```

### 2. Firebase Setup

**Create Firebase Project:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable **Firestore**, **Storage**, **Authentication**, **Cloud Functions**

**Configure App:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (select existing project)
firebase init
```

**Update `firebaseConfig.ts`:**
```typescript
const productionConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Gemini API Setup

```bash
# Create .env file in functions/
cd functions
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
cd ..
```

Get your API key: https://aistudio.google.com/app/apikey

### 4. Deploy Backend

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy Cloud Functions
firebase deploy --only functions

# Or deploy everything
firebase deploy
```

### 5. Configure Storage Lifecycle

**Enable GCS Object Versioning:**
1. Go to [GCS Console](https://console.cloud.google.com/storage)
2. Select your bucket: `YOUR_PROJECT.appspot.com`
3. Go to "Lifecycle" tab
4. Add rule: Delete noncurrent versions after 7 days

### 6. Create Admin User

```bash
# In Firebase Console → Authentication
# Create user with email/password

# In Firestore → Create document
# Collection: users
# Document ID: {user_uid}
# Fields:
{
  "email": "admin@example.com",
  "role": "admin",
  "name": "Admin User",
  "createdAt": 1234567890
}
```

### 7. Run App

**Development:**
```bash
# Start Expo dev server
npm run start

# Or with environment
npm run start:testing    # Testing env
npm run start:production # Production env
```

**Build APK:**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for Android
eas build --platform android --profile test

# Or production build
eas build --platform android --profile production
```

---

## 🔧 Configuration

### Environment Switching
The app supports multiple Firebase environments:

**Edit `firebaseConfig.ts`:**
```typescript
const testingConfig = { /* Testing Firebase config */ };
const productionConfig = { /* Production Firebase config */ };
```

**Build profiles in `eas.json`:**
```json
{
  "build": {
    "production": {
      "env": { "EXPO_PUBLIC_ENV": "production" }
    },
    "test": {
      "env": { "EXPO_PUBLIC_ENV": "testing" }
    }
  }
}
```

### Firebase Functions Config

**Memory & Timeout:**
```javascript
// functions/index.js
exports.processPdfUpload = functions
  .runWith({ 
    timeoutSeconds: 180,  // 3 minutes for large PDFs
    memory: '512MB' 
  })
  .storage.object().onFinalize(/*...*/);
```

---

## 🎨 UI/UX Features

### Design System
- 🎨 **Gradient Themes**: Admin (Blue), Staff (Green), Alerts (Amber)
- 📱 **Responsive**: Optimized for all screen sizes
- 🌙 **Loading States**: Spinners, progress bars, skeleton screens
- ✨ **Animations**: Pulse effects, smooth transitions
- 🎯 **Status Badges**: Color-coded status indicators

### Accessibility
- ✅ Large touch targets (48x48 minimum)
- ✅ High contrast text
- ✅ Error boundaries prevent crashes
- ✅ Loading indicators for all async operations

---

## 🐛 Troubleshooting

### Common Issues

**1. PDF Not Parsing**
```bash
# Check Cloud Function logs
firebase functions:log --only processPdfUpload

# Verify Gemini API key
cat functions/.env
```

**2. Receipt Upload Failing**
- Check Storage rules allow staff write access
- Verify image is < 10MB
- Ensure valid JPEG/PNG format

**3. Offline Login Not Working**
```bash
# Clear app cache
# Uninstall and reinstall app
# Check AsyncStorage permissions
```

**4. Cloud Function Timeout**
```javascript
// Increase timeout in functions/index.js
.runWith({ timeoutSeconds: 300 }) // 5 minutes
```

**5. EAS Build Failing**
```bash
# Clear build cache
eas build --platform android --clear-cache

# Check eas.json configuration
# Verify Firebase config is correct
```

---

## 📈 Performance Metrics

| Metric | Value | Status |
|--------|-------|--------|
| App Size (APK) | ~45 MB | ✅ Optimal |
| Cold Start | < 3s | ✅ Fast |
| PDF Processing (75 policies) | ~54s | ✅ Good |
| Receipt Verification | ~8s | ✅ Fast |
| Firestore Queries | < 500ms | ✅ Excellent |
| Offline Data Access | Instant | ✅ Perfect |

---

## 🔐 Security Best Practices

✅ **Implemented:**
- Firebase Authentication required for all operations
- Firestore rules enforce role-based access
- Storage rules validate file types and sizes
- API keys stored in environment variables
- No sensitive data in client code
- Input sanitization for search queries
- Commission data hidden from staff
- Proper error handling (no stack traces to users)

⚠️ **Recommended:**
- Add Sentry/Crashlytics for production error tracking
- Implement rate limiting on Cloud Functions
- Add 2FA for admin accounts
- Regular security audits

---

## 📱 Mobile Build Profiles

### Test Build (Internal Testing)
```bash
eas build --platform android --profile test
```
- Uses testing Firebase environment
- Includes environment badge
- Faster build times

### Production Build
```bash
eas build --platform android --profile production
```
- Uses production Firebase
- Optimized bundle
- Ready for Play Store

---

## 🚀 Deployment Checklist

- [ ] Update version in `app.json`
- [ ] Test all features on testing environment
- [ ] Deploy latest Cloud Functions
- [ ] Deploy Firestore/Storage rules
- [ ] Verify GCS lifecycle rules
- [ ] Build production APK
- [ ] Test APK on physical device
- [ ] Upload to Play Store

---

## 📄 License

This project is **private and proprietary**.  
All rights reserved © 2024

---

## 👨‍💻 Author

**Souvik Senapati**  
GitHub: [@souviksenapati](https://github.com/souviksenapati)

---

## 🙏 Acknowledgments

- **Google Gemini AI** - Intelligent PDF parsing and OCR
- **Firebase** - Comprehensive backend platform
- **Expo** - React Native development framework
- **React Native Community** - Amazing ecosystem

---

## 📞 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review [Firebase Logs](https://console.firebase.google.com/logs)
3. Open an issue on GitHub

---

<div align="center">

**Built with ❤️ using React Native and Firebase**

[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB.svg?logo=react)](https://reactnative.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6-FFCA28.svg?logo=firebase)](https://firebase.google.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)

</div>
