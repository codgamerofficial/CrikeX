import Razorpay from 'razorpay';
import crypto from 'crypto';

let configError = false;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('[Razorpay] Keys not configured. Payment endpoints will fail.');
  configError = true;
}

const razorpay = !configError ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
}) : null;

/**
 * Create a new Razorpay order for user deposit
 */
export async function createOrder(amount, currency = 'INR', receiptId) {
  if (configError) throw new Error('Razorpay not configured on server');

  const options = {
    amount: amount * 100, // Amount in paisa
    currency,
    receipt: receiptId,
    payment_capture: 1, // auto capture
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('[Razorpay] Create order failed:', error);
    throw new Error('Payment gateway error');
  }
}

/**
 * Verify Razorpay webhook or client signature
 */
export function verifySignature(orderId, paymentId, signature) {
  if (configError) return false;

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
}

export default razorpay;
