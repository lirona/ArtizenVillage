import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationSummary,
  normalizeApplication,
  serializeApplicationForSheet,
  setupApplicationForm,
  submitApplicationToGoogleSheet,
  validateApplication
} from "../src/form.js";

const validApplication = {
  fullName: "Ada Lovelace",
  email: "ada@example.org",
  location: "Berlin",
  affiliation: "Artizen creator",
  project: "A public-good research artwork for decentralized communities.",
  motivation: "I want to contribute a practical salon session that connects creative funding, decentralized infrastructure, and conflict transformation.",
  dwebPrinciples: "Human agency and ecological awareness resonate with how I build community-owned creative infrastructure.",
  contribution: ["Creator spotlight", "Workshop"],
  arrival: "July 8 setup window",
  accommodation: "Shared glamping",
  website: "https://example.org",
};

test("normalizeApplication trims strings and splits comma contributions", () => {
  const normalized = normalizeApplication({
    fullName: " Ada ",
    email: " ada@example.org ",
    contribution: "Workshop, Documentation",
  });

  assert.equal(normalized.fullName, "Ada");
  assert.equal(normalized.email, "ada@example.org");
  assert.deepEqual(normalized.contribution, ["Workshop", "Documentation"]);
});

test("validateApplication accepts a complete application", () => {
  const result = validateApplication(validApplication);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test("validateApplication reports every required missing field", () => {
  const result = validateApplication({});

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    "affiliation",
    "arrival",
    "contribution",
    "dwebPrinciples",
    "email",
    "fullName",
    "location",
    "motivation",
    "project",
  ]);
});

test("validateApplication rejects malformed email", () => {
  const result = validateApplication({
    ...validApplication,
    email: "ada.example.org"
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.email, "Use a valid email address.");
});

test("validateApplication rejects short motivation", () => {
  const result = validateApplication({
    ...validApplication,
    motivation: "Too short."
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.motivation, /at least 60 characters/);
});

test("buildApplicationSummary includes optional fallback values", () => {
  const summary = buildApplicationSummary({
    ...validApplication,
    accommodation: "",
    website: ""
  });

  assert.match(summary, /DWeb principles:/);
  assert.match(summary, /Accommodation: Not specified/);
  assert.match(summary, /Link: Not specified/);
  assert.doesNotMatch(summary, /Dietary notes:/);
  assert.doesNotMatch(summary, /Travel support needed:/);
});

test("serializeApplicationForSheet creates a row payload", () => {
  const payload = serializeApplicationForSheet(validApplication);

  assert.match(payload.submittedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(payload.fullName, "Ada Lovelace");
  assert.equal(payload.dwebPrinciples, validApplication.dwebPrinciples);
  assert.equal(payload.contribution, "Creator spotlight, Workshop");
  assert.equal("travelSupport" in payload, false);
  assert.equal("dietary" in payload, false);
  assert.match(payload.summary, /DWeb principles:/);
  assert.match(payload.summary, /Artizen Village application/);
});

test("submitApplicationToGoogleSheet rejects missing endpoint", async () => {
  const result = await submitApplicationToGoogleSheet(validApplication, "");

  assert.equal(result.ok, false);
  assert.equal(result.error, "Google Sheet endpoint is not configured yet.");
});

test("submitApplicationToGoogleSheet rejects missing fetch support", async () => {
  const result = await submitApplicationToGoogleSheet(validApplication, "https://script.google.com/macros/s/example/exec", null);

  assert.equal(result.ok, false);
  assert.equal(result.error, "Submission is unavailable in this browser.");
});

test("submitApplicationToGoogleSheet posts URL encoded payload", async () => {
  let request;
  const result = await submitApplicationToGoogleSheet(
    validApplication,
    "https://script.google.com/macros/s/example/exec",
    async (url, options) => {
      request = { url, options };
      return {};
    }
  );

  const payload = JSON.parse(request.options.body.get("payload"));

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://script.google.com/macros/s/example/exec");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.mode, "no-cors");
  assert.equal(payload.email, "ada@example.org");
});

test("submitApplicationToGoogleSheet reports network failures", async () => {
  const result = await submitApplicationToGoogleSheet(
    validApplication,
    "https://script.google.com/macros/s/example/exec",
    async () => {
      throw new Error("Network down");
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "Network down");
});

function createFakeDocument({ form, status, mailtoLink }) {
  return {
    querySelector(selector) {
      if (selector === "[data-application-form]") return form;
      if (selector === "[data-application-status]") return status;
      if (selector === "[data-submit-button]") return mailtoLink;
      return null;
    }
  };
}

function createFakeElement() {
  const classes = new Set();
  const attributes = new Map();

  return {
    textContent: "",
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name);
    }
  };
}

test("setupApplicationForm returns false when required DOM nodes are absent", () => {
  const didSetup = setupApplicationForm({
    documentRef: createFakeDocument({ form: null, status: null, mailtoLink: null })
  });

  assert.equal(didSetup, false);
});

test("setupApplicationForm handles invalid submission path", () => {
  let submitHandler;
  const form = {
    dataset: {
      googleSheetEndpoint: "https://script.google.com/macros/s/example/exec"
    },
    addEventListener(eventName, handler) {
      assert.equal(eventName, "submit");
      submitHandler = handler;
    }
  };
  const status = createFakeElement();
  const mailtoLink = createFakeElement();
  const documentRef = createFakeDocument({ form, status, mailtoLink });
  let prevented = false;

  const didSetup = setupApplicationForm({
    documentRef,
    readForm: () => ({})
  });
  submitHandler({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(didSetup, true);
  assert.equal(prevented, true);
  assert.equal(status.classList.contains("has-error"), true);
  assert.equal(mailtoLink.disabled, undefined);
});

test("setupApplicationForm handles missing endpoint submission path", async () => {
  let submitHandler;
  const form = {
    dataset: {},
    addEventListener(eventName, handler) {
      assert.equal(eventName, "submit");
      submitHandler = handler;
    }
  };
  const status = createFakeElement();
  const submitButton = createFakeElement();
  const documentRef = createFakeDocument({ form, status, mailtoLink: submitButton });
  const storage = new Map();

  setupApplicationForm({
    documentRef,
    storage: {
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    readForm: () => validApplication
  });
  await submitHandler({
    preventDefault() {}
  });

  assert.equal(status.textContent, "Google Sheet endpoint is not configured yet.");
  assert.equal(status.classList.contains("has-error"), true);
  assert.equal(JSON.parse(storage.get("artizenVillageApplication")).fullName, "Ada Lovelace");
});

test("setupApplicationForm handles failed submission path", async () => {
  let submitHandler;
  const form = {
    dataset: {
      googleSheetEndpoint: "https://script.google.com/macros/s/example/exec"
    },
    addEventListener(eventName, handler) {
      assert.equal(eventName, "submit");
      submitHandler = handler;
    }
  };
  const status = createFakeElement();
  const submitButton = createFakeElement();
  const documentRef = createFakeDocument({ form, status, mailtoLink: submitButton });

  setupApplicationForm({
    documentRef,
    readForm: () => validApplication,
    submitApplication: async () => ({
      ok: false,
      error: "Server rejected submission."
    })
  });
  await submitHandler({
    preventDefault() {}
  });

  assert.equal(submitButton.disabled, false);
  assert.equal(status.textContent, "Server rejected submission.");
  assert.equal(status.classList.contains("has-error"), true);
});

test("setupApplicationForm handles valid submission path", async () => {
  let submitHandler;
  const form = {
    dataset: {
      googleSheetEndpoint: "https://script.google.com/macros/s/example/exec"
    },
    resetCalled: false,
    reset() {
      this.resetCalled = true;
    },
    addEventListener(eventName, handler) {
      assert.equal(eventName, "submit");
      submitHandler = handler;
    }
  };
  const status = createFakeElement();
  const submitButton = createFakeElement();
  const documentRef = createFakeDocument({ form, status, mailtoLink: submitButton });
  const storage = new Map();

  setupApplicationForm({
    documentRef,
    storage: {
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    readForm: () => validApplication,
    submitApplication: async (data, endpoint) => ({
      ok: endpoint.includes("script.google.com"),
      payload: serializeApplicationForSheet(data)
    })
  });
  await submitHandler({
    preventDefault() {}
  });

  assert.equal(form.resetCalled, true);
  assert.equal(submitButton.disabled, false);
  assert.equal(status.textContent, "Application submitted. We will follow up by email.");
  assert.equal(status.classList.contains("has-error"), false);
  assert.equal(JSON.parse(storage.get("artizenVillageApplication")).fullName, "Ada Lovelace");
});
