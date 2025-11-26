const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const os = require('os');
const path = require('path');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();
const client = new vision.ImageAnnotatorClient();

// OCR Verification Function
exports.verifyReceipt = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name;

    if (!filePath.startsWith('receipts/')) return;

    const bucketName = object.bucket;
    const fileUri = `gs://${bucketName}/${filePath}`;

    try {
        const [result] = await client.textDetection(fileUri);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) return;

        const fullText = detections[0].description;

        // Extract policy number (9 digits or P-format)
        const policyRegex = /P\d{5,}/;
        const policyMatch = fullText.match(policyRegex) || fullText.match(/\b\d{9}\b/);

        if (!policyMatch) return;

        const policyNumber = policyMatch[0];

        // Extract customer name
        const nameRegex = /\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?(?:\s+[A-Z]{2,})?)\b/g;
        const nameMatches = fullText.match(nameRegex);

        // Query policies by policy number
        const policiesRef = db.collection('policies');
        const snapshot = await policiesRef.where('policyNumber', '==', policyNumber).get();

        if (!snapshot.empty) {
            const policyDoc = snapshot.docs[0];
            const policyData = policyDoc.data();

            // Verify customer name matches
            let nameVerified = false;
            if (nameMatches) {
                const customerNameUpper = policyData.customerName.toUpperCase();
                nameVerified = nameMatches.some(name => {
                    const extractedName = name.trim().toUpperCase();
                    return extractedName === customerNameUpper ||
                        customerNameUpper.includes(extractedName) ||
                        extractedName.includes(customerNameUpper);
                });
            }

            if (nameVerified) {
                await policyDoc.ref.update({
                    status: 'verified',
                    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                    ocrText: fullText,
                    verificationMethod: 'ocr-auto'
                });
                console.log(`Policy ${policyNumber} auto-verified (name matched: ${policyData.customerName})`);
            } else {
                await policyDoc.ref.update({
                    status: 'pending-review',
                    ocrText: fullText,
                    verificationMethod: 'ocr-failed-name-mismatch',
                    ocrExtractedNames: nameMatches
                });
                console.log(`Policy ${policyNumber} requires manual review (name mismatch)`);
            }
        }
    } catch (error) {
        console.error('Error processing receipt:', error);
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

        try {
            await bucket.file(filePath).download({ destination: tempFilePath });
            const dataBuffer = fs.readFileSync(tempFilePath);

            // Initialize Gemini 2.5 Flash
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

            const pdfBase64 = dataBuffer.toString('base64');

            const prompt = `Extract ALL policy information from this LIC Premium Due List PDF.

RULES:
1. IGNORE headers (Branch Code, Agent Name, column headers)
2. Extract: policyNumber (9 digits), customerName, mod (Qly/Hly/Yly), fup (MM/YYYY), amount (TotPrem), commission (EstCom - last column)
3. Return ONLY JSON array, no markdown

Example:
[{"policyNumber":"508815995","customerName":"CHHABI DAS","mod":"Qly","fup":"05/2025","amount":2865.00,"commission":1599.00}]`;

            console.log('Sending PDF to Gemini 2.5 Flash...');

            const response = await ai.models.generateContent({
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

            console.log('Gemini response received');
            const responseText = response.text;
            console.log('Response (first 500 chars):', responseText.substring(0, 500));

            // Parse JSON
            let policies = [];
            try {
                const jsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                policies = JSON.parse(jsonStr);
                console.log(`Gemini extracted ${policies.length} policies`);
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
                const batch = db.batch();
                validPolicies.forEach(p => {
                    const docRef = db.collection('policies').doc();
                    batch.set(docRef, {
                        id: docRef.id,  // Add document ID
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
                console.log(`✅ Created ${validPolicies.length} policies`);
            } else {
                console.log('⚠️ No valid policies found');
            }

            fs.unlinkSync(tempFilePath);

        } catch (error) {
            console.error('Error with Gemini:', error);
            if (error.message) console.error('Message:', error.message);
        }
    });
