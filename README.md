# Artizen Village Site

Static website for Artizen Village at DWeb Camp 2026.

## Run Locally

Run a local server:

```sh
npm run preview
```

## Test

```sh
npm test
```

## Application Recipient

The form submits to a Google Apps Script web app endpoint, which appends rows to a Google Sheet.

1. Create or open the Google Sheet that should receive applications.
2. Confirm `SPREADSHEET_ID` in `google-sheet-apps-script.gs` matches the Sheet URL.
3. In the Sheet, open `Extensions -> Apps Script`.
4. Paste the contents of `google-sheet-apps-script.gs`.
5. Deploy as `Web app`, execute as yourself, and allow access to anyone with the URL.
6. Copy the web app URL into `data-google-sheet-endpoint` on the form in `index.html`.
