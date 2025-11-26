# LIC Renewal Management App

A comprehensive React Native application for managing LIC policy renewals with intelligent PDF parsing using Gemini AI and automated OCR verification.

## 🌟 Features

### Admin Features
- 📄 **Bulk PDF Import** - Upload Premium Due List PDFs, automatically parsed by Gemini AI
- 💰 **Commission Tracking** - Track estimated commissions from verified policies
- 📊 **Dashboard Analytics** - Real-time stats for policies, amounts, and commissions
- ✅ **Policy Verification** - Review and verify payment receipts
- 📝 **Manual Policy Entry** - Add individual policies when needed
- 🗑️ **Batch Operations** - Clear all or verified policies for new month

### Staff Features
- 📋 **Policy List** - View all assigned policies for renewal
- 📸 **Receipt Upload** - Upload payment receipts for automatic verification
- 🔍 **OCR Verification** - Automatic policy verification using Google Vision AI

## 🛠️ Technology Stack

### Frontend
- **React Native** with Expo
- **TypeScript** for type safety
- **Expo Router** for navigation
- **Firebase SDK** for backend integration

### Backend
- **Firebase Cloud Functions** (Node.js 20)
- **Gemini 2.5 Flash API** for intelligent PDF parsing
- **Google Vision AI** for OCR receipt verification
- **Firestore** for database
- **Cloud Storage** for file management

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Firebase account
- Gemini API key (from Google AI Studio)
- Expo CLI

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/souviksenapati/LIC-Renewal-Management.git
cd LIC-Renewal-Management
```

2. **Install dependencies**
```bash
# Install app dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..
```

3. **Configure Firebase**
- Create a Firebase project
- Enable Firestore, Storage, and Cloud Functions
- Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
- Update `firebaseConfig.ts` with your Firebase config

4. **Set up Gemini API**
```bash
cd functions
echo "GEMINI_API_KEY=your_api_key_here" > .env
cd ..
```

5. **Deploy Cloud Functions**
```bash
firebase deploy --only functions
```

6. **Run the app**
```bash
npx expo start
```

## 📱 Usage

### Admin Workflow
1. **Upload PDF** - Admin uploads monthly Premium Due List PDF
2. **Gemini Processing** - AI extracts all policies with commission data
3. **Monitor Dashboard** - View real-time stats and commission totals
4. **Verify Receipts** - Review and verify staff-uploaded receipts

### Staff Workflow
1. **View Policies** - Check assigned policies for collection
2. **Upload Receipts** - Take photo and upload payment receipts
3. **Auto Verification** - OCR automatically verifies and updates status

## 🔐 Security

- Firebase Authentication required for all operations
- Firestore/Storage rules enforce authenticated access
- API keys stored in environment variables (not committed)
- Commission data visible only to admin users

## 📊 Data Model

### Policy Schema
```typescript
{
  id: string;
  policyNumber: string;
  customerName: string;
  amount: number;
  commission?: number;  // Visible to admin only
  dueDate: string;
  fup?: string;
  mod?: string;
  status: 'pending' | 'verified';
  receiptUrl?: string;
  uploadedBy?: string;
  uploadedAt?: number;
  verifiedAt?: number;
}
```

## 🤖 AI Integration

### Gemini 2.5 Flash (PDF Parsing)
- Model: `gemini-2.5-flash`
- Extracts: Policy numbers, names, modes, amounts, commissions
- Success rate: ~100% accuracy on standard LIC PDFs
- Processing: ~54s for 75 policies

### Google Vision AI (OCR)
- Extracts policy numbers and customer names from receipts
- Auto-verifies against Firestore data
- Name matching with fuzzy logic

## 📦 Project Structure

```
LIC-Renewal-Management/
├── app/                    # React Native screens
│   ├── admin/             # Admin dashboard, policies, upload
│   ├── staff/             # Staff dashboard
│   └── index.tsx          # Login screen
├── functions/             # Firebase Cloud Functions
│   ├── index.js          # verifyReceipt & processPdfUpload
│   └── .env              # API keys (not committed)
├── types/                 # TypeScript definitions
├── context/              # React Context (Auth)
├── firebaseConfig.ts     # Firebase configuration
└── package.json
```

## 🔧 Configuration

### Firebase Functions
- Runtime: Node.js 20
- Memory: 512MB
- Timeout: 180s (PDF processing), 60s (OCR)

### Dependencies
- `@google/genai` - Gemini AI SDK
- `@google-cloud/vision` - OCR
- `firebase-admin` - Backend SDK
- `expo` - React Native framework

## 📝 Environment Variables

**Required in `functions/.env`:**
```bash
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
```

## 🚀 Deployment

1. **Cloud Functions**
```bash
firebase deploy --only functions
```

2. **Firestore Rules**
```bash
firebase deploy --only firestore:rules
```

3. **Storage Rules**
```bash
firebase deploy --only storage
```

4. **Build APK** (Android)
```bash
eas build --platform android
```

## 🐛 Troubleshooting

### Cloud Function Timeout
- Default timeout increased to 180s for PDF processing
- Check Firebase logs: `firebase functions:log`

### PDF Not Parsing
- Verify Gemini API key in `functions/.env`
- Check function logs for errors
- Ensure PDF is in `policy-uploads/` folder

### OCR Not Verifying
- Check receipt clarity and lighting
- Ensure policy exists in Firestore
- Review name matching logic in logs

## 📄 License

This project is private and proprietary.

## 👥 Contributors

- Souvik Senapati ([@souviksenapati](https://github.com/souviksenapati))

## 🙏 Acknowledgments

- Google Gemini AI for intelligent PDF parsing
- Firebase for backend infrastructure
- Expo for React Native development
