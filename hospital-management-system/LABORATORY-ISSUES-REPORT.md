# Laboratory Module - Issues Report

**Date:** January 28, 2026
**Reporter:** Automated Diagnostic + Manual Testing
**Environment:** Production (https://spetaar.ai)

---

## ✅ FIXED ISSUES

### **Lab Order Status Not Updating - FIXED**

**Status:** ✅ FIXED AND DEPLOYED
**Priority:** HIGH
**Fixed Date:** January 28, 2026 11:15 AM
**Commit:** `9cf1a7f`

#### Problem:
When lab technicians entered test results, the parent lab order status remained stuck (e.g., ORDERED) even after entering results. Orders with results entered still showed as ORDERED/PENDING.

#### Solution:
Implemented automatic status transition logic in `enterTestResult()` and `uploadAndExtractLabResult()`:
- **ORDERED/SAMPLE_COLLECTED/RECEIVED → IN_PROGRESS** (when first result entered)
- **IN_PROGRESS → COMPLETED** (when all tests have results)

#### Testing:
Test with order **LAB-MKXWVGVWAPC** (Harry Chase):
1. Login as `labtech@hospital.com`
2. Enter results for tests in order LAB-MKXWVGVWAPC
3. Watch status change from ORDERED → IN_PROGRESS → COMPLETED

See full details: `/docs/LAB-STATUS-FLOW-FIX.md`

---

## 🔴 CRITICAL ISSUE IDENTIFIED

### **"View Booking" Button Flickering - STILL OCCURRING**

**Status:** ❌ NOT FIXED
**Priority:** HIGH
**User Impact:** Confusing UX, modal appears to flash/flicker when clicked

#### Symptoms:
1. User clicks "View Booking" button on a lab order
2. Page flickers/blinks
3. Modal may or may not appear
4. **No API call is being made** (confirmed via Network tab)

#### Root Cause Analysis:

Based on investigation, the issue is NOT with the modal rendering logic. The real problem is:

**The `useBookingData` hook is likely not triggering at all OR is being disabled/cancelled before the request is made.**

#### Evidence:
1. ✅ Code deployed has loading state in BookingTicket component
2. ✅ Code deployed has modal showing immediately when `selectedBookingId` is set
3. ❌ **No network request appears** when button is clicked
4. ❌ Console logs show hook is not executing properly

#### Hypothesis:

The flickering is caused by:
1. React Query (`useQuery`) is returning `enabled: false` OR
2. The `appointmentId` is undefined/null causing hook to not run OR
3. React is re-rendering and resetting state before data can load OR
4. The consultation object doesn't have an `appointmentId`

#### What We've Tried:
- ✅ Fixed modal condition to show immediately
- ✅ Added loading state to BookingTicket component
- ✅ Added error handling and console logging
- ❌ Issue persists

#### Next Steps to Fix:

1. **Verify `appointmentId` exists**
   ```typescript
   // Add console log before setting state
   onClick={() => {
     console.log('Appointment ID:', order.consultation?.appointmentId);
     setSelectedBookingId(order.consultation!.appointmentId!);
   }}
   ```

2. **Check if useQuery is being disabled**
   ```typescript
   // In useBookingData hook
   enabled: !!appointmentId && enabled, // This might be false
   ```

3. **Add immediate API call instead of relying on hook**
   ```typescript
   onClick={async () => {
     const id = order.consultation!.appointmentId!;
     setSelectedBookingId(id);
     // Manually trigger fetch
     const data = await opdApi.getBookingTicket(id);
     setBookingTicketData(data);
   }}
   ```

---

## ⚠️  OTHER POTENTIAL ISSUES (Needs Verification)

### 1. Critical Values "View All" Button
**Status:** ⚠️  PARTIALLY FIXED (needs production testing)
**What was done:** Added smooth scrolling to tab
**Needs verification:** Confirm it scrolls properly in production

### 2. Critical Values Not Refreshing After Results Entry
**Status:** ⚠️  PARTIALLY FIXED (needs production testing)
**What was done:** Added `fetchCritical()` and `fetchStats()` to `onSuccess`
**Needs verification:** Confirm values update without page refresh

### 3. Search Box
**Status:** ✅ WORKING (based on code review)
**Functionality:** Filters lab orders, resets page to 1

### 4. Status Filter
**Status:** ✅ WORKING (based on code review)
**Functionality:** Filters by order status, resets page to 1

---

## 📋 FEATURES REQUIRING MANUAL TESTING

The following features need manual testing by login as `labtech@hospital.com`:

### Core Functions:
- [ ] Page loads correctly
- [ ] Stats cards show correct numbers
- [ ] Search box filters results
- [ ] Status dropdown filters results
- [ ] All 4 tabs are clickable
- [ ] Lab orders list displays

### Buttons & Actions:
- [ ] **"View Booking" button** ❌ CONFIRMED BROKEN
- [ ] "Enter Results" button opens modal
- [ ] "View/Edit Results" button opens modal
- [ ] "Collect Sample" button works
- [ ] "New Order" button opens modal
- [ ] "AI Suggest Tests" button (if AI online)

### Critical Values:
- [ ] Critical banner shows when values exist
- [ ] "View All Critical Values" button scrolls to tab
- [ ] Critical Values tab shows data
- [ ] "Acknowledge" button works
- [ ] Values disappear after acknowledgment

### Results Entry:
- [ ] Can enter test results
- [ ] Critical values auto-flagged (e.g., Hb = 5.8 g/dL)
- [ ] Save button works
- [ ] **Critical banner updates immediately** (without refresh)
- [ ] **Stats update immediately** (without refresh)

### Tabs:
- [ ] Lab Orders tab
- [ ] Results Entry tab
- [ ] Critical Values tab
- [ ] Sample Tracking tab

---

## 🔧 RECOMMENDED IMMEDIATE ACTION

### Priority 1: Fix "View Booking" Flickering

**Proposed Solution:**

Replace the hook-based approach with a direct state management approach:

```typescript
// Add state for booking data
const [bookingData, setBookingData] = useState<BookingTicketData | null>(null);
const [loadingBooking, setLoadingBooking] = useState(false);

// Handle View Booking click
const handleViewBooking = async (appointmentId: string) => {
  setSelectedBookingId(appointmentId);
  setLoadingBooking(true);
  try {
    const response = await opdApi.getBookingTicket(appointmentId);
    setBookingData(response.data.data);
  } catch (error) {
    console.error('Failed to load booking:', error);
    toast.error('Failed to load booking details');
  } finally {
    setLoadingBooking(false);
  }
};

// In button
<button onClick={() => handleViewBooking(order.consultation!.appointmentId!)}>
  View Booking
</button>

// In modal
<BookingTicket
  data={bookingData}
  isLoading={loadingBooking}
  ...
/>
```

This approach:
- ✅ Guarantees API call happens
- ✅ No reliance on React Query hook behavior
- ✅ Simple state management
- ✅ Easy to debug

---

## 📊 TESTING STATUS SUMMARY

| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ | Works |
| Page Load | ✅ | Loads properly |
| Stats Cards | ⚠️ | Need verification |
| Search Box | ✅ | Fixed (resets page) |
| Status Filter | ✅ | Fixed (resets page) |
| Tabs | ⚠️ | Need verification |
| View Booking | ❌ | **BROKEN - Flickers, no API call** |
| Enter Results | ⚠️ | Need verification |
| Collect Sample | ⚠️ | Need verification |
| Critical Banner | ⚠️ | Need verification |
| View All Critical | ⚠️ | Scroll needs verification |
| Acknowledge | ⚠️ | Need verification |
| Auto-refresh | ⚠️ | Need verification |

---

## 🎯 CONCLUSION

**Main Issue:** The "View Booking" button flickering is NOT fixed. The problem is deeper than just modal rendering - the API call is not being triggered at all.

**Root Cause:** Likely an issue with React Query hook conditions or the appointmentId value itself.

**Recommended Fix:** Replace hook-based data fetching with manual state management for this specific use case.

**Timeline:** This should be the #1 priority fix before testing other features.

---

**Last Updated:** January 28, 2026 10:32 AM
**Next Action:** Implement manual state management for View Booking functionality
