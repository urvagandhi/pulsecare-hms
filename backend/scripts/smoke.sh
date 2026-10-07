#!/usr/bin/env bash
# ==============================================================================
# PulseCare HMS — API Smoke Test Suite
# Tests all 4 core modules end-to-end against a running API server.
# Usage:
#   API_URL=http://localhost:5000 bash backend/scripts/smoke.sh
# ==============================================================================

set -euo pipefail

API_URL="${API_URL:-http://localhost:5000/api/v1}"
PASSED=0
FAILED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass() {
  echo -e "  [${GREEN}PASS${NC}] $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo -e "  [${RED}FAIL${NC}] $1: $2"
  FAILED=$((FAILED + 1))
}

section() {
  echo -e "\n${BLUE}==== $1 ====${NC}"
}

echo "🏥 Starting PulseCare HMS Smoke Tests against: $API_URL"

# ------------------------------------------------------------------------------
# 1. Health check
# ------------------------------------------------------------------------------
section "1. System Health Check"
HEALTH_RES=$(curl -s -w "\n%{http_code}" "$API_URL/../health" || curl -s -w "\n%{http_code}" "$API_URL/health" || echo "FAIL\n500")
HEALTH_CODE=$(echo "$HEALTH_RES" | tail -n 1)

if [[ "$HEALTH_CODE" == "200" ]]; then
  pass "Health endpoint is reachable (HTTP $HEALTH_CODE)"
else
  fail "Health check" "Expected HTTP 200, got $HEALTH_CODE"
fi

# ------------------------------------------------------------------------------
# 2. Authentication for each seeded role
# ------------------------------------------------------------------------------
section "2. Multi-Role Authentication"

login_user() {
  local email="$1"
  local pass="$2"
  curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}"
}

# Admin
ADMIN_RES=$(login_user "admin@pulsecare.test" "Password@123")
ADMIN_TOKEN=$(echo "$ADMIN_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
if [[ -n "$ADMIN_TOKEN" ]]; then
  pass "Admin authentication (admin@pulsecare.test)"
else
  fail "Admin login" "No access token in response: $ADMIN_RES"
fi

# Receptionist
RECEP_RES=$(login_user "reception@pulsecare.test" "Password@123")
RECEP_TOKEN=$(echo "$RECEP_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
if [[ -n "$RECEP_TOKEN" ]]; then
  pass "Receptionist authentication (reception@pulsecare.test)"
else
  fail "Receptionist login" "No access token in response"
fi

# Doctor
DOC_RES=$(login_user "dr.smith@pulsecare.test" "Password@123")
DOC_TOKEN=$(echo "$DOC_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
if [[ -n "$DOC_TOKEN" ]]; then
  pass "Doctor authentication (dr.smith@pulsecare.test)"
else
  fail "Doctor login" "No access token in response"
fi

# Patient 1
PAT1_RES=$(login_user "patient1@pulsecare.test" "Password@123")
PAT1_TOKEN=$(echo "$PAT1_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
if [[ -n "$PAT1_TOKEN" ]]; then
  pass "Patient 1 authentication (patient1@pulsecare.test)"
else
  fail "Patient 1 login" "No access token in response"
fi

# Patient 2
PAT2_RES=$(login_user "patient2@pulsecare.test" "Password@123")
PAT2_TOKEN=$(echo "$PAT2_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4 || echo "")
if [[ -n "$PAT2_TOKEN" ]]; then
  pass "Patient 2 authentication (patient2@pulsecare.test)"
else
  fail "Patient 2 login" "No access token in response"
fi

# ------------------------------------------------------------------------------
# 3. Patient listing by Receptionist & Patient Details
# ------------------------------------------------------------------------------
section "3. Patient Management & Search"

PATIENTS_RES=$(curl -s -H "Authorization: Bearer $RECEP_TOKEN" "$API_URL/patients?limit=10")
PAT1_ID=$(echo "$PATIENTS_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4 || echo "")

if [[ -n "$PAT1_ID" ]]; then
  pass "Receptionist lists registered patients (Found patient ID: $PAT1_ID)"
else
  fail "Patient listing" "Could not extract patient ID from $PATIENTS_RES"
fi

# Patient safe regex search
SEARCH_RES=$(curl -s -H "Authorization: Bearer $RECEP_TOKEN" "$API_URL/patients?search=James")
if echo "$SEARCH_RES" | grep -q "James"; then
  pass "Safe regex patient search by name ('James')"
else
  fail "Patient search" "Query for 'James' returned no matches"
fi

# ------------------------------------------------------------------------------
# 4. Doctor schedules & Leave validation
# ------------------------------------------------------------------------------
section "4. Doctor Availability & Leave Protection"

DOCTORS_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/doctors?limit=5")
DOC_ID=$(echo "$DOCTORS_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4 || echo "")

if [[ -n "$DOC_ID" ]]; then
  pass "Doctor listing (Target Dr ID: $DOC_ID)"
else
  fail "Doctor listing" "Could not extract doctor ID"
fi

# Doctor leave check: Attempt to book on Dr. Smith's leave date (2026-10-16)
LEAVE_DATE="2026-10-16"
LEAVE_BOOK_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/appointments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"doctorId\":\"$DOC_ID\",\"patientId\":\"$PAT1_ID\",\"date\":\"$LEAVE_DATE\",\"timeSlot\":\"09:00\",\"type\":\"consultation\"}")

LEAVE_CODE=$(echo "$LEAVE_BOOK_RES" | tail -n 1)
LEAVE_BODY=$(echo "$LEAVE_BOOK_RES" | sed '$d')

if [[ "$LEAVE_CODE" == "400" ]] && echo "$LEAVE_BODY" | grep -qi "leave"; then
  pass "Booking on doctor's leave day is rejected with HTTP 400 (D-022)"
else
  fail "Doctor leave protection" "Expected 400 with leave message, got $LEAVE_CODE: $LEAVE_BODY"
fi

# ------------------------------------------------------------------------------
# 5. Appointment Booking & Queue Token (#1, #2)
# ------------------------------------------------------------------------------
section "5. Appointment Booking & Atomic Queue Token"

# Choose a future date (e.g., 2026-10-20, a Tuesday)
FUTURE_DATE="2026-10-20"

# Fetch available slots
SLOTS_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/appointments/slots?doctorId=$DOC_ID&date=$FUTURE_DATE")
SLOT=$(echo "$SLOTS_RES" | grep -o '"[0-9][0-9]:[0-9][0-9]"' | head -n 1 | tr -d '"' || echo "09:00")

BOOK1_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/appointments" \
  -H "Authorization: Bearer $PAT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"doctorId\":\"$DOC_ID\",\"patientId\":\"$PAT1_ID\",\"date\":\"$FUTURE_DATE\",\"timeSlot\":\"$SLOT\",\"type\":\"consultation\",\"reason\":\"Routine checkup\"}")

BOOK1_CODE=$(echo "$BOOK1_RES" | tail -n 1)
BOOK1_BODY=$(echo "$BOOK1_RES" | sed '$d')
APT_ID=$(echo "$BOOK1_BODY" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4 || echo "")
TOKEN_NUM=$(echo "$BOOK1_BODY" | grep -o '"tokenNumber":[0-9]*' | cut -d':' -f2 || echo "")

if [[ "$BOOK1_CODE" == "201" ]] && [[ -n "$TOKEN_NUM" ]]; then
  pass "Patient books appointment (HTTP 201, Token #$TOKEN_NUM, Apt ID: $APT_ID)"
else
  fail "Appointment booking" "Expected 201 with token, got $BOOK1_CODE: $BOOK1_BODY"
fi

# Double-booking prevention check (R7)
DBL_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/appointments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"doctorId\":\"$DOC_ID\",\"patientId\":\"$PAT1_ID\",\"date\":\"$FUTURE_DATE\",\"timeSlot\":\"$SLOT\",\"type\":\"consultation\"}")

DBL_CODE=$(echo "$DBL_RES" | tail -n 1)
if [[ "$DBL_CODE" == "409" ]]; then
  pass "Double-booking same slot rejected with HTTP 409 Conflict (R7)"
else
  fail "Double-booking prevention" "Expected HTTP 409, got $DBL_CODE"
fi

# ------------------------------------------------------------------------------
# 6. Billing: Itemized Invoice, Draft Item Removal, Issue, Payment
# ------------------------------------------------------------------------------
section "6. Billing & Pure Totals Recalculation (D-019, R11)"

CREATE_INV_RES=$(curl -s -X POST "$API_URL/billing" \
  -H "Authorization: Bearer $RECEP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patientId\":\"$PAT1_ID\",\"dueDate\":\"2026-10-30\",\"lineItems\":[{\"description\":\"Consultation\",\"category\":\"consultation\",\"quantity\":1,\"unitPrice\":500},{\"description\":\"Diagnostic Test\",\"category\":\"procedure\",\"quantity\":1,\"unitPrice\":1500}],\"taxRate\":5,\"discount\":100}")

INV_ID=$(echo "$CREATE_INV_RES" | grep -o '"_id":"[^"]*' | head -n 1 | cut -d'"' -f4 || echo "")
INV_TOTAL=$(echo "$CREATE_INV_RES" | grep -o '"totalAmount":[0-9.]*' | cut -d':' -f2 || echo "")

if [[ -n "$INV_ID" ]]; then
  pass "Receptionist creates draft invoice (ID: $INV_ID, Total: ₹$INV_TOTAL)"
else
  fail "Create draft invoice" "Could not create invoice: $CREATE_INV_RES"
fi

# Remove line item (item index 1)
DEL_ITEM_RES=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/billing/$INV_ID/items/1" \
  -H "Authorization: Bearer $RECEP_TOKEN")
DEL_CODE=$(echo "$DEL_ITEM_RES" | tail -n 1)
DEL_BODY=$(echo "$DEL_ITEM_RES" | sed '$d')
NEW_TOTAL=$(echo "$DEL_BODY" | grep -o '"totalAmount":[0-9.]*' | cut -d':' -f2 || echo "")

if [[ "$DEL_CODE" == "200" ]] && [[ "$NEW_TOTAL" != "$INV_TOTAL" ]]; then
  pass "Draft line item removed and totals recalculated from ₹$INV_TOTAL to ₹$NEW_TOTAL (D-019, R11)"
else
  fail "Line item removal" "Expected 200 with recalculated total, got $DEL_CODE: $DEL_BODY"
fi

# Issue invoice
ISSUE_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/billing/$INV_ID/issue" \
  -H "Authorization: Bearer $RECEP_TOKEN")
ISSUE_CODE=$(echo "$ISSUE_RES" | tail -n 1)
if [[ "$ISSUE_CODE" == "200" ]]; then
  pass "Draft invoice successfully issued (HTTP 200)"
else
  fail "Issue invoice" "Expected 200, got $ISSUE_CODE"
fi

# Record payment
PAY_RES=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/billing/$INV_ID/payments" \
  -H "Authorization: Bearer $RECEP_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\":$NEW_TOTAL,\"method\":\"card\",\"notes\":\"Full payment settled\"}")
PAY_CODE=$(echo "$PAY_RES" | tail -n 1)
if [[ "$PAY_CODE" == "201" ]]; then
  pass "Payment recorded successfully and invoice marked paid (HTTP 201)"
else
  fail "Record payment" "Expected 201, got $PAY_CODE"
fi

# ------------------------------------------------------------------------------
# 7. Printable PDF Generation (F5 + F3)
# ------------------------------------------------------------------------------
section "7. Server-Side Printable PDF Generation"

# Invoice PDF
INV_PDF_RES=$(curl -s -w "\n%{http_code}" "$API_URL/billing/$INV_ID/pdf" \
  -H "Authorization: Bearer $RECEP_TOKEN")
INV_PDF_CODE=$(echo "$INV_PDF_RES" | tail -n 1)
INV_PDF_BODY=$(echo "$INV_PDF_RES" | sed '$d')

if [[ "$INV_PDF_CODE" == "200" ]] && echo "$INV_PDF_BODY" | grep -q "^%PDF"; then
  pass "Invoice PDF generated with %PDF header (HTTP 200)"
else
  fail "Invoice PDF" "Expected 200 with %PDF, got $INV_PDF_CODE"
fi

# Patient ID Card PDF
ID_PDF_RES=$(curl -s -w "\n%{http_code}" "$API_URL/patients/me/id-card" \
  -H "Authorization: Bearer $PAT1_TOKEN")
ID_PDF_CODE=$(echo "$ID_PDF_RES" | tail -n 1)
ID_PDF_BODY=$(echo "$ID_PDF_RES" | sed '$d')

if [[ "$ID_PDF_CODE" == "200" ]] && echo "$ID_PDF_BODY" | grep -q "^%PDF"; then
  pass "Patient ID Card PDF generated with %PDF header (HTTP 200)"
else
  fail "Patient ID Card PDF" "Expected 200 with %PDF, got $ID_PDF_CODE"
fi

# Appointment Slip PDF
if [[ -n "$APT_ID" ]]; then
  SLIP_PDF_RES=$(curl -s -w "\n%{http_code}" "$API_URL/appointments/$APT_ID/slip" \
    -H "Authorization: Bearer $PAT1_TOKEN")
  SLIP_PDF_CODE=$(echo "$SLIP_PDF_RES" | tail -n 1)
  SLIP_PDF_BODY=$(echo "$SLIP_PDF_RES" | sed '$d')

  if [[ "$SLIP_PDF_CODE" == "200" ]] && echo "$SLIP_PDF_BODY" | grep -q "^%PDF"; then
    pass "Appointment Slip PDF generated with %PDF header (HTTP 200)"
  else
    fail "Appointment Slip PDF" "Expected 200 with %PDF, got $SLIP_PDF_CODE"
  fi
fi

# ------------------------------------------------------------------------------
# 8. Security & Authorization Gates (R2, R3)
# ------------------------------------------------------------------------------
section "8. Security & Cross-Patient Ownership Access Control"

# Patient 2 attempts to download Patient 1's invoice PDF -> 403 Forbidden
CROSS_INV_RES=$(curl -s -w "\n%{http_code}" "$API_URL/billing/$INV_ID/pdf" \
  -H "Authorization: Bearer $PAT2_TOKEN")
CROSS_INV_CODE=$(echo "$CROSS_INV_RES" | tail -n 1)

if [[ "$CROSS_INV_CODE" == "403" ]]; then
  pass "Cross-patient invoice access blocked with HTTP 403 Forbidden"
else
  fail "Cross-patient authorization" "Expected 403, got $CROSS_INV_CODE"
fi

# Patient attempts to access administrative revenue analytics -> 403 Forbidden
ROLE_AUTH_RES=$(curl -s -w "\n%{http_code}" "$API_URL/analytics/revenue" \
  -H "Authorization: Bearer $PAT1_TOKEN")
ROLE_AUTH_CODE=$(echo "$ROLE_AUTH_RES" | tail -n 1)

if [[ "$ROLE_AUTH_CODE" == "403" ]]; then
  pass "Role-forbidden endpoint blocked with HTTP 403 Forbidden (authorize middleware R3)"
else
  fail "Role authorization" "Expected 403, got $ROLE_AUTH_CODE"
fi

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
echo -e "\n========================================================"
echo -e "🏁 PulseCare HMS Smoke Test Summary"
echo -e "   Passed: ${GREEN}$PASSED${NC}"
echo -e "   Failed: ${RED}$FAILED${NC}"
echo -e "========================================================"

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi

exit 0
