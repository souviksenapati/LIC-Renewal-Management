const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const os = require('os');
const path = require('path');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

// Lazy-initialize Gemini AI client (initialized on first use to avoid deployment errors)
let geminiClient = null;
function getGeminiClient() {
    if (!geminiClient) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return geminiClient;
}

// Helper function to parse Gemini JSON responses
function parseGeminiResponse(responseText) {
    const cleanedText = responseText.replace(/```(json)?\n?/g, '').trim();
    return JSON.parse(cleanedText);
}

// Gemini-Powered Receipt Verification
exports.verifyReceipt = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .storage.object().onFinalize(async (object) => {
        const filePath = object.name;

        // Only process receipts
        if (!filePath.startsWith('receipts/')) return;

        // Extract policyId from filename: receipts/{policyId}.jpg (fixed filename format)
        const fileName = path.basename(filePath, '.jpg'); // Remove extension
        const policyId = fileName; // Filename IS the policyId

        if (!policyId) {
            console.error('Could not extract policy ID from filename:', fileName);
            return;
        }

        console.log(`Processing receipt for policy: ${policyId}`);

        // Use policyId as processing log ID for consistency with frontend
        // (Frontend and backend now use same ID since filename is fixed)
        const logRef = db.collection('processing_logs').doc(policyId);

        await logRef.set({
            type: 'receipt',
            policyId: policyId,
            stage: 'uploading',
            message: 'Receipt uploaded',
            fileName: `${policyId}.jpg`, // Fixed filename format
            startedAt: Date.now(),
            status: 'in_progress'
        });

        try {
            // Get policy data to verify against
            const policyDoc = await db.collection('policies').doc(policyId).get();

            if (!policyDoc.exists) {
                console.error('Policy not found:', policyId);
                await logRef.update({
                    stage: 'failed',
                    message: 'Policy not found',
                    error: 'Policy does not exist',
                    completedAt: Date.now(),
                    status: 'error'
                });
                return;
            }

            const policyData = policyDoc.data();
            const expectedPolicyNumber = policyData.policyNumber;
            const expectedCustomerName = policyData.customerName;

            // GCS Object Versioning handles old receipts automatically
            // No manual deletion needed - lifecycle rule deletes noncurrent versions after 7 days

            console.log(`Expected policy ID: ${policyId}`);

            // Download image to temp file
            const bucket = admin.storage().bucket(object.bucket);
            const tempFilePath = path.join(os.tmpdir(), fileName);

            await logRef.update({
                stage: 'processing',
                message: 'Analyzing receipt with AI...'
            });

            try {
                await bucket.file(filePath).download({ destination: tempFilePath });
                const imageBuffer = await fs.promises.readFile(tempFilePath);
                const imageBase64 = imageBuffer.toString('base64');

                const prompt = `System Role: Act as a Senior Insurance Compliance Auditor and Forensic Document Specialist. You are an expert in LIC's internal ERP systems and the specific tax/regulatory mandates of the Government of India.

═══════════════════════════════════════════════════════════════
TASK 1: GRANULAR DATA EXTRACTION (JSON)
═══════════════════════════════════════════════════════════════
Extract ALL text from the receipt image into structured JSON. Focus on:

UNIQUE IDENTIFIERS:
- Policy No (9-digit numeric, e.g., 508815995)
- Transaction No / Receipt No
- Agency Code
- Agency Reg No (GSTIN)

GEOGRAPHIC MARKERS:
- Branch Name
- Branch Code
- Address (full)
- State

FINANCIAL INTEGRITY:
- Net Premium / Installment Premium
- Late Fee (if any)
- CGST amount
- SGST amount
- Grand Total / Total Amount
- Amount in Words

POLICY LIFESPAN:
- Date of Commencement (DOC)
- Plan & Term
- Next Due Date
- Payment Mode (Yearly/Half-Yearly/Quarterly/Monthly)

CUSTOMER DETAILS:
- Policy Holder Name (if different)

═══════════════════════════════════════════════════════════════
TASK 2: INSTITUTIONAL INTEGRITY & CROSS-VERIFICATION
═══════════════════════════════════════════════════════════════

MATHEMATICAL INTEGRITY CHECK:
✓ Calculate: InstallmentPremium + LateFee + CGST + SGST
✓ Compare against Grand Total
✓ Verify Amount in Words matches Grand Total numerically
✓ Result: PASS or FAIL with discrepancy amount

AGENCY-BRANCH DNA MATCH:
✓ Verify Agency Code suffix matches Branch Code
   Example: If Branch Code is 569, Agency Code should end with 569
✓ Result: MATCH or MISMATCH

GST-STATE ALIGNMENT:
✓ Verify Agency Reg. No (GSTIN) starts with correct State Code
   Examples: 19 = West Bengal, 27 = Maharashtra, 09 = Delhi
✓ Result: VALID or INVALID

EMAIL-BRANCH LOGIC:
✓ Verify email follows format: BO_[BranchCode]@licindia.com
   Example: BO_569@licindia.com for Branch 569
✓ Result: VALID or INVALID

═══════════════════════════════════════════════════════════════
TASK 3: FORENSIC VISUAL INSPECTION
═══════════════════════════════════════════════════════════════

TYPOGRAPHY & PIXEL ARTIFACTS:
✓ Inspect Policy Number, Customer Name, Total Amount
✓ Look for "halos," blurring, different pixel densities
✓ Check if numbers appear "patched" compared to static text
✓ Finding: CLEAN, SUSPICIOUS_BLUR, or DIGITAL_TAMPERING

MICRO-ALIGNMENT CHECK:
✓ Verify vertical alignment of columns (Policy No, Premium, etc.)
✓ System-generated PDFs have perfect mathematical alignment
✓ Check for tilts or shifts indicating manual forgery
✓ Finding: ALIGNED or MISALIGNED

WATERMARK & BACKGROUND ANALYSIS:
✓ Search for LIC "Hands" logo watermark in background
✓ Check consistency and repetition pattern
✓ Detect flat/clinical white backgrounds (forgery indicator)
✓ Finding: WATERMARK_PRESENT or WATERMARK_MISSING

QR CODE AUDIT:
✓ Verify QR code exists in bottom-left quadrant
✓ Check for compression artifacts
✓ Compare QR code clarity vs surrounding text
✓ Finding: QR_VALID, QR_BLURRY, or QR_MISSING


STAMP DUTY CLAUSE VERIFICATION:
✓ Check LOA Number format (e.g., CSD/50/2025/1518)
✓ Verify font consistency with surrounding text
✓ Finding: CONSISTENT or FONT_MISMATCH

═══════════════════════════════════════════════════════════════
TASK 4: RISK EVALUATION & VERIFICATION SUMMARY
═══════════════════════════════════════════════════════════════

Provide comprehensive verification assessment:

AUTHENTICITY SCORE: 0-100%
- 90-100%: Highly Authentic
- 70-89%: Likely Authentic (Minor Issues)
- 40-69%: Needs Review (Multiple Concerns)
- 0-39%: Cannot Verify (Major Discrepancies)

VERIFICATION ISSUES (If Any):
List specific problems found (max 3 most critical):
- Logic Breaks (e.g., "Branch-Agency code mismatch")
- Visual Anomalies (e.g., "Font inconsistency in Amount field")
- Mathematical Errors (e.g., "Total calculation off by ₹50")
- Document Quality Issues (e.g., "Watermark missing")

AUDIT STATUS:
- VERIFIED: All checks passed, high confidence
- NEEDS_REVIEW: One or more concerns found, manual review recommended
- CANNOT_VERIFY: Multiple critical issues, unable to confirm authenticity

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (STRICT JSON - NO MARKDOWN)
═══════════════════════════════════════════════════════════════

{
  "extractedData": {
    "policyNumber": "508815995",
    "customerName": "CHHABI DAS",
    "transactionNo": "TXN1234567890",
    "branchName": "Kolkata Branch",
    "branchCode": "569",
    "agencyCode": "56912345",
    "agencyRegNo": "19ABCDE1234F1Z5",
    "state": "West Bengal",
    "netPremium": 8295.00,
    "lateFee": 0,
    "cgst": 746.55,
    "sgst": 746.55,
    "grandTotal": 9788.10,
    "amountInWords": "Nine Thousand Seven Hundred Eighty Eight Rupees and Ten Paise Only",
    "dateOfCommencement": "14/02/2025",
    "planTerm": "736/25",
    "nextDueDate": "14/05/2025",
    "paymentMode": "Quarterly"
  },
  "integrityChecks": {
    "mathematicalIntegrity": {
      "status": "PASS",
      "calculatedTotal": 9788.10,
      "declaredTotal": 9788.10,
      "discrepancy": 0,
      "amountInWordsMatch": true
    },
    "agencyBranchMatch": {
      "status": "MATCH",
      "branchCode": "569",
      "agencyCodeSuffix": "569"
    },
    "gstStateAlignment": {
      "status": "VALID",
      "stateCode": "19",
      "stateName": "West Bengal"
    },
    "emailBranchLogic": {
      "status": "VALID",
      "expectedEmail": "BO_569@licindia.com",
      "foundEmail": "BO_569@licindia.com"
    }
  },
  "forensicAnalysis": {
    "typographyCheck": "CLEAN",
    "alignmentCheck": "ALIGNED",
    "watermarkStatus": "WATERMARK_PRESENT",
    "qrCodeStatus": "QR_VALID",
    "stampDutyClauseCheck": "CONSISTENT"
  },
  "riskEvaluation": {
    "authenticityScore": 95,
    "verificationIssues": [],
    "auditStatus": "VERIFIED",
    "confidence": "high",
    "recommendation": "APPROVE"
  }
}

If data is unclear or missing, use null for that field. If the document has verification issues, set auditStatus to "CANNOT_VERIFY" and list top 2-3 verification issues (be specific and factual, avoid accusatory language).

CRITICAL: Return ONLY the JSON object. No markdown formatting, no code blocks, no explanatory text.`;

                console.log('Calling Gemini for forensic receipt analysis...');

                const response = await getGeminiClient().models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: imageBase64
                                }
                            },
                            { text: prompt }
                        ]
                    }]
                });

                const responseText = response.text;
                console.log('Gemini forensic analysis response:', responseText);

                let analysisResult;
                try {
                    analysisResult = parseGeminiResponse(responseText);
                } catch (parseError) {
                    console.error('Failed to parse Gemini response:', parseError);
                    throw new Error('Invalid JSON from Gemini');
                }

                // Extract key data for verification
                const extractedPolicyNumber = analysisResult.extractedData?.policyNumber;
                const extractedCustomerName = analysisResult.extractedData?.customerName;
                const authenticityScore = analysisResult.riskEvaluation?.authenticityScore || 0;
                const auditStatus = analysisResult.riskEvaluation?.auditStatus || 'NEEDS_REVIEW';
                const verificationIssues = analysisResult.riskEvaluation?.verificationIssues || [];
                const confidence = analysisResult.riskEvaluation?.confidence || 'low';

                console.log(`Extracted data for policy: ${policyId}, AuthenticityScore=${authenticityScore}%, Status=${auditStatus}`);

                // Update log with extraction results
                await logRef.update({
                    stage: 'verifying',
                    message: 'Performing forensic verification...',
                    extractedPolicyNumber,
                    extractedCustomerName,
                    authenticityScore,
                    auditStatus,
                    verificationIssues,
                    confidence
                });

                // Verify policy number match
                const policyNumberMatch = extractedPolicyNumber === expectedPolicyNumber;

                // Verify customer name match (fuzzy)
                let customerNameMatch = false;
                if (extractedCustomerName && expectedCustomerName) {
                    const extractedUpper = extractedCustomerName.toUpperCase().trim();
                    const expectedUpper = expectedCustomerName.toUpperCase().trim();

                    customerNameMatch = extractedUpper === expectedUpper ||
                        extractedUpper.includes(expectedUpper) ||
                        expectedUpper.includes(extractedUpper);
                }

                console.log(`Verification: PolicyMatch=${policyNumberMatch}, NameMatch=${customerNameMatch}, AuthScore=${authenticityScore}%`);

                // Enhanced verification: must pass data matching AND authenticity checks
                const verificationPassed = policyNumberMatch && customerNameMatch &&
                    authenticityScore >= 70 && auditStatus === 'VERIFIED';

                if (verificationPassed) {
                    // Update policy status to verified with forensic analysis data
                    await policyDoc.ref.update({
                        status: 'verified',
                        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                        verificationMethod: 'gemini-forensic',
                        forensicAnalysis: {
                            authenticityScore,
                            auditStatus,
                            verificationIssues,
                            confidence,
                            extractedData: analysisResult.extractedData || {},
                            integrityChecks: analysisResult.integrityChecks || {},
                            visualInspection: analysisResult.forensicAnalysis || {},
                            verifiedAt: Date.now()
                        }
                    });

                    await logRef.update({
                        stage: 'completed',
                        message: `✅ Receipt verified! Authenticity: ${authenticityScore}%`,
                        policyNumberMatch,
                        customerNameMatch,
                        verificationPassed: true,
                        authenticityScore,
                        auditStatus,
                        completedAt: Date.now(),
                        status: 'success'
                    });

                    console.log(`✅ Policy ${policyId} verified successfully (Auth: ${authenticityScore}%, Status: ${auditStatus})`);
                } else {
                    // Verification failed - collect top 3 specific reasons
                    const reasons = [];

                    // Add data mismatch issues first (most critical)
                    if (!policyNumberMatch) {
                        reasons.push('Policy number mismatch');
                    }
                    if (!customerNameMatch) {
                        reasons.push('Customer name mismatch');
                    }

                    // Add authenticity issues
                    if (authenticityScore < 70) {
                        reasons.push(`Low authenticity (${authenticityScore}%)`);
                    }

                    // Add specific verification issues from AI analysis (limit to top 3 total)
                    if (verificationIssues.length > 0) {
                        const remainingSlots = 3 - reasons.length;
                        verificationIssues.slice(0, remainingSlots).forEach(issue => {
                            reasons.push(issue);
                        });
                    }

                    // Ensure we show at most 3 reasons
                    const topReasons = reasons.slice(0, 3);

                    await logRef.update({
                        stage: 'completed',
                        message: `Verification failed: ${topReasons.join('; ')}`,
                        policyNumberMatch,
                        customerNameMatch,
                        verificationPassed: false,
                        authenticityScore,
                        auditStatus,
                        verificationIssues: topReasons,
                        allIssues: verificationIssues, // Store all issues for admin review
                        forensicDetails: analysisResult,
                        completedAt: Date.now(),
                        status: 'error'
                    });

                    console.log(`⚠️ Policy ${policyId} verification incomplete: ${topReasons.join('; ')}`);
                }

            } finally {
                // Always cleanup temp file, even if processing fails
                if (tempFilePath && fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                    } catch (cleanupError) {
                        console.warn('Failed to cleanup temp file:', cleanupError.message);
                    }
                }
            }

        } catch (error) {
            console.error('Error processing receipt:', error);

            await logRef.update({
                stage: 'failed',
                message: 'Processing error',
                error: error.message || 'Unknown error',
                completedAt: Date.now(),
                status: 'error'
            }).catch(err => console.error('Failed to update error status:', err));
        }
    });

// PDF Parsing Function using Gemini 2.5 Flash
exports.processPdfUpload = functions
    .runWith({ timeoutSeconds: 180, memory: '512MB' })
    .storage.object().onFinalize(async (object) => {
        const filePath = object.name;

        if (!filePath.startsWith('policy-uploads/') || !filePath.endsWith('.pdf')) return;

        const bucket = admin.storage().bucket(object.bucket);
        const fileName = path.basename(filePath);
        const tempFilePath = path.join(os.tmpdir(), fileName);

        // Create processing log document
        const uploadId = fileName.replace('.pdf', '');
        const logRef = db.collection('processing_logs').doc(uploadId);

        // Update status: uploading complete, now processing
        await logRef.set({
            stage: 'processing',
            message: 'Analyzing PDF content...',
            fileName: fileName,
            startedAt: Date.now(),
            status: 'in_progress'
        });

        try {
            try {
                await bucket.file(filePath).download({ destination: tempFilePath });
                const dataBuffer = await fs.promises.readFile(tempFilePath);

                const pdfBase64 = dataBuffer.toString('base64');

                const prompt = `You are an expert data extraction tool for LIC Premium Due List PDFs. Extract EVERY policy with 100% accuracy.

═══════════════════════════════════════════════════════════════
📊 DOCUMENT STRUCTURE
═══════════════════════════════════════════════════════════════
This PDF may have MULTIPLE PAGES (could be 1 page, 3 pages, 5 pages, or more)
Each page typically contains 30-40 rows of policy data.
Process ALL pages from START to END. DO NOT stop until you've reached the last page!

═══════════════════════════════════════════════════════════════
📋 COMPLETE COLUMN-BY-COLUMN GUIDE (ALL 13 COLUMNS)
═══════════════════════════════════════════════════════════════

COLUMN 1 - S.No (Serial Number)
├─ Contains: Row number (1, 2, 3...)
├─ Data Type: Integer
└─ Action: ❌ SKIP - Just a counter, not policy data

COLUMN 2 - PolicyNo (Policy Number)
├─ Contains: 9-digit policy number
├─ Data Type: String (9 digits exactly)
├─ Example: "508515995", "505255519"
└─ Action: ✅ EXTRACT as "policyNumber"

COLUMN 3 - Name of Assured (Customer Name)
├─ Contains: Customer full name (may span 2-3 lines)
├─ Data Type: String (ALL CAPS)
├─ Example: "CHHABI DAS", "KABITA MANDAL"
├─ Note: If multi-line, concatenate with SPACE between lines
├─ Example: "CHHABI\\nDAS" → "CHHABI DAS" (not "CHHABIDAS")
└─ Action: ✅ EXTRACT as "customerName"

COLUMN 4 - D.o.C (Date of Commencement)
├─ Contains: Policy start date
├─ Data Type: Date (DD/MM/YYYY)
├─ Example: "14/02/2025"
└─ Action: ✅ EXTRACT as "dateOfCommencement" - Used to calculate due date

COLUMN 5 - Pln/Tm (Plan/Term)
├─ Contains: Plan code and term
├─ Data Type: String (e.g., "736/25")
├─ Example: "736/25", "814/21"
└─ Action: ❌ SKIP - Not needed

COLUMN 6 - Mod (Payment Mode)
├─ Contains: Payment frequency
├─ Data Type: String (3 chars)
├─ Values: "Qly" (Quarterly), "Hly" (Half-yearly), "Yly" (Yearly)
├─ Example: "Qly", "Hly", "Yly"
└─ Action: ✅ EXTRACT as "mod"

COLUMN 7 - FUP (Follow-Up Date)
├─ Contains: Follow-up month/year
├─ Data Type: String (MM/YYYY)
├─ Example: "05/2025", "06/2025"
├─ Note: Cell may have GREEN or YELLOW background - IGNORE color, read text
└─ Action: ✅ EXTRACT as "fup"

COLUMN 8 - Flg (Flag)
├─ Contains: Status flag (FY/ST/etc)
├─ Data Type: String (2-3 chars)
├─ Example: "FY", "ST"
└─ Action: ❌ SKIP - Just a visual indicator

COLUMN 9 - InstPrem (Installment Premium)
├─ Contains: Per-installment premium amount
├─ Data Type: Decimal number
├─ Example: 2665.00, 1940.50
├─ Note: This is Column 9 - DO NOT USE for "amount"!
└─ Action: ⚠️ SKIP! This is NOT the total premium!

COLUMN 10 - Due (Due Count)
├─ Contains: Number of dues
├─ Data Type: Integer
├─ Example: 3, 2, 4
└─ Action: ❌ SKIP - Not needed

COLUMN 11 - GST (Tax Amount)
├─ Contains: GST/tax amount
├─ Data Type: Decimal number
├─ Example: 300.00, 232.20
└─ Action: ❌ SKIP - Not needed

COLUMN 12 - TotPrem (Total Premium) ⭐ CRITICAL
├─ Contains: TOTAL PREMIUM for the period
├─ Data Type: Decimal/Integer number
├─ Example: 8295, 7761, 12500, 1000, 500
├─ Note: This is in the SECOND-TO-LAST column position
├─ Formula: TotPrem = InstPrem × number of installments per year
└─ Action: ✅ EXTRACT as "amount" ⭐ THIS IS THE CORRECT AMOUNT!

COLUMN 13 - EstCom (Estimated Commission)
├─ Contains: Agent commission amount
├─ Data Type: Decimal number
├─ Example: 1599.00, 1552.20
├─ Note: This is the LAST column
└─ Action: ✅ EXTRACT as "commission" (use 0 if empty)

═══════════════════════════════════════════════════════════════
📝 DETAILED EXAMPLE ROW WITH ALL COLUMNS ANNOTATED
═══════════════════════════════════════════════════════════════

RAW DATA ROW:
1 | 508515995 | CHHABI DAS | 14/02/2025 | 736/25 | Qly | 05/2025 | FY | 2,665.00 | 3 | 300.00 | 8,295 | 1,599.00

COLUMN-BY-COLUMN BREAKDOWN:
Col 1:  "1"          → SKIP (S.No - just row number)
Col 2:  "508515995"  → EXTRACT as policyNumber (9 digits)
Col 3:  "CHHABI DAS" → EXTRACT as customerName (full name)
Col 4:  "14/02/2025" → EXTRACT as dateOfCommencement (policy start date)
Col 5:  "736/25"     → SKIP (Pln/Tm - not needed)
Col 6:  "Qly"        → EXTRACT as mod (payment mode)
Col 7:  "05/2025"    → EXTRACT as fup (follow-up date)
Col 8:  "FY"         → SKIP (Flg - just indicator)
Col 9:  "2,665.00"   → ⚠️ SKIP! (InstPrem - NOT TOTAL!)
Col 10: "3"          → SKIP (Due - not needed)
Col 11: "300.00"     → SKIP (GST - not needed)
Col 12: "8,295"      → ✅ EXTRACT as amount (TotPrem - Column 12 - second-to-last!)
Col 13: "1,599.00"   → EXTRACT as commission (agent commission)

CORRECT JSON OUTPUT:
{
  "policyNumber": "508515995",   ← Column 2 (PolicyNo)
  "customerName": "CHHABI DAS",  ← Column 3 (Name of Assured)
  "dateOfCommencement": "14/02/2025", ← Column 4 (D.o.C)
  "mod": "Qly",                  ← Column 6 (Mod)
  "fup": "05/2025",              ← Column 7 (FUP)
  "amount": 8295,                ← Column 12 (TotPrem)
  "commission": 1599.00          ← Column 13 (EstCom)
}

WRONG - DO NOT DO THIS:
{
  "amount": 2665  ← This is Column 9 (InstPrem) - WRONG COLUMN!
}

═══════════════════════════════════════════════════════════════
⚡ CRITICAL PROCESSING RULES
═══════════════════════════════════════════════════════════════
1. PROCESS EVERY PAGE: Start at page 1, continue sequentially until the LAST page
2. MULTI-LINE NAMES: If Column 3 has multiple lines, concatenate them
3. COLORED CELLS: Column 7 (FUP) may have green/yellow background - ignore color, read text
4. AMOUNT COLUMN: Always use Column 12 (TotPrem), NEVER Column 9 (InstPrem)
5. ONE ROW = ONE JSON OBJECT
6. DO NOT STOP early - extract EVERY row from EVERY page

═══════════════════════════════════════════════════════════════
🚫 IGNORE THESE (NOT DATA ROWS)
═══════════════════════════════════════════════════════════════
❌ LIC logo, letterhead, Branch Code, Agent Name
❌ Title "Premium Due List For The Agent..."
❌ Column header row
❌ Page numbers, footers

═══════════════════════════════════════════════════════════════
✅ VALIDATION CHECKLIST (before responding)
═══════════════════════════════════════════════════════════════
□ Processed ALL pages until the end of document?
□ Every policyNumber from Column 2 (9 digits)?
□ Every amount from Column 12 (TotPrem - second-to-last column)?
□ NOT using Column 9 (InstPrem)?

═══════════════════════════════════════════════════════════════
💾 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
Return ONLY valid JSON array. No markdown, no code blocks.

[
  {
    "policyNumber": "508515995",
    "customerName": "CHHABI DAS",
    "dateOfCommencement": "14/02/2025",
    "mod": "Qly",
    "fup": "05/2025",
    "amount": 8295,
    "commission": 1599.00
  },
  ... (continue for ALL policies in the document)
]

NUMBER CONVERSION RULES:
- Remove commas from numbers: "8,295" → 8295
- Preserve decimals if present: 1599.00 → 1599.00
- If value has no decimals, keep as integer: 8295 → 8295
- Convert to JSON numbers (not strings)
- Example: "2,665.00" → 2665.00, "8,295" → 8295

Extract ALL policy data now:`;

                console.log('Sending PDF to Gemini 2.5 Flash...');

                // Update status: parsing with Gemini
                await logRef.update({
                    stage: 'parsing',
                    message: 'Extracting policy data with AI...',
                });

                const response = await getGeminiClient().models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: 'application/pdf',
                                        data: pdfBase64
                                    }
                                },
                                { text: prompt }
                            ]
                        }
                    ]
                });

                const responseText = response.text;

                // Parse JSON
                let policies = [];
                try {
                    policies = parseGeminiResponse(responseText);

                    // LOG COUNT FOR DEBUGGING (no PII)
                    console.log('=== GEMINI EXTRACTION COMPLETE ===');
                    console.log(`=== Total: ${policies.length} policies extracted ===`);
                } catch (parseError) {
                    console.error('Failed to parse JSON:', parseError);
                    console.error('Response:', responseText);
                    throw new Error('Invalid JSON from Gemini');
                }

                // Validate and save
                const validPolicies = policies.filter(p =>
                    p.policyNumber && p.customerName && p.mod && p.fup && p.amount > 0
                );

                console.log(`${validPolicies.length} valid policies`);

                if (validPolicies.length > 0) {
                    const BATCH_SIZE = 400; // Safe limit below Firestore's 500 operation limit
                    const chunks = [];

                    // Split policies into chunks
                    for (let i = 0; i < validPolicies.length; i += BATCH_SIZE) {
                        chunks.push(validPolicies.slice(i, i + BATCH_SIZE));
                    }

                    console.log(`Processing ${validPolicies.length} policies in ${chunks.length} batch(es)`);

                    // Process each chunk
                    for (let i = 0; i < chunks.length; i++) {
                        const batch = db.batch();
                        chunks[i].forEach(p => {
                            const docRef = db.collection('policies').doc();

                            // Calculate due date: Use day from D.o.C + CURRENT month/year
                            // Get current month and year first
                            const now = new Date();
                            const currentMonth = now.getMonth(); // 0-11
                            const currentYear = now.getFullYear();

                            // Fallback: Last day of current month (if no D.o.C)
                            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                            const fallbackDd = String(lastDayOfMonth).padStart(2, '0');
                            const fallbackMm = String(currentMonth + 1).padStart(2, '0');
                            let dueDate = `${fallbackDd}/${fallbackMm}/${currentYear}`;

                            if (p.dateOfCommencement) {
                                try {
                                    // Extract day from D.o.C (DD/MM/YYYY)
                                    const docParts = p.dateOfCommencement.split('/');
                                    const day = parseInt(docParts[0]);

                                    // Create date: day from D.o.C, current month/year
                                    const date = new Date(currentYear, currentMonth, day);

                                    // Format as DD/MM/YYYY
                                    const dd = String(date.getDate()).padStart(2, '0');
                                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                                    const yyyy = date.getFullYear();
                                    dueDate = `${dd}/${mm}/${yyyy}`;

                                } catch (err) {
                                    console.warn('Could not parse D.o.C:', p.dateOfCommencement, err.message);
                                }
                            }

                            batch.set(docRef, {
                                id: docRef.id,
                                policyNumber: p.policyNumber,
                                customerName: p.customerName,
                                dateOfCommencement: p.dateOfCommencement || null,
                                mod: p.mod,
                                fup: p.fup,
                                amount: parseFloat(p.amount),
                                commission: parseFloat(p.commission || 0),
                                dueDate: dueDate,
                                status: 'pending',
                                createdAt: Date.now()
                            });
                        });

                        await batch.commit();
                        console.log(`✅ Batch ${i + 1}/${chunks.length} committed (${chunks[i].length} policies)`);
                    }

                    console.log(`✅ Created ${validPolicies.length} policies total`);

                    // Update status: completed successfully
                    await logRef.update({
                        stage: 'completed',
                        message: 'Successfully processed!',
                        policiesFound: validPolicies.length,
                        completedAt: Date.now(),
                        status: 'success'
                    });
                } else {
                    console.log('⚠️ No valid policies found');

                    // Update status: completed but no policies
                    await logRef.update({
                        stage: 'completed',
                        message: 'No valid policies found in PDF',
                        policiesFound: 0,
                        completedAt: Date.now(),
                        status: 'warning'
                    });
                }

            } finally {
                // Always cleanup temp file, even if processing fails
                if (fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                    } catch (cleanupError) {
                        console.warn('Failed to cleanup temp file:', cleanupError.message);
                    }
                }
            }

        } catch (error) {
            console.error('Error with Gemini:', error);
            if (error.message) console.error('Message:', error.message);

            // Update status: failed
            await logRef.update({
                stage: 'failed',
                message: 'Processing failed',
                error: error.message || 'Unknown error',
                completedAt: Date.now(),
                status: 'error'
            }).catch(err => console.error('Failed to update error status:', err));
        }
    });

// ========================================
// POLICY DELETION - AUTO-CLEANUP RECEIPTS
// ========================================

/**
 * Firestore Trigger: Auto-delete receipts when policy is deleted
 * Fires when ANY policy is deleted (admin UI, console, etc.)
 * Deletes ALL versions of the receipt + processing log
 */
exports.onPolicyDelete = functions.firestore
    .document('policies/{policyId}')
    .onDelete(async (snap, context) => {
        const policyId = context.params.policyId;
        const policyData = snap.data();

        console.log(`🗑️  Policy deleted: ${policyId}, starting cleanup...`);

        // Delete ALL versions of receipt from Storage (if exists)
        if (policyData.receiptUrl) {
            const bucket = admin.storage().bucket();
            const filePath = `receipts/${policyId}.jpg`;

            try {
                // List ALL versions of this file (live + noncurrent)
                const [files] = await bucket.getFiles({
                    prefix: filePath,
                    versions: true
                });

                // Delete each version
                const deletePromises = files.map(fileVersion =>
                    fileVersion.delete({ ignoreNotFound: true })
                );
                await Promise.all(deletePromises);

                console.log(`✅ Deleted ${files.length} version(s) of receipt: ${filePath}`);
            } catch (error) {
                // Log error but don't fail - file might not exist or already deleted
                console.error(`⚠️  Failed to delete receipt ${filePath}:`, error.message);
            }
        } else {
            console.log(`ℹ️  No receipt URL found for policy: ${policyId}`);
        }

        // Delete processing log (if exists)
        try {
            await db.collection('processing_logs').doc(policyId).delete();
            console.log(`✅ Deleted processing log: ${policyId}`);
        } catch (error) {
            console.error(`⚠️  Failed to delete processing log:`, error.message);
        }

        console.log(`✅ Cleanup complete for policy: ${policyId}`);
        return null;
    });
