const SHEET_NAME = "Applications";

const HEADERS = [
  "submittedAt",
  "fullName",
  "email",
  "location",
  "affiliation",
  "project",
  "motivation",
  "contribution",
  "arrival",
  "travelSupport",
  "accommodation",
  "dietary",
  "website",
  "summary"
];

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getApplicationSheet_();
    ensureHeaders_(sheet);
    const payload = parsePayload_(event);
    const row = HEADERS.map((header) => payload[header] || "");
    sheet.appendRow(row);

    return jsonResponse_({
      ok: true
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message
    });
  } finally {
    lock.releaseLock();
  }
}

function getApplicationSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => existing[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function parsePayload_(event) {
  const rawPayload =
    event &&
    event.parameter &&
    event.parameter.payload
      ? event.parameter.payload
      : event && event.postData && event.postData.contents;

  if (!rawPayload) {
    throw new Error("Missing payload.");
  }

  return JSON.parse(rawPayload);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
