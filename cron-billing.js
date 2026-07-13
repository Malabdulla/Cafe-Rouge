require('dotenv').config();
const { dbGet, dbAll, dbRun } = require('./db');

// Run automated recurring billing cycle
async function runBillingCycle() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[Billing Cycle] Starting cycle for date: ${today}`);

  try {
    // Find all active subscriptions that are due for billing today or earlier
    const dueSubscriptions = await dbAll(
      `SELECT s.*, u.email, u.name 
       FROM subscriptions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.status = 'active' AND s.next_billing_date <= ?`,
      [today]
    );

    console.log(`[Billing Cycle] Found ${dueSubscriptions.length} subscriptions due for billing.`);

    for (const sub of dueSubscriptions) {
      console.log(`[Billing Cycle] Processing user ${sub.email} (${sub.name}) for tier "${sub.tier}"...`);
      await processSubscriptionRenewal(sub);
    }

    console.log('[Billing Cycle] Cycle completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Billing Cycle] Error during cycle:', error);
    process.exit(1);
  }
}

// Process single renewal transaction
async function processSubscriptionRenewal(sub) {
  const merchantId = process.env.EAZYPAY_MERCHANT_ID;
  const apiPassword = process.env.EAZYPAY_API_PASSWORD;
  const isDemoMode = !merchantId || merchantId === 'TEST_YOUR_MERCHANT_ID' || !apiPassword;

  // New billing date (add 30 days)
  const nextBilling = new Date();
  nextBilling.setDate(nextBilling.getDate() + 30);
  const nextBillingStr = nextBilling.toISOString().split('T')[0];

  if (isDemoMode) {
    // Simulator Mode
    console.log(`[Billing Cycle] SIMULATOR: Charging stored card token "${sub.gateway_token}" for BHD ${sub.price.toFixed(3)}...`);
    
    // Update DB
    await dbRun(
      `UPDATE subscriptions 
       SET next_billing_date = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nextBillingStr, sub.id]
    );
    console.log(`[Billing Cycle] SIMULATOR: Renewal successful. Next billing set to ${nextBillingStr}.`);
    return;
  }

  // Real Integration Mode: Process Mastercard Gateway MIT Order
  try {
    const orderId = 'ORD_MIT_' + Date.now();
    const transactionId = 'TXN_MIT_' + Date.now();
    const gatewayUrl = `${process.env.EAZYPAY_GATEWAY_URL}/v${process.env.EAZYPAY_API_VERSION}/merchant/${merchantId}/order/${orderId}/transaction/${transactionId}`;
    const basicAuth = Buffer.from(`merchant.${merchantId}:${apiPassword}`).toString('base64');
    
    // We send an MIT transaction using the stored card token
    const payload = {
      apiOperation: 'PAY',
      order: {
        amount: sub.price,
        currency: 'BHD',
        description: `Cafe Rouge Membership Renewal - ${sub.tier}`
      },
      // Stored Credentials fields (Merchant Initiated Transaction)
      transaction: {
        source: 'MERCHANT'
      },
      sourceOfFunds: {
        type: 'CARD',
        provided: {
          card: {
            // Reference the stored token instead of raw card details
            token: sub.gateway_token,
            storedOnFile: 'STORED'
          }
        }
      },
      agreement: {
        type: 'RECURRING',
        id: sub.agreement_id
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

    if (response.ok && data.response?.gatewayCode === 'APPROVED') {
      // Payment Successful
      await dbRun(
        `UPDATE subscriptions 
         SET next_billing_date = ?, status = 'active', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [nextBillingStr, sub.id]
      );
      console.log(`[Billing Cycle] Renewal successful for ${sub.email}. Next billing: ${nextBillingStr}.`);
    } else {
      // Payment Declined / Error
      console.warn(`[Billing Cycle] Renewal DECLINED/FAILED for ${sub.email}: ${data.response?.gatewayCode || 'Error'}`);
      
      // Update status to past_due
      await dbRun(
        `UPDATE subscriptions 
         SET status = 'past_due', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [sub.id]
      );
    }
  } catch (error) {
    console.error(`[Billing Cycle] Connection error renewing ${sub.email}:`, error);
    // Mark as past_due on error
    await dbRun(
      `UPDATE subscriptions 
       SET status = 'past_due', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [sub.id]
    ).catch(err => console.error('Failed to update sub status on error:', err));
  }
}

// Run the script
runBillingCycle();
