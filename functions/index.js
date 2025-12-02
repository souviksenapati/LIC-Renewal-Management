const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const os = require('os');
const path = require('path');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();
const client = new vision.ImageAnnotatorClient();

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

            await bucket.file(filePath).download({ destination: tempFilePath });
            const imageBuffer = fs.readFileSync(tempFilePath);
            const imageBase64 = imageBuffer.toString('base64');

            // Initialize Gemini
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

            const response = await ai.models.generateContent({
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

            const responseText = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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

            // Cleanup
            fs.unlinkSync(tempFilePath);

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

            // Update status: parsing with Gemini
            await logRef.update({
                stage: 'parsing',
                message: 'Extracting policy data with AI...',
            });

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

            fs.unlinkSync(tempFilePath);

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
