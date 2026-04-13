/**
 * Appwrite Service Client
 * Handles: Authentication, User Management, KYC Storage
 * Dev mode uses in-memory mock
 */
import { Client, Account, Databases, Users, Storage, ID, Query } from 'node-appwrite';

// In-memory storage for development
const devMode = process.env.NODE_ENV === 'development' && !process.env.APPWRITE_PROJECT_ID?.includes('http');
const otpStore = new Map();
const userStore = new Map();

// Initialize Appwrite client (server-side with API key)
let client, users, databases, storage;

if (!devMode) {
  client = new Client();
  client
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  users = new Users(client);
  databases = new Databases(client);
  storage = new Storage(client);
}

const DB_ID = process.env.APPWRITE_DB_ID || 'crikex_db';
const USERS_COLLECTION = 'users_profile';
const OTP_COLLECTION = 'otp_records';

// ═══════ AUTHENTICATION ═══════

/**
 * Send OTP to phone number via Appwrite + Twilio
 * In production: Appwrite handles SMS delivery via Twilio provider
 * In development: Uses in-memory storage
 */
export async function sendOtp(phone) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpRef = ID.unique().slice(0, 8);
  const expiresAt = new Date(Date.now() + 300000).toISOString(); // 5 min

  const otpData = {
    phone,
    otp,
    otpRef,
    expiresAt,
    attempts: 0,
    verified: false,
  };

  if (devMode) {
    // Dev mode: Store in memory
    otpStore.set(otpRef, otpData);
    console.log(`[OTP DEV] ${phone} → ${otp} (ref: ${otpRef})`);
  } else {
    // Production: Store OTP in Appwrite database
    await databases.createDocument(DB_ID, OTP_COLLECTION, ID.unique(), otpData);

    // In production: Send SMS via Twilio
    if (process.env.TWILIO_ACCOUNT_SID) {
      const twilioClient = await import('twilio').then(m =>
        m.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      );
      await twilioClient.messages.create({
        body: `Your CrikeX OTP is: ${otp}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    } else {
      console.log(`[OTP DEV] ${phone} → ${otp} (ref: ${otpRef})`);
    }
  }

  return {
    otpRef,
    message: 'OTP sent successfully',
    hint_dev: process.env.NODE_ENV !== 'production' ? otp : undefined,
  };
}

/**
 * Verify OTP and create/return user session
 */
export async function verifyOtp(otpRef, otp, stateCode = 'IN-MH') {
  let record;

  if (devMode) {
    // Dev mode: Retrieve from memory
    record = otpStore.get(otpRef);
    if (!record) {
      throw new Error('INVALID_OTP_REF');
    }
  } else {
    // Production: Retrieve from Appwrite
    const records = await databases.listDocuments(DB_ID, OTP_COLLECTION, [
      Query.equal('otpRef', otpRef),
      Query.equal('verified', false),
    ]);

    if (records.documents.length === 0) {
      throw new Error('INVALID_OTP_REF');
    }
    record = records.documents[0];
  }

  // Check expiry
  if (new Date() > new Date(record.expiresAt)) {
    if (devMode) {
      otpStore.delete(otpRef);
    } else {
      await databases.deleteDocument(DB_ID, OTP_COLLECTION, record.$id);
    }
    throw new Error('OTP_EXPIRED');
  }

  // Check attempts
  if (record.attempts >= 3) {
    if (devMode) {
      otpStore.delete(otpRef);
    } else {
      await databases.deleteDocument(DB_ID, OTP_COLLECTION, record.$id);
    }
    throw new Error('TOO_MANY_ATTEMPTS');
  }

  // Increment attempts
  record.attempts += 1;
  if (devMode) {
    otpStore.set(otpRef, record);
  } else {
    await databases.updateDocument(DB_ID, OTP_COLLECTION, record.$id, {
      attempts: record.attempts,
    });
  }

  // Verify OTP
  if (record.otp !== otp) {
    throw new Error('WRONG_OTP');
  }

  // Mark as verified
  record.verified = true;
  if (devMode) {
    otpStore.set(otpRef, record);
  } else {
    await databases.updateDocument(DB_ID, OTP_COLLECTION, record.$id, {
      verified: true,
    });
  }

  // Find or create user
  let userProfile = null;
  const userKey = `user_${record.phone}`;

  if (devMode) {
    // Dev mode: Use memory
    userProfile = userStore.get(userKey);
    if (!userProfile) {
      userProfile = {
        $id: ID.unique(),
        appwriteUserId: ID.unique(),
        phone: record.phone,
        username: `Player${Date.now().toString(36)}`,
        role: 'user',
        kycStatus: 'pending',
        stateCode: stateCode,
        isBlocked: false,
        referralCode: generateReferralCode(),
        isNewUser: true,
      };
      userStore.set(userKey, userProfile);
    }
  } else {
    // Production: Use Appwrite
    const existingUsers = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
      Query.equal('phone', record.phone),
    ]);

    if (existingUsers.documents.length > 0) {
      userProfile = existingUsers.documents[0];
    } else {
      // Create new user in Appwrite Users
      const appwriteUser = await users.create(
        ID.unique(),
        undefined, // email
        record.phone,
        undefined, // password
        `Player${Date.now().toString(36)}`
      );

      // Create user profile document
      userProfile = await databases.createDocument(DB_ID, USERS_COLLECTION, ID.unique(), {
        appwriteUserId: appwriteUser.$id,
        phone: record.phone,
        username: appwriteUser.name,
        role: 'user',
        kycStatus: 'pending',
        stateCode: stateCode,
        isBlocked: false,
        referralCode: generateReferralCode(),
        isNewUser: true,
      });
    }
  }

  return {
    user: {
      id: userProfile.$id,
      appwriteId: userProfile.appwriteUserId,
      phone: userProfile.phone,
      username: userProfile.username,
      role: userProfile.role,
      kycStatus: userProfile.kycStatus,
      stateCode: userProfile.stateCode,
    },
    isNewUser: userProfile.isNewUser || false,
  };
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId) {
  const profile = await databases.getDocument(DB_ID, USERS_COLLECTION, userId);
  return {
    id: profile.$id,
    appwriteId: profile.appwriteUserId,
    phone: profile.phone,
    username: profile.username,
    role: profile.role,
    kycStatus: profile.kycStatus,
    stateCode: profile.stateCode,
    isBlocked: profile.isBlocked,
    referralCode: profile.referralCode,
  };
}

/**
 * List all users (admin)
 */
export async function listUsers(limit = 100, offset = 0) {
  const result = await databases.listDocuments(DB_ID, USERS_COLLECTION, [
    Query.limit(limit),
    Query.offset(offset),
    Query.orderDesc('$createdAt'),
  ]);
  return result.documents.map(d => ({
    id: d.$id,
    phone: d.phone,
    username: d.username,
    role: d.role,
    kycStatus: d.kycStatus,
    isBlocked: d.isBlocked,
  }));
}

/**
 * Upload KYC document
 */
export async function uploadKycDocument(userId, fileBuffer, fileName) {
  const BUCKET_ID = process.env.APPWRITE_KYC_BUCKET || 'kyc_documents';
  const file = await storage.createFile(BUCKET_ID, ID.unique(), fileBuffer, fileName);
  return file.$id;
}

/**
 * Block/unblock user
 */
export async function toggleBlockUser(userId) {
  const profile = await databases.getDocument(DB_ID, USERS_COLLECTION, userId);
  await databases.updateDocument(DB_ID, USERS_COLLECTION, userId, {
    isBlocked: !profile.isBlocked,
  });
  return { isBlocked: !profile.isBlocked };
}

// ═══════ HELPERS ═══════

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'CX';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export default {
  sendOtp,
  verifyOtp,
  getUserProfile,
  listUsers,
  uploadKycDocument,
  toggleBlockUser,
};
