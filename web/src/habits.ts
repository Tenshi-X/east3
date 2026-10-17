export const HABIT_TEMPLATES = [
  {
    id: "water",
    name: "Minum air putih",
    description: "Catat setiap gelas yang kamu minum",
    target: 8,
    unit: "ml",
    step: 250,
    color: "#088395",
  },
  {
    id: "read",
    name: "Membaca",
    description: "Luangkan waktu untuk beberapa halaman",
    target: 15,
    unit: "menit",
    step: 5,
    color: "#9b59b6",
  },
  {
    id: "walk",
    name: "Jalan kaki",
    description: "Bergerak sedikit demi sedikit",
    target: 30,
    unit: "menit",
    step: 5,
    color: "#3fb950",
  },
  {
    id: "meditate",
    name: "Meditasi",
    description: "Berhenti sejenak dan tenangkan pikiran",
    target: 5,
    unit: "menit",
    step: 1,
    color: "#088395",
  },
  {
    id: "journal",
    name: "Menulis jurnal",
    description: "Tuliskan satu hal dari harimu",
    target: 1,
    unit: "kali",
    step: 1,
    color: "#f39c12",
  },
  {
    id: "sleep",
    name: "Tidur teratur",
    description: "Checklist saat rutinitas tidur terpenuhi",
    target: 1,
    unit: "kali",
    step: 1,
    color: "#9b59b6",
  },
];

export const habitTarget = (h: any) =>
  Number(h.target_value) > 0 ? Number(h.target_value) : 1;
export const habitStep = (h: any) =>
  Number(h.step_value) > 0 ? Number(h.step_value) : 1;
export const habitDone = (h: any, log: any) =>
  log?.value != null
    ? Number(log.value) >= habitTarget(h)
    : Boolean(log?.is_completed);
const number = (value: number) =>
  value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export const isWater = (h: any) => h.settings?.template === "water";
export function habitProgressText(h: any, value: number) {
  const target = habitTarget(h);
  if (isWater(h)) {
    const glass =
      Number(h.settings.glass_ml) > 0 ? Number(h.settings.glass_ml) : 250;
    return h.settings.display_unit === "liters"
      ? `${number(value / 1000)} / ${number(target / 1000)} liter · ${number(value / glass)} gelas`
      : `${number(value / glass)} / ${number(target / glass)} gelas · ${number(value / 1000)} liter`;
  }
  return `${number(value)} / ${number(target)} ${h.unit === "times" || !h.unit ? "kali" : h.unit}`;
}
export function habitStepText(h: any) {
  if (isWater(h)) return `1 gelas (${number(habitStep(h))} ml)`;
  return `${number(habitStep(h))} ${h.unit === "times" || !h.unit ? "kali" : h.unit}`;
}

// This is a starting estimate for adults, not a prescription or a hydration diagnosis.
// https://rightdecisions.scot.nhs.uk/media/l5cbmhjn/hydration-poster.pdf
export function waterEstimate(weight: number) {
  // Keep the app's initial suggestion within 1.5–3 L; users can set their own target.
  return Math.min(3000, Math.max(1500, Math.round((weight * 30) / 100) * 100));
}
