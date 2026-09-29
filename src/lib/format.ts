let activeLocale = "en-BD";
let activeTimeZone = "Asia/Dhaka";

export function setFormatLocale(locale: string, timeZone = activeTimeZone) {
  activeLocale = locale || "en-BD";
  activeTimeZone = timeZone || "Asia/Dhaka";
}

export function formatPrice(cents: number, currency = "BDT", locale = activeLocale) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
  }
}

export function formatDate(value: string | number | Date, locale = activeLocale, timeZone = activeTimeZone) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(value));
  }
}
