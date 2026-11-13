import { useLocation } from "react-router";

export const LOCATION_PROBE_ID = "test-location";

/** Адрес, на котором стоит приложение: в тестах нет адресной строки браузера. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <output id={LOCATION_PROBE_ID} hidden>
      {location.pathname + location.search}
    </output>
  );
}
