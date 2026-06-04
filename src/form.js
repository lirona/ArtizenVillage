const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_MOTIVATION_LENGTH = 60;
const STORAGE_KEY = "artizenVillageApplication";

export function normalizeApplication(source = {}) {
  const contribution = Array.isArray(source.contribution)
    ? source.contribution
    : String(source.contribution || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    fullName: String(source.fullName || "").trim(),
    email: String(source.email || "").trim(),
    location: String(source.location || "").trim(),
    affiliation: String(source.affiliation || "").trim(),
    project: String(source.project || "").trim(),
    motivation: String(source.motivation || "").trim(),
    dwebPrinciples: String(source.dwebPrinciples || "").trim(),
    contribution,
    arrival: String(source.arrival || "").trim(),
    accommodation: String(source.accommodation || "").trim(),
    website: String(source.website || "").trim()
  };
}

export function validateApplication(source = {}) {
  const data = normalizeApplication(source);
  const errors = {};

  if (!data.fullName) {
    errors.fullName = "Name is required.";
  }

  if (!data.email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(data.email)) {
    errors.email = "Use a valid email address.";
  }

  if (!data.location) {
    errors.location = "Current location is required.";
  }

  if (!data.affiliation) {
    errors.affiliation = "Choose a primary affiliation.";
  }

  if (!data.project) {
    errors.project = "Project or practice is required.";
  }

  if (!data.motivation) {
    errors.motivation = "Motivation is required.";
  } else if (data.motivation.length < MIN_MOTIVATION_LENGTH) {
    errors.motivation = `Add at least ${MIN_MOTIVATION_LENGTH} characters about your motivation.`;
  }

  if (!data.dwebPrinciples) {
    errors.dwebPrinciples = "Tell us which DWeb principles resonate with you.";
  }

  if (data.contribution.length === 0) {
    errors.contribution = "Choose at least one contribution.";
  }

  if (!data.arrival) {
    errors.arrival = "Choose an arrival plan.";
  }

  return {
    data,
    errors,
    valid: Object.keys(errors).length === 0
  };
}

export function buildApplicationSummary(source = {}) {
  const data = normalizeApplication(source);
  const optional = (value) => value || "Not specified";

  return [
    "Artizen Village application",
    "",
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `Current location: ${data.location}`,
    `Primary affiliation: ${data.affiliation}`,
    `Project or practice: ${data.project}`,
    "",
    "Why Artizen Village:",
    data.motivation,
    "",
    "DWeb principles:",
    data.dwebPrinciples,
    "",
    `Contribution: ${data.contribution.join(", ")}`,
    `Arrival plan: ${data.arrival}`,
    `Accommodation: ${optional(data.accommodation)}`,
    `Link: ${optional(data.website)}`
  ].join("\n");
}

export function serializeApplicationForSheet(source = {}) {
  const data = normalizeApplication(source);

  return {
    submittedAt: new Date().toISOString(),
    fullName: data.fullName,
    email: data.email,
    location: data.location,
    affiliation: data.affiliation,
    project: data.project,
    motivation: data.motivation,
    dwebPrinciples: data.dwebPrinciples,
    contribution: data.contribution.join(", "),
    arrival: data.arrival,
    accommodation: data.accommodation,
    website: data.website,
    summary: buildApplicationSummary(data)
  };
}

export async function submitApplicationToGoogleSheet(source = {}, endpoint = "", fetchFn = globalThis.fetch) {
  const trimmedEndpoint = String(endpoint || "").trim();

  if (!trimmedEndpoint) {
    return {
      ok: false,
      error: "Google Sheet endpoint is not configured yet."
    };
  }

  if (typeof fetchFn !== "function") {
    return {
      ok: false,
      error: "Submission is unavailable in this browser."
    };
  }

  const payload = serializeApplicationForSheet(source);
  const body = new URLSearchParams({
    payload: JSON.stringify(payload)
  });

  try {
    await fetchFn(trimmedEndpoint, {
      method: "POST",
      mode: "no-cors",
      body
    });

    return {
      ok: true,
      payload
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Submission failed."
    };
  }
}

export function readApplicationForm(form) {
  const formData = new FormData(form);

  return {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    location: formData.get("location"),
    affiliation: formData.get("affiliation"),
    project: formData.get("project"),
    motivation: formData.get("motivation"),
    dwebPrinciples: formData.get("dwebPrinciples"),
    contribution: formData.getAll("contribution"),
    arrival: formData.get("arrival"),
    accommodation: formData.get("accommodation"),
    website: formData.get("website")
  };
}

export function setupApplicationForm(options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const storage = options.storage || globalThis.localStorage;
  const readForm = options.readForm || readApplicationForm;
  const submitApplication = options.submitApplication || submitApplicationToGoogleSheet;

  const form = documentRef?.querySelector?.("[data-application-form]");
  const status = documentRef?.querySelector?.("[data-application-status]");
  const submitButton = documentRef?.querySelector?.("[data-submit-button]");

  if (!form || !status || !submitButton) {
    return false;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const result = validateApplication(readForm(form));

    if (!result.valid) {
      const errorList = Object.values(result.errors).join(" ");
      status.textContent = errorList;
      status.classList.add("has-error");
      return;
    }

    const endpoint = options.endpoint || form.dataset.googleSheetEndpoint;
    submitButton.disabled = true;
    status.textContent = "Submitting application...";
    status.classList.remove("has-error");

    const submission = await submitApplication(result.data, endpoint);

    submitButton.disabled = false;

    if (!submission.ok) {
      status.textContent = submission.error;
      status.classList.add("has-error");
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(result.data));
      return;
    }

    storage?.setItem?.(STORAGE_KEY, JSON.stringify(submission.payload || result.data));
    form.reset?.();
    status.textContent = "Application submitted. We will follow up by email.";
    status.classList.remove("has-error");
  });

  return true;
}

setupApplicationForm();
