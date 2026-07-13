require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbRun, dbGet, dbAll } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-caferouge';

app.use(cors());
app.use(express.json());

// Serve static frontend files from this directory
app.use(express.static(path.join(__dirname)));

// Helper: JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ----------------- AUTHENTICATION ENDPOINTS -----------------

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, phone]
    );

    const token = jwt.sign({ id: result.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, email, name, phone } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, email, name: user.name, phone: user.phone }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile & subscription details
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, email, name, phone FROM users WHERE id = ?', [req.user.id]);
    const subscription = await dbGet('SELECT tier, status, next_billing_date FROM subscriptions WHERE user_id = ?', [req.user.id]);
    res.json({ user, subscription: subscription || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------- EAZYPAY PAYMENT & SUBSCRIPTION ENDPOINTS -----------------

// Create Hosted Session
app.post('/api/payment/session', authenticateToken, async (req, res) => {
  const merchantId = process.env.EAZYPAY_MERCHANT_ID;
  const apiPassword = process.env.EAZYPAY_API_PASSWORD;
  const isDemoMode = !merchantId || merchantId === 'TEST_YOUR_MERCHANT_ID' || !apiPassword;

  if (isDemoMode) {
    // Simulator Mode: Return mock session id
    const mockSessionId = 'SESSION_SIM_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    return res.json({ session: { id: mockSessionId }, mode: 'simulator', merchant: 'TEST_YOUR_MERCHANT_ID' });
  }

  // Real Integration Mode
  try {
    const gatewayUrl = `${process.env.EAZYPAY_GATEWAY_URL}/v${process.env.EAZYPAY_API_VERSION}/merchant/${merchantId}/session`;
    const basicAuth = Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64');
    
    // Dynamic import to use node native fetch if available
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          authenticationLimit: 25
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.explanation || 'Failed to create session');
    res.json({ ...data, merchant: merchantId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subscribe (Initial CIT Transaction & Card Storage)
app.post('/api/payment/subscribe', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const tier = 'VIP Member';
  const price = 27.00;

  const merchantId = process.env.EAZYPAY_MERCHANT_ID;
  const apiPassword = process.env.EAZYPAY_API_PASSWORD;
  const isDemoMode = !merchantId || merchantId === 'TEST_YOUR_MERCHANT_ID' || !apiPassword;

  // Next billing date (30 days from now)
  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + 30);
  const nextBillingStr = nextBilling.toISOString().split('T')[0];

  if (isDemoMode) {
    // Simulator Mode: Mock successful subscription
    try {
      const mockToken = 'tok_sim_' + Math.random().toString(36).substring(2, 12);
      const agreementId = 'agr_sim_' + Math.random().toString(36).substring(2, 10);
      
      // Upsert Subscription
      await dbRun(`
        INSERT INTO subscriptions (user_id, status, price, tier, gateway_token, agreement_id, next_billing_date)
        VALUES (?, 'active', ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
          status = 'active', price = excluded.price, tier = excluded.tier,
          gateway_token = excluded.gateway_token, agreement_id = excluded.agreement_id,
          next_billing_date = excluded.next_billing_date, updated_at = CURRENT_TIMESTAMP
      `, [req.user.id, price, tier, mockToken, agreementId, nextBillingStr]);

      return res.json({
        success: true,
        message: 'Successfully subscribed (Simulated Gateway)',
        subscription: { tier, status: 'active', next_billing_date: nextBillingStr }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Real Integration Mode: Process Mastercard Gateway CIT Order
  try {
    const orderId = 'ORD_' + Date.now();
    const transactionId = 'TXN_CIT_' + Date.now();
    const gatewayUrl = `${process.env.EAZYPAY_GATEWAY_URL}/v${process.env.EAZYPAY_API_VERSION}/merchant/${merchantId}/order/${orderId}/transaction/${transactionId}`;
    const basicAuth = Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64');
    
    // We send a CIT transaction indicating to tokenise and store this card for future recurring transactions.
    const payload = {
      apiOperation: 'PAY',
      session: {
        id: sessionId
      },
      order: {
        amount: price,
        currency: 'BHD',
        description: `Cafe Rouge Membership - ${tier}`
      },
      // Stored Credentials fields (Cardholder Initiated Transaction)
      transaction: {
        source: 'INTERNET'
      },
      sourceOfFunds: {
        type: 'CARD',
        provided: {
          card: {
            storedOnFile: 'TO_BE_STORED'
          }
        }
      },
      agreement: {
        type: 'RECURRING',
        id: 'AGR_' + Math.random().toString(36).substring(2, 10).toUpperCase()
      }
    };

    const response = await fetch(gatewayUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.explanation || 'Transaction failed');

    // Confirm that the transaction was captured and successfully authorized
    if (data.response?.gatewayCode === 'APPROVED') {
      const cardToken = data.sourceOfFunds?.provided?.card?.token || 'tok_dummy_' + Math.random().toString(36).substring(2, 10);
      const agreementId = payload.agreement.id;

      // Save Subscription in DB
      await dbRun(`
        INSERT INTO subscriptions (user_id, status, price, tier, gateway_token, agreement_id, next_billing_date)
        VALUES (?, 'active', ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
          status = 'active', price = excluded.price, tier = excluded.tier,
          gateway_token = excluded.gateway_token, agreement_id = excluded.agreement_id,
          next_billing_date = excluded.next_billing_date, updated_at = CURRENT_TIMESTAMP
      `, [req.user.id, price, tier, cardToken, agreementId, nextBillingStr]);

      res.json({
        success: true,
        message: 'Successfully subscribed',
        subscription: { tier, status: 'active', next_billing_date: nextBillingStr }
      });
    } else {
      res.status(400).json({ error: 'Card transaction was not approved: ' + (data.response?.gatewayCode || 'Declined') });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback to index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Cafe Rouge server running at http://localhost:${PORT}`);
  console.log(`Local development database location: ./database.sqlite`);
});
