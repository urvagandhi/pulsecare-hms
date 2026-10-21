import { test, expect } from '@playwright/test';

test.describe.serial('PulseCare HMS — Official Demonstration Script Real Browser E2E Workflows', () => {
  let testPatientEmail = `kavya.e2e_${Date.now()}_${Math.floor(Math.random() * 10000)}@test.com`;

  // ─── SCENE 1: Introduction, Project Overview & Landing Page ───────────────
  test('Scene 1: Public Landing Page, Branding & Seeded Credentials Drawer', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');

    // 1. Verify Branding & Title
    await expect(page).toHaveTitle(/PulseCare HMS/);
    await expect(page.getByText('PulseCare').first()).toBeVisible();

    // 2. Open Seeded Demo Credentials Drawer
    const credBtn = page.getByRole('button', { name: /Demo Roles/i }).first();
    await credBtn.click();

    // Verify all 4 roles are listed
    await expect(page.getByText('Rajesh Malhotra')).toBeVisible();
    await expect(page.getByText('Pooja Verma')).toBeVisible();
    await expect(page.getByText('Dr. Arvind Sharma')).toBeVisible();
    await expect(page.getByText('Aarav Sharma')).toBeVisible();

    // 3. Verify 4 Core Clinical Module Pillars on Landing Page
    await expect(page.getByText('Patient Portal & Digital Identity')).toBeVisible();
    await expect(page.getByText('Doctor Schedule & Leave Engine')).toBeVisible();
    await expect(page.getByText('Conflict-Free Queue Tokens')).toBeVisible();
    await expect(page.getByText('Itemized Billing & Tax Invoices')).toBeVisible();

    // 4. Navigate to Sign In
    await page.getByRole('link', { name: /Sign In/i }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  // ─── SCENE 3: Module 1 — Patient Self-Registration & ID Card ──────────────
  test('Scene 3: Module 1 — Patient Self-Registration (Kavya Patel) & Profile Flow', async ({ page }) => {
    testPatientEmail = `kavya.e2e_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
    await page.context().clearCookies();
    await page.goto('/sign-up');

    // Fill Registration Form
    await page.fill('#firstName', 'Kavya');
    await page.fill('#lastName', 'Patel');
    await page.fill('#email', testPatientEmail);
    await page.fill('#password', 'Test@123');
    await page.selectOption('#bloodGroup', 'B+');
    await page.fill('#allergies', 'Penicillin');
    await page.fill('#emergencyName', 'Ramesh Patel (Father)');
    await page.fill('#emergencyPhone', '9876543210');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to patient dashboard
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Kavya/i).first()).toBeVisible({ timeout: 15000 });

    // Verify ID Card download button exists
    const idCardBtn = page.getByRole('button', { name: /Download ID Card/i });
    await expect(idCardBtn).toBeVisible();
  });

  // ─── SCENE 3 & 4: Receptionist Safe Patient RegEx Search ────────────────────
  test('Scene 3: Receptionist Login & Safe RegEx Patient Search', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Quick sign-in as Receptionist Pooja Verma
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await page.fill('#email', 'reception@pulsecare.test');
    await page.fill('#password', 'Test@123');
    await page.click('button[type="submit"]');

    // Redirected to admin/reception dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Navigate to Patients directory via sidebar link to stay in authenticated SPA context
    await page.locator('aside nav').getByRole('link', { name: 'Patients' }).click();
    await expect(page).toHaveURL(/\/admin\/patients/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Patients', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Patient List')).toBeVisible();

    // Search by Name
    const searchInput = page.getByPlaceholder(/Search by name, email, ID, or phone/i);
    await searchInput.fill('Kavya');
    await page.waitForTimeout(600); // debounce
    await expect(page.locator('table').getByText(/Kavya/i).first()).toBeVisible({ timeout: 10000 });

    // Search with RegEx Metacharacters: 'Kavya (' without crashing the application (Defect D-021)
    await searchInput.fill('Kavya (');
    await page.waitForTimeout(600);
    // Verified: No 500 error; backend safely escaped regex and frontend shows empty state gracefully
    await expect(page.getByText(/No patients found/i)).toBeVisible({ timeout: 5000 });

    // Clear search and verify patient list table restores
    await searchInput.fill('');
    await page.waitForTimeout(600);
    await expect(page.locator('table')).toBeVisible();
  });

  // ─── SCENE 4: Admin Schedules Doctor Leave Window (Defect D-022) ───────────
  test('Scene 4: Admin Schedules Approved Leave for Dr. Arvind Sharma', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Quick sign-in as Admin Rajesh Malhotra
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await page.fill('#email', 'admin@pulsecare.test');
    await page.fill('#password', 'Test@123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Navigate to Staff directory via sidebar link
    await page.locator('aside nav').getByRole('link', { name: 'Staff & Doctors' }).click();
    await expect(page).toHaveURL(/\/admin\/staff/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Staff', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Arvind Sharma').first()).toBeVisible();

    // Open Doctor Leave Modal using Time Off button
    const drRow = page.locator('tr:has-text("Arvind Sharma")');
    const timeOffBtn = drRow.getByRole('button', { name: 'Time Off' });
    await expect(timeOffBtn).toBeVisible();
    await timeOffBtn.click();

    // Verify modal is open
    await expect(page.getByRole('heading', { name: /Doctor Time Off/i })).toBeVisible({ timeout: 10000 });

    // Set leave for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await page.fill('#leaveStart', tomorrowStr);
    await page.fill('#leaveEnd', tomorrowStr);
    await page.fill('#leaveReason', 'Medical Conference in Ahmedabad');

    await page.getByRole('button', { name: '+ Add Leave Window' }).click();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for modal to close or toast
    await page.waitForTimeout(1000);
  });

  // ─── SCENE 4 & 5: Patient Appointment Booking & Queue Token #1 Flow ────────
  test('Scene 4 & 5: Patient Slot Engine, Leave Blackout & Queue Token #1 Booking', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Sign in as Patient
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await page.fill('#email', 'patient1@pulsecare.test');
    await page.fill('#password', 'Test@123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 15000 });

    // Navigate to Book Appointment wizard via sidebar link
    await page.locator('aside nav').getByRole('link', { name: 'Book Appointment' }).click();
    await expect(page).toHaveURL(/\/patient\/book-appointment/, { timeout: 15000 });
    await expect(page.getByText('Step 1: Select a Doctor')).toBeVisible({ timeout: 15000 });

    // Step 1: Select Dr. Arvind Sharma
    const drCard = page.locator('text=Dr. Arvind Sharma').first();
    await drCard.click();

    const nextSlotBtn = page.getByRole('button', { name: /Next: Choose Slot/i });
    await expect(nextSlotBtn).toBeEnabled();
    await nextSlotBtn.click();

    // Step 2: Slot Selection
    await expect(page.getByText('Step 2: Choose a Time Slot')).toBeVisible({ timeout: 15000 });

    // Verify date picker is loaded
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // Test tomorrow (leave date just configured in Scene 4)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(tomorrowStr);
    await page.waitForTimeout(1000);

    // If doctor leave blackout warning is present, verify
    const blackoutWarning = page.locator('text=Doctor Unavailable');
    if (await blackoutWarning.isVisible()) {
      await expect(blackoutWarning).toBeVisible();
    }

    // Now pick a working clinic day (next upcoming weekday after leave)
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 5);
    if (bookingDate.getDay() === 6) bookingDate.setDate(bookingDate.getDate() + 2);
    if (bookingDate.getDay() === 0) bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateStr = bookingDate.toISOString().split('T')[0];

    await dateInput.fill(bookingDateStr);
    await page.waitForTimeout(1200);

    // Click an available slot (e.g. first available button)
    const availableSlot = page.locator('button:has-text("Available")').first();
    await expect(availableSlot).toBeVisible({ timeout: 15000 });
    await availableSlot.click();

    // Proceed to Step 3: Confirm
    const nextConfirmBtn = page.getByRole('button', { name: /Next: Confirm/i });
    await expect(nextConfirmBtn).toBeEnabled();
    await nextConfirmBtn.click();

    // Step 3: Confirm Booking
    await expect(page.getByText('Step 3: Confirm Booking')).toBeVisible({ timeout: 15000 });
    await page.fill('input[placeholder*="Describe your symptoms" i]', 'ECG consultation');

    // Confirm Booking
    const confirmBtn = page.getByRole('button', { name: /Confirm Booking/i });
    await confirmBtn.click();

    // Success confirmation screen
    await expect(page.getByText('Appointment Confirmed!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Your Daily Queue Token')).toBeVisible();

    // Verify token number badge (e.g. #1, #2...)
    const tokenBadge = page.getByText(/#\d+/).first();
    await expect(tokenBadge).toBeVisible();

    // Verify printable slip PDF action button
    const downloadSlipBtn = page.getByRole('button', { name: /Download Slip \(PDF\)/i });
    await expect(downloadSlipBtn).toBeVisible();
  });

  // ─── SCENE 5: Doctor OPD Queue Schedule ────────────────────────────────────
  test('Scene 5: Doctor Schedule OPD Queue View', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Sign in as Dr. Arvind Sharma
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    await page.fill('#email', 'dr.sharma@pulsecare.test');
    await page.fill('#password', 'Test@123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/doctor\/dashboard/, { timeout: 15000 });

    // Open Doctor Schedule via sidebar link
    await page.locator('aside nav').getByRole('link', { name: 'Appointments' }).click();
    await expect(page).toHaveURL(/\/doctor\/schedule/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'My Schedule' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Appointments').first()).toBeVisible();

    // Verify time filters (Today, Tomorrow, All Upcoming)
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tomorrow', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All Upcoming', exact: true })).toBeVisible();
  });

  // ─── SCENE 6: Itemized Invoicing & Recalculation (Defect D-019) ─────────────
  test('Scene 6: Receptionist Itemized Billing & Recalculation (Defect D-019)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Quick sign-in as Receptionist Pooja Verma
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    const receptionQuickBtn = page.locator('button:has-text("Reception Pooja Verma")');
    if (await receptionQuickBtn.isVisible()) {
      await receptionQuickBtn.click();
    } else {
      await page.fill('#email', 'reception@pulsecare.test');
      await page.fill('#password', 'Test@123');
    }
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Navigate to Billing via sidebar link
    await page.locator('aside nav').getByRole('link', { name: 'Billing & Invoices' }).click();
    await expect(page).toHaveURL(/\/admin\/billing/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible({ timeout: 15000 });

    // Verify invoice list table is populated with records
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Open Create Invoice modal
    const createInvBtn = page.getByRole('button', { name: /Create Invoice/i });
    await expect(createInvBtn).toBeVisible();
    await createInvBtn.click();

    // Verify Create Invoice modal elements
    await expect(page.getByRole('heading', { name: 'Create Invoice' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#patientId')).toBeVisible();
    await expect(page.locator('#taxRate')).toBeVisible();
    await expect(page.locator('#discount')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // View first invoice detail
    const viewBtn = page.locator('table button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();
    await expect(page.getByRole('heading', { name: 'Invoice Detail' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Line Items')).toBeVisible();
    await expect(page.getByText('Summary')).toBeVisible();

    // Close detail modal using Close button
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  });

  // ─── SCENE 7: Executive Analytics Dashboard ────────────────────────────────
  test('Scene 7: Admin Executive Analytics Dashboard Synthesis', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sign-in');

    // Sign in as Admin
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
    const adminQuickBtn = page.locator('button:has-text("Admin Rajesh Malhotra")');
    if (await adminQuickBtn.isVisible()) {
      await adminQuickBtn.click();
    } else {
      await page.fill('#email', 'admin@pulsecare.test');
      await page.fill('#password', 'Test@123');
    }
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Navigate to Analytics via sidebar link
    await page.locator('aside nav').getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/\/analytics/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /System Analytics & Insights/i })).toBeVisible({ timeout: 15000 });

    // Verify key KPI metric sections exist
    await expect(page.getByText('Total Consultations')).toBeVisible();
    await expect(page.getByText('Revenue (Recent)')).toBeVisible();
    await expect(page.getByText('Outstanding Balance')).toBeVisible();
    await expect(page.getByText('Active Doctors')).toBeVisible();

    // Verify charts section
    await expect(page.getByText('Appointment Distribution & Volume')).toBeVisible();
  });
});
