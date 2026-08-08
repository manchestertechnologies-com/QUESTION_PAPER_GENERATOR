# Manchester College Question Paper Portal — Architecture Audit

> Prepared by: Principal Software Architect / Security Engineer  
> Date: 2026-08-08  
> Application: https://qestion-paper.vercel.app/  
> Repository: https://github.com/yashwanthyashu514/Qestion_paper

---

## 1. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | React 18, Vite 8 |
| Styling | Tailwind CSS v4 | v4 |
| Backend | Node.js + Express | Express 5.2.1 |
| Database | MongoDB (Mongoose) | Mongoose 9.6.1 |
| Auth | JWT (jsonwebtoken) | 9.0.3 |
| Password Hashing | bcryptjs | 3.0.3 |
| File Storage | Cloudinary | 1.41.3 |
| PDF Generation | Puppeteer | 24.42.0 |
| Word Export | docxtemplater + pizzip | 3.68.6 |
| Math Rendering | KaTeX | 0.16.45 |
| Frontend Deploy | Vercel | — |
| Backend Deploy | Render.com | — |

**Missing Security Packages (NONE installed):**
- helmet — HTTP security headers
- express-rate-limit — rate limiting
- express-validator / joi — input validation
- dompurify — XSS sanitization
- express-mongo-sanitize — NoSQL injection protection
- hpp — HTTP parameter pollution protection

---

## 2. Database Collections

| Collection | Model | Purpose |
|-----------|-------|---------|
| users | User.js | Admin + Teacher accounts |
| questions | Question.js | Question bank |
| papers | Paper.js | Teacher-created papers |
| onlineexams | OnlineExam.js | Scheduled online exams |
| examsessions | ExamSession.js | Student exam attempts |
| grandtestpapers | GrandTestPaper.js | JEE/NEET Grand Test papers |
| templates | Template.js | Institutional header templates |
| bridgekeys | BridgeKey.js | Lab computer auth tokens |
| students | Student.js | Student records |
| previousyearpapers | PreviousYearPaper.js | PYQ papers |
| examblueprints | ExamBlueprint.js | Exam structure templates |

---

## 3. Roles and Access

| Role | Access Level |
|------|-------------|
| admin | Full system access (hardcoded: college@gmail.com) |
| teacher | Subject-scoped (PARTIALLY enforced) |
| lab | Computer lab terminal access |
| student | No login — exam via lab terminal |

---

## 4. Authentication Flow (Current)

```
1. POST /api/auth/login  receives email + password
2. Checks hardcoded admin email first (college@gmail.com)
3. Falls through to MongoDB User lookup
4. bcryptjs.compare() for password
5. JWT signed with JWT_SECRET — 10h expiry
6. JWT stored in localStorage (XSS vulnerable)
7. JWT sent as Bearer token in Authorization header on every request
```

---

## 5. CRITICAL SECURITY FINDINGS — P0

### P0-01 — JWT Stored in localStorage (XSS Theft)
**File:** client/src/context/AuthContext.jsx, client/src/api.js  
**Risk:** Any XSS attack steals the JWT token → full account takeover.  
**Code:** localStorage.setItem('token', res.data.token)  
**Fix:** Move to HttpOnly cookies (Secure, SameSite=Lax).

### P0-02 — Massive XSS Surface (28+ dangerouslySetInnerHTML with No Sanitization)
**Files:** AdminPaperPreview.jsx, AdminQuestionBank.jsx, ExamManagement.jsx, ExamEngine.jsx, Scorecard.jsx, AddQuestion.jsx, CreatePaper.jsx, SavedPapers.jsx  
**Risk:** Question text/options from DB rendered as raw HTML with ZERO sanitization. Stored XSS — any JS in a question executes in every user's browser.  
**Fix:** Install dompurify. Sanitize ALL dangerouslySetInnerHTML content.

### P0-03 — Answer Keys Sent to Student Browser
**File:** server/routes/exams.js (GET /api/exams/student/:id)  
**Risk:** The answer field is included in the student-facing exam payload. Students open DevTools Network tab and read all answers before submitting.  
**Fix:** Strip answer and solutionText from student exam payload. Return only after submission.

### P0-04 — No Rate Limiting on Login Endpoint
**File:** server/routes/auth.js  
**Risk:** Unlimited brute-force attacks against all teacher/admin passwords.  
**Fix:** express-rate-limit — 5 attempts / 15 minutes on /api/auth/login.

### P0-05 — NoSQL Injection Possible
**Files:** All routes using req.body in Mongoose queries  
**Risk:** Attacker passes {"$gt": ""} as email to bypass authentication or enumerate data.  
**Fix:** express-mongo-sanitize as global middleware.

### P0-06 — No HTTP Security Headers
**File:** server/index.js  
**Risk:** Missing X-Frame-Options, X-XSS-Protection, Content-Security-Policy, X-Content-Type-Options, HSTS. Vulnerable to clickjacking and MIME-sniffing.  
**Fix:** helmet with appropriate configuration.

### P0-07 — Mass Assignment on Question/Paper Creation
**Files:** server/routes/questions.js, server/routes/papers.js  
**Risk:** req.body spread directly into Mongoose documents. Attacker injects arbitrary fields.  
**Fix:** Explicitly whitelist allowed fields when creating/updating documents.

---

## 6. HIGH SEVERITY FINDINGS — P1

### P1-01 — Subject-Level Access Not Enforced Server-Side
A Chemistry teacher can query Physics questions by manipulating the subject param.

### P1-02 — IDOR on Paper Access
Any teacher can retrieve any other teacher's paper by guessing the paper ID.

### P1-03 — Admin Password Hardcoded in Source
Password 123456 in source + env variable with no complexity requirements.

### P1-04 — No JWT Revocation
Stolen tokens cannot be invalidated. No blocklist or session table.

### P1-05 — Exam Session Not Fully Validated Server-Side
Students may resubmit answers after exam ends.

### P1-06 — Lab IP Check May Be Bypassable via X-Forwarded-For Spoofing
labIp.js middleware may trust spoofable headers.

### P1-07 — No Server-Side Input Validation
No validation of required fields, data types, string lengths, enum values.

### P1-08 — File Upload Missing Magic Byte Validation
Template upload only checks browser-reported MIME type, not actual file content.

### P1-09 — CORS Configuration Unverified
May be too permissive in production.

### P1-10 — No Audit Logging
Zero logs of question CRUD, paper generation, answer key access, PDF export.

---

## 7. MEDIUM SEVERITY FINDINGS — P2

### P2-01 — Zero Automated Tests
scripts.test = echo Error: no test specified. No unit, integration, or security tests.

### P2-02 — Missing Database Indexes
Question collection has no compound indexes on {subject, chapter, type, classes}.

### P2-03 — Paper Generation Happens Client-Side
Teacher selects questions in browser, sends IDs to server. No server-side validation of the selection.

### P2-04 — Published Exams Can Be Edited
No lifecycle enforcement — live exam questions can be modified.

### P2-05 — Puppeteer PDF With User-Controlled HTML (Potential SSRF/XSS)
User content embedded in Puppeteer HTML without sanitization.

### P2-06 — API Key Not Handled Gracefully
Missing GEMINI_API_KEY causes uncaught server errors.

### P2-07 — Error Messages Leak Internal Details
Raw err.message returned in API responses.

---

## 8. LOW SEVERITY FINDINGS — P3

### P3-01 — bcryptjs Instead of Argon2id (OWASP preferred)
### P3-02 — No Password Reset Mechanism
### P3-03 — No Pagination on Question Bank (returns ALL questions)
### P3-04 — Debug/Test Scripts Committed to Main Branch
### P3-05 — No Content Security Policy
### P3-06 — No Watermarking on Exported Papers

---

## 9. Missing Features Summary

| Feature | Status |
|---------|--------|
| Rate limiting | Missing |
| HTTP security headers | Missing |
| Input validation | Missing |
| NoSQL injection protection | Missing |
| XSS sanitization | Missing |
| Answer key protection | Missing |
| Audit logging | Missing |
| Password reset | Missing |
| JWT revocation | Missing |
| Database indexes | Missing |
| Automated tests | Missing — 0 tests |
| Subject-level auth (server) | Partial |
| IDOR protection | Partial |
| File upload security | Partial |
| MFA | Missing |
| Pagination | Missing |
| Watermarking | Missing |
