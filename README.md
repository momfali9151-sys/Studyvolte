# StudyVault — Ready to Run

A public student study portal with owner-only upload/delete controls.

## Easiest Windows setup

1. Install Node.js LTS.
2. Extract this ZIP.
3. Double-click `START_STUDYVAULT.bat`.
4. Open `http://localhost:3000` if the browser does not open automatically.

### Owner login
- Email: `admin@studyvault.local`
- Password: `StudyVault@2026!`

Change the password from the Admin dashboard after the first login.

## Manual setup

```bash
npm install
npm start
```

## Features

- BCA and B-Pharma course structure
- Subject-wise study material
- Search
- Preview and download
- Owner-only upload/delete routes
- Password hashing with bcryptjs
- Login rate limiting
- Helmet security headers
- File type and size validation
- Persistent JSON metadata + local file storage

## Important for public deployment

Do not commit `.env` to GitHub. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`, `SESSION_HOURS`, and `MAX_FILE_MB` in the hosting provider's environment settings. For a serious public deployment, use persistent storage/object storage rather than ephemeral local disk.
