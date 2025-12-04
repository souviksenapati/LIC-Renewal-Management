const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const os = require('os');
const path = require('path');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

// Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
}

// Initialize Gemini AI client
const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Gemini-Powered Receipt Verification
exports.verifyReceipt = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .storage.object().onFinalize(async (object) => {
        const filePath = object.name;

        // Only process receipts
        if (!filePath.startsWith('receipts/')) return;

        // Extract policyId from filename: receipts/{policyId}_{timestamp}.jpg
        const fileName = path.basename(filePath);
        const policyId = fileName.split('_')[0];

        if (!policyId) {
            console.error('Could not extract policy ID from filename:', fileName);
            return;
        }

        console.log(`Processing receipt for policy: ${policyId}`);

        // Create processing log
        const uploadId = fileName.replace(/\.(jpg|jpeg|png)$/i, '');
        const logRef = db.collection('processing_logs').doc(uploadId);

        await logRef.set({
            type: 'receipt',
            policyId: policyId,
            stage: 'uploading',
            message: 'Receipt uploaded',
            fileName: fileName,
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

            console.log(`Expected: Policy=${expectedPolicyNumber}, Name=${expectedCustomerName}`);

            // Download image to temp file
            const bucket = admin.storage().bucket(object.bucket);
            const tempFilePath = path.join(os.tmpdir(), fileName);

            await logRef.update({
                stage: 'processing',
                message: 'Analyzing receipt with AI...'
            });

            try {
                await bucket.file(filePath).download({ destination: tempFilePath });
                const imageBuffer = fs.readFileSync(tempFilePath);
                const imageBase64 = imageBuffer.toString('base64');

                const prompt = `Analyze this payment receipt image and extract:
1. Policy Number (9-digit number only, numeric)
2. Customer Name

IMPORTANT:
- Policy number is ALWAYS 9 digits, purely numeric (e.g., 508815995)
- Extract the exact name as written on receipt
- If information is unclear or not found, return null

Return ONLY valid JSON (no markdown):
{"policyNumber": "508815995", "customerName": "CHHABI DAS", "confidence": "high"}

If not found:
{"policyNumber": null, "customerName": null, "confidence": "low"}`;

                console.log('Calling Gemini for receipt analysis...');

                const response = await geminiClient.models.generateContent({
                    model: 'gemini-2.0-flash-exp',
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

                const responseText = response.text.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
                console.log('Gemini response:', responseText);

                let extracted;
                try {
                    extracted = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('Failed to parse Gemini response:', parseError);
                    throw new Error('Invalid JSON from Gemini');
                }

                const extractedPolicyNumber = extracted.policyNumber;
                const extractedCustomerName = extracted.customerName;
                const confidence = extracted.confidence || 'medium';

                console.log(`Extracted: Policy=${extractedPolicyNumber}, Name=${extractedCustomerName}, Confidence=${confidence}`);

                // Update log with extraction results
                await logRef.update({
                    stage: 'verifying',
                    message: 'Verifying against policy data...',
                    extractedPolicyNumber,
                    extractedCustomerName,
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

                console.log(`Verification: PolicyMatch=${policyNumberMatch}, NameMatch=${customerNameMatch}`);

                // Determine verification result
                const verificationPassed = policyNumberMatch && customerNameMatch;

                if (verificationPassed) {
                    // Update policy status to verified
                    await policyDoc.ref.update({
                        status: 'verified',
                        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                        verificationMethod: 'gemini-auto',
                        extractedData: {
                            policyNumber: extractedPolicyNumber,
                            customerName: extractedCustomerName,
                            confidence
                        }
                    });

                    await logRef.update({
                        stage: 'completed',
                        message: 'Receipt verified successfully!',
                        policyNumberMatch,
                        customerNameMatch,
                        verificationPassed: true,
                        completedAt: Date.now(),
                        status: 'success'
                    });

                    console.log(`✅ Policy ${policyId} verified successfully`);
                } else {
                    // Verification failed - keep as pending, allow retry
                    const reasons = [];
                    if (!policyNumberMatch) reasons.push('Policy number mismatch');
                    if (!customerNameMatch) reasons.push('Customer name mismatch');

                    await logRef.update({
                        stage: 'completed',
                        message: `Verification failed: ${reasons.join(', ')}`,
                        policyNumberMatch,
                        customerNameMatch,
                        verificationPassed: false,
                        failureReasons: reasons,
                        completedAt: Date.now(),
                        status: 'error'
                    });

                    console.log(`❌ Policy ${policyId} verification failed: ${reasons.join(', ')}`);
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
                const dataBuffer = fs.readFileSync(tempFilePath);

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
└─ Action: ❌ SKIP - Not needed

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
Col 4:  "14/02/2025" → SKIP (D.o.C - not needed)
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

                const response = await geminiClient.models.generateContent({
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
                    const jsonStr = responseText.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
                    policies = JSON.parse(jsonStr);

                    // LOG PARSED JSON FOR DEBUGGING
                    console.log('=== GEMINI EXTRACTED POLICIES ===');
                    console.log(JSON.stringify(policies, null, 2));
                    console.log(`=== Total: ${policies.length} policies ===`);
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
                            batch.set(docRef, {
                                id: docRef.id,
                                policyNumber: p.policyNumber,
                                customerName: p.customerName,
                                mod: p.mod,
                                fup: p.fup,
                                amount: parseFloat(p.amount),
                                commission: parseFloat(p.commission || 0),
                                dueDate: '2025-12-31',
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
