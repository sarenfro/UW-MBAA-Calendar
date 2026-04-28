import { useState } from "react";
import { useListCalendars } from "@workspace/api-client-react";

export function useCalendarFilters() {
  const { data: calendars } = useListCalendars();
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<Set<number>>(new Set());

  const toggleCalendar = (id: number) => {
    setHiddenCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleCalendars = calendars?.filter((c) => !hiddenCalendarIds.has(c.id)) || [];
  const visibleCalendarIds = visibleCalendars.map((c) => c.id);

  return {
    calendars,
    hiddenCalendarIds,
    toggleCalendar,
    visibleCalendarIds,
    visibleCalendarIdsString: visibleCalendarIds.join(","),
  };
}
