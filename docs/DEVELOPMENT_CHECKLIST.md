# Development Checklist - Preventing Breaking Changes

**Purpose**: Ensure changes don't break existing working functionality

---

## Before Making Changes

### 1. ✅ Document Current Working State
- [ ] Test the feature that's working
- [ ] Note which files are involved
- [ ] Save console output showing it works
- [ ] Take screenshots if UI-related

### 2. ✅ Identify What You're Changing
- [ ] List exact files being modified
- [ ] Note specific functions/components being changed
- [ ] Understand dependencies (what else calls this code?)

### 3. ✅ Create a Rollback Plan
- [ ] Commit current working state to git
- [ ] Or save backup copies of files being modified
- [ ] Document the "before" state in a comment

---

## While Making Changes

### 1. ✅ Make Incremental Changes
- [ ] Change one thing at a time
- [ ] Test after each change
- [ ] Don't make multiple unrelated changes together

### 2. ✅ Add Defensive Code
- [ ] Add error handling (try/catch)
- [ ] Add timeouts for async operations (especially wallet calls)
- [ ] Add fallbacks for when things fail
- [ ] Add logging to track what's happening

### 3. ✅ Test Immediately
- [ ] Test the specific feature you changed
- [ ] Test related features that might be affected
- [ ] Check console for errors/warnings

---

## After Making Changes

### 1. ✅ Verify Nothing Broke
- [ ] Test the original working functionality
- [ ] Test edge cases (timeouts, errors, empty states)
- [ ] Check console for new errors/warnings

### 2. ✅ Document the Change
- [ ] Update relevant docs
- [ ] Add comments explaining why you changed it
- [ ] Note any new limitations or requirements

### 3. ✅ Create Recovery Documentation
- [ ] Document how to roll back if needed
- [ ] Note what was changed and why
- [ ] Include before/after comparison

---

## Known Fragile Areas (blockVote)

### 🔴 Wallet Integration
**Why fragile**: Eternl wallet API can timeout or hang

**Protection added**:
- ✅ 5-second timeout in WalletDrawer for `getUtxos()`
- ✅ 8-second timeout in transactions for `getUtxos()`
- ✅ Fallback to show address even if UTxOs fail

**Testing checklist**:
- [ ] Wallet connects successfully
- [ ] Address displays
- [ ] Balance displays
- [ ] Can create governance action
- [ ] Can create multiple governance actions

**If it breaks**:
- Check console for timeout errors
- Try disconnecting/reconnecting wallet
- Refresh page
- Close and reopen wallet extension

---

### 🔴 UTxO Selection for Minting
**Why fragile**: Parameterized minting policy requires consuming specific UTxO

**Protection added**:
- ✅ Random selection to avoid reusing same UTxO
- ✅ Error messages guide user to reconnect wallet
- ✅ Timeout protection on wallet calls

**Testing checklist**:
- [ ] First governance action works
- [ ] Second governance action works (uses different UTxO)
- [ ] Third governance action works (uses different UTxO)
- [ ] Console shows "Selected UTxO X of Y suitable UTxOs"

**If it breaks**:
- Check if wallet has multiple UTxOs with ≥2 ADA
- Check if wallet API timed out
- Verify different UTxOs are being selected (check console)

---

### 🔴 Transaction Building (Lucid Evolution)
**Why fragile**: Complex Plutus V3 data structures, parameterized policies, redeemers

**Protection added**:
- ✅ Extensive logging at each step
- ✅ Proper error messages
- ✅ Step-by-step console output

**Testing checklist**:
- [ ] Transaction builds (Steps 1-8)
- [ ] Transaction completes (Step 9)
- [ ] Transaction submits (Step 10)
- [ ] Check blockfrost for confirmation

**If it breaks**:
- Check which step failed (1-10)
- Look for serialization errors
- Verify policy ID matches
- Check redeemer structure

---

### 🔴 Metadata (CIP-25)
**Why fragile**: Lucid has strict 64-char limit, chunked arrays don't work

**Current state**:
- ❌ Chunked arrays NOT compatible with Lucid Evolution
- ✅ IPFS URLs work
- ✅ No image works

**Testing checklist**:
- [ ] Metadata builds without errors
- [ ] Metadata size is reasonable (<16KB)
- [ ] If using IPFS, URL is valid

**If it breaks**:
- Ensure no image field or use IPFS URL
- Don't use chunked Base64 arrays with Lucid
- Check string lengths are ≤64 chars

---

## Common Wallet Issues

### Issue: "Total UTxOs in wallet: 0"
**Cause**: Wallet API timed out or hung

**Solution**:
1. Disconnect wallet
2. Close wallet extension
3. Reopen wallet extension
4. Reconnect to dApp
5. Refresh page if needed

---

### Issue: Wallet info not displaying
**Cause**: `getUtxos()` hanging indefinitely

**Solution**:
- Timeout is now in place (5 seconds for drawer, 8 seconds for transactions)
- Should show address even if UTxOs fail
- Check console for "getUtxos timed out" message

---

### Issue: Second governance action fails
**Cause**: Trying to reuse same UTxO that was already consumed

**Solution**:
- ✅ Fixed with random UTxO selection
- Ensure wallet has multiple UTxOs with ≥2 ADA
- Check console for "Selected UTxO X of Y"

---

## Emergency Rollback Procedure

If something breaks and you need to restore working state:

### Option 1: Git Rollback
```bash
git status  # See what changed
git diff <file>  # See exact changes
git checkout <file>  # Restore specific file
git reset --hard HEAD  # Restore everything (⚠️ loses all changes)
```

### Option 2: Manual Rollback
1. Find the file in `/docs/` with "before" code
2. Copy the working code back
3. Test immediately
4. Document what broke and why

### Option 3: Ask for Help
1. Note exactly what broke
2. Save console errors
3. Note what you were trying to do
4. Share error messages and steps to reproduce

---

## File-Specific Safety Notes

### `/lib/transactions.ts`
- **Line 283-297**: `getUserUtxos()` - Has timeout protection
- **Line 306-350**: `selectUtxoForMinting()` - Uses random selection, don't change to `.find()`

### `/lib/transactions-lucid.ts`
- **Line 191**: `includeImage` - Keep commented out (chunked arrays don't work)
- **Line 248-256**: UTxO consumption - Don't remove the UTxO validation

### `/components/WalletDrawer.tsx`
- **Line 31-56**: UTxO fetching - Has 5-second timeout, don't remove it
- **Line 64-68**: Wallet info setting - Handles empty state gracefully

### `/lib/metadata.ts`
- **Line 93-145**: `buildTokenMetadata()` - Keep string lengths ≤64 chars
- **Line 122**: Chunked arrays - Only works with Mesh, not Lucid

---

## Testing Checklist (Run Before Each Deploy)

### Basic Functionality
- [ ] Wallet connects
- [ ] Wallet info displays (address, balance, assets)
- [ ] Can navigate to "Create Governance Action"
- [ ] Form accepts input
- [ ] Can select qualified members

### Create Governance Action
- [ ] First action submits successfully
- [ ] Second action submits successfully (different UTxO)
- [ ] Third action submits successfully (different UTxO)
- [ ] Console shows UTxO selection working
- [ ] No timeout errors

### Error Handling
- [ ] Wallet disconnect shows appropriate message
- [ ] Timeout errors show helpful message
- [ ] Invalid input shows validation errors
- [ ] Network errors are caught and displayed

### Console Checks
- [ ] No red errors (except expected wallet warnings)
- [ ] UTxO selection logs show variety
- [ ] Transaction steps 1-10 all succeed
- [ ] No infinite loops or hanging

---

## Change Log Format

When making changes, document them like this:

```markdown
## [Date] - [Feature/Fix Name]

**What changed**: [List files and functions modified]

**Why**: [Explain the problem being solved]

**Testing done**: [What you tested to verify it works]

**Risks**: [What could break, what to watch for]

**Rollback**: [How to undo this change if needed]
```

**Example**:
```markdown
## 2024-12-08 - Fixed UTxO Selection for Multiple Governance Actions

**What changed**:
- `/lib/transactions.ts` line 318-338
- Changed from `.find()` to `.filter()` + random selection

**Why**:
- Multiple governance actions were failing
- Always selected first UTxO, which was already spent

**Testing done**:
- Created 3 governance actions in sequence
- All succeeded with different UTxOs
- Console verified random selection

**Risks**:
- Random selection might pick same UTxO by chance
- Need multiple UTxOs in wallet

**Rollback**:
- Replace `filter()` + random with `.find()` (line 319)
- Will break multiple actions but restore original behavior
```

---

## Questions to Ask Before Changing Code

1. **Is this code currently working?**
   - If YES → Be extra careful, test thoroughly
   - If NO → Safer to change, but still test

2. **What else depends on this code?**
   - Search for function/component usage
   - Check imports in other files

3. **Can I add the feature without changing existing code?**
   - New function vs modifying existing
   - New component vs changing existing

4. **Do I have a quick way to undo this?**
   - Git commit first
   - Save backup
   - Document rollback steps

5. **Have I tested the exact scenario that was working before?**
   - Don't just test the new feature
   - Re-test the old feature too

---

*Keep this checklist handy during development!*
*When in doubt, make smaller changes and test more frequently.*
