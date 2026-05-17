console.log("Starting extract.js...");
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use(express.static(__dirname));

const usedCodesPath = path.join(__dirname, 'used_codes.json');
function readUsedCodes() {
    try {
        if (!fs.existsSync(usedCodesPath)) return [];
        const data = fs.readFileSync(usedCodesPath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Failed to read used codes:', e);
        return [];
    }
}
function writeUsedCodes(arr) {
    try {
        fs.writeFileSync(usedCodesPath, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to write used codes:', e);
    }
}

function parseVoucherMessage(text) {
    console.log("📝 Parsing text:", text);

    // 1. Voucher code
    let rawCouponCode = null;
    const codeMatch = text.match(/Voucher code:\s*(\S+)/i);
    if (codeMatch) rawCouponCode = codeMatch[1];

    // 2. Expiry date
    let expiryDate = null;
    const daysMatch = text.match(/Expiring in\s+(\d+)\s+days?/i);
    if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        expiryDate = Math.floor(expiry.getTime() / 1000);
    } else {
        const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        expiryDate = Math.floor(expiry.getTime() / 1000);
    }

    // 3. Price
    let price = null;
    let priceMatch = text.match(/@\s*\D{0,8}(\d+(?:\.\d+)?)/i);
    if (!priceMatch) priceMatch = text.match(/Only at\s*\D{0,8}(\d+(?:\.\d+)?)/i);
    if (!priceMatch) priceMatch = text.match(/(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) price = priceMatch[1];

    // 4. Extract company name – multi‑word support
    let company = null;

    // Pattern 1: "this {multi-word brand} voucher" (capture everything until "voucher")
    let brandMatch = text.match(/this\s+(.+?)\s+voucher/i);
    if (brandMatch) {
        let rawBrand = brandMatch[1].trim();
        // Ensure it's not an empty string and doesn't contain obvious stopwords at the end
        if (rawBrand.length > 0 && !rawBrand.match(/^(only|expiring|voucher|code)$/i)) {
            company = rawBrand;
        }
    }

    // Pattern 2: If no match, look for any line that ends with "voucher" and extract preceding capitalized words
    if (!company) {
        const lines = text.split('\n');
        for (let line of lines) {
            const match = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+voucher/i);
            if (match && match[1]) {
                company = match[1];
                break;
            }
        }
    }

    // Pattern 3: if still no match, look for a capitalized phrase (2+ words) in the first few lines
    if (!company) {
        const firstLines = text.slice(0, 200);
        const multiWordMatch = firstLines.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
        if (multiWordMatch && !multiWordMatch[1].match(/^(Hey|I|Only|Expiring|Voucher|Google|Pay)$/i)) {
            company = multiWordMatch[1];
        }
    }

    // 5. Extract description (product/offer line) – same as before
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    let rawDescription = "";

    const skipKeywords = [
        /hey,/i, /voucher code/i, /expiring in/i, /@\s*(?:₹|Rs\.?|INR)/i, /only at\s*(?:₹|Rs\.?|INR)/i,
        /https?:\/\//i, /utm_/i, /google pay/i, /acwo/i, /tecsox/i
    ];
    if (company) skipKeywords.push(new RegExp(company.replace(/\s+/g, '\\s*'), 'i'));

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let skip = false;
        for (const pattern of skipKeywords) {
            if (pattern.test(line)) {
                skip = true;
                break;
            }
        }
        if (skip) continue;
        if (line.match(/^[\d\s]+$/) || /(?:₹|Rs\.?|INR)/i.test(line)) continue;
        if (line.length > 10 && !line.includes('http')) {
            rawDescription = line;
            break;
        }
    }

    if (!rawDescription) {
        for (let i = 0; i < lines.length; i++) {
            if (/@\s*(?:₹|Rs\.?|INR)|Only at\s*(?:₹|Rs\.?|INR)/i.test(lines[i])) {
                if (i + 1 < lines.length) {
                    rawDescription = lines[i+1];
                    break;
                }
            }
        }
    }
    if (!rawDescription) rawDescription = "Voucher offer";

    // Final description: prefix with #company# only if company was found
    let finalDescription = rawDescription;
    if (company) {
        finalDescription = `#${company}# ${rawDescription}`;
    }

    const issueDate = Math.floor(Date.now() / 1000);
    const sellerWallet = process.env.SELLER_WALLET || "0xYourSellerWalletAddress";

    if (!rawCouponCode || !price) {
        throw new Error(`Missing required fields. Code: ${rawCouponCode}, Price: ${price}`);
    }

    const result = {
        rawCouponCode,
        description: finalDescription.substring(0, 100),
        expiryDate,
        issueDate,
        price: parseFloat(price).toFixed(1),
        sellerWallet
    };
    if (company) result.company = company;
    return result;
}

app.post('/parse-voucher', (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: "Missing 'text' field in request body" });
        }
        const result = parseVoucherMessage(text);
        // check whether the extracted code was already used or put on sale
        const used = readUsedCodes();
        const codeKey = (result.rawCouponCode || '').toString().trim().toLowerCase();
        if (codeKey && used.includes(codeKey)) {
            return res.status(422).json({ error: 'Invalid coupon: it was already used or put on sale' });
        }
        res.json(result);
    } catch (err) {
        res.status(422).json({ error: err.message });
    }
});

// Endpoint to mark a code as used / put on sale
app.post('/mark-used', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing code field' });
        const key = code.toString().trim().toLowerCase();
        const used = readUsedCodes();
        if (!used.includes(key)) {
            used.push(key);
            writeUsedCodes(used);
        }
        res.json({ success: true, code: key });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to unmark a code (for testing / revoke)
app.post('/unmark-used', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Missing code field' });
        const key = code.toString().trim().toLowerCase();
        let used = readUsedCodes();
        used = used.filter(c => c !== key);
        writeUsedCodes(used);
        res.json({ success: true, code: key });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
