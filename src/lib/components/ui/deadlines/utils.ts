import { m } from "$i18n/messages";

export const deadlineUnits = [
  {
    label: m["components.deadlines.units.minutes"](),
    value: "minutes",
    values: [5, 10, 15, 30, 45],
  },
  {
    label: m["components.deadlines.units.hours"](),
    value: "hours",
    values: [1, 2, 3, 4, 5, 6, 12, 24],
  },
  {
    label: m["components.deadlines.units.days"](),
    value: "days",
    values: [1, 2, 3, 4, 5, 6, 7, 14, 21, 30],
  },
  {
    label: m["components.deadlines.units.weeks"](),
    value: "weeks",
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    label: m["components.deadlines.units.months"](),
    value: "months",
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
];
