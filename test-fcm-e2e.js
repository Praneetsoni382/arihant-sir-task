// ============================================================
// FCM WEB PUSH NOTIFICATION INTEGRATION TEST SUITE (Section 21 & 24)
// ============================================================

import http from 'http';
import app from './server/dist/app.js';
import { seedStore, deviceRepo, pushPrefRepo } from './server/dist/repositories/inMemoryStore.js';

let server;
const PORT = 5566;

class SessionClient {
  constructor(name) {
    this.name = name;
    this.cookies = [];
  }

  async request(method, path, body = null) {
    const cleanPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
    const url = `http://localhost:${PORT}${cleanPath}`;
    return new Promise((resolve, reject) => {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.cookies.length > 0) {
        headers['Cookie'] = this.cookies.join('; ');
      }

      const req = http.request(
        url,
        {
          method,
          headers,
        },
        (res) => {
          let data = '';
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            this.cookies = setCookie.map((c) => c.split(';')[0]);
          }

          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ status: res.statusCode, data: parsed });
            } catch (err) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );

      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  get(path) {
    return this.request('GET', path);
  }
  post(path, body) {
    return this.request('POST', path, body);
  }
  patch(path, body) {
    return this.request('PATCH', path, body);
  }
  delete(path, body) {
    return this.request('DELETE', path, body);
  }
}

async function runFcmSuite() {
  console.log('====================================================');
  console.log('🚀 EXECUTING FIREBASE CLOUD MESSAGING (FCM) E2E SUITE');
  console.log('====================================================\n');

  await seedStore(true);
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });
  console.log(`[Test Server] Started on port ${PORT}`);

  let passCount = 0;
  let testCount = 0;

  function assert(condition, description) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✔ [PASS] Test ${testCount}: ${description}`);
    } else {
      console.error(`❌ [FAIL] Test ${testCount}: ${description}`);
    }
  }

  try {
    // Test 1: Push Config Endpoint is accessible and returns VAPID configuration
    const anon = new SessionClient('Anonymous');
    const configRes = await anon.get('/push/config');
    assert(
      configRes.status === 200 && configRes.data.success && configRes.data.data.vapidKey !== undefined,
      'Public /api/push/config endpoint provides FCM Web Push configuration'
    );

    // Test 2: Admin Login
    const admin = new SessionClient('Admin');
    const loginAdmin = await admin.post('/auth/login', {
      email: 'admin@company.com',
      password: 'Admin@2024!',
    });
    assert(loginAdmin.status === 200 && loginAdmin.data.data.role === 'admin', 'Admin logs in successfully');

    // Test 3: Create Employee 1 & Employee 2
    const emp1Data = {
      fullName: 'Employee One',
      employeeId: 'EMP-001',
      email: 'emp1@company.com',
      department: 'Engineering',
      designation: 'Staff Engineer',
      password: 'Password@123',
    };
    const emp1Res = await admin.post('/employees', emp1Data);
    const emp1Id = emp1Res.data.data.id;
    assert(emp1Res.status === 201, `Create Employee 1 (ID: ${emp1Id})`);

    const emp2Data = {
      fullName: 'Employee Two',
      employeeId: 'EMP-002',
      email: 'emp2@company.com',
      department: 'Design',
      designation: 'UI Designer',
      password: 'Password@123',
    };
    const emp2Res = await admin.post('/employees', emp2Data);
    const emp2Id = emp2Res.data.data.id;
    assert(emp2Res.status === 201, `Create Employee 2 (ID: ${emp2Id})`);

    // Test 4: Employee 1 Login
    const emp1 = new SessionClient('Employee 1');
    const loginEmp1 = await emp1.post('/auth/login', {
      email: 'emp1@company.com',
      password: 'Password@123',
    });
    assert(loginEmp1.status === 200 && loginEmp1.data.data.id === emp1Id, 'Employee 1 logs in successfully');

    // Test 5: Register Device A for Employee 1
    const regDeviceA = await emp1.post('/push/register', {
      fcmToken: 'fcm_token_emp1_desktop_chrome',
      deviceId: 'dev_emp1_laptop',
      browserName: 'Chrome 125.0',
      userAgent: 'Mozilla/5.0 Mac Chrome',
      permissionStatus: 'granted',
    });
    assert(
      (regDeviceA.status === 200 || regDeviceA.status === 201) && regDeviceA.data.data.isActive === true && regDeviceA.data.data.deviceId === 'dev_emp1_laptop',
      'Register Desktop Device for Employee 1'
    );

    // Test 6: Multi-Device Support: Register Device B for Employee 1
    const regDeviceB = await emp1.post('/push/register', {
      fcmToken: 'fcm_token_emp1_mobile_safari',
      deviceId: 'dev_emp1_phone',
      browserName: 'Safari Mobile',
      userAgent: 'Mozilla/5.0 iPhone Safari',
      permissionStatus: 'granted',
    });
    assert(
      (regDeviceB.status === 200 || regDeviceB.status === 201) && regDeviceB.data.data.isActive === true,
      'Multi-Device Support: Register Mobile Device for Employee 1'
    );

    // Test 7: List Registered Devices
    const devicesRes = await emp1.get('/push/devices');
    assert(
      devicesRes.status === 200 && devicesRes.data.data.length >= 2,
      'Employee 1 lists both active devices'
    );

    // Test 8: Push Notification Preferences (Get and Update)
    const prefRes = await emp1.get('/push/preferences');
    assert(
      prefRes.status === 200 && prefRes.data.data.enabled === true,
      'Retrieve user push preferences'
    );

    const updatePrefRes = await emp1.patch('/push/preferences', {
      categories: {
        taskAssignments: true,
        queries: false,
      },
    });
    assert(
      updatePrefRes.status === 200 && updatePrefRes.data.data.categories.queries === false,
      'Update user push preferences (mute queries)'
    );

    // Test 9: Send Test Push Notification
    const testPushRes = await emp1.post('/push/test', {});
    assert(
      testPushRes.status === 200 && testPushRes.data.data !== undefined && testPushRes.data.data.deviceCount >= 1,
      'Employee 1 dispatches test push notification through Admin SDK'
    );

    // Test 10: Rate Limiting on Test Push (Max 5 requests per 60s per user)
    let rateLimitTriggered = false;
    for (let i = 0; i < 6; i++) {
      const res = await emp1.post('/push/test', {});
      if (res.status === 429) {
        rateLimitTriggered = true;
        break;
      }
    }
    assert(rateLimitTriggered, 'Rate limit enforced: 6th test push attempt within 60s returns HTTP 429');

    // Test 11: Safe Account Switching / Device Token Theft Prevention
    // Simulate Employee 2 using the same browser/token as Employee 1's laptop
    const emp2 = new SessionClient('Employee 2');
    await emp2.post('/auth/login', {
      email: 'emp2@company.com',
      password: 'Password@123',
    });

    const regEmp2Theft = await emp2.post('/push/register', {
      fcmToken: 'fcm_token_emp1_desktop_chrome', // same token
      deviceId: 'dev_emp1_laptop',
      browserName: 'Chrome 125.0',
      permissionStatus: 'granted',
    });
    assert(
      (regEmp2Theft.status === 200 || regEmp2Theft.status === 201) && regEmp2Theft.data.data.userId === emp2Id,
      'Shared machine registration safely transfers token ownership to new authenticated user'
    );

    // Verify Employee 1 no longer has the shared device active
    const emp1DevicesAfterSwitch = await emp1.get('/push/devices');
    const deviceAStillForEmp1 = emp1DevicesAfterSwitch.data.data.find(d => d.deviceId === 'dev_emp1_laptop' && d.isActive);
    assert(
      !deviceAStillForEmp1,
      'Previous user cannot receive notifications on transferred device'
    );

    // Test 12: Admin assigns Solo Task to Employee 1
    // Triggers createNotification which handles push notification delivery asynchronously
    const taskPayload = {
      title: 'Solo Architecture Review',
      description: 'Review the FCM Web Push architecture and service worker.',
      assignmentType: 'solo',
      priority: 'high',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      timezone: 'UTC',
      reminderEnabled: true,
      reminderTimes: ['10:00', '16:00'],
      assignedUserIds: [emp1Id],
    };
    const createTask = await admin.post('/tasks', taskPayload);
    const taskId = createTask.data.data.id;
    assert(createTask.status === 201 && createTask.data.success, 'Admin creates task assigned exclusively to Employee 1');

    // Wait 400ms for async push delivery processing
    await new Promise((r) => setTimeout(r, 400));

    // Test 13: In-App Notification and Push Tracking
    const emp1Notifs = await emp1.get('/notifications');
    const notifsList = emp1Notifs.data.data?.notifications || [];
    const assignedNotif = notifsList.find(n => n.relatedTaskId === taskId || n.taskId === taskId);
    assert(
      assignedNotif && assignedNotif.title.includes('New Task Assigned') && assignedNotif.pushStatus !== undefined,
      'Authoritative Firestore in-app notification created with pushStatus tracked'
    );

    // Test 14: Strict Isolation: Employee 2 must NOT receive notification for Employee 1 task
    const emp2Notifs = await emp2.get('/notifications');
    const emp2List = emp2Notifs.data.data?.notifications || [];
    const emp2HasNotif = emp2List.some(n => n.taskId === taskId);
    assert(
      !emp2HasNotif,
      'Strict User Isolation: Unassigned Employee 2 receives no notification for Employee 1 task'
    );

    // Test 15: Logout with deviceId deactivates device token
    const logoutRes = await emp1.post('/auth/logout', { deviceId: 'dev_emp1_phone' });
    assert(logoutRes.status === 200, 'Employee 1 logs out providing deviceId');

    const phoneDevice = deviceRepo.findByDeviceId('dev_emp1_phone');
    assert(
      phoneDevice && phoneDevice.isActive === false,
      'Device token is deactivated upon logout'
    );

    console.log(`\n====================================================`);
    console.log(`FCM E2E RESULTS: ${passCount}/${testCount} PASSED`);
    console.log(`====================================================\n`);

    await seedStore(true);

    if (passCount !== testCount) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    await seedStore(true);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runFcmSuite();
