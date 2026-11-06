const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value) {
  const match = ISO_DATE_PATTERN.exec(String(value ?? ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isIsoDate(value) {
  return parseIsoDate(value) !== null;
}

export function formatDisplayDate(value) {
  if (!value) return "";

  const date = parseIsoDate(value);
  if (!date) return String(value);

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function monthsAgoIsoDate(months, from = new Date()) {
  const target = new Date(from.getFullYear(), from.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(from.getDate(), lastDay));
  return toIsoDate(target);
}
