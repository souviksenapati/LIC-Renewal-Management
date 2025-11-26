const functions = require('firebase-functions');
const admin = require('firebase-admin');
const vision = require('@google-cloud/vision');
const pdf = require('pdf-parse');
const os = require('os');
const path = require('path');
const fs = require('fs');

// admin.initializeApp(); // Already initialized in index.js usually, but if this is separate file...
// Assuming this is appended to index.js or imported. 
// For simplicity in this environment, I will rewrite index.js to include both.

exports.processPdfUpload = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name;

    // Only process files in 'policy-uploads/' folder
    if (!filePath.startsWith('policy-uploads/') || !filePath.endsWith('.pdf')) {
        return console.log('Not a policy PDF.');
    }

    const bucket = admin.storage().bucket(object.bucket);
    const fileName = path.basename(filePath);
    const tempFilePath = path.join(os.tmpdir(), fileName);

    try {
        // Download file
        await bucket.file(filePath).download({ destination: tempFilePath });

        // Read file
        const dataBuffer = fs.readFileSync(tempFilePath);

        // Parse PDF
        const data = await pdf(dataBuffer);
        const text = data.text;

        // Extract Policies using Regex
        // Based on image: S.No PolicyNo Name ...
        // Regex to find lines starting with a number, then a 9-digit policy number
        // Example: 1 508815995 CHHABI DAS ...

        const lines = text.split('\n');
        const policies = [];

        // Regex explanation:
        // ^\s*\d+\s+ -> Start with number (S.No)
        // (\d{9}) -> Capture 9 digit Policy No
        // \s+ -> space
        // ([A-Z\s]+?) -> Capture Name (Lazy)
        // \s+\d{2}\/\d{2}\/\d{4} -> Date (D.o.C) - skip
        // ... skip to Premium ...
        // We might need a simpler approach if columns are fixed width or just grab what looks like a policy.

        // Let's try a robust regex for the provided format
        // 1 508815995 CHHABI DAS 14/02/2025 736/25 Qly 05/2025 FY 2665.00

        const policyRegex = /(\d{9})\s+([A-Z\s]+?)\s+\d{2}\/\d{2}\/\d{4}.*?([QHY]ly)\s+(\d{2}\/\d{4})\s+[A-Z]{2}\s+([\d\.]+)/;

        for (const line of lines) {
            const match = line.match(policyRegex);
            if (match) {
                // match[1] = PolicyNo
                // match[2] = Name
                // match[3] = Mod (Qly)
                // match[4] = FUP (05/2025)
                // match[5] = InstPrem (We might want TotPrem, but let's take InstPrem for now or try to find TotPrem at end)

                // Actually, looking at image: InstPrem is before GST. TotPrem is near end.
                // Let's just grab the first amount found after FUP as "Amount" for now, usually InstPrem.

                policies.push({
                    policyNumber: match[1],
                    customerName: match[2].trim(),
                    mod: match[3],
                    fup: match[4],
                    amount: parseFloat(match[5]),
                    dueDate: '2025-12-31', // Placeholder, should calculate from FUP
                    status: 'pending',
                    createdAt: Date.now()
                });
            }
        }

        // Batch write to Firestore
        const batch = db.batch();
        policies.forEach(p => {
            const docRef = db.collection('policies').doc(); // Auto ID
            batch.set(docRef, p);
        });

        await batch.commit();
        console.log(`Successfully created ${policies.length} policies from PDF.`);

        // Cleanup
        fs.unlinkSync(tempFilePath);

    } catch (error) {
        console.error('Error processing PDF:', error);
    }
});
