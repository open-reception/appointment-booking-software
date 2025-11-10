import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { ROUTES } from "$lib/const/routes";
import type { TCalendar, TCalendarItem } from "$lib/types/calendar";
import { toCalendarDateTime, toZoned, type CalendarDate } from "@internationalized/date";

export const fetchCalendar = async (opts: { tenant: string; startDate: CalendarDate }) => {
  if (!browser) return;

  const params = new URLSearchParams({
    startDate: toZoned(opts.startDate, "UTC").toAbsoluteString(),
    endDate: toZoned(
      toCalendarDateTime(opts.startDate).set({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      }),
      "UTC",
    ).toAbsoluteString(),
  });
  const res = await fetch(`/api/tenants/${opts.tenant}/calendar?${params}`, {
    method: "GET",
  });

  if (res.status < 400) {
    try {
      const data = await res.json();
      return data as TCalendar;
    } catch (error) {
      console.error("Unable to parse calendar response", error);
    }
  } else {
    if (res.status === 401) {
      goto(ROUTES.LOGIN);
    } else {
      console.error("Unable to fetch calendar", res.status, res.statusText);
    }
  }
};

// Convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function positionItems(items: TCalendarItem[] | undefined) {
  if (!items) return [];

  // Sort items by start time
  const sortedItems = [...items].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Calculate layout positions
  const processedItems = sortedItems.map((item) => {
    const startMinutes = timeToMinutes(item.start);
    const endMinutes = startMinutes + item.duration;

    return {
      ...item,
      startMinutes,
      endMinutes,
      totalColumns: 1,
    };
  });

  // Find overlapping groups and assign columns
  for (let i = 0; i < processedItems.length; i++) {
    const currentItem = processedItems[i];
    const overlappingItems = [currentItem];

    // Find all items that overlap with current item's time range
    for (let j = i + 1; j < processedItems.length; j++) {
      const nextItem = processedItems[j];

      // Check if items overlap
      if (nextItem.startMinutes < currentItem.endMinutes) {
        overlappingItems.push(nextItem);
      } else {
        break;
      }
    }

    // Assign columns to overlapping items
    if (overlappingItems.length > 1) {
      const columns: number[] = [];

      overlappingItems.forEach((item) => {
        // Find the first available column
        let column = 0;
        while (columns[column] && columns[column] > item.startMinutes) {
          column++;
        }

        // Don't change columns back
        if (item.column !== undefined && item.column > column) {
          column = item.column;
        }

        item.column = column;
        item.totalColumns = Math.max(item.totalColumns, column + 1);
        columns[column] = item.endMinutes;
      });

      // Update totalColumns for all overlapping items
      const maxColumns = Math.max(...overlappingItems.map((item) => item.column)) + 1;
      overlappingItems.forEach((item) => {
        item.totalColumns = maxColumns;
      });
    }
  }

  return processedItems;
}
