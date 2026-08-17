# Implementation Plan - Manchester Technologies College Question Paper Portal

This plan addresses all required fixes and features to restore correct math symbol rendering, fix Word export, repair the template view/architecture, resolve the admin onboarding authorization bug, remove Gemini AI solve buttons, implement online/offline exam rules, secure PDF downloads, and implement the Grand Test (GT) paper system.

## User Review Required

> [!IMPORTANT]
> - **Word Export**: Rather than relying on simple HTML-to-Word conversions (which corrupt layout and math), we will implement a backend-driven `.docx` generator using the `docx` package and use `puppeteer` to pre-render LaTeX expressions to high-quality images embedded directly into the Word document.
> - **Template Management**: We are extending the database model to include `templateType` (`LOGO`, `HEADER`, `FULL_PAPER`, `AD_BANNER`, `FOOTER`) to support the new template architecture and prevent layout stretching or cropping.

## Proposed Changes

---

### Database Schema Updates

#### [MODIFY] [Template.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/models/Template.js)
- Add `templateType` field to schema:
  ```javascript
  templateType: { type: String, enum: ['LOGO', 'HEADER', 'FULL_PAPER', 'AD_BANNER', 'FOOTER'], default: 'FULL_PAPER' }
  ```

#### [MODIFY] [OnlineExam.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/models/OnlineExam.js)
- Add `examMode` field to schema to support Online vs Offline exams:
  ```javascript
  examMode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' }
  ```

#### [NEW] [GrandTestPaper.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/models/GrandTestPaper.js) (If needs update)
- Verify `GrandTestPaper` fields to support teacher ownership, mode (Online/Offline), subject, and custom tags.

---

### Backend Logic & Security

#### [MODIFY] [auth.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/middleware/auth.js)
- Sanitize `"null"` and `"undefined"` string values in headers/cookies.
- Add fallbacks to check token in query parameters (`req.query.token`) or body (`req.body.token`) for robust API calls.

#### [MODIFY] [templates.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/routes/templates.js)
- Allow `application/pdf` in multer fileFilter.
- Update Cloudinary storage config (in `server/config/cloudinary.js`) to allow PDF format and `raw` resource type when uploading PDFs.
- Save `templateType` field from request body.

#### [MODIFY] [exams.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/routes/exams.js)
- Update results `/results` and scoreboard `/scorecard` routes to authorize teachers to access only their created exams or exams they are authorized to manage.
- Ensure students only get scores if `examMode === 'ONLINE'`.
- Implement `GET /api/exams/:id/results/pdf/:sessionId` endpoint for generating individual scorecard reports.
- Implement `GET /api/exams/:id/results/pdf-zip` endpoint that compiles all PDFs into a single ZIP for download.

---

### Word & PDF Export Engine

#### [NEW] [mathToImage.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/utils/mathToImage.js)
- Create a server-side helper using `puppeteer` and `katex` to convert LaTeX equations (inline `$math$` or block `$$math$$`) into PNG buffers.

#### [NEW] [wordExport.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/services/wordExport.js)
- Implement document building using `docx` package:
  - Embed layout template/logo if selected.
  - Split question text into plain text runs and math equation runs (using `mathToImage` to embed rendered equations).
  - List MCQ options cleanly as `A) ...`, `B) ...`, `C) ...`, `D) ...`.
  - Maintain page breaks, footer texts, and watermarks.

#### [MODIFY] [papers.js](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/server/routes/papers.js)
- Add route `GET /api/papers/:id/export-word` to trigger Word export.

---

### Frontend Components & UI Cleanup

#### [NEW] [MathRenderer.jsx](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/client/src/components/MathRenderer.jsx)
- Create a React component using the `katex` package to parse math delimiters and render math nodes natively in client browsers with proper CSS styling.

#### [MODIFY] [index.css](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/client/src/index.css)
- Import `katex/dist/katex.min.css` at the top of the file to render math symbols correctly.

#### [MODIFY] [AdminPaperPreview.jsx](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/client/src/pages/admin/AdminPaperPreview.jsx) & [SavedPapers.jsx](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/client/src/pages/teacher/SavedPapers.jsx)
- Replace plain `dangerouslySetInnerHTML` with `<MathRenderer>` for question text and options.
- Remove all Gemini AI solve buttons and loading states. Replace with clean manual solution display (or "No detailed solution has been added..." message if empty).
- Connect the EXPORT WORD button to the backend DOCX export API.

#### [MODIFY] [UploadTemplate.jsx](file:///c:/Users/swamy/.gemini/antigravity/scratch/Qestion_paper/client/src/pages/admin/UploadTemplate.jsx)
- Add Template Type dropdown selector.
- Add an overlay modal to preview templates. Show PDFs in standard PDF embeds and images at original aspect ratio without cropping.

## Verification Plan

### Automated Tests
- Run `npm test` to ensure existing 119 unit tests pass.
- Create new test cases verifying math rendering conversions and Word/PDF export downloads.

### Manual Verification
- Test admin onboard faculty API from UI without token errors.
- Preview template PDFs and images in admin template manager.
- Verify LaTeX equations render correctly in question bank and scorecard page.
