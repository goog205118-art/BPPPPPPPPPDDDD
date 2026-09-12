const { createHash } = require("node:crypto");

function text(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return text(value).toLowerCase();
}

function emailsIn(value) {
  return [...new Set(
    String(value || "")
      .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
      ?.map(normalizeEmail) || [],
  )];
}

const CONTACT_ROLES = new Set(["primary", "agent", "business", "cc", "other"]);
const CONTACT_VALIDITY = new Set(["unknown", "valid", "invalid"]);

function personCollection(personType) {
  return text(personType) === "lead" ? "leads" : "creators";
}

function stableLegacyContactId(personType, personId, email) {
  const digest = createHash("sha1")
    .update(`${text(personType)}|${text(personId)}|${normalizeEmail(email)}`, "utf8")
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  return `LEGACY-CONTACT-${digest}`;
}

function normalizeContact(row = {}) {
  const role = CONTACT_ROLES.has(text(row.role)) ? text(row.role) : "other";
  const validity = CONTACT_VALIDITY.has(text(row.validity)) ? text(row.validity) : "unknown";
  return {
    ...row,
    id: text(row.id),
    brand_id: text(row.brand_id),
    brand: text(row.brand),
    person_type: text(row.person_type) === "lead" ? "lead" : "creator",
    person_id: text(row.person_id),
    name: text(row.name || row.person_name),
    email: emailsIn(row.email).join("; "),
    role,
    is_primary: Boolean(row.is_primary === true || ["1", "true", "yes", "是"].includes(text(row.is_primary).toLowerCase())),
    validity,
    unsubscribed: Boolean(row.unsubscribed === true || ["1", "true", "yes", "是"].includes(text(row.unsubscribed).toLowerCase())),
    unsubscribed_at: text(row.unsubscribed_at),
    notes: text(row.notes),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
  };
}

function contactsForPerson(state, personType, personId, brandId = "") {
  const contacts = (Array.isArray(state?.contacts) ? state.contacts : [])
    .map(normalizeContact)
    .filter((contact) =>
      contact.person_type === (text(personType) === "lead" ? "lead" : "creator") &&
      contact.person_id === text(personId) &&
      (!text(brandId) || contact.brand_id === text(brandId)),
    );
  const collection = personCollection(personType);
  const person = (Array.isArray(state?.[collection]) ? state[collection] : [])
    .find((row) => text(row.id) === text(personId));
  const legacyEmails = emailsIn(person?.email);
  const knownEmails = new Set(contacts.flatMap((contact) => emailsIn(contact.email)));
  for (const email of legacyEmails) {
    if (knownEmails.has(email)) continue;
    contacts.push({
      id: stableLegacyContactId(personType, personId, email),
      brand_id: text(person?.brand_id || brandId),
      brand: text(person?.brand),
      person_type: text(personType) === "lead" ? "lead" : "creator",
      person_id: text(personId),
      name: text(person?.name || person?.handle || person?.social_url),
      email,
      role: "primary",
      is_primary: true,
      validity: "unknown",
      unsubscribed: false,
      unsubscribed_at: "",
      notes: "",
      createdAt: text(person?.createdAt),
      updatedAt: text(person?.updatedAt),
      legacy: true,
    });
  }
  return contacts;
}

function personEmailAddresses(state, personType, person, brandId = "") {
  return contactsForPerson(state, personType, person?.id, brandId)
    .flatMap((contact) => emailsIn(contact.email));
}

function contactIdentityForEmail(state, personType, personId, email, brandId = "") {
  const wanted = normalizeEmail(email);
  if (!wanted) return null;
  return contactsForPerson(state, personType, personId, brandId)
    .find((contact) => emailsIn(contact.email).includes(wanted)) || null;
}

function contactEmailSet(state, personType, person, brandId = "") {
  return new Set(personEmailAddresses(state, personType, person, brandId));
}

module.exports = {
  CONTACT_ROLES,
  CONTACT_VALIDITY,
  text,
  normalizeEmail,
  emailsIn,
  normalizeContact,
  contactsForPerson,
  personEmailAddresses,
  contactIdentityForEmail,
  contactEmailSet,
};
