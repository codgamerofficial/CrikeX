/**
 * Global Setup for E2E Tests
 * Creates test users and seeds database
 */

const API_URL = process.env.PLAYWRIGHT_TEST_API_URL || 'http://localhost:3000/api/v1';

async function globalSetup() {
  console.log('🧪 E2E Test Setup: Creating test users and seeding database...');

  try {
    // Wait for API to be ready
    let apiReady = false;
    let attempts = 0;
    while (!apiReady && attempts < 30) {
      try {
        const response = await fetch(`${API_URL.replace('/api/v1', '')}/api/health`);
        if (response.ok) {
          apiReady = true;
          console.log('✅ API is ready');
        }
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!apiReady) {
      throw new Error('API did not start in time');
    }

    // Create test user for auth tests
    const testUser = {
      phone: '+919876543210',
      password: 'TestPass@123',
      name: 'Test User',
      email: 'test@crikex.app',
    };

    console.log('📝 Test credentials created:');
    console.log(`   Phone: ${testUser.phone}`);
    console.log(`   Email: ${testUser.email}`);

    // Store test credentials in process.env for tests to use
    process.env.TEST_USER_PHONE = testUser.phone;
    process.env.TEST_USER_PASSWORD = testUser.password;
    process.env.TEST_USER_EMAIL = testUser.email;
    process.env.API_URL = API_URL;

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

export default globalSetup;
